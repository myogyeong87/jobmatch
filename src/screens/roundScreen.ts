import { buildRoundCards } from "../game/cards";
import type { JobPair } from "../data/rounds";
import type { CardData } from "../game/types";

const TOTAL_ROUNDS = 9;
const FLIP_STAGGER_MS = 45;
const WRONG_FEEDBACK_MS = 500;

function formatElapsed(ms: number): string {
  const totalSeconds = ms / 1000;
  return `${totalSeconds.toFixed(1)}초`;
}

export function renderRoundScreen(
  root: HTMLElement,
  round: number,
  pairs: JobPair[],
  onComplete: (timeMs: number) => void,
): void {
  const cards = buildRoundCards(pairs);
  let remaining = pairs.length;
  let selected: CardData | null = null;
  let locked = false; // 오답 애니메이션 중 입력 잠금
  let finished = false;

  const startedAt = performance.now();

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
              <span class="card-face card-face--front">${escapeHtml(card.text)}</span>
              <span class="card-face card-face--back" aria-hidden="true"></span>
            </span>
          </button>
        `,
          )
          .join("")}
      </div>
    </section>
  `;

  const timerEl = root.querySelector<HTMLSpanElement>(".round-timer")!;
  const cardEls = new Map<string, HTMLButtonElement>();
  root.querySelectorAll<HTMLButtonElement>(".card").forEach((el) => {
    cardEls.set(el.dataset.id!, el);
  });

  // 카드 뒷면 -> 앞면 진입 애니메이션 (라운드 시작 연출)
  requestAnimationFrame(() => {
    root.querySelectorAll<HTMLButtonElement>(".card--facedown").forEach((el) => {
      el.classList.remove("card--facedown");
    });
  });

  let rafId = requestAnimationFrame(function tick() {
    if (finished) return;
    timerEl.textContent = formatElapsed(performance.now() - startedAt);
    rafId = requestAnimationFrame(tick);
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

  root.querySelector(".card-grid")!.addEventListener("click", (event) => {
    if (finished || locked) return;
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
        finished = true;
        cancelAnimationFrame(rafId);
        const elapsed = performance.now() - startedAt;
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
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
