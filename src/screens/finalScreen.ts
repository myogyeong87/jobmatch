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
      <p class="final-badge">🎉 완주!</p>
      <h1 class="final-title">${escapeHtml(displayName)}님, 9라운드를 모두 마쳤어요!</h1>
      <p class="final-subtitle">9라운드 동안 걸린 시간</p>
      <p class="final-time">${totalSeconds}<span class="final-unit">초</span></p>
      <ol class="final-breakdown">
        ${roundTimes
          .map(
            (t, i) => `
          <li><span class="final-breakdown-round">${i + 1}R</span><span class="final-breakdown-time">${(t / 1000).toFixed(1)}초</span></li>
        `,
          )
          .join("")}
      </ol>
      <p class="final-note">선생님이 최종 순위를 발표하면 화면에서 확인할 수 있어요!</p>
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
