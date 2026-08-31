# Melo support and security-report intake workflow

Prepared 31 August 2026. This is an executable internal workflow, not a public contact address.
The owner must choose an existing support/security route before publication; no inbox or domain is
invented here.

## Intake boundary

Until a route is confirmed, support and security reports are not advertised in the app or store
listing. Once the owner supplies a route, publish this workflow behind that route and record the
confirmed address/URL in the operations configuration and store package.

## Required intake fields

Ask the reporter for only:

- product, platform, app version and candidate/build identifier;
- affected route or feature;
- concise reproduction steps and expected versus observed result;
- impact and whether exploitation is active;
- redacted logs or screenshots only;
- a safe reply route.

Never request recovery secrets, passphrases, bank credentials, payment details, provider tokens,
unredacted statements, transaction exports or raw AI conversations.

## Internal handling

1. Acknowledge receipt and assign a private incident ID.
2. Remove secrets and financial content from the report record; preserve only the minimum evidence.
3. Classify severity using `docs/release-operations/vulnerability-disclosure-readiness.md`.
4. Route to security, privacy/legal, billing, provider, cloud or release ownership as applicable.
5. Contain first: disable the affected route, revoke/rotate credentials or halt rollout where
   needed.
6. Reproduce only with synthetic data or a disposable test account.
7. Attach a regression test or runtime evidence, then record the user/reporter communication and
   closure criterion in the incident record.

## Service targets

- Acknowledge within 3 business days.
- Complete initial severity triage within 7 business days.
- Escalate active critical exploitation to security and privacy/legal the same business day.
- Provide status at least every 14 calendar days while remediation is active.

These are internal targets, not a promise to a reporter until the owner/legal reviewer approves the
published policy.

## Owner action

`OWNER INPUT REQUIRED: choose/confirm an existing support and security contact route.`

After confirmation, update `tooling/config/operations-readiness.json`,
`docs/release-operations/vulnerability-disclosure-readiness.md`, the privacy policy and the store
submission package with the same owner-provided value. Do not infer one from a repository domain.
