# Completion audit of the full release brief

The continuation re-read the complete brief and checked the delivered source and installed
artifacts, rather than treating the earlier report as proof. The final source is committed at
`390574198dbdfca4706683428e37a8b53750cb75`; its signed artifact, installation and supported
native checks are verified below. The original shell and all requested gates remain the
acceptance scope.

## Preserved and reverified

- The authoritative worktree, pre-change safety ref, prior handoff ancestry and pushed branch
  match the Git evidence. Both connected Android installations matched the c74 artifact's
  SHA-256 before this follow-up. That artifact is retained as an earlier candidate.
- The final signed artifact is `C:\dev\melo-release-artifacts-2026-09-09\Melo-manual-39057419-arm64-x86_64.apk`,
  155,773,850 bytes, SHA-256 `c313eb289213228f4442b650e6484bbd5eb116687f346b3f347409bd200a2d76`.
  Its signing certificate SHA-256 is `547396e1fd99681c2a6d768b8b7d1b4484b5f42a17597cad6c495221267a5488`.
  It installed successfully on the emulator and Galaxy S9; installed `base.apk` hashes matched
  the artifact. Final artifact/evidence linkage is recorded in external `GIT_HANDOFF.json`.
- Historical local unpublished branches (32 on the older native line and 13 on the parity line),
  older worktrees, dirty documents and stashes remain preserved.
- Finance-engine and contract package dist outputs were refreshed before the follow-up checks;
  native Metro reads the source directly. Completion-focused checks passed **66/66**,
  completion-contract checks **51/51**, completion-shell checks **21/21**, and final mobile
  typecheck passed.
- Additional existing Business journey, Business surface registry, appearance and Timeline
  tests passed **21/21** (`completion-shell-tests.json`). These supplement the baseline and
  native acceptance evidence; they are not an exhaustive visual parity claim.
- Fixture B's persisted native state was cash £1,780, safe £360, future monthly income £1,800,
  bundled rent/bills £950, essentials £70/week, buffer £200 and Klarna £320/minimum £80.
- A/B/C and the exact 30-case matrix continue to use the same canonical engine. No personal
  fixture-specific branches, second app, removed routes or Open Banking prerequisite were added.

## Concrete gaps found and corrected in the follow-up

The engine's original monthly debt anchor could drift after a short month. The follow-up
preserves the declared calendar day, including a mobile adapter starting in February with
a due day of 31.

The extra-payment preview needed explicit one-off and weekly paths. Those paths must apply
payments on their actual dates, preserve minimum-payment cascade, include daily dated interest,
and reserve all actual weekly payments before the next income. The weekly cash count is truncated
when the portfolio clears. The existing monthly path remains its calendar-month approximation.
Root rejected an initial candidate that summed weekly payments at month-end and subtracted only
one payment in the UI.

The brief's specific conversational examples also exposed missing interpretation. The follow-up
covers the exact phrases “I spent £200 I wasn't supposed to”, “I don't have a car”, “I've got
£500 spare. What should I do?”, “My bill went up”, “I'm behind on this one”, “I actually spend
about £70 a week on food”, “Change my rent and bills to £1000”, “What happens if I pay £400?”,
“I want to pay £400”, “I just cleared Klarna” and “I got paid £300 less than usual”. No-car
context does not invent a transport amount or cancel an existing bill; spare-money wording does
not overwrite the recorded balance.

Final native observations were verified on the signed follow-up artifact: £50 Monthly and Once
previews each left £310 with payoff dates 2026-11-18 and 2026-12-18; £50 Weekly showed three
payments before income, left £210 and projected payoff 2026-10-07. The exact unplanned-spend
phrase required confirmation, then persisted a £200 spend (cash £1,580, safe-to-spend £160).
Offline cold launch retained those values after 14,493 ms. Fresh-profile verification passed:
profile 11 reached empty manual onboarding after Android finished initializing the new user;
no launch timing claim is made for that initialization wait. Earlier c74 candidate evidence
remains available and is not relabeled as the final build.
