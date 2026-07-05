# Privacy Policy — Folio (working name; also referred to as Melo)

_Last updated: 5 July 2026 · Draft pending final product name and hosting URL. Not legal advice;
have it reviewed before publication._

## The short version

Your money data lives on your device, encrypted, under your control. Nothing is collected in the
background: no ads, no analytics, no tracking. Some features send specific data off the device
**only when you use them** — reading a statement you pick, chatting with Melo, signing in, or
buying a subscription — and this policy lists exactly what leaves, where it goes, and why.

## Data stored on your device

Everything you enter or import — balances, transactions, bills, subscriptions, pots, plans,
debts, settings — is stored locally on your device in an encrypted file. The encryption key is
held in your device's secure keystore and never leaves it. Deleting the app's data (or using the
in-app wipe) permanently destroys this data; we cannot recover it, because we never had it.

## Data that leaves your device, and only when you act

**Statement reading.** When you choose to read a bank statement (PDF, photo, screenshot, or
pasted text), that document is sent over an encrypted connection to our reading service (a
server we operate on Cloudflare Workers) so an AI model can extract the transactions for your
review. The document is processed to produce the extraction and is not used to build profiles or
train models by us. Nothing is added to your records until you review and confirm it.

**Melo chat.** When you send Melo a message, the conversation — and, only if you have turned on
"share my numbers", a summary of your financial snapshot — is sent to the same service so the AI
can answer. Turning the toggle off keeps your numbers out of the conversation.

**Sign-in (optional).** The app works fully without an account. If you choose to sign in, your
email address is processed by Clerk (clerk.com), our authentication provider, to send you a
sign-in code and maintain your session. Clerk's own privacy policy applies to that processing.
Signing in does not upload your money data.

**Purchases.** Subscriptions are processed by Google Play. We receive purchase entitlement
information (what tier you bought, its state) — never your payment details.

**Crash reports.** If enabled in a future release, anonymized crash diagnostics (stack trace,
device model, OS version — never your financial records) may be sent to a crash-reporting
service to help us fix bugs.

## What we never do

- No advertising, no ad identifiers, no data sale, ever.
- No analytics or behavioral tracking SDKs.
- No background collection: if you don't act, nothing is sent.
- No access to your bank. The app cannot connect to bank accounts in this version; every number
  comes from you or from a document you explicitly provided.

## Your controls

- **Export**: a complete copy of everything the app stores, from Account → Export.
- **Wipe**: a deliberate, multi-step full deletion from Privacy → Start fresh. Irreversible.
- **Chat sharing**: the "share my numbers" toggle inside Melo chat.
- **Account deletion**: signing out removes the session; contact us (or use Clerk's account
  portal, where offered) to delete the authentication account itself.

## Children

The app is a personal-finance tool intended for users 18 and over.

## Changes

We will update this page when the app's data behavior changes, and the app's own screens are
written to describe honestly what happens at the moment you use each feature.

## Contact

_[owner: add contact email + hosted URL before Play submission]_
