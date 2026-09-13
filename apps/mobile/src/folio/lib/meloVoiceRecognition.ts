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
      return 'No speech detected. Try again or type instead.';
    case 'not-allowed':
      return 'Microphone access is off.\nAllow microphone access in your phone settings, or keep typing.';
    case 'language-not-supported':
      return 'Speech isn’t available right now. Keep typing or try later.';
    case 'network':
      return 'Couldn’t start listening. Keep typing, or try again.';
    case 'audio-capture':
    case 'interrupted':
    case 'busy':
      return 'Couldn’t start listening. Keep typing, or try again.';
    case 'service-not-allowed':
      return 'Speech isn’t available right now. Keep typing or try later.';
    case 'aborted':
      return '';
    case 'bad-grammar':
    case 'client':
    case 'unknown':
      return 'Voice input stopped. Keep typing, or try again.';
  }
}
