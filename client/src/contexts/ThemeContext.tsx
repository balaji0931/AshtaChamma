// ============================================================================
// Theme Context — Dice type + Pawn style + Board theme selection
// ============================================================================

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type DiceType = 'tamarind' | 'cowrie';
export type PawnStyle = 'ludo' | 'checkers' | 'rural';
export type BoardTheme = 'css' | 'paper' | 'wood' | 'marble' | 'slate';

interface ThemeContextValue {
  diceType: DiceType;
  pawnStyle: PawnStyle;
  boardTheme: BoardTheme;
  setDiceType: (type: DiceType) => void;
  setPawnStyle: (style: PawnStyle) => void;
  setBoardTheme: (theme: BoardTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [diceType, setDiceTypeState] = useState<DiceType>(
    () => loadFromStorage('ac_diceType', 'tamarind' as DiceType),
  );
  const [pawnStyle, setPawnStyleState] = useState<PawnStyle>(
    () => loadFromStorage('ac_pawnStyle', 'rural' as PawnStyle),
  );
  const [boardTheme, setBoardThemeState] = useState<BoardTheme>(
    () => loadFromStorage('ac_boardTheme', 'css' as BoardTheme),
  );

  const setDiceType = useCallback((type: DiceType) => {
    setDiceTypeState(type);
    localStorage.setItem('ac_diceType', JSON.stringify(type));
  }, []);

  const setPawnStyle = useCallback((style: PawnStyle) => {
    setPawnStyleState(style);
    localStorage.setItem('ac_pawnStyle', JSON.stringify(style));
  }, []);

  const setBoardTheme = useCallback((theme: BoardTheme) => {
    setBoardThemeState(theme);
    localStorage.setItem('ac_boardTheme', JSON.stringify(theme));
  }, []);

  return (
    <ThemeContext.Provider value={{ diceType, pawnStyle, boardTheme, setDiceType, setPawnStyle, setBoardTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
