import "./style.css";
import { rounds } from "./data/rounds";
import { claimDisplayName } from "./game/nameCounter";
import { submitRoundResult } from "./game/leaderboard";
import { renderStartScreen } from "./screens/startScreen";
import { renderRoundScreen } from "./screens/roundScreen";
import { renderResultScreen } from "./screens/resultScreen";
import { renderFinalScreen } from "./screens/finalScreen";

const app = document.querySelector<HTMLDivElement>("#app")!;

interface GameState {
  displayName: string;
  roundTimes: number[];
}

function newState(): GameState {
  return { displayName: "", roundTimes: [] };
}

let state = newState();

function startGame(): void {
  state = newState();
  showStartScreen();
}

function showStartScreen(): void {
  renderStartScreen(app, async (name) => {
    state.displayName = await claimDisplayName(name);
    showRound(1);
  });
}

function showRound(round: number): void {
  const pairs = rounds[round - 1];
  renderRoundScreen(app, round, pairs, (timeMs) => {
    state.roundTimes.push(timeMs);
    showResult(round, timeMs);
  });
}

function showResult(round: number, timeMs: number): void {
  const handle = renderResultScreen(
    app,
    round,
    timeMs,
    () => {
      if (round < rounds.length) {
        showRound(round + 1);
      } else {
        showFinal();
      }
    },
  );

  submitRoundResult(round, state.displayName, timeMs)
    .then((rank) => handle.showRank(rank))
    .catch((err) => {
      console.error("[leaderboard] 등수 계산 실패", err);
      handle.showRank(1);
    });
}

function showFinal(): void {
  renderFinalScreen(app, state.displayName, state.roundTimes, startGame);
}

startGame();
