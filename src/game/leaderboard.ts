import {
  addDoc,
  collection,
  getCountFromServer,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

const SCORES_COLLECTION = "roundScores";

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

  const scoresRef = collection(db, SCORES_COLLECTION);

  await addDoc(scoresRef, {
    round,
    name,
    timeMs,
    createdAt: serverTimestamp(),
  });

  const fasterQuery = query(
    scoresRef,
    where("round", "==", round),
    where("timeMs", "<", timeMs),
  );
  const fasterCount = await getCountFromServer(fasterQuery);

  return fasterCount.data().count + 1;
}
