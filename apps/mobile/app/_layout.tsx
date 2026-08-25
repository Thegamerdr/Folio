import { Component, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
} from '@expo-google-fonts/fraunces';
import { ClerkProvider, type ClerkProviderProps } from '@clerk/clerk-expo';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
// Same SDK import errorReporting.ts uses internally — that module only inits Sentry, it exposes
// no captureException helper.
import * as Sentry from '@sentry/react-native';

import { ThemeProvider, useIsDark, useTheme } from '../src/surfaces/pressureMap/kit';
import { clerkTokenCache, getClerkPublishableKey } from '../src/folio/lib/clerkAuth';
import { initErrorReporting } from '../src/folio/lib/errorReporting';
import { clearEvidenceViewCache } from '../src/folio/lib/documentVault';
import { safeZoneWidgetTaskHandler } from '../src/folio/widget/widgetTaskHandler';
import { RootErrorFallback } from '../src/folio/ui/RootErrorFallback';

// ---------------------------------------------------------------------------
// Root error boundary — the LAST line of defence, above every provider and above FolioShell's own
// screen-level ScreenErrorBoundary. Deliberately self-contained: no `@/folio/*` imports and no
// theme dependency (raw RN primitives + inline styles only), so it can still render its fallback
// even when the thing that threw is the folio module graph or the theme system itself.
// ---------------------------------------------------------------------------
type RootErrorBoundaryProps = { children: ReactNode };
type RootErrorBoundaryState = { hasError: boolean };

class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  override state: RootErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RootErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep local logs free of exception messages, component stacks and props. Sentry receives the
    // same boundary through beforeSend redaction, while the on-device fallback remains useful.
    // eslint-disable-next-line no-console
    console.error('Root error boundary captured an application failure.');
    try {
      Sentry.captureException(error);
    } catch {
      /* telemetry is best-effort — never let capture crash the fallback. */
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <RootErrorFallback />;
    }
    return this.props.children;
  }
}

// Crash reporting first — module scope, before anything else can throw. Privacy-tuned
// (no PII/screenshots/tracing — see errorReporting.ts); no-op when no DSN is configured.
initErrorReporting();

// Editorial Ledger lives or dies on a real serif. Keep the splash up until Fraunces is loaded so
// the first paint is already editorial — never a system-font flash that then swaps.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Widget headless task registration — MUST happen at module scope (not inside a component/effect):
// Android can invoke `RNWidgetBackgroundTask` in its own headless JS context — e.g. the OS's
// periodic update tick, or a widget added while the app was never opened — with no app UI ever
// mounting. Registering here means it runs unconditionally the instant this file's module graph
// loads, on every JS entry point (this app has no other one — `main` is `expo-router/entry`, which
// loads this root layout). See widget/widgetTaskHandler.tsx for the render-from-disk-snapshot logic.
registerWidgetTaskHandler(safeZoneWidgetTaskHandler);

// A bundled font should normally resolve almost immediately, but a corrupt/missing asset or a
// platform loader regression must never strand the user behind the native splash forever. Keep
// the editorial first paint when loading succeeds, then degrade to the platform font after a
// bounded wait. The named families used by the UI already fall back safely when unavailable.
const FONT_BOOT_TIMEOUT_MS = 6_000;

// The themed shell. It lives UNDER ThemeProvider so the root background + status bar follow the
// resolved palette (and so a forced Light/Dark choice — not just 'system' — is honoured here too).
function ThemedRoot() {
  const t = useTheme();
  // Light status-bar glyphs on the dark ground, dark glyphs on the cream. `useIsDark` reflects the
  // resolved palette, so a forced Light/Dark choice is honoured, not just the OS scheme.
  const isDark = useIsDark();

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: t.canvas },
          headerShown: false,
        }}
      />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    // Body/UI sans, matching the web's --font-sans. Vendored locally as a single variable TTF
    // (Inter Tight ships variable-only upstream — see assets/fonts/InterTight-Variable.ttf).
    // Kept registered for back-compat with any code still requesting the bare 'InterTight' family.
    InterTight: require('../assets/fonts/InterTight-Variable.ttf'),
    // Static per-weight instances (fontTools varLib.instancer, wght 400/500/600/700). Android does
    // not resolve the `wght` variation axis from RN's `fontWeight` prop on a variable font — every
    // weight silently renders at the font's default instance (400). Registering one static family
    // per weight and switching `fontFamily` (via src/folio/theme/fontWeight.ts's weightFamily())
    // instead of relying on `fontWeight` is the only reliable cross-platform fix. See
    // src/surfaces/pressureMap/kit.tsx (`sans`) for the consumer-facing token.
    InterTightRegular: require('../assets/fonts/InterTight-Regular.ttf'),
    InterTightMedium: require('../assets/fonts/InterTight-Medium.ttf'),
    InterTightSemiBold: require('../assets/fonts/InterTight-SemiBold.ttf'),
    InterTightBold: require('../assets/fonts/InterTight-Bold.ttf'),
  });

  const [fontWaitExpired, setFontWaitExpired] = useState(false);

  useEffect(() => {
    void clearEvidenceViewCache();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError !== null) return;
    const timeout = setTimeout(() => setFontWaitExpired(true), FONT_BOOT_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    if (fontError === null) return;
    // eslint-disable-next-line no-console
    console.error('Bundled fonts failed to load; continuing with platform fallbacks.');
    try {
      Sentry.captureException(fontError);
    } catch {
      /* telemetry is best-effort; the degraded boot path must always render. */
    }
  }, [fontError]);

  useEffect(() => {
    if (!fontWaitExpired || fontsLoaded || fontError !== null) return;
    // eslint-disable-next-line no-console
    console.warn('Bundled fonts did not finish loading; continuing with platform fallbacks.');
    try {
      Sentry.captureMessage('Bundled fonts timed out during app startup', 'warning');
    } catch {
      /* telemetry is best-effort; the degraded boot path must always render. */
    }
  }, [fontError, fontWaitExpired, fontsLoaded]);

  if (!fontsLoaded && fontError === null && !fontWaitExpired) return null;

  const tree = (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );

  // Sign-in stays entirely optional (see clerkAuth.ts) — with no publishable key configured this
  // renders exactly the same tree as before ClerkProvider existed. Zero behaviour change.
  const publishableKey = getClerkPublishableKey();
  if (publishableKey === undefined) return tree;

  // @clerk/types builds ClerkProviderProps from several `Without<..., K>` intersections whose
  // remaining members are themselves optional at runtime; under this project's
  // `exactOptionalPropertyTypes: true` those collapse into a structural type TS reports as
  // "missing" properties that Clerk's own JSX usage examples never provide. This is a documented
  // upstream typing friction with strict optional-property configs, not a real prop gap — the
  // object below is the complete, valid set clerk-expo's own Expo quickstart passes.
  const clerkProps = { publishableKey, tokenCache: clerkTokenCache } as ClerkProviderProps;

  return <ClerkProvider {...clerkProps}>{tree}</ClerkProvider>;
}

// The default export: RootLayout wrapped in RootErrorBoundary so a throw anywhere inside it
// (font loading, ThemeProvider, ClerkProvider setup, FolioShell's own module graph) renders the
// calm fallback instead of a white screen.
export default function Root(): ReactNode {
  return (
    <RootErrorBoundary>
      <RootLayout />
    </RootErrorBoundary>
  );
}
