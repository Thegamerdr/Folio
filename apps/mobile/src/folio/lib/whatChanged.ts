// What-Changed summary — pure LOGIC, Node-testable (no expo, no react-native).
//
// WHY THIS EXISTS. "'What changed' briefing" was sold on the paywall while the app had NO standing
// what-changed surface at all — only event-driven caught-sheets (the 2026-07-10 alignment audit's
// truth pass demoted the bullet to 'soon'). This module + ui/WhatChangedRow.tsx build the real
// thing, v1: a quiet standing row on every Today that answers "what changed since I last looked?"
// and opens the Timeline. Free for everyone — it's clarity/safety-layer, and the Free tier is
// never quality-degraded (MONEY_MODEL.md §2b). The paywall's Full bullet stays 'soon' and now
// means the richer future briefing (AI-written digest), not this row.
//
// WHAT COUNTS AS A CHANGE since the `seenISO` baseline:
//   • Every Timeline row (buildTimelineRows: transactions Added/Edited + the sub-paused/resumed/
//     review-ignored event log) whose timestamp is after the baseline.
//   • Every statement import (statementImports log) whose import moment is after the baseline —
//     counted as ONE change each, because its transactions carry HISTORICAL dates (last month's
//     statement) and would otherwise slip past a purely timestamp-based filter unnoticed.
// A `null` baseline means "no baseline yet" → null summary (the row stays hidden; the component
// stamps the first baseline silently on first mount, so the row only ever reports changes that
// happened after the user first had it).

import type { TimelineRow } from './timelineEvents';
import type { StatementImportRecord } from '../store';
import type { MaterialFinancialChange } from '@folio/domain';

export type WhatChangedSummary = {
  /** Total change moments since the baseline (rows + imports). Always >= 1 when non-null. */
  count: number;
  /** Calm one-liner for the row — the NEWEST change, plus a "· N more" tail when count > 1. */
  headline: string;
};

/** The row's verb, lowercased for mid-sentence use ('Tesco added'). */
function lowerVerb(verb: TimelineRow['verb']): string {
  return verb.toLowerCase();
}

function formatPounds(minorUnits: number): string {
  const pounds = Math.round(Math.abs(minorUnits) / 100);
  return `£${pounds.toLocaleString('en-GB')}`;
}

function materialChangeLabel(change: MaterialFinancialChange): string {
  const primary = change.causes.find((cause) => cause.weight === 'primary') ?? change.causes[0];
  const amount =
    change.rangeEffect?.conservativeBoundaryDelta ??
    change.rangeEffect?.lowerDelta ??
    change.rangeEffect?.upperDelta ??
    change.monetaryEffect ??
    primary?.amount ??
    null;
  if (primary === undefined) return change.explanationCode;
  if (amount === null || amount.minorUnits === 0) return primary.label;
  const direction = amount.minorUnits > 0 ? 'up' : 'down';
  return `${primary.label} · ${formatPounds(amount.minorUnits)} ${direction}`;
}

export function summarizeWhatChanged(args: {
  rows: readonly TimelineRow[];
  imports: readonly StatementImportRecord[];
  materialChanges?: readonly MaterialFinancialChange[];
  seenISO: string | null;
}): WhatChangedSummary | null {
  const { rows, imports, materialChanges = [], seenISO } = args;
  if (seenISO === null) return null;
  const seenTime = new Date(seenISO).getTime();
  if (Number.isNaN(seenTime)) return null; // corrupt baseline — stay quiet, never crash.

  type Moment = { at: number; label: string };
  const moments: Moment[] = [];

  for (const change of materialChanges) {
    const at = new Date(change.detectedAt).getTime();
    if (!Number.isNaN(at) && at > seenTime) {
      moments.push({ at, label: materialChangeLabel(change) });
    }
  }
  for (const row of rows) {
    const at = new Date(row.at).getTime();
    if (!Number.isNaN(at) && at > seenTime) {
      moments.push({ at, label: `${row.what} ${lowerVerb(row.verb)}` });
    }
  }
  for (const imported of imports) {
    const at = new Date(imported.atISO).getTime();
    if (!Number.isNaN(at) && at > seenTime) {
      const rowsWord = imported.rowCount === 1 ? 'row' : 'rows';
      moments.push({ at, label: `Statement read · ${imported.rowCount} ${rowsWord}` });
    }
  }

  if (moments.length === 0) return null;

  moments.sort((a, b) => b.at - a.at);
  const newest = moments[0]!;
  const rest = moments.length - 1;
  const headline = rest === 0 ? newest.label : `${newest.label} · ${rest} more`;
  return { count: moments.length, headline };
}
