import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

// React Native's Flow entry point is not renderable in this Node test configuration. These are
// narrow route contracts for the material behavior that can regress without a device: the shared
// rail's measured one-row geometry, ReviewHub's waiting gate, and Timeline's fixed-rail/scroll
// ownership. Native bounds, TalkBack order and focus return remain device evidence obligations.
const reviewHub = readFileSync(new URL('./ReviewHubScreen.tsx', import.meta.url), 'utf8');
const timeline = readFileSync(new URL('./TimelineScreen.tsx', import.meta.url), 'utf8');
const rail = readFileSync(new URL('../ui/ReviewTimelineTabRail.tsx', import.meta.url), 'utf8');
const reviewHistory = readFileSync(new URL('../lib/reviewHistory.ts', import.meta.url), 'utf8');

describe('MF12 Review and Timeline route contracts', () => {
  it('keeps the shared destination rail horizontal, scrollable and one row at large text', () => {
    expect(rail).toContain('horizontal');
    expect(rail).toContain('scrollRef.current?.scrollTo');
    expect(rail).toContain('accessibilityRole="tablist"');
    expect(rail).toContain('accessibilityRole="tab"');
    expect(rail).toContain('minHeight: 48');
    expect(rail).toContain('minHeight: 44');
    expect(rail).toContain('flexShrink: 0');
    expect(rail).not.toContain("flexDirection: 'column'");
  });

  it('keeps the ReviewHub doorway behind the real pending-count gate', () => {
    expect(reviewHub).toContain(
      'pendingCount === 0 && resumableStatements.length === 0 && !caught',
    );
    expect(reviewHub).toContain('session.candidates.length > 0 || session.receipt !== undefined');
    expect(reviewHub).toContain('Statements you started. Nothing is added until you say so.');
    expect(reviewHub).toContain('Add a statement');
    expect(reviewHub).toContain('result not seen yet');
  });

  it('preserves exact Activity and Decisions scope copy and labels', () => {
    expect(reviewHub).toContain('EXPLORE YOUR RECORDS');
    expect(reviewHub).toContain('REVIEW YOUR CHOICES');
    expect(reviewHistory).toContain(
      'Confirmed money records, newest first. Corrections also appear in Decisions.',
    );
    expect(reviewHistory).toContain(
      'Corrections, bills paused or resumed, debt tracking changes, and items put aside. Open a record to review the current details.',
    );
    expect(reviewHub).toContain("hiddenCount ? `${hiddenCount} hidden` : 'nothing hidden'");
  });

  it('gives destination rows a single labeled action and static rows no button role', () => {
    expect(reviewHub).toContain('accessibilityRole="button"');
    expect(reviewHub).toContain('accessible accessibilityLabel={`${label}. ${meta}`}');
    expect(reviewHub).toContain('historyAction');
    expect(timeline).toContain('if (destination === null)');
    expect(timeline).toContain('accessibilityLabel={`${verb} ${row.title}`}');
    expect(timeline).toContain('accessibilityLabel={destination.label}');
  });

  it('reserves a fixed rail above Timeline content and removes the old stacking tabs', () => {
    expect(timeline).toContain('<View style={s.railWrap}>');
    expect(timeline).toContain('style={s.scrollBody}');
    expect(timeline).toContain('railWrap:');
    expect(timeline).toContain('scrollBody:');
    expect(timeline).toContain('scrollContent:');
    expect(timeline).toContain('paddingHorizontal: 0');
    expect(timeline).not.toContain('function TimelineTabs(');
  });
});
