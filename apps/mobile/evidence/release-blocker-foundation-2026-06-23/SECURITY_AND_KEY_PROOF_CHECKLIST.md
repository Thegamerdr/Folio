# Security And Key Proof Checklist

Canonical source: `SECURITY_AND_KEY_PROOF_CHECKLIST.md`.

Evidence summary:

- Current storage uses local SQLite/SQLCipher through `nativeLedgerStore.ts`.
- Local keys are generated with `expo-crypto` and stored with `expo-secure-store` when available.
- SecureStore unavailable fallback is memory-only.
- Dogfood diagnostics are redacted and local-only.
- User data export and diagnostic export remain separate.
- Manual review is still required for physical Android key behavior, SQLCipher proof, logs, app lock and iOS keychain behavior.
