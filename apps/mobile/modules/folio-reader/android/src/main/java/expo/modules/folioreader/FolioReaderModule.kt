package expo.modules.folioreader

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.abs

/**
 * On-device statement reader.
 *
 * - Images / screenshots / camera photos: Google ML Kit on-device Text Recognition (bundled Latin
 *   model — fully offline).
 * - PDFs: Android's framework PdfRenderer rasterises each page to a bitmap, then the same ML Kit
 *   recogniser reads it. PdfRenderer alone cannot pull a PDF's selectable text layer, so we OCR the
 *   rendered page — this works for BOTH digital and scanned PDFs without a third-party PDF library.
 *
 * Nothing leaves the device. The function never throws across the bridge: any failure resolves to
 * { text: "", source: "none" }, and the JS layer falls back to the manual-from-file workbench.
 */
class FolioReaderModule : Module() {
  private val recognizer: TextRecognizer by lazy {
    // Default on-device Latin recognizer (bundled model, offline).
    TextRecognition.getClient(TextRecognizerOptions.Builder().build())
  }

  override fun definition() = ModuleDefinition {
    Name("FolioReader")

    // Runs on a background module queue, so blocking on the ML Kit task here is safe.
    AsyncFunction("extractText") { uri: String, mimeType: String ->
      extract(uri, mimeType)
    }
  }

  private val context: Context?
    get() = appContext.reactContext

  private fun extract(uriString: String, mimeType: String): Map<String, Any> {
    val ctx = context ?: return none()
    return try {
      val uri = Uri.parse(uriString)
      val lower = uriString.lowercase()
      val isPdf = mimeType.contains("pdf") || lower.endsWith(".pdf")
      val text = if (isPdf) ocrPdf(ctx, uri) else ocrImage(ctx, uri)
      when {
        text.isBlank() -> none()
        isPdf -> result(text, "pdf-text")
        else -> result(text, "ocr-image")
      }
    } catch (e: Throwable) {
      none()
    }
  }

  private fun ocrImage(ctx: Context, uri: Uri): String {
    return recognize(InputImage.fromFilePath(ctx, uri))
  }

  // Run OCR and rebuild rows from element bounding boxes. Bank statements are columnar (date …
  // description … amount, separated by wide gaps), and ML Kit groups text by spatial blocks — so
  // its raw `.text` splits each transaction across several "lines". Grouping the recognised words
  // by vertical position (then ordering each row left-to-right) reconstructs one line per
  // transaction, which is what the statement parser expects.
  private fun recognize(image: InputImage): String {
    val visionText = Tasks.await(recognizer.process(image))
    return reconstructRows(visionText)
  }

  private fun reconstructRows(visionText: Text): String {
    val words = ArrayList<Pair<Rect, String>>()
    for (block in visionText.textBlocks) {
      for (line in block.lines) {
        for (element in line.elements) {
          val box = element.boundingBox ?: continue
          if (element.text.isNotBlank()) {
            words.add(box to element.text)
          }
        }
      }
    }
    if (words.isEmpty()) return ""

    words.sortBy { it.first.centerY() }
    val heights = words.map { it.first.height() }.sorted()
    val medianHeight = heights[heights.size / 2]
    val rowThreshold = (medianHeight * 0.6).toInt().coerceAtLeast(8)

    val rows = ArrayList<ArrayList<Pair<Rect, String>>>()
    for (word in words) {
      val current = rows.lastOrNull()
      if (current != null && abs(word.first.centerY() - current.last().first.centerY()) <= rowThreshold) {
        current.add(word)
      } else {
        rows.add(arrayListOf(word))
      }
    }

    return rows.joinToString("\n") { row ->
      row.sortedBy { it.first.left }.joinToString(" ") { it.second }
    }
  }

  private fun ocrPdf(ctx: Context, uri: Uri): String {
    val descriptor: ParcelFileDescriptor =
      ctx.contentResolver.openFileDescriptor(uri, "r") ?: return ""
    descriptor.use { pfd ->
      val renderer = PdfRenderer(pfd)
      try {
        val builder = StringBuilder()
        // Cap pages so a huge statement can't hang the device; most statements are a few pages.
        val pageCount = minOf(renderer.pageCount, MAX_PDF_PAGES)
        for (index in 0 until pageCount) {
          val page = renderer.openPage(index)
          // Render at 2x for legible OCR without exhausting memory on large pages.
          val width = (page.width * PDF_RENDER_SCALE).coerceAtMost(MAX_BITMAP_DIMEN)
          val height = (page.height * PDF_RENDER_SCALE).coerceAtMost(MAX_BITMAP_DIMEN)
          val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
          bitmap.eraseColor(Color.WHITE)
          page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
          page.close()
          val pageText = recognize(InputImage.fromBitmap(bitmap, 0))
          if (pageText.isNotBlank()) {
            builder.append(pageText).append('\n')
          }
          bitmap.recycle()
        }
        return builder.toString()
      } finally {
        renderer.close()
      }
    }
  }

  private fun result(text: String, source: String): Map<String, Any> =
    mapOf("text" to text, "source" to source)

  private fun none(): Map<String, Any> = mapOf("text" to "", "source" to "none")

  companion object {
    private const val MAX_PDF_PAGES = 15
    // Render PDF pages at 3x so small statement type stays legible to the OCR pass.
    private const val PDF_RENDER_SCALE = 3
    private const val MAX_BITMAP_DIMEN = 4000
  }
}
