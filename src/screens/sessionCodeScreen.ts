/**
 * 세션 코드 입력 화면. 보통은 QR/링크(?s=코드)로 바로 들어오므로
 * 링크 없이 접속했거나 코드가 틀렸거나 만료됐을 때만 보인다.
 */
export function renderSessionCodeScreen(
  root: HTMLElement,
  options: { initialCode?: string; message?: string },
  onSubmit: (rawCode: string) => void,
): void {
  root.innerHTML = `
    <section class="screen start-screen">
      <h1 class="start-title">직업 짝맞추기</h1>
      <p class="start-subtitle">선생님이 알려준 세션 코드를 입력해요</p>
      <form class="start-form" novalidate>
        <input
          class="start-input session-code-input"
          type="text"
          name="sessionCode"
          placeholder="예: 3BK9QX"
          maxlength="8"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          required
        />
        <button class="start-button" type="submit">입장하기</button>
      </form>
      <p class="start-error" hidden></p>
    </section>
  `;

  const form = root.querySelector<HTMLFormElement>(".start-form")!;
  const input = root.querySelector<HTMLInputElement>(".start-input")!;
  const errorEl = root.querySelector<HTMLParagraphElement>(".start-error")!;
  const button = root.querySelector<HTMLButtonElement>(".start-button")!;

  input.value = options.initialCode ?? "";
  if (options.message) {
    errorEl.hidden = false;
    errorEl.textContent = options.message;
  }
  input.focus();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = input.value.trim();
    if (!code) {
      errorEl.hidden = false;
      errorEl.textContent = "세션 코드를 먼저 적어주세요.";
      return;
    }
    errorEl.hidden = true;
    button.disabled = true;
    button.textContent = "확인하는 중...";
    onSubmit(code);
  });
}
