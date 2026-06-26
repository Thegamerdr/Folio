# Rotation Drill Record

## Status

Blocked. This file is the required record shape. It is not completed rotation evidence.

## Required Drills

| Drill                     | Required proof                                                       |
| ------------------------- | -------------------------------------------------------------------- |
| Device/session revoke     | Lost-device revoke and future sync-key rotation drill passes.        |
| Cloud service role rotate | Least-privilege role rotation does not expose plaintext vault data.  |
| Provider token rotate     | Provider token revocation stops refresh and keeps local data usable. |
| AI provider key rotate    | Gateway route rotation keeps provider keys out of the app.           |
| Store credential rotate   | Store submission and billing credentials rotate without user impact. |
| Recovery route rotate     | Clean-device restore still works without support seeing secrets.     |

## Completion Evidence

To close the rotation blocker, record:

- drill date and environment;
- rotated secret/token/key class;
- before/after access validation;
- rollback path;
- user-data exposure check;
- support impact;
- owner signoff;
- remaining gaps.

## Current Result

No rotation drill has been completed. `RB-T185-INCIDENT-RUNBOOKS` remains blocked.
