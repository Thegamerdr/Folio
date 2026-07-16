package expo.modules.foliolocallanguage

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * Narrow on-device language bridge. It deliberately has no URL, HTTP, analytics or provider API.
 * The model must already be inside Melo's private storage and match the signed release manifest
 * hash before LiteRT-LM can execute it.
 */
class FolioLocalLanguageModule : Module() {
  private val engineLock = Any()
  private var languageRuntime: LiteRtLmBridge? = null
  private var activeModelSha256: String? = null
  private var activeModelBytes: Long? = null

  override fun definition() = ModuleDefinition {
    Name("FolioLocalLanguage")

    Function("getStatus") {
      synchronized(engineLock) {
        status()
      }
    }

    AsyncFunction("verifyModel") { modelUri: String, expectedSha256: String, minimumBytes: Double ->
      synchronized(engineLock) {
        when (val validation = validateModel(modelUri, expectedSha256, minimumBytes.toLong())) {
          is ModelValidation.Valid -> mapOf(
            "kind" to "valid",
            "modelSha256" to validation.sha256,
            "modelBytes" to validation.bytes.toDouble(),
          )
          is ModelValidation.Invalid -> invalidModel(validation.message)
        }
      }
    }

    AsyncFunction("initializeModel") { modelUri: String, expectedSha256: String, minimumBytes: Double ->
      synchronized(engineLock) {
        initialize(modelUri, expectedSha256, minimumBytes.toLong())
      }
    }

    AsyncFunction("complete") { systemInstruction: String, prompt: String ->
      synchronized(engineLock) {
        complete(systemInstruction, prompt)
      }
    }

    AsyncFunction("closeModel") {
      synchronized(engineLock) {
        closeEngine()
      }
    }
  }

  private fun status(): Map<String, Any> {
    val result = mutableMapOf<String, Any>(
      "available" to true,
      "initialized" to (languageRuntime != null),
    )
    activeModelSha256?.let { result["modelSha256"] = it }
    activeModelBytes?.let { result["modelBytes"] = it.toDouble() }
    return result
  }

  private fun initialize(
    modelUri: String,
    expectedSha256Raw: String,
    minimumBytes: Long,
  ): Map<String, Any> {
    val validation = validateModel(modelUri, expectedSha256Raw, minimumBytes)
    if (validation is ModelValidation.Invalid) return invalidModel(validation.message)
    validation as ModelValidation.Valid
    val file = validation.file
    val byteCount = validation.bytes
    val actualSha256 = validation.sha256

    return try {
      closeEngine()
      val context = appContext.reactContext
        ?: return error("Android application context is unavailable.")
      val candidate = LiteRtLmBridge()
      try {
        candidate.initialize(file.absolutePath, context.cacheDir.absolutePath)
      } catch (reason: Throwable) {
        candidate.close()
        throw reason
      }
      languageRuntime = candidate
      activeModelSha256 = actualSha256
      activeModelBytes = byteCount
      mapOf(
        "kind" to "ready",
        "modelSha256" to actualSha256,
        "modelBytes" to byteCount.toDouble(),
      )
    } catch (_: Throwable) {
      closeEngine()
      error("The local language model could not be initialized on this device.")
    }
  }

  private fun validateModel(
    modelUri: String,
    expectedSha256Raw: String,
    minimumBytes: Long,
  ): ModelValidation {
    val expectedSha256 = expectedSha256Raw.trim().lowercase()
    if (!SHA256.matches(expectedSha256) || minimumBytes < MINIMUM_MODEL_BYTES) {
      return ModelValidation.Invalid("The model manifest is invalid.")
    }
    val file = privateModelFile(modelUri)
      ?: return ModelValidation.Invalid("The model must be stored in Melo's private app storage.")
    if (!file.isFile || !file.name.lowercase().endsWith(".litertlm")) {
      return ModelValidation.Invalid("The local model file is missing or has the wrong format.")
    }
    val byteCount = file.length()
    if (byteCount < minimumBytes) {
      return ModelValidation.Invalid("The local model file is incomplete.")
    }
    val actualSha256 = sha256(file)
    if (actualSha256 != expectedSha256) {
      return ModelValidation.Invalid("The local model signature does not match this Melo release.")
    }
    return ModelValidation.Valid(file, actualSha256, byteCount)
  }

  private fun complete(systemInstructionRaw: String, promptRaw: String): Map<String, Any> {
    val current = languageRuntime
      ?: return mapOf("kind" to "not-ready", "message" to "The local language model is not ready.")
    val systemInstruction = systemInstructionRaw.trim()
    val prompt = promptRaw.trim()
    if (systemInstruction.isEmpty() || prompt.isEmpty()) {
      return error("The local language request is empty.")
    }
    if (systemInstruction.length > MAX_SYSTEM_CHARS || prompt.length > MAX_PROMPT_CHARS) {
      return error("The local language request is too large for the bounded Companion context.")
    }

    return try {
      val text = current.complete(systemInstruction, prompt).trim()
      if (text.isEmpty()) error("The local language model returned no text.")
      else mapOf("kind" to "ok", "text" to text)
    } catch (_: Throwable) {
      error("The local language model could not complete this turn.")
    }
  }

  private fun privateModelFile(modelUri: String): File? {
    val context = appContext.reactContext ?: return null
    val parsed = Uri.parse(modelUri)
    val candidatePath = when (parsed.scheme?.lowercase()) {
      null, "" -> modelUri
      "file" -> parsed.path
      else -> null
    } ?: return null
    val candidate = try {
      File(candidatePath).canonicalFile
    } catch (_: Throwable) {
      return null
    }
    val roots = listOf(context.filesDir, context.noBackupFilesDir, context.cacheDir).mapNotNull {
      try { it.canonicalFile } catch (_: Throwable) { null }
    }
    return candidate.takeIf { file ->
      roots.any { root -> file.path == root.path || file.path.startsWith(root.path + File.separator) }
    }
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { input ->
      val buffer = ByteArray(1024 * 1024)
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        if (read > 0) digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
  }

  private fun closeEngine() {
    try {
      languageRuntime?.close()
    } catch (_: Throwable) {
      // Cleanup is best-effort; status is cleared either way so a dead engine cannot be reused.
    }
    languageRuntime = null
    activeModelSha256 = null
    activeModelBytes = null
  }

  private fun invalidModel(message: String): Map<String, Any> =
    mapOf("kind" to "invalid-model", "message" to message)

  private fun error(message: String): Map<String, Any> = mapOf("kind" to "error", "message" to message)

  companion object {
    private val SHA256 = Regex("^[a-f0-9]{64}$")
    private const val MINIMUM_MODEL_BYTES = 50L * 1024L * 1024L
    private const val MAX_SYSTEM_CHARS = 12_000
    private const val MAX_PROMPT_CHARS = 24_000
  }

  private sealed interface ModelValidation {
    data class Valid(val file: File, val sha256: String, val bytes: Long) : ModelValidation
    data class Invalid(val message: String) : ModelValidation
  }
}
