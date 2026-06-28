// New core-slice surface — the premium money-pressure map.
//
// These components are drop-in replacements for the old core-slice screens: they
// accept the same props the container already passes and talk to the same canonical
// engine. Only the user-facing design language changed.

export { StartScreen } from './startScreen';
export { QuickEstimateScreen } from './roughFirstAnswer';
export { ImportReviewScreen } from './reviewDecision';
export { FoundItemsScreen } from './foundItems';
export { TodayScreen } from './todayPath';
export type { TodayScreenProps } from './todayPath';
export { DataControlScreen } from './trustControl';
export { MoreScreen } from './moreHub';
export { TimelineScreen } from './timeline';
export { PlansScreen } from './plans';
export { CalendarScreen } from './calendarMonth';
export { MeloScreen } from './meloCompanion';
export { BottomNav } from './kit';

// New Stage-4 surfaces — the "tend the picture" group + the cycle ritual + insights.
export { PotsScreen } from './pots';
export { SubscriptionsScreen } from './subscriptions';
export { InsightsScreen } from './insights';
export type { InsightsNote } from './insights';
export { PaydayRitualScreen } from './paydayRitual';

// Stage-5 sheets — the Melo chat companion + first-run onboarding.
export { MeloChatSheet } from './sheets/meloChat';
export type { MeloChatSettings } from './sheets/meloChat';
export { OnboardingSheet } from './sheets/onboarding';
export type { OnboardingProfile } from './sheets/onboarding';
