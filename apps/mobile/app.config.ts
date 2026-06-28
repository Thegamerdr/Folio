import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Folio',
  slug: 'folio-v2-greenfield',
  scheme: 'folio',
  version: '0.0.1',
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
    allowBackup: false,
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    package: 'com.folio.v2.greenfield',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
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
        photosPermission:
          'Folio uses your photos only to read a statement you choose. Images stay on this device.',
        cameraPermission:
          'Folio uses the camera only to capture a statement you choose. Photos stay on this device.',
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
    EXPO_PUBLIC_MELO_GATEWAY_URL: process.env.EXPO_PUBLIC_MELO_GATEWAY_URL,
    EXPO_PUBLIC_MELO_GATEWAY_TOKEN: process.env.EXPO_PUBLIC_MELO_GATEWAY_TOKEN,
  },
});
