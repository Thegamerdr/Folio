// The Melo app shell — the four-tab home around MeloGlance (MELO_PHASE2_PLAN.md). This does NOT
// replace MeloGlance's internal takeovers (settings/chat/shield/review/import sheets it already
// owns when live) — those stay exactly as they are; the shell only adds the outer tab frame so
// Calendar and (a persistently-mounted) Melo chat are reachable as peers of Today, not buried
// inside Glance's own state machine.
//
// Melo tab: MeloChat is mounted persistently (not lazily opened) so its thread survives tab
// switches for the length of the session — the same "same numbers, same mascot" one-entity
// guarantee MeloChat.tsx documents. derived/view are recomputed from the live store on every
// render the same way MeloGlance computes them (deriveLive → resolveState), so Melo-the-chat and
// Melo-the-Glance can never disagree.

import { useMemo, useState } from 'react';

import { resolveState } from '@folio/melo-engine';

import { deriveLive } from '../state/derive';
import { useMeloStore } from '../state/meloStore';
import { MeloGlance } from '../screens/MeloGlance';
import { MeloChat } from '../screens/MeloChat';
import { MeloSettings } from '../screens/MeloSettings';
// MoneyCalendar self-derives (no props besides onClose) — imported statically per the
// orchestrator's build plan; if this file is still mid-build in a parallel lane, this import
// will fail typecheck for that reason only (see wiring notes).
import { MoneyCalendar } from '../screens/MoneyCalendar';
import { BottomNavigation, type MeloTab } from './BottomNavigation';

type Props = {
  onExitToFolio?: (() => void) | undefined;
};

export function AppShell({ onExitToFolio }: Props) {
  const store = useMeloStore();
  const [tab, setTab] = useState<MeloTab>('today');

  // Same derivation the Melo tab's chat needs on every render — cheap (pure functions over the
  // already-loaded store state) and keeps the chat's system prompt honest even if the user
  // switches to it without ever opening Glance's own chat sheet first.
  const derived = useMemo(() => deriveLive(store.state, new Date()), [store.state]);
  const resolved = useMemo(
    () => resolveState(store.state.journey.record, derived.inputs, derived.today),
    [store.state.journey.record, derived],
  );

  // Melo must never be a room without a door — onboarding is handled by the route before this
  // shell ever mounts, but guard here too in case a caller renders AppShell early.
  if (!store.state.setup.onboarded) return null;

  return (
    <>
      {tab === 'today' ? <MeloGlance onExitToFolio={onExitToFolio} /> : null}
      {tab === 'calendar' ? <MoneyCalendar onClose={() => setTab('today')} /> : null}
      {tab === 'melo' ? (
        <MeloChat
          derived={derived}
          view={resolved.view}
          colorway={store.state.setup.colorway}
          wardrobe={store.state.setup.wardrobe}
          form={store.state.setup.form}
          checksThisWeek={store.state.checksThisWeek}
          onClose={() => setTab('today')}
        />
      ) : null}
      {tab === 'settings' ? (
        <MeloSettings
          autoMode={derived.moneyMode}
          setup={store.state.setup}
          onSave={store.updateSetup}
          onClose={() => setTab('today')}
          onPaidToday={() => {
            store.markPaidToday(derived.today);
            store.bump('manualPayday');
          }}
          onResetAll={() => {
            // Reset drops onboarded=false — the route lands back on onboarding, same as
            // MeloGlance's own reset path.
            store.resetAll();
            setTab('today');
          }}
        />
      ) : null}
      <BottomNavigation active={tab} onChange={setTab} />
    </>
  );
}
