// The ambient weather sky (MELO_BLUEPRINT.md §2 P2). A gradient that blends into the kit canvas,
// with restrained scene props per weather. Deliberately STILL in bad weather — motion reduces in
// danger states (§4 calm-down law); the storm is a dark quiet sky, never a violent animation.

import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { Weather } from '@folio/melo-engine';
import { useTheme } from '@/surfaces/pressureMap/kit';

import { WEATHER_VISUALS } from '../theme/weather';

const W = 390; // design width; the Svg scales to the container

type Props = {
  weather: Weather;
  height?: number;
};

export function WeatherSky({ weather, height = 200 }: Props) {
  const t = useTheme();
  const v = WEATHER_VISUALS[weather];

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="melo-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={v.top} />
          <Stop offset="0.55" stopColor={v.mid} />
          <Stop offset="1" stopColor={t.canvas} />
        </LinearGradient>
        <RadialGradient id="melo-sun" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#F7D48A" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#F7D48A" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="melo-rainbow" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#D9A05B" />
          <Stop offset="0.35" stopColor="#C9B36A" />
          <Stop offset="0.7" stopColor="#9FB07E" />
          <Stop offset="1" stopColor="#8FA3B0" />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={W} height={height} fill="url(#melo-sky)" />

      {weather === 'sunny' ? <Circle cx={318} cy={64} r={46} fill="url(#melo-sun)" /> : null}

      {weather === 'rain' ? (
        <>
          {[36, 92, 148, 204, 260, 316].map((x, i) => (
            <Rect
              key={x}
              x={x}
              y={22 + (i % 3) * 26}
              width={1.6}
              height={14}
              rx={1}
              fill="rgba(90,110,125,0.30)"
            />
          ))}
        </>
      ) : null}

      {weather === 'storm' ? (
        <>
          <Ellipse cx={120} cy={34} rx={78} ry={20} fill="rgba(26,32,40,0.16)" />
          <Ellipse cx={268} cy={52} rx={92} ry={22} fill="rgba(26,32,40,0.12)" />
        </>
      ) : null}

      {weather === 'fog' ? (
        <>
          <Rect
            x={-10}
            y={height * 0.42}
            width={W + 20}
            height={26}
            rx={13}
            fill="rgba(240,238,244,0.38)"
          />
          <Rect
            x={-10}
            y={height * 0.62}
            width={W + 20}
            height={18}
            rx={9}
            fill="rgba(240,238,244,0.28)"
          />
        </>
      ) : null}

      {weather === 'rainbow' ? (
        <Path
          d="M115 128 A80 80 0 0 1 275 128"
          stroke="url(#melo-rainbow)"
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          opacity={0.5}
        />
      ) : null}
    </Svg>
  );
}
