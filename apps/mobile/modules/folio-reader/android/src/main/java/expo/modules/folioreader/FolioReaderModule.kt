package expo.modules.folioreader

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Point
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
      val extraction = if (isPdf) ocrPdf(ctx, uri) else ocrImage(ctx, uri)
      when {
        extraction.text.isBlank() -> none()
        isPdf -> result(extraction, "pdf-text")
        else -> result(extraction, "ocr-image")
      }
    } catch (e: Throwable) {
      none()
    }
  }

  private fun ocrImage(ctx: Context, uri: Uri): Extraction {
    val image = InputImage.fromFilePath(ctx, uri)
    val page = recognize(image, 0)
    return Extraction(page.text, 1, 1, listOf(page))
  }

  // Run OCR and rebuild rows from element bounding boxes. Bank statements are columnar (date …
  // description … amount, separated by wide gaps), and ML Kit groups text by spatial blocks — so
  // its raw `.text` splits each transaction across several "lines". Grouping the recognised words
  // by vertical position (then ordering each row left-to-right) reconstructs one line per
  // transaction, which is what the statement parser expects.
  private fun recognize(image: InputImage, pageIndex: Int): RecognizedPage {
    val visionText = Tasks.await(recognizer.process(image))
    return RecognizedPage(
      text = reconstructRows(visionText),
      pageIndex = pageIndex,
      width = image.width,
      height = image.height,
      lines = visionText.textBlocks.flatMap { block ->
        block.lines.map { line -> serializeLine(line) }
      },
    )
  }

  /**
   * Keep the evidence ML Kit actually saw. The prior bridge flattened every page to text and threw
   * away coordinates, language and confidence before the local parser ran. Those fields are what a
   * layout-aware statement/receipt reader needs to distinguish amount, debit, credit and balance
   * columns without guessing from word order.
   */
  private fun serializeLine(line: Text.Line): Map<String, Any> {
    val output = mutableMapOf<String, Any>(
      "text" to line.text,
      "confidence" to line.confidence,
      "elements" to line.elements.map { element -> serializeElement(element) },
    )
    line.boundingBox?.let { output["boundingBox"] = serializeRect(it) }
    line.cornerPoints?.let { output["cornerPoints"] = it.map(::serializePoint) }
    if (line.recognizedLanguage.isNotBlank()) {
      output["recognizedLanguage"] = line.recognizedLanguage
    }
    return output
  }

  private fun serializeElement(element: Text.Element): Map<String, Any> {
    val output = mutableMapOf<String, Any>(
      "text" to element.text,
      "confidence" to element.confidence,
    )
    element.boundingBox?.let { output["boundingBox"] = serializeRect(it) }
    element.cornerPoints?.let { output["cornerPoints"] = it.map(::serializePoint) }
    if (element.recognizedLanguage.isNotBlank()) {
      output["recognizedLanguage"] = element.recognizedLanguage
    }
    return output
  }

  private fun serializeRect(rect: Rect): Map<String, Int> = mapOf(
    "left" to rect.left,
    "top" to rect.top,
    "right" to rect.right,
    "bottom" to rect.bottom,
  )

  private fun serializePoint(point: Point): Map<String, Int> = mapOf(
    "x" to point.x,
    "y" to point.y,
  )

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

    val directionalColumns = findDirectionalColumns(rows)
    return rows.mapIndexed { index, row ->
      val ordered = row.sortedBy { it.first.left }
      ordered.joinToString(" ") { word ->
        if (directionalColumns != null && index > directionalColumns.headerRowIndex) {
          signAmountFromColumn(word, directionalColumns)
        } else {
          word.second
        }
      }
    }.joinToString("\n")
  }

  /**
   * OCR gives us words plus their page coordinates, but the JS bridge carries plain text. Preserve
   * the meaning of split debit / credit columns before those coordinates are lost. A bare unsigned
   * amount under "Money out" / "Debit" must become negative; an amount under "Money in" /
   * "Credit" becomes explicitly positive. Running balances are left untouched.
   *
   * Column starts, rather than header centres, are used because statement amounts are usually
   * right-aligned and can sit closer to the next header's label than their own.
   */
  private fun findDirectionalColumns(
    rows: List<ArrayList<Pair<Rect, String>>>,
  ): DirectionalColumns? {
    rows.forEachIndexed { index, row ->
      val ordered = row.sortedBy { it.first.left }
      val debitStart = findPhraseStart(
        ordered,
        listOf(
          listOf("money", "out"),
          listOf("paid", "out"),
          listOf("debit"),
          listOf("debits"),
          listOf("withdrawal"),
          listOf("withdrawals"),
          listOf("outgoing"),
        ),
      )
      val creditStart = findPhraseStart(
        ordered,
        listOf(
          listOf("money", "in"),
          listOf("paid", "in"),
          listOf("credit"),
          listOf("credits"),
          listOf("deposit"),
          listOf("deposits"),
          listOf("incoming"),
        ),
      )
      val balanceStart = findPhraseStart(
        ordered,
        listOf(listOf("balance"), listOf("running", "balance")),
      )

      // We only infer a direction when a debit column is present and at least one neighbouring
      // money column gives it a safe right boundary. Otherwise an unsigned amount remains review
      // only instead of being guessed negative.
      if (debitStart != null && (creditStart != null || balanceStart != null)) {
        return DirectionalColumns(index, debitStart, creditStart, balanceStart)
      }
    }
    return null
  }

  private fun findPhraseStart(
    words: List<Pair<Rect, String>>,
    phrases: List<List<String>>,
  ): Int? {
    val normalized = words.map { normalizeHeaderWord(it.second) }
    for (phrase in phrases) {
      if (phrase.isEmpty() || phrase.size > normalized.size) continue
      for (start in 0..normalized.size - phrase.size) {
        if (normalized.subList(start, start + phrase.size) == phrase) {
          return words[start].first.left
        }
      }
    }
    return null
  }

  private fun normalizeHeaderWord(value: String): String =
    value.lowercase().replace(Regex("[^a-z]"), "")

  private fun signAmountFromColumn(
    word: Pair<Rect, String>,
    columns: DirectionalColumns,
  ): String {
    val text = word.second
    if (!UNSIGNED_MONEY_TOKEN.matches(text)) return text
    val x = word.first.centerX()
    val column = listOfNotNull(
      columns.debitStart?.let { ColumnStart(it, MoneyColumn.DEBIT) },
      columns.creditStart?.let { ColumnStart(it, MoneyColumn.CREDIT) },
      columns.balanceStart?.let { ColumnStart(it, MoneyColumn.BALANCE) },
    )
      .filter { x >= it.start }
      .maxByOrNull { it.start }
      ?.column

    return when (column) {
      MoneyColumn.DEBIT -> "-$text"
      MoneyColumn.CREDIT -> "+$text"
      MoneyColumn.BALANCE, null -> text
    }
  }

  private fun ocrPdf(ctx: Context, uri: Uri): Extraction {
    val descriptor: ParcelFileDescriptor =
      ctx.contentResolver.openFileDescriptor(uri, "r") ?: return Extraction("", 0, 0, emptyList())
    descriptor.use { pfd ->
      val renderer = PdfRenderer(pfd)
      try {
        val builder = StringBuilder()
        val recognizedPages = ArrayList<RecognizedPage>()
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
          val recognizedPage = recognize(InputImage.fromBitmap(bitmap, 0), index)
          recognizedPages.add(recognizedPage)
          if (recognizedPage.text.isNotBlank()) {
            builder.append(recognizedPage.text).append('\n')
          }
          bitmap.recycle()
        }
        return Extraction(builder.toString(), pageCount, renderer.pageCount, recognizedPages)
      } finally {
        renderer.close()
      }
    }
  }

  private fun result(extraction: Extraction, source: String): Map<String, Any> =
    mapOf(
      "text" to extraction.text,
      "source" to source,
      "pages" to extraction.pages,
      "totalPages" to extraction.totalPages,
      "truncated" to (extraction.pages < extraction.totalPages),
      "layout" to extraction.layout.map { page ->
        mapOf(
          "pageIndex" to page.pageIndex,
          "width" to page.width,
          "height" to page.height,
          "text" to page.text,
          "lines" to page.lines,
        )
      },
    )

  private fun none(): Map<String, Any> = mapOf("text" to "", "source" to "none")

  private data class Extraction(
    val text: String,
    val pages: Int,
    val totalPages: Int,
    val layout: List<RecognizedPage>,
  )

  private data class RecognizedPage(
    val text: String,
    val pageIndex: Int,
    val width: Int,
    val height: Int,
    val lines: List<Map<String, Any>>,
  )

  private data class DirectionalColumns(
    val headerRowIndex: Int,
    val debitStart: Int?,
    val creditStart: Int?,
    val balanceStart: Int?,
  )

  private data class ColumnStart(val start: Int, val column: MoneyColumn)

  private enum class MoneyColumn { DEBIT, CREDIT, BALANCE }

  companion object {
    private val UNSIGNED_MONEY_TOKEN = Regex(
      "^(?:GBP|USD|EUR)?[\\p{Sc}]?\\d+(?:,\\d{3})*(?:\\.\\d{2})$",
      RegexOption.IGNORE_CASE,
    )
    private const val MAX_PDF_PAGES = 15
    // Render PDF pages at 3x so small statement type stays legible to the OCR pass.
    private const val PDF_RENDER_SCALE = 3
    private const val MAX_BITMAP_DIMEN = 4000
  }
}
