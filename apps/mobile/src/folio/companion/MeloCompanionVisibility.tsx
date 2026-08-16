import { createContext, useContext, type PropsWithChildren } from 'react';

const InlineMeloVisibilityContext = createContext(false);

export function MeloCompanionVisibilityProvider({
  suppressInlineCharacter,
  children,
}: PropsWithChildren<{ suppressInlineCharacter: boolean }>) {
  return (
    <InlineMeloVisibilityContext.Provider value={suppressInlineCharacter}>
      {children}
    </InlineMeloVisibilityContext.Provider>
  );
}

/** False only while the one root companion owns the screen, or while Quiet Mode hides all Melo art. */
export function useMeloInlineCharacterVisible(): boolean {
  return !useContext(InlineMeloVisibilityContext);
}
