package expo.modules.foliolocalvault

import android.content.Context
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest

/**
 * Minimal private-files bridge for corrupt SQLCipher recovery.
 *
 * Expo's public filesystem bridge deliberately scopes writes to files/cache and cannot rename a
 * file from Android's private databases directory. This module accepts only Melo's opaque,
 * hash-derived database filename. It copies and SHA-256 verifies every live family member before
 * deleting any of them, so a failed quarantine always leaves at least one byte-identical copy.
 */
class FolioLocalVaultModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FolioLocalVault")

    AsyncFunction("quarantineDatabaseFamily") { databaseName: String ->
      quarantineDatabaseFamily(requireContext(), requireDatabaseName(databaseName))
    }

    AsyncFunction("clearQuarantinedDatabaseFamily") { databaseName: String ->
      clearQuarantinedDatabaseFamily(requireContext(), requireDatabaseName(databaseName))
    }
  }

  private fun requireContext(): Context =
    appContext.reactContext ?: throw IllegalStateException("Android application context unavailable.")

  private fun requireDatabaseName(value: String): String {
    if (!DATABASE_NAME.matches(value)) {
      throw IllegalArgumentException("Unrecognised private SQLCipher database name.")
    }
    return value
  }

  private fun quarantineDatabaseFamily(ctx: Context, databaseName: String): Map<String, Any> {
    val liveMain = ctx.getDatabasePath(databaseName)
    val parkedMain = File(ctx.filesDir, "$databaseName.unreadable")
    val members = listOf(
      FamilyMember(liveMain, parkedMain),
      FamilyMember(File("${liveMain.path}-wal"), File("${parkedMain.path}-wal")),
      FamilyMember(File("${liveMain.path}-shm"), File("${parkedMain.path}-shm")),
    )

    // Phase 1: establish a byte-identical parked copy for every live member. Never remove a live
    // member in this phase. A retry preserves an already-parked member whose live source was
    // removed by an interrupted earlier attempt.
    for (member in members) {
      if (!member.live.exists()) continue
      val copying = File("${member.parked.path}.copying")
      if (copying.exists() && !copying.delete()) {
        throw IllegalStateException("Could not clear an incomplete local-vault quarantine copy.")
      }
      member.live.copyTo(copying, overwrite = true)
      if (!sameBytes(member.live, copying)) {
        copying.delete()
        throw IllegalStateException("Local-vault quarantine copy verification failed.")
      }
      if (member.parked.exists() && !member.parked.delete()) {
        throw IllegalStateException("Could not replace the previous local-vault quarantine copy.")
      }
      if (!copying.renameTo(member.parked) || !sameBytes(member.live, member.parked)) {
        throw IllegalStateException("Could not commit a verified local-vault quarantine copy.")
      }
    }

    val preserved = members.filter { it.parked.exists() }
    if (members.any { it.live.exists() && !it.parked.exists() }) {
      throw IllegalStateException("A live SQLCipher family member was not preserved.")
    }

    // Phase 2: only after every existing source has a verified copy may the live family be removed.
    // Direct private-file deletion avoids reopening the corrupt SQLite handle.
    for (member in members) {
      if (member.live.exists() && !member.live.delete()) {
        throw IllegalStateException("Could not remove a verified corrupt SQLCipher family member.")
      }
    }
    if (members.any { it.live.exists() }) {
      throw IllegalStateException("The corrupt SQLCipher family is still live.")
    }

    return mapOf(
      "moved" to preserved.map { Uri.fromFile(it.parked).toString() },
      "parkedMainUri" to Uri.fromFile(parkedMain).toString(),
    )
  }

  private fun clearQuarantinedDatabaseFamily(ctx: Context, databaseName: String) {
    val parkedMain = File(ctx.filesDir, "$databaseName.unreadable")
    val candidates = listOf(
      parkedMain,
      File("${parkedMain.path}-wal"),
      File("${parkedMain.path}-shm"),
      File("${parkedMain.path}.copying"),
      File("${parkedMain.path}-wal.copying"),
      File("${parkedMain.path}-shm.copying"),
    )
    for (candidate in candidates) {
      if (candidate.exists() && !candidate.delete()) {
        throw IllegalStateException("Could not clear a quarantined private database member.")
      }
    }
  }

  private fun sameBytes(left: File, right: File): Boolean =
    left.length() == right.length() && digest(left).contentEquals(digest(right))

  private fun digest(file: File): ByteArray {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered().use { input ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        if (count > 0) digest.update(buffer, 0, count)
      }
    }
    return digest.digest()
  }

  private data class FamilyMember(val live: File, val parked: File)

  companion object {
    private val DATABASE_NAME =
      Regex("^melo\\.workspace\\.[a-f0-9]{64}\\.ledger\\.v1\\.sqlite$")
  }
}
