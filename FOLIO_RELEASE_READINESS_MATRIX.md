# Folio Release Readiness Matrix

Date: 2026-06-23

Updated 2026-06-30 (evening) — commits eb6e0a0/3783c9c/a3f81c9 (branch
`claude/folio-rn-faithful-port`; 0 typecheck errors, 306 folio tests green; visible fixes verified
on-device by screenshot). See the "2026-06-30 evening session" note below the table for the
per-item changes; affected rows are annotated inline.

This matrix separates owner dogfood, external beta and public release. Public-release blockers do
not automatically block private owner dogfood.

| Area                     | Owner dogfood required? | External beta required? | Public release required? | Current state                                                                                                                                                                       | Evidence path                                                    | Gap                                               | Next pass                                |
| ------------------------ | ----------------------- | ----------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| Android emulator         | yes                     | yes                     | yes                      | proven by prior APK/emulator passes                                                                                                                                                 | `apps/mobile/evidence/*android*`, `ANDROID_INSTALL_FOR_OWNER.md` | keep current with each APK                        | use as smoke baseline                    |
| Physical Android         | yes                     | yes                     | yes                      | not yet performed                                                                                                                                                                   | `apps/mobile/evidence/owner-dogfood-prep-2026-06-23/`            | real device install/launch missing                | physical Android dogfood pass            |
| iOS simulator            | no                      | yes                     | yes                      | not proven in this environment                                                                                                                                                      | `STATUS.md`, release blocker gate                                | macOS/Xcode required                              | iOS smoke pass on macOS/EAS              |
| iOS physical device      | no                      | yes                     | yes                      | not proven                                                                                                                                                                          | release blocker register                                         | macOS/Xcode and device required                   | iOS physical proof pass                  |
| local-first storage      | yes                     | yes                     | yes                      | implemented in local SQLite/SQLCipher path                                                                                                                                          | `nativeLedgerStore.ts`, storage tests                            | physical-device persistence proof pending         | Android persistence proof                |
| encryption/key handling  | yes                     | yes                     | yes                      | SecureStore key generation implemented; fallback documented                                                                                                                         | `nativeLocalSecurity.ts`                                         | hardware-backed behavior not independently proven | security/key proof pass                  |
| data export              | yes                     | yes                     | yes                      | local user export implemented                                                                                                                                                       | `nativeDataExport.ts`, Data Control tests                        | export sensitivity needs manual review            | export review pass                       |
| data clear/delete        | yes                     | yes                     | yes                      | local clear/reset implemented; Start-fresh wipe-to-empty fixed (2026-06-30 evening) — More→"Start fresh" no longer reseeds the demo, now `resetToEmpty` + one-tap confirm (eb6e0a0) | Data Control, Dogfood Mode                                       | physical proof and deletion scope review pending  | Android clear/delete proof               |
| import/review safety     | yes                     | yes                     | yes                      | canonical staged-review flow implemented                                                                                                                                            | import review tests, canonical tests                             | device UX proof pending                           | dogfood import scenario                  |
| rejected evidence safety | yes                     | yes                     | yes                      | rejected evidence stays non-financial                                                                                                                                               | `dogfoodMode.test.ts`, import tests                              | device scenario proof pending                     | dogfood rejected evidence scenario       |
| advice boundary          | yes                     | yes                     | yes                      | policy tests exist                                                                                                                                                                  | `@folio/melo-policy`, copy tests                                 | legal copy review pending                         | privacy/legal copy review                |
| Melo policy              | yes                     | yes                     | yes                      | Melo is gated and cannot write directly                                                                                                                                             | `localMeloPolicyAdapter.test.ts`                                 | final runtime not built by design                 | final Melo runtime separate              |
| accessibility            | basic source check      | manual baseline         | independent audit        | source-level labels and copy exist                                                                                                                                                  | `ACCESSIBILITY_AUDIT_FOUNDATION.md`                              | TalkBack/VoiceOver/large text not complete        | Android accessibility pass               |
| privacy copy             | basic note              | reviewed copy           | legal approved policy    | foundation drafted                                                                                                                                                                  | `PRIVACY_AND_LEGAL_COPY_FOUNDATION.md`                           | legal approval missing                            | privacy/legal review pass                |
| security review          | self-check              | security review plan    | independent review       | checklist drafted                                                                                                                                                                   | `SECURITY_AND_KEY_PROOF_CHECKLIST.md`                            | independent review missing                        | security/key proof and external review   |
| crash/error handling     | basic                   | required                | required                 | install recovery docs exist                                                                                                                                                         | `ANDROID_INSTALL_FOR_OWNER.md`                                   | real crash/logcat drill missing                   | Android failure recovery drill           |
| diagnostics              | yes                     | yes                     | yes                      | redacted dogfood diagnostics implemented                                                                                                                                            | `nativeDogfoodDiagnosticExport.ts`                               | physical export proof pending                     | dogfood diagnostics proof                |
| billing                  | no                      | no unless paid beta     | yes if paid              | not built by instruction                                                                                                                                                            | release blocker gate                                             | implementation and store credentials missing      | separate billing pass                    |
| store declarations       | no                      | no                      | yes                      | prep docs exist; no submission                                                                                                                                                      | `STORE_DECLARATION_PREP.md`                                      | binary/store/legal review missing                 | store declaration prep review            |
| legal disclaimers        | basic boundary          | reviewed                | approved                 | placeholder copy drafted                                                                                                                                                            | `PRIVACY_AND_LEGAL_COPY_FOUNDATION.md`                           | legal approval missing                            | legal/business review                    |
| release notes            | helpful                 | required                | required                 | existing status/release evidence exists                                                                                                                                             | `STATUS.md`, evidence folders                                    | owner dogfood release note missing                | dogfood release note after physical test |
| support/contact path     | no                      | yes                     | yes                      | bug template exists                                                                                                                                                                 | `DOGFOOD_BUG_REPORT_TEMPLATE.md`                                 | support address/process undecided                 | support path decision                    |

## 2026-06-30 evening session — RN correctness pass (commits eb6e0a0 / 3783c9c / a3f81c9; AUDIT.md 7147884)

Branch `claude/folio-rn-faithful-port`; 0 typecheck errors, 306 folio tests green; visible fixes
verified on-device by screenshot. These are RN app-state corrections (the gate rows above are
device-proof/legal/security gates and are unchanged by this work except where annotated inline).

- **Sample/placeholder data purge — RESOLVED.** Pattern enforced: nothing fabricated is present
  24/7; a cleared/real app shows only the user's own data, and demo/illustrative data is gated behind
  the demo regime (`currentBalance.source === 'sample'`). Today's money-path chart now plots from the
  real `route.points` daily series (was hardcoded SVG geometry: "salary rise +£2,180 / bill drop
  −£875 / 7 Jul"); the summary trio and low-point tile now read real route totals
  (`RouteResult.incomingTotal/outgoingTotal`) and the real route tight point; calendar agenda
  reviews + UK tax deadlines and `RECURRING_BILLS` (Octopus/Council Tax/Rent/BT) are now gated behind
  the demo regime; reader screens (Visualizer/Review/Paste/Image), `SubCaughtSheet`, the edit sheets
  and `RouteDetailSheet` now show honest empty doorways / blank forms instead of falling back to a
  fake "Tesco · £42 · 26 Jun" or Octopus/Rent placeholders; chart "breathing room · £100" → "breathing
  room" (eb6e0a0, 3783c9c, a3f81c9).
- **Melo mood wired — RESOLVED.** App-wide pressure is now DERIVED from the real route via
  `derivePressure()`, gated on a real money picture so an empty/cleared app stays neutral calm; the
  Melo mood picker sets a global override via `nav.setPressure` that propagates to
  Today/What-if/Melo/chat. (Was a no-op.) (eb6e0a0)
- **Dark mode — RESOLVED for TimelineScreen.** The Timeline headline + subhead had no color
  (defaulted to black → invisible on the dark canvas; light mode read fine); now bound to theme
  `ink`/`muted` (eb6e0a0). Note: an exhaustive per-screen dark-mode visual pass is still open (see
  below) — a token-contrast audit can't catch a MISSING color, only looking can.
- **Scroll — RESOLVED.** Privacy/Subscriptions/PaydayRitual/Check-in/Start were fixed-height; now
  wrapped in `ScrollView` so content scrolls, including Privacy's "Clear to empty" which was
  previously unreachable below the fold (eb6e0a0).
- **Import date — RESOLVED.** Imported transactions now keep their real statement date (was stamped
  "today") (eb6e0a0).
- **AI cost split — RESOLVED (app + gateway code).** Chat pins cheap `gemini-2.5-flash-lite`; vision
  (`gemini-2.5-flash`) is reserved for PDF/photo extraction; the gateway model allow-list rejects
  costlier models (eb6e0a0). Operationally STILL OPEN: this needs a `wrangler deploy` of the gateway
  plus an OpenRouter spend cap (see the Melo policy / billing rows and `MELO_AI_SETUP.md`).

Still open (owner/QA, not RN bugs): exhaustive per-screen dark-mode + cross-device VISUAL pass on an
emulator; iOS (needs a Mac/EAS — unbuildable on the Windows dev box; tracked by the iOS rows above);
the gateway redeploy + OpenRouter spend cap.
