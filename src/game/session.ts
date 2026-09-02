import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

export type SessionStatus = "playing" | "result" | "finished";

const SESSIONS_COLLECTION = "sessions";

function sanitizeSessionId(name: string): string {
  return name.trim().slice(0, 60).replace(/[/\\]/g, "_") || "이름없음";
}

/**
 * 교사 진행 현황 화면(teacher.html)에서 실시간으로 보기 위한 학생별 상태 기록.
 * 라운드 시작/결과/전체 완료 시점마다 호출해 sessions/{displayName} 문서를 갱신한다.
 * 실패해도 게임 진행에는 영향 없어야 하므로 호출부에서는 await하지 않고 흘려보낸다.
 */
export async function updateSession(
  displayName: string,
  currentRound: number,
  status: SessionStatus,
  lastRoundRank?: number,
): Promise<void> {
  if (!firebaseConfigured) return;

  const ref = doc(db, SESSIONS_COLLECTION, sanitizeSessionId(displayName));
  await setDoc(
    ref,
    {
      name: displayName,
      currentRound,
      status,
      ...(lastRoundRank !== undefined ? { lastRoundRank } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
