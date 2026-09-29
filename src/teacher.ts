import "./style.css";
import { onSnapshot } from "firebase/firestore";
import confetti from "canvas-confetti";
import QRCode from "qrcode";
import { firebaseConfigured } from "./firebase";
import {
  SESSION_TTL_DAYS,
  activeSessionCode,
  activeSessionCollection,
  checkSession,
  createSession,
  normalizeSessionCode,
  sessionCodeFromUrl,
  setActiveSession,
  writeSessionCodeToUrl,
} from "./game/classSession";
import { setStarted, subscribeStarted } from "./game/gameStart";
import { roundEntries, type RoundBest } from "./game/leaderboard";
import { setPaused, subscribePaused } from "./game/pause";
import { kickPlayer } from "./game/player";
import { setRevealed, subscribeRevealed } from "./game/reveal";

interface SessionRow {
  name: string;
  currentRound: number;
  status: "playing" | "result" | "finished";
  lastRoundRank?: number;
  kicked?: boolean;
}

interface FinalRow {
  name: string;
  totalMs: number;
}

interface RankedRow extends FinalRow {
  rank: number;
}

const TOTAL_ROUNDS = 9;
const REVEAL_MAX_TIERS = 5;
const REVEAL_INTRO_MS = 1800;
const REVEAL_STEP_MS = 1800;

const LAST_SESSION_KEY = "jobmatch:lastTeacherSession";

const app = document.querySelector<HTMLDivElement>("#app")!;
let revealToken = 0;

function studentUrl(): string {
  return `${window.location.origin}/?s=${activeSessionCode()}`;
}

const STATUS_LABEL: Record<SessionRow["status"], string> = {
  playing: "게임 중",
  result: "결과 확인 중",
  finished: "전체 완료",
};

function render(
  sessions: SessionRow[],
  finalRanking: FinalRow[],
  roundBests: Map<number, RoundBest>,
  started: boolean,
  paused: boolean,
  hasRevealed: boolean,
  qrModalOpen: boolean,
): void {
  const sortedSessions = sessions.slice().sort((a, b) => {
    if (a.currentRound !== b.currentRound) return b.currentRound - a.currentRound;
    return a.name.localeCompare(b.name, "ko");
  });

  const scrollScreen = app.querySelector<HTMLElement>(".teacher-screen")?.scrollTop ?? 0;
  const scrollParticipants = app.querySelector<HTMLElement>(".participant-table-scroll")?.scrollTop ?? 0;

  app.innerHTML = `
    <section class="teacher-screen">
      <header class="teacher-header">
        <div class="teacher-header-text">
          <h1>직업 짝맞추기 현황판</h1>
          <p class="teacher-session-code">세션 코드 <strong>${activeSessionCode()}</strong></p>
          <p class="teacher-subtitle">${started ? "총 참여 인원" : "대기 중인 학생"} ${sortedSessions.length}명${started && paused ? ` · <span class="status-badge status-badge--paused">일시정지 중</span>` : ""}</p>
        </div>
        <div class="teacher-controls">
          <button type="button" id="qr-toggle-btn" class="teacher-btn">QR 코드</button>
          ${
            !started
              ? `<button type="button" id="start-game-btn" class="teacher-btn teacher-btn--start">게임 시작</button>`
              : `
            <button type="button" id="pause-toggle" class="teacher-btn${paused ? " teacher-btn--active" : ""}">
              ${paused ? "재개하기" : "일시정지"}
            </button>
            <button type="button" id="end-game-btn" class="teacher-btn teacher-btn--accent">게임 종료</button>
          `
          }
          <button type="button" id="new-session-btn" class="teacher-btn teacher-btn--danger">새 세션</button>
        </div>
      </header>

      <div class="teacher-panels">
        <section class="teacher-panel">
          <h2>${started ? "실시간 참여 현황" : "대기 명단"}</h2>
          ${!started ? `<p class="teacher-panel-desc">명단과 인원을 확인하고 게임을 시작하세요.</p>` : ""}
          ${
            sortedSessions.length === 0
              ? `<p class="teacher-empty">아직 참여한 학생이 없어요.</p>`
              : !started
                ? `<div class="waiting-list">
                    ${sortedSessions
                      .map(
                        (s) => `
                      <span class="waiting-chip">
                        ${escapeHtml(s.name)}
                        <button type="button" class="waiting-chip-kick" data-kick-name="${escapeHtml(s.name)}" aria-label="${escapeHtml(s.name)} 퇴장">×</button>
                      </span>
                    `,
                      )
                      .join("")}
                  </div>`
                : `<div class="table-scroll participant-table-scroll">
                  <table class="teacher-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>상태</th>
                        <th>진행 라운드</th>
                        <th>방금 라운드 등수</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sortedSessions
                        .map(
                          (s) => `
                        <tr>
                          <td>${escapeHtml(s.name)}</td>
                          <td><span class="status-badge status-badge--${s.status}">${STATUS_LABEL[s.status]}</span></td>
                          <td>${s.currentRound} / ${TOTAL_ROUNDS}</td>
                          <td>${s.lastRoundRank ? `${s.lastRoundRank}등` : "-"}</td>
                          <td><button type="button" class="kick-btn" data-kick-name="${escapeHtml(s.name)}" aria-label="${escapeHtml(s.name)} 퇴장">×</button></td>
                        </tr>
                      `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>`
          }
        </section>

        <section class="teacher-panel">
          <h2>라운드별 최고 기록</h2>
          <p class="teacher-panel-desc">라운드마다 가장 빠른 기록이 실시간으로 갱신돼요.</p>
          <table class="teacher-table">
            <thead>
              <tr>
                <th>라운드</th>
                <th>이름</th>
                <th>기록</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1)
                .map((round) => {
                  const best = roundBests.get(round);
                  return `
                    <tr>
                      <td>${round}</td>
                      <td>${best ? escapeHtml(best.name) : "-"}</td>
                      <td>${best ? `${(best.timeMs / 1000).toFixed(1)}초` : "-"}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </section>

        <section class="teacher-panel">
          <h2>최종 순위</h2>
          <p class="teacher-panel-desc">9라운드를 모두 마친 학생의 총 걸린 시간이 짧은 순서예요.</p>
          ${
            !hasRevealed
              ? `<p class="teacher-empty">게임 종료 후 발표되면 여기에 공개돼요.</p>`
              : finalRanking.length === 0
                ? `<p class="teacher-empty">아직 9라운드를 모두 마친 학생이 없어요.</p>`
                : (() => {
                    const ranked = assignRanks(finalRanking);
                    const rankCounts = new Map<number, number>();
                    ranked.forEach((r) => rankCounts.set(r.rank, (rankCounts.get(r.rank) ?? 0) + 1));
                    return `<table class="teacher-table">
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>이름</th>
                      <th>총 걸린 시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ranked
                      .map(
                        (r) => `
                      <tr>
                        <td>${r.rank}등${(rankCounts.get(r.rank) ?? 0) > 1 ? " (공동)" : ""}</td>
                        <td>${escapeHtml(r.name)}</td>
                        <td>${(r.totalMs / 1000).toFixed(1)}초</td>
                      </tr>
                    `,
                      )
                      .join("")}
                  </tbody>
                </table>`;
                  })()
          }
        </section>
      </div>

      <div class="qr-modal" ${qrModalOpen ? "" : "hidden"}>
        <div class="qr-modal-backdrop" id="qr-modal-backdrop"></div>
        <div class="qr-modal-content">
          <button type="button" id="qr-modal-close" class="qr-modal-close" aria-label="닫기">✕</button>
          <h2>학생 접속 QR</h2>
          <p class="teacher-panel-desc">태블릿 카메라로 스캔하면 이 세션에 바로 들어와요.</p>
          <div class="qr-wrap">
            <canvas id="student-qr-canvas"></canvas>
          </div>
          <p class="qr-session-code">${activeSessionCode()}</p>
          <p class="qr-url">${escapeHtml(studentUrl())}</p>
        </div>
      </div>

    </section>
  `;

  const qrCanvas = app.querySelector<HTMLCanvasElement>("#student-qr-canvas");
  if (qrCanvas && qrModalOpen) {
    QRCode.toCanvas(qrCanvas, studentUrl(), { width: 260, margin: 1 }).catch((err) => {
      console.error("[qr] QR 코드 생성 실패", err);
    });
  }

  const screenEl = app.querySelector<HTMLElement>(".teacher-screen");
  if (screenEl) screenEl.scrollTop = scrollScreen;
  const participantsEl = app.querySelector<HTMLElement>(".participant-table-scroll");
  if (participantsEl) participantsEl.scrollTop = scrollParticipants;
}

/** 동일 기록은 같은 순위를 받고 다음 순위는 그만큼 건너뛴다(1,1,3위 방식). */
function assignRanks(sorted: FinalRow[]): RankedRow[] {
  const ranked: RankedRow[] = [];
  sorted.forEach((row, i) => {
    const rank = i > 0 && row.totalMs === sorted[i - 1].totalMs ? ranked[i - 1].rank : i + 1;
    ranked.push({ ...row, rank });
  });
  return ranked;
}

function groupByRank(ranked: RankedRow[]): { rank: number; rows: RankedRow[] }[] {
  const groups: { rank: number; rows: RankedRow[] }[] = [];
  for (const row of ranked) {
    const last = groups[groups.length - 1];
    if (last && last.rank === row.rank) {
      last.rows.push(row);
    } else {
      groups.push({ rank: row.rank, rows: [row] });
    }
  }
  return groups;
}

let audioCtx: AudioContext | null = null;

function playTone(freq: number, durationMs: number, delayMs = 0): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    const startAt = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.3, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + durationMs / 1000 + 0.05);
  } catch {
    // 자동재생 정책 등으로 소리가 안 나도 발표 자체는 계속 진행한다.
  }
}

function playRevealSound(isFirstPlace: boolean, stepIndex: number): void {
  if (isFirstPlace) {
    playTone(523.25, 140, 0); // C5
    playTone(659.25, 140, 150); // E5
    playTone(783.99, 320, 300); // G5
    return;
  }
  playTone(360 + stepIndex * 45, 180, 0);
}

function renderReveal(ranking: FinalRow[]): void {
  const token = ++revealToken;

  app.innerHTML = `
    <section class="teacher-screen reveal-screen">
      <p class="reveal-status">게임이 끝났습니다.<br />결과를 집계합니다...</p>
      <ol class="reveal-list"></ol>
      <button type="button" id="reveal-exit-btn" class="teacher-btn" hidden>현황판으로 돌아가기</button>
    </section>
  `;

  const listEl = app.querySelector<HTMLOListElement>(".reveal-list")!;
  const statusEl = app.querySelector<HTMLParagraphElement>(".reveal-status")!;
  const exitBtn = app.querySelector<HTMLButtonElement>("#reveal-exit-btn")!;

  const groups = groupByRank(assignRanks(ranking));
  const revealGroups = groups.slice(0, REVEAL_MAX_TIERS);

  if (revealGroups.length === 0) {
    window.setTimeout(() => {
      if (revealToken !== token) return;
      statusEl.textContent = "아직 9라운드를 모두 마친 학생이 없어요.";
      exitBtn.hidden = false;
    }, REVEAL_INTRO_MS);
    return;
  }

  const order = revealGroups.slice().reverse(); // 가장 낮은 순위 -> 1위 순서로 발표

  window.setTimeout(function revealStep(index = 0) {
    if (revealToken !== token) return;

    if (index === 0) {
      statusEl.textContent = "결과를 발표합니다!";
    }

    const group = order[index];
    const isFirstPlace = group.rank === 1;
    const names = group.rows.map((r) => escapeHtml(r.name)).join(" · ");
    const seconds = (group.rows[0].totalMs / 1000).toFixed(1);

    const li = document.createElement("li");
    li.className = `reveal-item${isFirstPlace ? " reveal-item--first" : ""}`;
    li.innerHTML = `<span class="reveal-rank">${group.rank}위${group.rows.length > 1 ? " (공동)" : ""}</span><span class="reveal-name">${names}</span><span class="reveal-time">${seconds}초</span>`;
    listEl.prepend(li);

    playRevealSound(isFirstPlace, index);
    confetti({
      particleCount: isFirstPlace ? 160 : 50,
      spread: isFirstPlace ? 100 : 65,
      origin: { y: 0.6 },
    });

    if (index + 1 < order.length) {
      window.setTimeout(() => revealStep(index + 1), REVEAL_STEP_MS);
    } else {
      window.setTimeout(() => {
        if (revealToken !== token) return;
        statusEl.textContent = "🎉 축하합니다!";
        exitBtn.hidden = false;
      }, REVEAL_STEP_MS);
    }
  }, REVEAL_INTRO_MS);
}

/** 텍스트 콘텐츠뿐 아니라 속성값(data-*)에 넣어도 안전하도록 따옴표까지 이스케이프한다. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function computeFinalRanking(
  docs: { name: string; round: number; timeMs: number }[],
): FinalRow[] {
  const byName = new Map<string, { rounds: Set<number>; totalMs: number }>();

  for (const { name, round, timeMs } of docs) {
    const entry = byName.get(name) ?? { rounds: new Set<number>(), totalMs: 0 };
    if (!entry.rounds.has(round)) {
      entry.rounds.add(round);
      entry.totalMs += timeMs;
    }
    byName.set(name, entry);
  }

  return [...byName.entries()]
    .filter(([, v]) => v.rounds.size === TOTAL_ROUNDS)
    .map(([name, v]) => ({ name, totalMs: v.totalMs }))
    .sort((a, b) => a.totalMs - b.totalMs);
}

function computeRoundBests(
  docs: { name: string; round: number; timeMs: number }[],
): Map<number, RoundBest> {
  const bests = new Map<number, RoundBest>();

  for (const { name, round, timeMs } of docs) {
    const current = bests.get(round);
    if (!current || timeMs < current.timeMs) {
      bests.set(round, { name, timeMs });
    }
  }

  return bests;
}

function rememberSession(code: string): void {
  try {
    localStorage.setItem(LAST_SESSION_KEY, code);
  } catch {
    // 저장소를 못 써도 주소창의 ?s=코드로 이어서 쓸 수 있다.
  }
}

function lastSession(): string | null {
  try {
    return normalizeSessionCode(localStorage.getItem(LAST_SESSION_KEY));
  } catch {
    return null;
  }
}

/** 세션 선택 화면: 새 세션 시작 / 최근 세션 이어서 / 코드로 열기. */
function renderSessionPicker(message?: string): void {
  const recent = lastSession();

  app.innerHTML = `
    <section class="teacher-screen session-picker">
      <h1>직업 짝맞추기 현황판</h1>
      <p class="teacher-subtitle">수업을 시작하려면 새 세션을 만들어 주세요. 세션마다 순위표가 따로 운영돼요.</p>
      ${message ? `<p class="start-error">${escapeHtml(message)}</p>` : ""}
      <button type="button" id="create-session-btn" class="teacher-btn teacher-btn--start session-picker-main">새 세션 시작</button>
      ${
        recent
          ? `<button type="button" id="resume-session-btn" class="teacher-btn">최근 세션 이어서 하기 (${recent})</button>`
          : ""
      }
      <form class="session-picker-form" novalidate>
        <input class="start-input" name="code" placeholder="세션 코드로 열기" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" />
        <button type="submit" class="teacher-btn">열기</button>
      </form>
    </section>
  `;

  app.querySelector<HTMLButtonElement>("#create-session-btn")!.addEventListener("click", async (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "만드는 중...";
    try {
      openSession(await createSession());
    } catch (err) {
      console.error("[session] 세션 생성 실패", err);
      renderSessionPicker("세션을 만들지 못했어요. 다시 시도해 주세요.");
    }
  });

  app.querySelector<HTMLButtonElement>("#resume-session-btn")?.addEventListener("click", () => {
    if (recent) tryOpenSession(recent);
  });

  app.querySelector<HTMLFormElement>(".session-picker-form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = (event.currentTarget as HTMLFormElement).querySelector("input")!.value;
    const code = normalizeSessionCode(raw);
    if (!code) {
      renderSessionPicker("세션 코드는 영어와 숫자 6자리예요.");
      return;
    }
    tryOpenSession(code);
  });
}

async function tryOpenSession(code: string): Promise<void> {
  let check;
  try {
    check = await checkSession(code);
  } catch (err) {
    console.error("[session] 세션 확인 실패", err);
    renderSessionPicker("연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.");
    return;
  }
  if (check !== "ok") {
    writeSessionCodeToUrl(null);
    renderSessionPicker(
      check === "expired"
        ? `세션 ${code}은(는) ${SESSION_TTL_DAYS}일이 지나 만료됐어요. 새 세션을 시작해 주세요.`
        : `세션 ${code}을(를) 찾을 수 없어요.`,
    );
    return;
  }
  openSession(code);
}

/** 세션 현황판을 연다. 페이지당 한 번만 호출된다(다른 세션으로 바꿀 땐 새로고침). */
function openSession(code: string): void {
  setActiveSession(code);
  writeSessionCodeToUrl(code);
  rememberSession(code);

  let players: SessionRow[] = [];
  let finalRanking: FinalRow[] = [];
  let roundBests = new Map<number, RoundBest>();
  const roundDocs = new Map<number, { name: string; round: number; timeMs: number }[]>();
  let started = false;
  let paused = false;
  let revealing = false;
  let hasRevealed = false;
  let qrModalOpen = false;

  function renderNow(): void {
    if (!revealing) render(players, finalRanking, roundBests, started, paused, hasRevealed, qrModalOpen);
  }

  onSnapshot(activeSessionCollection("players"), (snap) => {
    players = snap.docs
      .map((d) => d.data() as SessionRow)
      .filter((s) => !s.kicked);
    renderNow();
  });

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    onSnapshot(roundEntries(round), (snap) => {
      roundDocs.set(
        round,
        snap.docs.map((d) => {
          const data = d.data() as { name: string; timeMs: number };
          return { name: data.name, round, timeMs: data.timeMs };
        }),
      );
      const docs = [...roundDocs.values()].flat();
      finalRanking = computeFinalRanking(docs);
      roundBests = computeRoundBests(docs);
      renderNow();
    });
  }

  subscribeStarted((next) => {
    started = next;
    renderNow();
  });

  subscribePaused((next) => {
    paused = next;
    renderNow();
  });

  subscribeRevealed((next) => {
    hasRevealed = next;
    renderNow();
  });

  app.addEventListener("click", async (event) => {
    const kickBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-kick-name]");
    if (kickBtn) {
      const name = kickBtn.dataset.kickName!;
      if (!window.confirm(`"${name}" 학생을 퇴장시킬까요?`)) return;
      kickBtn.disabled = true;
      try {
        await kickPlayer(name);
      } catch (err) {
        console.error("[control] 퇴장 처리 실패", err);
        window.alert("퇴장 처리를 하지 못했어요. 다시 시도해 주세요.");
      } finally {
        kickBtn.disabled = false;
      }
      return;
    }

    if ((event.target as HTMLElement).closest("#qr-modal-backdrop, #qr-modal-close")) {
      qrModalOpen = false;
      renderNow();
      return;
    }

    const target = (event.target as HTMLElement).closest("button");
    if (!target) return;

    if (target.id === "qr-toggle-btn") {
      qrModalOpen = true;
      renderNow();
      return;
    }

    if (target.id === "start-game-btn") {
      if (players.length === 0) {
        window.alert("아직 대기 중인 학생이 없어요. 학생들이 접속한 후 다시 눌러주세요.");
        return;
      }
      target.disabled = true;
      try {
        await setStarted(true);
      } catch (err) {
        console.error("[control] 게임 시작 실패", err);
        window.alert("게임을 시작하지 못했어요. 다시 시도해 주세요.");
      } finally {
        target.disabled = false;
      }
      return;
    }

    if (target.id === "pause-toggle") {
      target.disabled = true;
      try {
        await setPaused(!paused);
      } catch (err) {
        console.error("[control] 일시정지 전환 실패", err);
        window.alert("일시정지 상태를 바꾸지 못했어요. 다시 시도해 주세요.");
      } finally {
        target.disabled = false;
      }
      return;
    }

    if (target.id === "end-game-btn") {
      if (!window.confirm("게임을 종료하고 최종 순위를 발표할까요?")) return;
      revealing = true;
      hasRevealed = true;
      setRevealed(true).catch((err) => console.error("[control] 발표 상태 저장 실패", err));
      renderReveal(finalRanking.slice());
      return;
    }

    if (target.id === "reveal-exit-btn") {
      revealing = false;
      renderNow();
      return;
    }

    if (target.id === "new-session-btn") {
      const ok = window.confirm(
        `새 세션을 시작할까요?\n지금 세션(${code})의 학생들은 새 QR로 다시 접속해야 해요.`,
      );
      if (!ok) return;
      target.disabled = true;
      try {
        const next = await createSession();
        rememberSession(next);
        writeSessionCodeToUrl(next);
        window.location.reload();
      } catch (err) {
        console.error("[control] 새 세션 생성 실패", err);
        window.alert("새 세션을 만들지 못했어요. 다시 시도해 주세요.");
        target.disabled = false;
      }
    }
  });

  renderNow();
}

if (!firebaseConfigured) {
  app.innerHTML = `
    <section class="teacher-screen">
      <p class="teacher-empty">Firebase 설정이 안 되어 있어서 진행 현황을 볼 수 없어요.</p>
    </section>
  `;
} else {
  const initialCode = sessionCodeFromUrl();
  if (initialCode) {
    tryOpenSession(initialCode);
  } else {
    renderSessionPicker();
  }
}
