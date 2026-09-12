import { createContext, useContext, type ReactNode } from 'react';

type BottomChromeContextValue = {
  contentBottomPadding: number;
};

const BottomChromeContext = createContext<BottomChromeContextValue | null>(null);

export function BottomChromeProvider({
  measuredHeight,
  systemBottomInset,
  children,
}: {
  measuredHeight: number;
  systemBottomInset: number;
  children: ReactNode;
}) {
  // The measured wrapper includes S. Remove it before adding max(S, 24), avoiding double-counting.
  const appTabHeight = Math.max(0, measuredHeight - systemBottomInset);
  const contentBottomPadding = appTabHeight + Math.max(systemBottomInset, 24);
  return (
    <BottomChromeContext.Provider value={{ contentBottomPadding }}>
      {children}
    </BottomChromeContext.Provider>
  );
}

export function useBottomChromeContentPadding() {
  return useContext(BottomChromeContext)?.contentBottomPadding ?? 84;
}
