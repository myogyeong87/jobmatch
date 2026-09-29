import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseConfigured } from "../firebase";
import { activeSessionCollection, expireAtFromNow } from "./classSession";

export type PlayerStatus = "playing" | "result" | "finished";

function playerRef(displayName: string) {
  const id = displayName.trim().slice(0, 60).replace(/[/\\]/g, "_") || "이름없음";
  return doc(activeSessionCollection("players"), id);
}

/**
 * 교사 진행 현황 화면(teacher.html)에서 실시간으로 보기 위한 학생별 상태 기록.
 * 라운드 시작/결과/전체 완료 시점마다 호출해 sessions/{code}/players/{displayName} 문서를 갱신한다.
 * 실패해도 게임 진행에는 영향 없어야 하므로 호출부에서는 await하지 않고 흘려보낸다.
 */
export async function updatePlayer(
  displayName: string,
  currentRound: number,
  status: PlayerStatus,
  lastRoundRank?: number,
): Promise<void> {
  if (!firebaseConfigured) return;

  await setDoc(
    playerRef(displayName),
    {
      name: displayName,
      currentRound,
      status,
      ...(lastRoundRank !== undefined ? { lastRoundRank } : {}),
      expireAt: expireAtFromNow(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** 교사가 잘못 참여한 학생을 퇴장시킨다(현황판 목록에서 제외 + 학생 화면에 안내). */
export async function kickPlayer(displayName: string): Promise<void> {
  if (!firebaseConfigured) return;

  await setDoc(playerRef(displayName), { kicked: true, updatedAt: serverTimestamp() }, { merge: true });
}

/** 본인이 퇴장 처리됐는지 실시간 구독한다. 구독 해제 함수를 반환한다. */
export function subscribeKicked(displayName: string, onChange: (kicked: boolean) => void): () => void {
  if (!firebaseConfigured) return () => {};

  return onSnapshot(playerRef(displayName), (snap) => {
    onChange(Boolean(snap.data()?.kicked));
  });
}
