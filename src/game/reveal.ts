import { onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseConfigured } from "../firebase";
import { activeSessionRef } from "./classSession";

/** 교사가 최종 순위를 발표했는지 여부를 저장한다(새로고침해도 유지됨). */
export async function setRevealed(revealed: boolean): Promise<void> {
  if (!firebaseConfigured) return;
  await setDoc(activeSessionRef(), { revealed, updatedAt: serverTimestamp() }, { merge: true });
}

/** 발표 여부를 실시간 구독한다. 구독 해제 함수를 반환한다. */
export function subscribeRevealed(onChange: (revealed: boolean) => void): () => void {
  if (!firebaseConfigured) {
    onChange(false);
    return () => {};
  }
  return onSnapshot(activeSessionRef(), (snap) => {
    onChange(Boolean(snap.data()?.revealed));
  });
}
