import type { RoundBest } from "../game/leaderboard";

const AUTO_ADVANCE_MS = 4000;
const TOTAL_ROUNDS = 9;

export interface ResultScreenHandle {
  showRank: (rank: number) => void;
  showBest: (best: RoundBest | null, displayName: string) => void;
  destroy: () => void;
}

export function renderResultScreen(
  root: HTMLElement,
  round: number,
  timeMs: number,
  onNext: () => void,
): ResultScreenHandle {
  const seconds = (timeMs / 1000).toFixed(1);
  const isLastRound = round === TOTAL_ROUNDS;

  root.innerHTML = `
    <section class="screen result-screen">
      <p class="result-round">${round} / ${TOTAL_ROUNDS} 라운드 완료!</p>
      <p class="result-time">${seconds}<span class="result-unit">초</span></p>
      <p class="result-rank" data-state="loading">등수 확인 중...</p>
      <p class="result-best" data-state="loading">최고 기록 확인 중...</p>
      <p class="result-next">${isLastRound ? "결과를 정리하고 있어요" : "곧 다음 라운드로 넘어가요"}</p>
    </section>
  `;

  const rankEl = root.querySelector<HTMLParagraphElement>(".result-rank")!;
  const bestEl = root.querySelector<HTMLParagraphElement>(".result-best")!;

  const advanceTimeoutId = window.setTimeout(onNext, AUTO_ADVANCE_MS);

  return {
    destroy() {
      window.clearTimeout(advanceTimeoutId);
    },
    showRank(rank: number) {
      rankEl.dataset.state = "ready";
      rankEl.innerHTML = `현재 <strong>${rank}</strong>등`;
    },
    showBest(best: RoundBest | null, displayName: string) {
      bestEl.dataset.state = "ready";
      if (!best) {
        bestEl.hidden = true;
        return;
      }
      const bestSeconds = (best.timeMs / 1000).toFixed(1);
      bestEl.innerHTML =
        best.name === displayName
          ? `🎉 이 라운드 최고 기록이에요!`
          : `이 라운드 최고 기록 <strong>${bestSeconds}초</strong> (${escapeHtml(best.name)})`;
    },
  };
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
