import { onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseConfigured } from "../firebase";
import { activeSessionRef } from "./classSession";

/** 교사 화면에서 세션 전체 학생 기기의 일시정지 상태를 켜고 끈다. */
export async function setPaused(paused: boolean): Promise<void> {
  if (!firebaseConfigured) return;
  await setDoc(activeSessionRef(), { paused, updatedAt: serverTimestamp() }, { merge: true });
}

/** 일시정지 상태를 실시간 구독한다. 구독 해제 함수를 반환한다. */
export function subscribePaused(onChange: (paused: boolean) => void): () => void {
  if (!firebaseConfigured) {
    onChange(false);
    return () => {};
  }
  return onSnapshot(activeSessionRef(), (snap) => {
    onChange(Boolean(snap.data()?.paused));
  });
}
