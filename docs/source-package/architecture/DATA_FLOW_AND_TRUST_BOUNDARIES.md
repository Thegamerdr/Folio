# Data Flow and Trust Boundaries

```text
[User / selected files / optional bank provider]
                    |
                    v
      [staging + provenance on device]
                    |
             user review/command
                    |
                    v
      [encrypted authoritative SQLite]
       |       |        |        |
       v       v        v        v
    events  forecast  search   calendar
       \       |        |       /
        \      v        v      /
          [Today + Melo + views]
                    |
      optional encrypted/limited routes
        /             |               \
[cloud vault]    [AI gateway]    [bank adapter]
opaque blobs     minimal context    regulated token
```

## Trust boundaries

1. **Device vault boundary** — decrypted financial content exists only while the local vault is unlocked.
2. **Native key boundary** — root wrapping key is held by Keychain/Keystore, not JavaScript storage.
3. **Cloud vault boundary** — server stores ciphertext and minimum routing metadata.
4. **AI boundary** — receives a typed, minimised task, never vault access.
5. **Open Banking boundary** — regulated provider tokens stay in the secure backend adapter; canonical rows are staged locally.
6. **Workspace boundary** — personal and each business workspace have explicit scope and separate subkeys.
7. **Document boundary** — file content is untrusted evidence, not executable/model instruction.

## Write authority

Only the local command handler can commit domain changes. Sync, imports and Melo all submit commands/proposals through the same invariants.
