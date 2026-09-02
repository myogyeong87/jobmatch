# 직업 짝맞추기

중학교 진로와 직업 수업용 카드 짝맞추기 게임. 태블릿 브라우저로 접속해 직업명과 하는 일을 짝짓는다.
9라운드 × 10쌍, 라운드별 Firestore 순위표. Vite + Vanilla TypeScript, Firebase Hosting/Firestore.

## 로컬 개발

```bash
npm install
npm run dev
```

Firebase `.env`가 없어도 로컬에서 게임 플로우 전체(시작 → 9라운드 → 최종 요약)를 테스트할 수 있다.
이 상태에서는 순위 계산이 항상 1등으로 폴백하고, 콘솔에 설정값 누락 경고가 뜬다.

## Firebase 연동

1. Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹 앱 없으면 추가) → SDK 설정값(firebaseConfig) 확인
2. `.env.example`을 `.env`로 복사하고 값 채우기
3. `.firebaserc`의 `default` 프로젝트 ID를 실제 Firebase 프로젝트 ID로 교체
4. `firebase login` (최초 1회)
5. `firebase deploy --only firestore:rules,firestore:indexes` — 순위표 컬렉션 보안 규칙/인덱스 배포
6. `npm run build && firebase deploy --only hosting` — 빌드 후 Hosting 배포

## 데이터 모델 (Firestore)

- `roundScores/{autoId}`: `{ round: 1-9, name, timeMs, createdAt }` — 라운드 완료 시 생성만 됨(수정/삭제 불가)
- `nameCounters/{baseName}`: `{ count }` — 동명이인 처리용 접속 순번 카운터

## 알려진 주의사항

- 카드 3D 뒤집기(라운드 시작 연출)는 `backface-visibility: hidden`을 적용했지만,
  실제 iPadOS Safari 태블릿에서 렌더링을 반드시 육안으로 확인할 것 (이전 버전에서 텍스트 반전 버그 이력 있음).
- 결과 화면 자동 전환은 4초로 고정되어 있다 (`src/screens/resultScreen.ts`의 `AUTO_ADVANCE_MS`).
