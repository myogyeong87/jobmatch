import {
  addDoc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  type CollectionReference,
} from "firebase/firestore";
import { firebaseConfigured } from "../firebase";
import { activeSessionCollection, expireAtFromNow } from "./classSession";

export interface RoundBest {
  name: string;
  timeMs: number;
}

/** 현재 세션의 라운드별 기록 컬렉션: sessions/{code}/rounds/{n}/entries */
export function roundEntries(round: number): CollectionReference {
  return activeSessionCollection("rounds", String(round), "entries");
}

/**
 * 라운드 결과를 기록하고, 그 순간 기준 잠정 등수를 계산해 반환한다.
 * 등수는 재조회하지 않는다(스펙: 이후 다른 학생 기록으로 등수가 바뀌어도 무방).
 * Firebase 미설정 상태에서는 항상 1등으로 폴백한다(로컬 개발용).
 */
export async function submitRoundResult(
  round: number,
  name: string,
  timeMs: number,
): Promise<number> {
  if (!firebaseConfigured) {
    return 1;
  }

  const entriesRef = roundEntries(round);

  await addDoc(entriesRef, {
    name,
    timeMs,
    createdAt: serverTimestamp(),
    expireAt: expireAtFromNow(),
  });

  const fasterCount = await getCountFromServer(query(entriesRef, where("timeMs", "<", timeMs)));

  return fasterCount.data().count + 1;
}

/** 해당 라운드의 현재 최고 기록(가장 빠른 시간)을 조회한다. 기록이 없으면 null. */
export async function getRoundBest(round: number): Promise<RoundBest | null> {
  if (!firebaseConfigured) return null;

  const snap = await getDocs(query(roundEntries(round), orderBy("timeMs", "asc"), limit(1)));
  if (snap.empty) return null;

  const data = snap.docs[0].data() as { name: string; timeMs: number };
  return { name: data.name, timeMs: data.timeMs };
}
