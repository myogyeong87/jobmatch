import {
  Timestamp,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type CollectionReference,
  type DocumentReference,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

/**
 * 교사별 방(세션) 분리.
 * 모든 데이터는 sessions/{세션코드} 아래에 저장되어, 여러 학급이 동시에 진행해도 섞이지 않는다.
 *   sessions/{code}                           — 시작/일시정지/발표 스위치 + expireAt
 *   sessions/{code}/players/{표시이름}         — 학생별 진행 현황
 *   sessions/{code}/nameCounters/{이름}        — 동명이인 순번
 *   sessions/{code}/rounds/{n}/entries/{id}   — 라운드별 기록
 * 모든 문서에 expireAt을 함께 저장하고, 컬렉션 그룹별 TTL 정책(firestore.indexes.json)으로
 * 30일 뒤 자동 삭제한다. (TTL은 하위 컬렉션을 지우지 않으므로 문서마다 expireAt이 필요하다.)
 */
export const SESSION_TTL_DAYS = 30;

const SESSIONS_COLLECTION = "sessions";
const CODE_LENGTH = 6;
// 헷갈리기 쉬운 문자(0/O, 1/I/L)는 뺀다.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type SessionCheck = "ok" | "missing" | "expired";

let activeCode: string | null = null;

export function setActiveSession(code: string): void {
  activeCode = code;
}

export function activeSessionCode(): string {
  if (!activeCode) throw new Error("세션 코드가 설정되지 않았습니다.");
  return activeCode;
}

export function activeSessionRef(): DocumentReference {
  return doc(db, SESSIONS_COLLECTION, activeSessionCode());
}

export function activeSessionCollection(...path: string[]): CollectionReference {
  return collection(db, SESSIONS_COLLECTION, activeSessionCode(), ...path);
}

export function expireAtFromNow(): Timestamp {
  return Timestamp.fromMillis(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** 입력값을 대문자로 바꾸고 공백·하이픈을 제거한다. 형식이 맞지 않으면 null. */
export function normalizeSessionCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").toUpperCase().replace(/[\s-]/g, "");
  return new RegExp(`^[A-Z0-9]{${CODE_LENGTH}}$`).test(code) ? code : null;
}

export function sessionCodeFromUrl(): string | null {
  return normalizeSessionCode(new URLSearchParams(window.location.search).get("s"));
}

/** 새로고침해도 같은 세션에 머물도록 주소창에 ?s=코드를 남긴다. */
export function writeSessionCodeToUrl(code: string | null): void {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set("s", code);
  else url.searchParams.delete("s");
  window.history.replaceState(null, "", url);
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** 새 세션을 만들고 코드를 반환한다. 이미 있는 코드가 뽑히면 다시 뽑는다. */
export async function createSession(): Promise<string> {
  if (!firebaseConfigured) return randomCode();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const ref = doc(db, SESSIONS_COLLECTION, code);
    const created = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) return false;
      tx.set(ref, {
        started: false,
        paused: false,
        revealed: false,
        createdAt: serverTimestamp(),
        expireAt: expireAtFromNow(),
        updatedAt: serverTimestamp(),
      });
      return true;
    });
    if (created) return code;
  }
  throw new Error("세션 코드를 만들지 못했습니다.");
}

/** 세션이 존재하고 아직 만료되지 않았는지 확인한다. */
export async function checkSession(code: string): Promise<SessionCheck> {
  if (!firebaseConfigured) return "ok";

  const snap = await getDoc(doc(db, SESSIONS_COLLECTION, code));
  if (!snap.exists()) return "missing";
  const expireAt = snap.data().expireAt as Timestamp | undefined;
  if (expireAt && expireAt.toMillis() <= Date.now()) return "expired";
  return "ok";
}
