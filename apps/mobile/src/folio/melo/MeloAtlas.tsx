import { useEffect, useState } from 'react';
import { AppState, Image, View } from 'react-native';
import { useAppStore } from '@/folio/store';
import { Melo } from './Melo';
import type { PresencePhase } from '@/folio/lib/melo/presenceMotion';

type Frame = {
  filename: string;
  rect: { x: number; y: number; width: number; height: number };
  durationMs: number;
};
type Clip = {
  frames: Frame[];
  entryFrame: string;
  exitFrame: string;
  reducedMotionFallbackFrame: string;
  loopType: string;
  loopCount: number | null;
};
const manifest = require('./assets/fenice-melo-atlas.json') as {
  atlas: { width: number; height: number; cellWidth: number; cellHeight: number };
  animations: Record<string, Clip>;
};
const atlas = require('./assets/fenice-melo-atlas.webp');

/** The unchanged ad90b4 atlas, with the reference frame/loop timing and state
 * mapping. Native Image cropping replaces CSS background-position only. */
export function MeloAtlas({
  size,
  phase,
  faceLeft,
  shortHop,
  paused,
}: {
  size: number;
  phase: PresencePhase;
  faceLeft: boolean;
  shortHop: boolean;
  paused: boolean;
}) {
  const wardrobe = useAppStore((state) => state.melo?.wardrobe);
  const [failed, setFailed] = useState(false);
  const [backgrounded, setBackgrounded] = useState(AppState.currentState !== 'active');
  const direction = faceLeft ? 'left' : 'right';
  const name =
    phase === 'waiting'
      ? 'waiting-for-user'
      : phase === 'entering'
        ? 'settle'
        : phase === 'peeking'
          ? 'peek'
          : phase === 'leaving'
            ? `takeoff-${direction}`
            : phase === 'moving'
              ? `${shortHop ? 'move-short' : 'flight-loop'}-${direction}`
              : 'idle-calm';
  const clip = manifest.animations[name] ?? manifest.animations['idle-calm']!;
  const poster = Math.max(
    0,
    clip.frames.findIndex((frame) => frame.filename === clip.reducedMotionFallbackFrame),
  );
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setBackgrounded(state !== 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    let frameIndex = Math.max(
      0,
      clip.frames.findIndex((frame) => frame.filename === clip.entryFrame),
    );
    let loops = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setIndex(paused ? poster : frameIndex);
    if (paused || backgrounded || failed || wardrobe?.length) return;
    const advance = () => {
      const frame = clip.frames[frameIndex]!;
      timer = setTimeout(
        () => {
          if (frameIndex < clip.frames.length - 1) frameIndex++;
          else if (
            clip.loopType === 'loop' &&
            (clip.loopCount === null || ++loops < clip.loopCount)
          ) {
            frameIndex = Math.max(
              0,
              clip.frames.findIndex((entry) => entry.filename === clip.entryFrame),
            );
          } else {
            setIndex(
              Math.max(
                0,
                clip.frames.findIndex((entry) => entry.filename === clip.exitFrame),
              ),
            );
            return;
          }
          setIndex(frameIndex);
          advance();
        },
        Math.max(16, frame.durationMs),
      );
    };
    advance();
    return () => clearTimeout(timer);
  }, [clip, paused, poster, backgrounded, failed, wardrobe]);
  // The reference preserves equipped static wardrobe art instead of dropping
  // the accessory when switching to the animation atlas.
  if (failed || wardrobe?.length) return <Melo mood="calm" size={Math.ceil(size / 0.82)} frozen />;
  const frame = clip.frames[paused ? poster : index] ?? clip.frames[0]!;
  const scale = size / manifest.atlas.cellWidth;
  return (
    <View style={{ width: size, height: manifest.atlas.cellHeight * scale, overflow: 'hidden' }}>
      <Image
        source={atlas}
        resizeMode="stretch"
        fadeDuration={0}
        onError={() => setFailed(true)}
        style={{
          position: 'absolute',
          width: manifest.atlas.width * scale,
          height: manifest.atlas.height * scale,
          left: -frame.rect.x * scale,
          top: -frame.rect.y * scale,
        }}
      />
    </View>
  );
}
