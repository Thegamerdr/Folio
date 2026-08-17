import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import {
  MELO_ATLAS as ATLAS,
  frameIndexForFilename,
  resolveMeloAtlasState,
} from './MeloAtlasContract';

// The source atlas is 4,992px tall, above the 4,096px texture ceiling still present on common
// Android GPUs. Rendering it as one translated Image also fails silently on some React Native GPU
// paths. The native player therefore packages the exact atlas as 24 lossless one-row textures and
// selects the row from the manifest rect. Frame coordinates and timings remain the source of truth.
const ATLAS_ROW_IMAGES = [
  require('../../../assets/melo/motion/native-atlas-rows/row-00.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-01.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-02.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-03.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-04.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-05.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-06.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-07.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-08.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-09.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-10.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-11.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-12.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-13.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-14.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-15.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-16.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-17.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-18.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-19.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-20.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-21.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-22.png') as number,
  require('../../../assets/melo/motion/native-atlas-rows/row-23.png') as number,
] as const;
const A_PLUS_STATIC_IMAGE =
  require('../../../assets/melo/motion/fenice-a-plus-static.png') as number;

type MeloAnimatedSpriteProps = Readonly<{
  visualState: string;
  width: number;
  height: number;
  reducedMotion: boolean;
  paused: boolean;
  wardrobeActive: boolean;
  wardrobeFallback: ReactNode;
}>;

/**
 * Native atlas player for the validated A+ companion pack.
 *
 * The character frame is always clipped to one uniform atlas cell. Cosmetics intentionally fall
 * back to the complete static wardrobe art because the current atlas has no truthful attachment
 * landmarks or animated cosmetic layers.
 */
export function MeloAnimatedSprite({
  visualState,
  width,
  height,
  reducedMotion,
  paused,
  wardrobeActive,
  wardrobeFallback,
}: MeloAnimatedSpriteProps) {
  const state = resolveMeloAtlasState(visualState);
  const animation = ATLAS.animations[state] ?? ATLAS.animations['idle-calm'];
  const [frameIndex, setFrameIndex] = useState(() =>
    animation ? frameIndexForFilename(animation, animation.entryFrame) : 0,
  );
  const [atlasFailed, setAtlasFailed] = useState(false);
  const [completedLoops, setCompletedLoops] = useState(0);

  useEffect(() => {
    if (!animation) return;
    setCompletedLoops(0);
    setFrameIndex(
      frameIndexForFilename(
        animation,
        reducedMotion ? animation.reducedMotionFallbackFrame : animation.entryFrame,
      ),
    );
  }, [animation, reducedMotion, state]);

  useEffect(() => {
    if (!animation || paused || reducedMotion || animation.frames.length <= 1) return undefined;
    const frame = animation.frames[frameIndex] ?? animation.frames[0];
    if (!frame) return undefined;
    const timer = setTimeout(
      () => {
        const next = frameIndex + 1;
        if (next < animation.frames.length) {
          setFrameIndex(next);
          return;
        }
        if (
          animation.loopType === 'loop' &&
          (animation.loopCount === null || completedLoops + 1 < animation.loopCount)
        ) {
          setCompletedLoops((value) => value + 1);
          setFrameIndex(0);
          return;
        }
        setFrameIndex(frameIndexForFilename(animation, animation.exitFrame));
      },
      Math.max(16, frame.durationMs),
    );
    return () => clearTimeout(timer);
  }, [animation, completedLoops, frameIndex, paused, reducedMotion]);

  const geometry = useMemo(() => {
    const scale = Math.min(width / ATLAS.atlas.cellWidth, height / ATLAS.atlas.cellHeight);
    const viewportWidth = ATLAS.atlas.cellWidth * scale;
    const viewportHeight = ATLAS.atlas.cellHeight * scale;
    return {
      scale,
      viewportWidth,
      viewportHeight,
      left: (width - viewportWidth) / 2,
      top: height - viewportHeight,
    };
  }, [height, width]);

  if (wardrobeActive) return wardrobeFallback;

  if (!animation || atlasFailed) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={A_PLUS_STATIC_IMAGE}
        resizeMode="contain"
        style={{ height, width }}
      />
    );
  }

  const frame = animation.frames[frameIndex] ?? animation.frames[0];
  if (!frame) return wardrobeFallback;
  const atlasRow = Math.floor(frame.rect.y / ATLAS.atlas.cellHeight);
  const atlasRowImage = ATLAS_ROW_IMAGES[atlasRow];
  if (!atlasRowImage) return wardrobeFallback;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ height, overflow: 'hidden', width }}
    >
      <View
        style={[
          styles.cellViewport,
          {
            height: geometry.viewportHeight,
            left: geometry.left,
            top: geometry.top,
            width: geometry.viewportWidth,
          },
        ]}
      >
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setAtlasFailed(true)}
          resizeMode="stretch"
          source={atlasRowImage}
          style={{
            height: geometry.viewportHeight,
            left: -frame.rect.x * geometry.scale,
            position: 'absolute',
            top: 0,
            width: ATLAS.atlas.width * geometry.scale,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cellViewport: {
    overflow: 'hidden',
    position: 'absolute',
  },
});
