import { onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseConfigured } from "../firebase";
import { activeSessionRef } from "./classSession";

/** 교사가 "게임 시작"을 눌렀는지 여부. 시작 전에는 세션의 모든 학생이 대기 화면에 머문다. */
export async function setStarted(started: boolean): Promise<void> {
  if (!firebaseConfigured) return;
  await setDoc(activeSessionRef(), { started, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * 시작 여부를 실시간 구독한다. 구독 해제 함수를 반환한다.
 * Firebase 미설정 상태(로컬 개발)에서는 대기 화면 없이 바로 플레이할 수 있도록 항상 true를 보낸다.
 */
export function subscribeStarted(onChange: (started: boolean) => void): () => void {
  if (!firebaseConfigured) {
    onChange(true);
    return () => {};
  }
  return onSnapshot(activeSessionRef(), (snap) => {
    onChange(Boolean(snap.data()?.started));
  });
}
