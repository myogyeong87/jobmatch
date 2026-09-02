export function renderFinalScreen(
  root: HTMLElement,
  displayName: string,
  roundTimes: number[],
  onRestart: () => void,
): void {
  const totalMs = roundTimes.reduce((sum, t) => sum + t, 0);
  const totalSeconds = (totalMs / 1000).toFixed(1);

  root.innerHTML = `
    <section class="screen final-screen">
      <h1 class="final-title">${escapeHtml(displayName)}님, 9라운드 완료!</h1>
      <p class="final-subtitle">전체 라운드 총 걸린 시간 (참고용, 순위 아님)</p>
      <p class="final-time">${totalSeconds}<span class="final-unit">초</span></p>
      <button class="final-restart" type="button">처음부터 다시 하기</button>
    </section>
  `;

  root
    .querySelector<HTMLButtonElement>(".final-restart")!
    .addEventListener("click", onRestart);
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
