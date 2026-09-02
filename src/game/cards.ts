import type { JobPair } from "../data/rounds";
import type { CardData } from "./types";

function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildRoundCards(pairs: JobPair[]): CardData[] {
  const cards: CardData[] = pairs.flatMap((pair, pairId) => [
    {
      id: `${pairId}-name`,
      pairId,
      kind: "name" as const,
      text: pair.name,
      matched: false,
    },
    {
      id: `${pairId}-task`,
      pairId,
      kind: "task" as const,
      text: pair.task,
      matched: false,
    },
  ]);

  return shuffle(cards);
}
