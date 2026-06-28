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
});
