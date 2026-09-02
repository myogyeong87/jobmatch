import { doc, runTransaction } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

/** 이름/모둠명 문서 ID로 못 쓰는 문자를 정리한다 (슬래시 등). */
function sanitizeBaseName(raw: string): string {
  const trimmed = raw.trim().slice(0, 40);
  return trimmed.replace(/[/\\]/g, "_") || "이름없음";
}

/**
 * 동명이인 처리: nameCounters/{baseName} 문서의 count를 트랜잭션으로 원자적 증가시켜
 * 접속 순서를 보장한다. 1번째는 "이름", 2번째부터는 "이름(N)".
 * Firebase 미설정 상태에서는 접미사 없이 그대로 반환한다(로컬 개발용 폴백).
 */
export async function claimDisplayName(rawName: string): Promise<string> {
  const baseName = sanitizeBaseName(rawName);

  if (!firebaseConfigured) {
    return baseName;
  }

  const counterRef = doc(db, "nameCounters", baseName);

  const sequence = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists() ? (snap.data().count as number) : 0) + 1;
    tx.set(counterRef, { count: next }, { merge: true });
    return next;
  });

  return sequence === 1 ? baseName : `${baseName}(${sequence})`;
}
