import "./style.css";
import { collection, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase";

interface SessionRow {
  name: string;
  currentRound: number;
  status: "playing" | "result" | "finished";
  lastRoundRank?: number;
}

interface FinalRow {
  name: string;
  totalMs: number;
}

const TOTAL_ROUNDS = 9;

const app = document.querySelector<HTMLDivElement>("#app")!;

const STATUS_LABEL: Record<SessionRow["status"], string> = {
  playing: "게임 중",
  result: "결과 확인 중",
  finished: "전체 완료",
};

function render(sessions: SessionRow[], finalRanking: FinalRow[]): void {
  const sortedSessions = sessions.slice().sort((a, b) => {
    if (a.currentRound !== b.currentRound) return b.currentRound - a.currentRound;
    return a.name.localeCompare(b.name, "ko");
  });

  app.innerHTML = `
    <section class="teacher-screen">
      <header class="teacher-header">
        <h1>직업 짝맞추기 - 진행 현황</h1>
        <p class="teacher-subtitle">지금 참여 중인 학생 ${sortedSessions.length}명</p>
      </header>

      <div class="teacher-panels">
        <section class="teacher-panel">
          <h2>실시간 참여 현황</h2>
          ${
            sortedSessions.length === 0
              ? `<p class="teacher-empty">아직 참여한 학생이 없어요.</p>`
              : `<table class="teacher-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>상태</th>
                      <th>진행 라운드</th>
                      <th>방금 라운드 등수</th>
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
                      </tr>
                    `,
                      )
                      .join("")}
                  </tbody>
                </table>`
          }
        </section>

        <section class="teacher-panel">
          <h2>최종 순위</h2>
          <p class="teacher-panel-desc">9라운드를 모두 마친 학생의 총 걸린 시간이 짧은 순서예요.</p>
          ${
            finalRanking.length === 0
              ? `<p class="teacher-empty">아직 9라운드를 모두 마친 학생이 없어요.</p>`
              : `<table class="teacher-table">
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>이름</th>
                      <th>총 걸린 시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${finalRanking
                      .map(
                        (r, i) => `
                      <tr>
                        <td>${i + 1}등</td>
                        <td>${escapeHtml(r.name)}</td>
                        <td>${(r.totalMs / 1000).toFixed(1)}초</td>
                      </tr>
                    `,
                      )
                      .join("")}
                  </tbody>
                </table>`
          }
        </section>
      </div>
    </section>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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

if (!firebaseConfigured) {
  app.innerHTML = `
    <section class="teacher-screen">
      <p class="teacher-empty">Firebase 설정이 안 되어 있어서 진행 현황을 볼 수 없어요.</p>
    </section>
  `;
} else {
  let sessions: SessionRow[] = [];
  let finalRanking: FinalRow[] = [];

  onSnapshot(collection(db, "sessions"), (snap) => {
    sessions = snap.docs.map((d) => d.data() as SessionRow);
    render(sessions, finalRanking);
  });

  onSnapshot(collection(db, "roundScores"), (snap) => {
    const docs = snap.docs.map((d) => d.data() as { name: string; round: number; timeMs: number });
    finalRanking = computeFinalRanking(docs);
    render(sessions, finalRanking);
  });

  render(sessions, finalRanking);
}
