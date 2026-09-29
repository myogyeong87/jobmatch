import "./style.css";
import { rounds } from "./data/rounds";
import {
  checkSession,
  normalizeSessionCode,
  sessionCodeFromUrl,
  setActiveSession,
  writeSessionCodeToUrl,
} from "./game/classSession";
import { claimDisplayName } from "./game/nameCounter";
import { getRoundBest, submitRoundResult } from "./game/leaderboard";
import { subscribeKicked, updatePlayer } from "./game/player";
import { renderSessionCodeScreen } from "./screens/sessionCodeScreen";
import { renderStartScreen } from "./screens/startScreen";
import { renderRoundScreen } from "./screens/roundScreen";
import { renderResultScreen } from "./screens/resultScreen";
import { renderFinalScreen } from "./screens/finalScreen";
import { renderKickedScreen } from "./screens/kickedScreen";

const app = document.querySelector<HTMLDivElement>("#app")!;

interface GameState {
  displayName: string;
  roundTimes: number[];
}

function newState(): GameState {
  return { displayName: "", roundTimes: [] };
}

let state = newState();
let cleanupScreen: (() => void) | null = null;
let unsubscribeKicked: (() => void) | null = null;

function teardown(): void {
  cleanupScreen?.();
  cleanupScreen = null;
}

function startGame(): void {
  unsubscribeKicked?.();
  unsubscribeKicked = null;
  teardown();
  state = newState();
  showStartScreen();
}

function showSessionCodeScreen(initialCode?: string, message?: string): void {
  renderSessionCodeScreen(app, { initialCode, message }, (rawCode) => {
    const code = normalizeSessionCode(rawCode);
    if (!code) {
      showSessionCodeScreen(rawCode, "세션 코드는 영어와 숫자 6자리예요.");
      return;
    }
    openSession(code);
  });
}

async function openSession(code: string): Promise<void> {
  let check;
  try {
    check = await checkSession(code);
  } catch (err) {
    console.error("[session] 세션 확인 실패", err);
    showSessionCodeScreen(code, "연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.");
    return;
  }

  if (check !== "ok") {
    writeSessionCodeToUrl(null);
    showSessionCodeScreen(
      code,
      check === "expired"
        ? "만료된 세션이에요. 선생님께 새 코드를 받아 주세요."
        : "없는 세션 코드예요. 다시 확인해 주세요.",
    );
    return;
  }

  setActiveSession(code);
  writeSessionCodeToUrl(code);
  startGame();
}

function showStartScreen(): void {
  renderStartScreen(app, async (name) => {
    state.displayName = await claimDisplayName(name);
    unsubscribeKicked = subscribeKicked(state.displayName, (kicked) => {
      if (kicked) showKicked();
    });
    showRound(1);
  });
}

function showKicked(): void {
  teardown();
  renderKickedScreen(app, startGame);
}

function showRound(round: number): void {
  updatePlayer(state.displayName, round, "playing").catch((err) =>
    console.error("[session] 상태 갱신 실패", err),
  );

  const pairs = rounds[round - 1];
  const handle = renderRoundScreen(app, round, pairs, (timeMs) => {
    cleanupScreen = null;
    state.roundTimes.push(timeMs);
    showResult(round, timeMs);
  });
  cleanupScreen = handle.destroy;
}

function showResult(round: number, timeMs: number): void {
  const handle = renderResultScreen(
    app,
    round,
    timeMs,
    () => {
      cleanupScreen = null;
      if (round < rounds.length) {
        showRound(round + 1);
      } else {
        showFinal();
      }
    },
  );
  cleanupScreen = handle.destroy;

  submitRoundResult(round, state.displayName, timeMs)
    .then((rank) => {
      handle.showRank(rank);
      updatePlayer(state.displayName, round, "result", rank).catch((err) =>
        console.error("[session] 상태 갱신 실패", err),
      );
    })
    .catch((err) => {
      console.error("[leaderboard] 등수 계산 실패", err);
      handle.showRank(1);
    });

  getRoundBest(round)
    .then((best) => handle.showBest(best, state.displayName))
    .catch((err) => {
      console.error("[leaderboard] 최고 기록 조회 실패", err);
      handle.showBest(null, state.displayName);
    });
}

function showFinal(): void {
  updatePlayer(state.displayName, rounds.length, "finished").catch((err) =>
    console.error("[session] 상태 갱신 실패", err),
  );
  renderFinalScreen(app, state.displayName, state.roundTimes, startGame);
}

const initialCode = sessionCodeFromUrl();
if (initialCode) {
  openSession(initialCode);
} else {
  showSessionCodeScreen();
}
