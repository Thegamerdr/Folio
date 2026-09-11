import { createContext } from 'react';

// Screens keep their layout while a sheet/keyboard owns the viewport; the
// character's body and motion are suppressed without resetting preferences.
export const MeloSuppressedContext = createContext(false);
