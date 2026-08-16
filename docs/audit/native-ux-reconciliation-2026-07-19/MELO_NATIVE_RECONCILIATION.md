# Melo native reconciliation — current working record

Date: 2026-07-19

Native target: `C:\dev\melo-native-ux`

Design authority: `C:\dev\folio-melo-lovable-main`

Native branch: `codex/melo-native-ux`

## Corrected verdict

This is a port and reconciliation pass over the existing React Native product. It is not a rebuild
from the Lovable prototype. The native app remains authoritative for real persistence, encrypted
workspace boundaries, local readers, Review-before-ledger truth, Open Banking adapters, Business
engines and device features. Lovable is authoritative for the current frozen UI, information
architecture, copy and interaction design.

The earlier version of this report incorrectly treated an older Addendum decision as authority for a
four-tab Personal bar. That was stale. The current freeze in `docs/HANDOFF_FINAL.md`, the rework
documents and the current Lovable source supersede it:

- Personal uses **Today · raised Talk to Melo · More**.
- Review and Workspace live inside Personal More.
- Melo remains a main function and the most visually prominent action; it was not removed.
- Business retains its operational **Today · Review · Melo · More** bar.
- Business retains the persistent workspace rail because it is operational context, not Personal
  showcase chrome.
- No sample balance, transaction, statement or Business record is seeded into native runtime.

## Authority read order used

1. `docs/HANDOFF_FINAL.md`
2. root `HANDOFF.md` section 0
3. `docs/HANDOFF_REWORK.md`
4. `docs/HANDOFF_ADDENDUM.md`
5. `docs/HANDOFF_RATIONALE.md`
6. `docs/AUDIT_FINAL.md`
7. Feature specifications referenced by those documents
8. Current Lovable source for the rendered frozen result

Where an older document conflicts with `HANDOFF_FINAL.md` or the later refrozen source, the later
freeze wins. Native-only functionality is retained behind that design instead of being deleted.

## What was ported in this pass

| Area              | Native result                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal shell    | Current 3-slot IA: Today, raised Talk to Melo, More                                                                                               |
| Personal More     | Current Lovable hierarchy and order, with real Review and Workspace destinations                                                                  |
| Melo surface      | Current hero, talk controls, Money Weather/lens state, plumage, memory, companion touches, Quiet Mode and rituals                                 |
| Melo wardrobe     | Full sprite variants for scarf, crown and headphones; no composited triangle overlays                                                             |
| Melo memory       | Persisted editable/deletable thread, per-line forget, Undo and two-step clear-all                                                                 |
| Companion touches | Current refrozen sheet, unlock copy and wear state                                                                                                |
| First meeting     | Four persisted primer beats from the Melo presence specification                                                                                  |
| Returning user    | Real recap gated by an actual 21+ day gap and actual closed-cycle activity                                                                        |
| One Move history  | Persisted rolling 50-move history, shown/tapped/dismissed states and seven-day held/bent/lifted outcomes                                          |
| Melo presence     | Lovable's `poseForContext` authority is wired across Today, Insights, Recovery, Shortfall, Ritual, Business and the Melo hub                      |
| Account           | Current Personal hierarchy while keeping real statement, cadence, other-income, bank, sign-in, backup, app-lock, privacy, export and wipe actions |
| Start             | Current Melo identity and locked companion line; no sample-data shortcut                                                                          |
| Chat sheet        | Fixed header/transcript/composer layout when the Android keyboard is open                                                                         |
| Android safe area | Long scrollers are masked beneath the transparent status bar without changing Lovable composition                                                 |
| Business          | Existing real Business Today, Review, Melo, More and workspace switching preserved                                                                |
| State authority   | Memory, primer and One Move records are included in canonical projection/recovery                                                                 |
| Sample data       | Runtime remains empty until the user enters or confirms real data; the check-in and chart-style preview no longer invent currency values          |

## What was deliberately not replaced

- Encrypted local persistence and canonical recovery.
- Personal/Business record and key isolation.
- PDF, image, receipt, CSV, text and paste readers.
- The Review gate before reader candidates become financial truth.
- Existing Open Banking provider boundary.
- Business tax, filing preparation, invoice, client, deduction and planning engines.
- Local companion/tool execution and validated financial mutations.
- App lock, notifications, widget and Android device integrations.

These are product capabilities absent from the Lovable design source. Porting the UI did not grant
permission to remove or simulate them.

## Android evidence

Tested targets:

- Physical Samsung Galaxy S9, 1080×2220 physical pixels.
- Android x86_64 emulator, 1080×2400 physical pixels.

The physical production package was not cleared or uninstalled. QA used the isolated
`com.folio.v2.greenfield.qa` package. The emulator used a separate x86_64 QA artifact.

Current final-build evidence:

- [Physical — final Start](../../../artifacts/final-lovable-port-2026-07-19/31-final-complete-launch.png)
- [Physical — clean check-in with no fabricated balance](../../../artifacts/final-lovable-port-2026-07-19/33-final-checkin-empty.png)
- [Physical — One Move history, clean light state](../../../artifacts/final-lovable-port-2026-07-19/35-final-your-moves-empty-light.png)
- [Physical — Melo context mapping](../../../artifacts/final-lovable-port-2026-07-19/36-final-melo-context.png)
- [Physical — Personal More](../../../artifacts/final-lovable-port-2026-07-19/27-physical-final-more.png)
- [Physical — Account scrolled safe-area proof](../../../artifacts/final-lovable-port-2026-07-19/28-physical-final-account-safe-area.png)
- [Emulator — final x86_64 Start](../../../artifacts/final-lovable-port-2026-07-19/37-emulator-final-complete.png)

Additional device evidence from the same port, before the final safe-area-only rebuild:

- [Physical — Melo memory](../../../artifacts/final-lovable-port-2026-07-19/08-physical-memory.png)
- [Physical — chat with keyboard](../../../artifacts/final-lovable-port-2026-07-19/10-physical-melo-chat-keyboard.png)
- [Physical — companion sections](../../../artifacts/final-lovable-port-2026-07-19/13-physical-melo-sections.png)
- [Physical — companion touches](../../../artifacts/final-lovable-port-2026-07-19/14-physical-companion-touches.png)
- [Physical — workspace switcher](../../../artifacts/final-lovable-port-2026-07-19/16-physical-workspace.png)
- [Physical — Business Today](../../../artifacts/final-lovable-port-2026-07-19/17-physical-business-today.png)
- [Physical — Business Review](../../../artifacts/final-lovable-port-2026-07-19/18-physical-business-review.png)
- [Physical — Business Melo](../../../artifacts/final-lovable-port-2026-07-19/19-physical-business-melo.png)
- [Physical — Business More](../../../artifacts/final-lovable-port-2026-07-19/20-physical-business-more.png)

## Verification record

- Mobile TypeScript build: passed.
- Domain TypeScript build: passed.
- Targeted canonical-state, recovery, Melo rework and no-fabricated-content tests: 67/67 passed.
- `git diff --check`: passed.
- ARM64 standalone release build: passed.
- ARM64 QA update on the physical phone: passed without clearing QA state.
- x86_64 standalone release build: passed.
- Clean x86_64 emulator launch: passed; no fatal runtime exception.
- Final ARM64 QA APK:
  `artifacts/rationale-aware-ui-audit-2026-07-19/melo-qa-lovable-refrozen-complete-nosample-2026-07-19.apk`
- Final ARM64 SHA-256:
  `D781AB679F3F95C097283633815B7F416AA3515D56EF4BC9A3BF1AFAF47BED07`
- Emulator x86_64 QA APK:
  `artifacts/rationale-aware-ui-audit-2026-07-19/melo-qa-lovable-refrozen-complete-nosample-x86_64-2026-07-19.apk`
- Emulator x86_64 SHA-256:
  `826D0600CB8A9A8CDB144E538C1FDBC37863193147EBDCB311D8AE111B67E439`

The temporary QA application-ID suffix was removed from generated Android source after the two
artifacts were built. The checked-out source therefore remains production-correct.

## Genuine remaining work

This port is not evidence that the whole product is complete. The following remain factual gaps:

1. **Live Open Banking activation.** Provider procurement, regulatory route, DPIA/DPA, production
   credentials, supported-bank validation and pilot approval are external gates.
2. **Direct HMRC/MTD and Companies House submission.** Native prepares working copies and PDFs but
   does not yet transmit filings through a production conformance-approved adapter.
3. **Distinct turned-back sprite source.** Context authority is complete against current Lovable
   source. `docs/MELO_PRESENCE_MEMORY.md` asks for a distinct turned-back sprite, but the current
   Lovable asset library does not contain one; both Lovable and native use the locked `think`
   mapping. A new locked asset must originate in Lovable before a 1:1 native port exists.
4. **Partner Mode.** Explicitly deferred in the design documentation.
5. **iOS, Watch and Wear proof.** Android validation does not establish parity on those targets.
6. **Release operations.** Store declarations, production signing, current public privacy/support
   URLs, processor inventory, accessibility sign-off, tax/legal sign-off and production monitoring
   configuration remain release gates.

No broader UI redesign should be improvised in native. Future Lovable refreezes should be ported as
design authority while preserving and testing the real native capabilities listed above.
