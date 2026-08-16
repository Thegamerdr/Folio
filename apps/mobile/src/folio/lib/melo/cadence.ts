/** Session cadence caps from the live Lovable Melo wrapper. */
const HERO_LIMIT = 2;

let heroUsed = 0;
let celebrateUsedThisSession = false;
let celebrateUsedForCycleId: string | null = null;

export function takeHeroSlot(): boolean {
  if (heroUsed >= HERO_LIMIT) return false;
  heroUsed += 1;
  return true;
}

export function heroSlotAvailable(): boolean {
  return heroUsed < HERO_LIMIT;
}

export function takeCelebrateSlot(cycleId: string): boolean {
  if (celebrateUsedThisSession || celebrateUsedForCycleId === cycleId) return false;
  celebrateUsedThisSession = true;
  celebrateUsedForCycleId = cycleId;
  return true;
}

export function releaseCelebrateSlotForNewCycle() {
  celebrateUsedThisSession = false;
  celebrateUsedForCycleId = null;
}

export function __resetMeloCadence() {
  heroUsed = 0;
  celebrateUsedThisSession = false;
  celebrateUsedForCycleId = null;
}
