export function renderKickedScreen(root: HTMLElement, onRestart: () => void): void {
  root.innerHTML = `
    <section class="screen kicked-screen">
      <p class="kicked-emoji">🚪</p>
      <h1 class="kicked-title">참여가 취소되었어요</h1>
      <p class="kicked-desc">선생님이 참여를 취소했어요. 다시 참여하려면 이름을 다시 입력해주세요.</p>
      <button class="kicked-restart" type="button">다시 참여하기</button>
    </section>
  `;

  root
    .querySelector<HTMLButtonElement>(".kicked-restart")!
    .addEventListener("click", onRestart);
}
