// ============================================================================
// Dice Wrapper — Selects TamarindDice or CowrieDice based on theme
// ============================================================================

import { PlayerPosition } from '@shared/types';
import { useTheme } from '../contexts/ThemeContext';
import { TamarindDice } from './dice/TamarindDice';
import { CowrieDice } from './dice/CowrieDice';

interface DiceProps {
  position: PlayerPosition;
}

export function Dice({ position }: DiceProps) {
  const { diceType } = useTheme();

  switch (diceType) {
    case 'cowrie':
      return <CowrieDice position={position} />;
    case 'tamarind':
    default:
      return <TamarindDice position={position} />;
  }
}
