import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionErrorCode,
} from 'expo-speech-recognition';

import {
  buildMeloVoiceRecognitionOptions,
  describeMeloVoiceError,
  hasInstalledMeloVoiceLocale,
  resolveMeloVoiceRecognitionRoute,
  type MeloVoiceRecognitionRoute,
} from './meloVoiceRecognition';

export type MeloVoicePhase = 'idle' | 'starting' | 'listening' | 'processing' | 'review';
export type MeloVoiceStartResult = 'started' | 'needs-phone-service-consent' | 'unavailable';

export type MeloVoiceTranscript = Readonly<{
  phase: MeloVoicePhase;
  route: Exclude<MeloVoiceRecognitionRoute, 'unavailable'> | null;
  transcript: string;
  error: string | null;
  requestStart: () => Promise<MeloVoiceStartResult>;
  startWithPhoneService: () => Promise<boolean>;
  stop: () => void;
  discard: () => void;
  setTranscript: (value: string) => void;
}>;

/**
 * One foreground-only recognition session. A native result becomes reviewable text; this hook has
 * no callback that can apply a proposal or write a record.
 */
export function useMeloVoiceTranscript(active: boolean): MeloVoiceTranscript {
  const [phase, setPhase] = useState<MeloVoicePhase>('idle');
  const [route, setRoute] = useState<Exclude<MeloVoiceRecognitionRoute, 'unavailable'> | null>(
    null,
  );
  const [transcript, setTranscriptState] = useState('');
  const [error, setError] = useState<string | null>(null);

  const phaseRef = useRef<MeloVoicePhase>('idle');
  const transcriptRef = useRef('');
  const sessionActiveRef = useRef(false);
  const deliberateAbortRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const activeRef = useRef(active);

  const updatePhase = useCallback((next: MeloVoicePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const setTranscript = useCallback((value: string) => {
    transcriptRef.current = value;
    setTranscriptState(value);
  }, []);

  const abortNativeSession = useCallback(
    (clearTranscript: boolean) => {
      requestGenerationRef.current += 1;
      if (sessionActiveRef.current) {
        deliberateAbortRef.current = true;
        ExpoSpeechRecognitionModule.abort();
      }
      sessionActiveRef.current = false;
      setRoute(null);
      updatePhase('idle');
      if (clearTranscript) setTranscript('');
    },
    [setTranscript, updatePhase],
  );

  useSpeechRecognitionEvent('start', () => {
    if (!sessionActiveRef.current) return;
    updatePhase('listening');
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!sessionActiveRef.current) return;
    const nextTranscript = event.results[0]?.transcript?.trim() ?? '';
    if (nextTranscript) setTranscript(nextTranscript);
    if (!event.isFinal) return;
    sessionActiveRef.current = false;
    updatePhase(nextTranscript || transcriptRef.current.trim() ? 'review' : 'idle');
  });

  useSpeechRecognitionEvent('end', () => {
    if (!sessionActiveRef.current) return;
    sessionActiveRef.current = false;
    const hasTranscript = transcriptRef.current.trim().length > 0;
    updatePhase(hasTranscript ? 'review' : 'idle');
    if (!hasTranscript) {
      setError("Melo didn't hear anything. You can tap the mic to try once more, or type instead.");
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    const wasDeliberate = deliberateAbortRef.current;
    deliberateAbortRef.current = false;
    if (!sessionActiveRef.current && !wasDeliberate) return;
    sessionActiveRef.current = false;
    if (wasDeliberate || event.error === 'aborted') return;
    if (transcriptRef.current.trim()) {
      updatePhase('review');
      setError('Voice input stopped early. Review the words captured below, or discard them.');
      return;
    }
    updatePhase('idle');
    setError(describeMeloVoiceError(event.error as ExpoSpeechRecognitionErrorCode));
  });

  const beginRecognition = useCallback(
    async (
      recognitionRoute: Exclude<MeloVoiceRecognitionRoute, 'unavailable'>,
    ): Promise<boolean> => {
      const generation = requestGenerationRef.current + 1;
      requestGenerationRef.current = generation;
      setError(null);
      setTranscript('');
      setRoute(recognitionRoute);
      updatePhase('starting');

      const permission =
        recognitionRoute === 'on-device'
          ? await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync()
          : await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (generation !== requestGenerationRef.current || !activeRef.current) return false;
      if (!permission.granted) {
        setRoute(null);
        updatePhase('idle');
        setError(
          permission.canAskAgain
            ? 'Microphone access is needed for voice input. You can also type instead.'
            : 'Microphone access is off. You can enable it in phone settings, or type instead.',
        );
        return false;
      }

      try {
        deliberateAbortRef.current = false;
        sessionActiveRef.current = true;
        ExpoSpeechRecognitionModule.start(buildMeloVoiceRecognitionOptions(recognitionRoute));
        return true;
      } catch {
        sessionActiveRef.current = false;
        setRoute(null);
        updatePhase('idle');
        setError('Voice input could not start. You can type instead.');
        return false;
      }
    },
    [setTranscript, updatePhase],
  );

  const requestStart = useCallback(async (): Promise<MeloVoiceStartResult> => {
    if (!activeRef.current || phaseRef.current !== 'idle') return 'unavailable';
    let nextRoute = resolveMeloVoiceRecognitionRoute(
      ExpoSpeechRecognitionModule.isRecognitionAvailable(),
      ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
    );
    if (nextRoute === 'on-device' && Platform.OS === 'android') {
      try {
        const locales = await ExpoSpeechRecognitionModule.getSupportedLocales({
          androidRecognitionServicePackage: 'com.google.android.as',
        });
        if (!hasInstalledMeloVoiceLocale(locales.installedLocales)) nextRoute = 'phone-service';
      } catch {
        // An Android recognizer that cannot prove an installed offline locale is treated as the
        // disclosed phone-service route. We never silently relax requiresOnDeviceRecognition.
        nextRoute = 'phone-service';
      }
    }
    if (!activeRef.current || phaseRef.current !== 'idle') return 'unavailable';
    if (nextRoute === 'unavailable') {
      setError('Speech recognition is not available on this phone. You can type instead.');
      return 'unavailable';
    }
    if (nextRoute === 'phone-service') return 'needs-phone-service-consent';
    return (await beginRecognition(nextRoute)) ? 'started' : 'unavailable';
  }, [beginRecognition]);

  const startWithPhoneService = useCallback(async (): Promise<boolean> => {
    if (!activeRef.current || phaseRef.current !== 'idle') return false;
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError('Speech recognition is not available on this phone. You can type instead.');
      return false;
    }
    return beginRecognition('phone-service');
  }, [beginRecognition]);

  const stop = useCallback(() => {
    if (!sessionActiveRef.current) return;
    updatePhase('processing');
    ExpoSpeechRecognitionModule.stop();
  }, [updatePhase]);

  const discard = useCallback(() => {
    setError(null);
    abortNativeSession(true);
  }, [abortNativeSession]);

  useEffect(() => {
    activeRef.current = active;
    if (!active) abortNativeSession(true);
  }, [abortNativeSession, active]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') abortNativeSession(true);
    });
    return () => {
      subscription.remove();
      requestGenerationRef.current += 1;
      if (sessionActiveRef.current) ExpoSpeechRecognitionModule.abort();
      sessionActiveRef.current = false;
    };
  }, [abortNativeSession]);

  return {
    phase,
    route,
    transcript,
    error,
    requestStart,
    startWithPhoneService,
    stop,
    discard,
    setTranscript,
  };
}
