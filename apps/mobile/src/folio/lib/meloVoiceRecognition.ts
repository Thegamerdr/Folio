import type {
  ExpoSpeechRecognitionErrorCode,
  ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition';

export const MELO_VOICE_LOCALE = 'en-GB';

export type MeloVoiceRecognitionRoute = 'on-device' | 'phone-service' | 'unavailable';

/**
 * Capability is resolved on every explicit microphone tap. On-device recognition wins whenever
 * the platform reports it; the phone speech service is an explicit, disclosed fallback.
 */
export function resolveMeloVoiceRecognitionRoute(
  recognitionAvailable: boolean,
  onDeviceRecognitionAvailable: boolean,
): MeloVoiceRecognitionRoute {
  if (!recognitionAvailable) return 'unavailable';
  return onDeviceRecognitionAvailable ? 'on-device' : 'phone-service';
}

export function hasInstalledMeloVoiceLocale(installedLocales: readonly string[]): boolean {
  const wanted = MELO_VOICE_LOCALE.toLowerCase();
  const wantedLanguage = wanted.split('-')[0];
  return installedLocales.some((locale) => {
    const candidate = locale.toLowerCase();
    return candidate === wanted || candidate.split('-')[0] === wantedLanguage;
  });
}

/**
 * Speech recognition is deliberately single-session and never persists a recording. In particular,
 * do not add `recordingOptions`: the native module only writes raw audio when persistence is opted in.
 */
export function buildMeloVoiceRecognitionOptions(
  route: Exclude<MeloVoiceRecognitionRoute, 'unavailable'>,
): ExpoSpeechRecognitionOptions {
  return {
    lang: MELO_VOICE_LOCALE,
    interimResults: true,
    continuous: false,
    maxAlternatives: 1,
    requiresOnDeviceRecognition: route === 'on-device',
    addsPunctuation: true,
  };
}

export function describeMeloVoiceError(error: ExpoSpeechRecognitionErrorCode): string {
  switch (error) {
    case 'no-speech':
    case 'speech-timeout':
      return "Melo didn't hear anything. You can tap the mic to try once more, or type instead.";
    case 'not-allowed':
      return 'Microphone access is off. You can enable it in phone settings, or type instead.';
    case 'language-not-supported':
      return 'English speech recognition is not ready on this phone. You can type instead.';
    case 'network':
      return 'The phone speech service could not finish. You can try once more, or type instead.';
    case 'audio-capture':
    case 'interrupted':
    case 'busy':
      return 'Voice input stopped because the microphone became unavailable. You can type instead.';
    case 'service-not-allowed':
      return 'Speech recognition is not available on this phone. You can type instead.';
    case 'aborted':
      return '';
    case 'bad-grammar':
    case 'client':
    case 'unknown':
      return 'Voice input stopped. You can tap the mic to try once more, or type instead.';
  }
}
