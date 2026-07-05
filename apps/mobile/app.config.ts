import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Folio',
  slug: 'folio-v2-greenfield',
  scheme: 'folio',
  version: '0.0.1',
  icon: './assets/brand/app-icon-1024.png',
  orientation: 'portrait',
  platforms: ['ios', 'android'],
  userInterfaceStyle: 'automatic',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    enabled: false,
  },
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.folio.v2.greenfield',
    infoPlist: {
      ...config.ios?.infoPlist,
      NSFaceIDUsageDescription: 'Folio uses device authentication to lock local money data.',
    },
    supportsTablet: false,
  },
  android: {
    ...config.android,
    adaptiveIcon: {
      foregroundImage: './assets/brand/adaptive-foreground.png',
      backgroundColor: '#EFE9DD',
    },
    allowBackup: false,
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    package: 'com.folio.v2.greenfield',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-iap',
    './plugins/withUploadSigning',
    [
      // R8 code + resource shrinking for release builds (the 68MB sideload APK problem).
      // If a release build ever crashes on boot after a new native dep, suspect missing
      // ProGuard keep rules first.
      'expo-build-properties',
      {
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    [
      // Small-icon tint uses the brand's calm terracotta — visible on the shade without
      // reading as an alert color. No dedicated monochrome icon asset yet; falls back to
      // the app icon until one is drawn.
      'expo-notifications',
      {
        color: '#DC5E33',
        defaultChannel: 'melo',
      },
    ],
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            name: 'SafeZoneWidget', // must match SAFE_ZONE_WIDGET_NAME in widget/widgetSnapshotWriter.tsx
            label: 'Folio — Safe Zone',
            description: 'See how much you can safely spend today, at a glance.',
            minWidth: '110dp',
            minHeight: '40dp',
            targetCellWidth: 4,
            targetCellHeight: 1,
            maxResizeWidth: '250dp',
            maxResizeHeight: '110dp',
            resizeMode: 'horizontal|vertical',
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F7F6F1',
        image: './assets/splash.png',
        imageWidth: 120,
        dark: {
          backgroundColor: '#18231D',
          image: './assets/splash.png',
        },
      },
    ],
    [
      'expo-image-picker',
      {
        // Honest permission copy: reading a statement image SENDS it to Folio's reader service (the
        // Melo gateway vision model, services/ai-gateway) — it does not stay on device. Review-before-
        // truth: nothing is added to the user's money until they confirm it. (Was "Images stay on this
        // device", which contradicted the Intake reader flow — IntakeScreen.runReader → gateway.)
        photosPermission:
          'Folio uses a photo only to read a statement you pick. Reading it sends the image to Folio’s reader service; nothing is added to your money until you review it.',
        cameraPermission:
          'Folio uses the camera only to capture a statement you choose. Reading it sends the image to Folio’s reader service; nothing is added until you review it.',
      },
    ],
    'expo-sharing',
  ],
  experiments: {
    typedRoutes: true,
  },
  // Surface the Melo gateway config on Constants.expoConfig.extra as a fallback for the
  // meloAiClient (which prefers the inlined process.env value). These are PUBLIC, keyless
  // values: the gateway URL and a weak shared token. The real OpenRouter key lives only as a
  // Cloudflare Worker secret (see services/ai-gateway) and never reaches the app/APK.
  extra: {
    ...config.extra,
    // Prefer an env override (EAS env / .env), else the deployed gateway. These ship in the app by
    // design — the URL and the WEAK shared token only. The real OpenRouter key is a Cloudflare Worker
    // secret and never reaches the app. Embedding here (Constants.expoConfig.extra) is reliable across
    // gradle/EAS builds, unlike EXPO_PUBLIC_* babel inlining which depends on the bundler's env.
    EXPO_PUBLIC_MELO_GATEWAY_URL:
      process.env.EXPO_PUBLIC_MELO_GATEWAY_URL ??
      'https://folio-ai-gateway.tgdroppin.workers.dev/v1',
    EXPO_PUBLIC_MELO_GATEWAY_TOKEN:
      process.env.EXPO_PUBLIC_MELO_GATEWAY_TOKEN ?? 'folio-local-38cf0d6da78a33a51382b91cafe0a7f2',
    // Clerk PUBLISHABLE key (pk_test_* — public by design, same tier as the gateway URL above).
    // The secret key never exists anywhere in this repo or app.
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
      'pk_test_dW5pdGVkLWdpcmFmZmUtMzMuY2xlcmsuYWNjb3VudHMuZGV2JA',
    // Sentry DSN — public submit-only key (crash reports; privacy-tuned init lives in
    // src/folio/lib/errorReporting.ts: no PII, no screenshots, no tracing).
    EXPO_PUBLIC_SENTRY_DSN:
      process.env.EXPO_PUBLIC_SENTRY_DSN ??
      'https://4593a25966a06219730d6509c801febf@o4511684285497344.ingest.de.sentry.io/4511684377641040',
  },
});
