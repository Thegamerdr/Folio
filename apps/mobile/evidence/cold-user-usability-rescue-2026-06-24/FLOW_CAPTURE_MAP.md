# Flow Capture Map

Date: 2026-06-24

## Flow 1: Fresh App To Fake Data

- Start: `screenshots/start.png`, `xml/start.xml`
- Try fake data: `screenshots/sample-briefing.png`, `xml/sample-briefing.xml`
- Review sample rows: `screenshots/review-rows.png`, `xml/review-rows.xml`
- Ignore row: `screenshots/rejected-import-state.png`, `xml/rejected-import-state.xml`
- Today: `screenshots/first-real-today-briefing.png`, `xml/first-real-today-briefing.xml`
- What changed: included in Today capture
- More/Data and privacy: `screenshots/data-control.png`, `xml/data-control.xml`

## Flow 2: Add A Few Numbers

- Start: `screenshots/start.png`, `xml/start.xml`
- Add a few numbers: `screenshots/minimal-manual-path.png`, `xml/minimal-manual-path.xml`
- Today: `screenshots/first-real-today-briefing.png`, `xml/first-real-today-briefing.xml`
- More/Data and privacy: `screenshots/data-control.png`, `xml/data-control.xml`

## Flow 3: Bank Statement Or Pasted Rows

- Start: `screenshots/start.png`, `xml/start.xml`
- Import entry: `screenshots/import-entry.png`, `xml/import-entry.xml`
- Rows found: `screenshots/review-rows.png`, `xml/review-rows.xml`
- Ignored duplicate: `screenshots/rejected-import-state.png`, `xml/rejected-import-state.xml`
- Today updates only accepted rows: `screenshots/first-real-today-briefing.png`, `xml/first-real-today-briefing.xml`
- Timeline: `screenshots/timeline.png`, `xml/timeline.xml`

## Flow 4: Unsupported File Truth

- Import entry: `screenshots/import-entry.png`, `xml/import-entry.xml`
- Data and privacy/document visibility: `screenshots/data-control.png`, `xml/data-control.xml`
- Domain proof: `apps/mobile/src/local/localLedger.test.ts` covers unsupported file metadata without money rows.
