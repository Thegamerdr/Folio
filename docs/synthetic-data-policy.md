# Synthetic Data Policy

Folio V2 source, tests, screenshots and demo records must use synthetic data only.

## Rules

- Do not commit real bank statements, receipts, screenshots, voice notes, account identifiers, names, addresses, emails, phone numbers or financial records.
- Do not paste production crash reports, model prompts or telemetry containing financial content.
- Use labelled fake records from `packages/testing` or generated fixtures.
- Use example sort codes, masked account numbers and clearly fictional names.
- Treat any uncertain sample as real and keep it out of the repository.

## CI guard

`pnpm check:samples` blocks common sample-data hazards and requires this policy to exist before CI can pass.
