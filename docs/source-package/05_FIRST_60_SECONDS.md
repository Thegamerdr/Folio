# First 60 Seconds and Progressive Onboarding

## Objective

Before Folio has personal data, it must earn enough interest and trust for the user to bring data in. It must not pretend to know the user or start an interview.

## Zero-data first launch

### 0–8 seconds: human welcome

Melo appears with a short, animated introduction:

> I help you see what is happening with your money, what is coming next, and how changes affect your plans. Your information stays on this device unless you choose otherwise.

No account prompt. No bank permission. No multi-page carousel.

### 8–20 seconds: three clear paths

- **Bring in a statement** — file, photo or supported financial export.
- **Tell Melo one thing** — opens a purposeful interaction such as “I just got paid” or “I need to know if I’m okay until Friday.”
- **See a 20-second example** — local fictional data, clearly labelled as a demo.

These are interaction paths, not identity or goal segmentation.

### 20–45 seconds: demonstrate the mechanism

The demo shows a fictional but relatable timeline:

- money available;
- payday;
- rent or another obligation;
- a small hypothetical purchase;
- the resulting timeline change.

The user sees the core idea: Folio explains the consequences, not just the transaction.

### 20–60 seconds: import path

If a user chooses a supported CSV, OFX/QFX or structured statement:

1. Copy the selected file into an encrypted staging area.
2. Detect account, period, currency and rows locally.
3. Display progressive, truthful stages rather than a generic spinner.
4. Surface partial facts as soon as they are reliable: date range, transaction count, opening/closing balance, likely repeating payments.
5. Ask only the smallest review question needed to create the first position.

Target first real value after selecting a well-formed supported file: show an initial position and next important dates within roughly one minute on a representative mid-range device. PDF and image processing may take longer; keep the user informed and never invent partial results.

## Minimal manual value path

A user who does not import can receive a temporary projection from three facts gathered in context:

- money available now;
- next income date and expected amount;
- next important obligation.

This state is clearly marked incomplete. It is useful without becoming a mandatory setup form.

## Permission timing

- Files: system picker only when import is chosen.
- Camera: only when scan is chosen.
- Microphone: only when voice input is tapped.
- Notifications: after the user creates or accepts a reminder.
- Calendar write: when adding an item to the system calendar.
- Calendar read: only after explicit calendar import/sync selection.
- Open Banking: only after the user selects live bank connection.
- Account/cloud: only after sync, backup, recovery or paid cloud functionality is selected.

Every request explains the immediate benefit and the fallback if refused.

## First real magic moment

The user should receive a statement such as:

> I found your likely payday, six repeating payments and the next thirty days. Three items need a quick check before the forecast is reliable.

After review:

> Based on what is confirmed, rent and your other known bills are covered before payday. Here is the amount that remains and exactly how it was calculated.

## Onboarding completion

There is no ceremonial “setup complete.” The product gradually becomes more accurate as facts are imported, confirmed and corrected. The Today screen always indicates data freshness and remaining uncertainty without nagging the user to complete a profile percentage.
