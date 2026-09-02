export type CardKind = "name" | "task";

export interface CardData {
  id: string;
  pairId: number;
  kind: CardKind;
  text: string;
  matched: boolean;
}

export interface RoundOutcome {
  round: number;
  timeMs: number;
  rank: number;
}

export interface GameState {
  displayName: string;
  currentRound: number;
  roundTimes: number[];
}
