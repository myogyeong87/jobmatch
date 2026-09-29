import { buildRoundCards } from "../game/cards";
import { subscribeStarted } from "../game/gameStart";
import { subscribePaused } from "../game/pause";
import type { JobPair } from "../data/rounds";
import type { CardData } from "../game/types";

const TOTAL_ROUNDS = 9;
const FLIP_STAGGER_MS = 45;
const WRONG_FEEDBACK_MS = 300;
const COUNTDOWN_STEP_MS = 700;

export interface RoundScreenHandle {
  destroy: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = ms / 1000;
  return `${totalSeconds.toFixed(1)}초`;
}

export function renderRoundScreen(
  root: HTMLElement,
  round: number,
  pairs: JobPair[],
  onComplete: (timeMs: number) => void,
): RoundScreenHandle {
  const cards = buildRoundCards(pairs);
  let remaining = pairs.length;
  let selected: CardData | null = null;
  let locked = false; // 오답 애니메이션 중 입력 잠금
  let finished = false;
  let started = false;
  let paused = false;
  let blocked: boolean | null = null; // 최초 구독 응답 전에는 미정
  let readyToPlay = false; // 카운트다운이 끝나 실제로 플레이 가능한 상태
  let pausedAccumMs = 0;
  let pausedAt: number | null = null;
  let startedAt = 0;
  let rafId = 0;
  let countdownToken = 0;

  root.innerHTML = `
    <section class="screen round-screen">
      <header class="round-header">
        <span class="round-indicator">${round} / ${TOTAL_ROUNDS} 라운드</span>
        <span class="round-timer" aria-live="off">0.0초</span>
      </header>
      <div class="card-grid">
        ${cards
          .map(
            (card, index) => `
          <button
            type="button"
            class="card card--${card.kind} card--facedown"
            data-id="${card.id}"
            style="transition-delay:${index * FLIP_STAGGER_MS}ms"
          >
            <span class="card-inner">
              <span class="card-face card-face--front">
                <span class="card-label">${card.kind === "name" ? "직업" : "하는 일"}</span>
                <span class="card-text">${escapeHtml(card.text)}</span>
              </span>
              <span class="card-face card-face--back" aria-hidden="true"></span>
            </span>
          </button>
        `,
          )
          .join("")}
      </div>
      <div class="pause-overlay" hidden>
        <p class="pause-overlay-title"></p>
        <p class="pause-overlay-desc"></p>
      </div>
      <div class="countdown-overlay" hidden>
        <p class="countdown-number">3</p>
      </div>
    </section>
  `;

  const timerEl = root.querySelector<HTMLSpanElement>(".round-timer")!;
  const pauseOverlayEl = root.querySelector<HTMLDivElement>(".pause-overlay")!;
  const pauseOverlayTitleEl = root.querySelector<HTMLParagraphElement>(".pause-overlay-title")!;
  const pauseOverlayDescEl = root.querySelector<HTMLParagraphElement>(".pause-overlay-desc")!;
  const countdownOverlayEl = root.querySelector<HTMLDivElement>(".countdown-overlay")!;
  const countdownNumberEl = root.querySelector<HTMLParagraphElement>(".countdown-number")!;
  const cardEls = new Map<string, HTMLButtonElement>();
  root.querySelectorAll<HTMLButtonElement>(".card").forEach((el) => {
    cardEls.set(el.dataset.id!, el);
  });

  function elapsedMs(): number {
    const pausedSoFar = pausedAt !== null ? pausedAccumMs + (performance.now() - pausedAt) : pausedAccumMs;
    return performance.now() - startedAt - pausedSoFar;
  }

  function tick(): void {
    if (finished) return;
    timerEl.textContent = formatElapsed(elapsedMs());
    rafId = requestAnimationFrame(tick);
  }

  function beginPlay(): void {
    readyToPlay = true;
    pausedAccumMs = 0;
    pausedAt = null;
    startedAt = performance.now();
    root.querySelectorAll<HTMLButtonElement>(".card--facedown").forEach((el) => {
      el.classList.remove("card--facedown");
    });
    rafId = requestAnimationFrame(tick);
  }

  function cancelCountdown(): void {
    countdownToken += 1;
    countdownOverlayEl.hidden = true;
  }

  function startCountdown(): void {
    const token = (countdownToken += 1);
    let n = 3;
    countdownOverlayEl.hidden = false;
    countdownNumberEl.textContent = String(n);

    const step = () => {
      if (countdownToken !== token) return;
      n -= 1;
      if (n > 0) {
        countdownNumberEl.textContent = String(n);
        countdownNumberEl.style.animation = "none";
        void countdownNumberEl.offsetWidth; // 애니메이션 재시작을 위한 강제 리플로우
        countdownNumberEl.style.animation = "";
        window.setTimeout(step, COUNTDOWN_STEP_MS);
      } else {
        countdownOverlayEl.hidden = true;
        beginPlay();
      }
    };
    window.setTimeout(step, COUNTDOWN_STEP_MS);
  }

  function applyBlockedState(): void {
    const nextBlocked = !started || paused;
    if (nextBlocked === blocked) return;
    blocked = nextBlocked;
    pauseOverlayEl.hidden = !blocked;
    if (!started) {
      pauseOverlayTitleEl.textContent = "대기 중";
      pauseOverlayDescEl.textContent = "선생님이 게임을 시작하면 바로 시작돼요";
    } else {
      pauseOverlayTitleEl.textContent = "일시정지";
      pauseOverlayDescEl.textContent = "선생님의 안내를 기다려 주세요";
    }

    if (blocked) {
      pausedAt = performance.now();
      if (!readyToPlay) cancelCountdown();
    } else {
      if (pausedAt !== null) {
        pausedAccumMs += performance.now() - pausedAt;
        pausedAt = null;
      }
      if (!readyToPlay) startCountdown();
    }
  }

  const unsubscribeStarted = subscribeStarted((next) => {
    started = next;
    applyBlockedState();
  });

  const unsubscribePause = subscribePaused((next) => {
    paused = next;
    applyBlockedState();
  });

  function findCard(id: string): CardData {
    const found = cards.find((c) => c.id === id);
    if (!found) throw new Error(`card not found: ${id}`);
    return found;
  }

  function clearSelection() {
    if (selected) {
      cardEls.get(selected.id)?.classList.remove("card--selected");
    }
    selected = null;
  }

  function destroy(): void {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(rafId);
    cancelCountdown();
    unsubscribePause();
    unsubscribeStarted();
  }

  root.querySelector(".card-grid")!.addEventListener("click", (event) => {
    if (finished || locked || blocked || !readyToPlay) return;
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(".card");
    if (!target) return;

    const card = findCard(target.dataset.id!);
    if (card.matched) return;

    if (!selected) {
      selected = card;
      target.classList.add("card--selected");
      return;
    }

    if (selected.id === card.id) {
      clearSelection();
      return;
    }

    if (selected.kind === card.kind) {
      cardEls.get(selected.id)?.classList.remove("card--selected");
      selected = card;
      target.classList.add("card--selected");
      return;
    }

    // 서로 다른 종류의 카드 두 장 선택 완료 -> 정답 검사
    const selectedCard = selected;
    const selectedEl = cardEls.get(selectedCard.id)!;
    if (selectedCard.pairId === card.pairId) {
      selectedCard.matched = true;
      card.matched = true;
      selectedEl.classList.remove("card--selected");
      selectedEl.classList.add("card--matched");
      target.classList.add("card--matched");
      selected = null;
      remaining -= 1;
      if (remaining === 0) {
        const elapsed = elapsedMs();
        destroy();
        timerEl.textContent = formatElapsed(elapsed);
        window.setTimeout(() => onComplete(elapsed), 350);
      }
    } else {
      locked = true;
      selectedEl.classList.add("card--wrong");
      target.classList.add("card--wrong");
      window.setTimeout(() => {
        selectedEl.classList.remove("card--selected", "card--wrong");
        target.classList.remove("card--wrong");
        selected = null;
        locked = false;
      }, WRONG_FEEDBACK_MS);
    }
  });

  return { destroy };
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
