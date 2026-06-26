import { type CompactMeloNote } from '../local/localMeloPolicyAdapter';
import { CompactMeloNoteSurface } from './compactMeloNoteSurface';

export function RecoveryPathSurface({ note }: Readonly<{ note: CompactMeloNote }>) {
  return <CompactMeloNoteSurface note={note} tone="warm" />;
}
