import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { base64 } from '@scure/base';
import { Platform } from 'react-native';

import {
  FEEDBACK_MAP,
  type FeedbackEvent,
  type FeedbackHaptic,
  type FeedbackSound,
} from './feedbackMap';

export type FeedbackOptions = Readonly<{
  soundEnabled?: boolean;
  quietMode?: boolean;
}>;

let audioConfigured = false;
const soundUris = new Map<Exclude<FeedbackSound, null>, string>();

/** Supplementary physical feedback for committed actions. Every caller also supplies visible
 * state/copy; a missing motor or disabled setting never changes the outcome of the action. */
export async function triggerFeedback(
  event: FeedbackEvent,
  options: FeedbackOptions = {},
): Promise<void> {
  const rule = FEEDBACK_MAP[event];
  const jobs: Promise<void>[] = [];
  if (rule.haptic !== null) jobs.push(playHaptic(rule.haptic));
  if (rule.sound !== null && options.soundEnabled === true && options.quietMode !== true) {
    jobs.push(playSound(rule.sound));
  }
  await Promise.allSettled(jobs);
}

async function playHaptic(haptic: FeedbackHaptic): Promise<void> {
  if (haptic === null || Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    const type =
      haptic === 'error'
        ? Haptics.AndroidHaptics.Reject
        : haptic === 'heavy'
          ? Haptics.AndroidHaptics.Long_Press
          : haptic === 'medium' || haptic === 'success'
            ? Haptics.AndroidHaptics.Confirm
            : Haptics.AndroidHaptics.Virtual_Key;
    await Haptics.performAndroidHapticsAsync(type);
    return;
  }
  if (haptic === 'success') {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return;
  }
  if (haptic === 'error') {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    return;
  }
  const style =
    haptic === 'heavy'
      ? Haptics.ImpactFeedbackStyle.Heavy
      : haptic === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
  await Haptics.impactAsync(style);
}

async function playSound(sound: Exclude<FeedbackSound, null>): Promise<void> {
  if (Platform.OS === 'web') return;
  const uri = await soundUri(sound);
  if (!audioConfigured) {
    await setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
    audioConfigured = true;
  }
  const player = createAudioPlayer(uri, { keepAudioSessionActive: false });
  player.volume = sound === 'bell-warm' ? 0.2 : 0.16;
  player.play();
  setTimeout(() => player.remove(), sound === 'bell-warm' ? 1_300 : 900);
}

async function soundUri(sound: Exclude<FeedbackSound, null>): Promise<string> {
  const existing = soundUris.get(sound);
  if (existing !== undefined) return existing;
  const cache = FileSystem.cacheDirectory;
  if (cache === null) throw new Error('Sound cache is unavailable.');
  const uri = `${cache}melo-${sound}-v1.wav`;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.writeAsStringAsync(uri, base64.encode(synthesiseSound(sound)), {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
  soundUris.set(sound, uri);
  return uri;
}

/** A tiny deterministic PCM sound bank avoids network audio and keeps the optional cues private.
 * The warm bell is 800ms; the soft two-note chime is 400ms, matching the approved feedback map. */
function synthesiseSound(sound: Exclude<FeedbackSound, null>): Uint8Array {
  const sampleRate = 22_050;
  const duration = sound === 'bell-warm' ? 0.8 : 0.4;
  const samples = Math.round(sampleRate * duration);
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeAscii(bytes, 8, 'WAVE');
  writeAscii(bytes, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, 'data');
  view.setUint32(40, samples * 2, true);

  for (let index = 0; index < samples; index++) {
    const time = index / sampleRate;
    const attack = Math.min(1, time / 0.012);
    const release = Math.min(1, (duration - time) / 0.04);
    const envelope = attack * Math.max(0, release);
    let value: number;
    if (sound === 'bell-warm') {
      value =
        Math.sin(2 * Math.PI * 523.25 * time) * Math.exp(-3.3 * time) * 0.58 +
        Math.sin(2 * Math.PI * 784.88 * time) * Math.exp(-5.4 * time) * 0.25 +
        Math.sin(2 * Math.PI * 1_046.5 * time) * Math.exp(-7.1 * time) * 0.12;
    } else {
      const secondTime = Math.max(0, time - 0.075);
      value =
        Math.sin(2 * Math.PI * 659.25 * time) * Math.exp(-8.2 * time) * 0.58 +
        (time >= 0.075
          ? Math.sin(2 * Math.PI * 987.77 * secondTime) * Math.exp(-9.5 * secondTime) * 0.34
          : 0);
    }
    view.setInt16(44 + index * 2, Math.round(clamp(value * envelope, -1, 1) * 12_000), true);
  }
  return bytes;
}

function writeAscii(target: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index++) {
    target[offset + index] = value.charCodeAt(index);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
