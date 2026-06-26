# Account, Vault Recovery and Deletion Runbook

## Account versus vault

Account authentication grants access to optional services. Vault recovery decrypts user data. Support staff cannot bypass vault recovery.

## Recovery paths

1. Existing trusted device transfers a newly wrapped vault key.
2. Recovery code/passphrase unwraps the cloud-stored wrapped key.
3. Restore local encrypted export.
4. Without any valid recovery factor, cloud ciphertext is unrecoverable; explain this before enablement.

## Lost device

- Revoke device/session.
- Rotate future sync-envelope key.
- Restore on new device.
- Confirm last successful snapshot/cursor.
- Do not claim remote erasure of a device that never reconnects.

## Account deletion

- Authenticate strongly.
- Show cloud services and local data separately.
- Offer export.
- Record deletion request and effective date.
- Revoke bank/provider tokens immediately.
- Delete AI/diagnostic retained content according to processor policy.
- Delete cloud ciphertext and metadata after grace period.
- Keep local vault only if user explicitly selects it.
- Provide confirmation without exposing sensitive details.

## Support boundaries

Support may verify account ownership and service state. It cannot request the user's recovery secret or decrypt financial records.
