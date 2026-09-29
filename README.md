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
5. `firebase deploy --only firestore:rules` — 보안 규칙 배포
   (TTL 자동 삭제까지 쓰려면 Blaze 요금제 전환 후 `firebase deploy --only firestore:indexes`)
6. `npm run build && firebase deploy --only hosting` — 빌드 후 Hosting 배포

## 세션(교사별 방)

- 교사가 `teacher.html`에서 **새 세션 시작**을 누르면 6자리 세션 코드가 발급된다.
  현황판 주소는 `teacher.html?s=코드`, 학생 QR/링크는 `/?s=코드`로 코드를 담고 있다.
- 학생이 링크 없이 접속하면 세션 코드 입력 화면이 먼저 나온다. 없는/만료된 코드는 안내 후 다시 입력받는다.
- 세션마다 순위표·참여 현황·시작/일시정지 스위치가 완전히 분리되므로 여러 학급이 동시에 진행해도 섞이지 않는다.
- 다음 학급은 **새 세션** 버튼으로 새 코드를 발급한다(이전 "전체 초기화"를 대체, 기존 기록은 지우지 않음).

## 교사용 진행 현황 화면 (`teacher.html?s=코드`)

- **일시정지**: 세션의 모든 학생 기기에 실시간 전파된다. 일시정지 중에는 라운드 화면이
  전체 화면 오버레이로 카드를 가리고, 라운드 타이머도 멈춘다(경과 시간에서 일시정지 구간 제외).

## 데이터 모델 (Firestore)

모든 데이터는 `sessions/{code}` 아래에 있고, 모든 문서에 `expireAt`(생성 시점 + 30일)이 있다.

- `sessions/{code}`: `{ started, paused, revealed, createdAt, expireAt }` — 교사용 스위치. 스위치만 수정 가능.
- `sessions/{code}/rounds/{1-9}/entries/{autoId}`: `{ name, timeMs, createdAt, expireAt }` — 생성만 허용.
- `sessions/{code}/nameCounters/{baseName}`: `{ count, expireAt }` — 동명이인 처리용 접속 순번 카운터.
- `sessions/{code}/players/{displayName}`: 교사 화면이 구독하는 학생별 실시간 상태.
- 오래된 세션 자동 삭제: `firestore.indexes.json`에 컬렉션 그룹별 `expireAt` TTL 정책이 정의되어 있다.
  TTL은 하위 컬렉션을 지우지 않으므로 네 컬렉션 그룹 모두에 정책이 필요하다. **TTL은 Blaze(종량제) 요금제에서만 켤 수 있다.**

## 알려진 주의사항

- 카드 3D 뒤집기(라운드 시작 연출)는 `backface-visibility: hidden`을 적용했지만,
  실제 iPadOS Safari 태블릿에서 렌더링을 반드시 육안으로 확인할 것 (이전 버전에서 텍스트 반전 버그 이력 있음).
- 결과 화면 자동 전환은 4초로 고정되어 있다 (`src/screens/resultScreen.ts`의 `AUTO_ADVANCE_MS`).
