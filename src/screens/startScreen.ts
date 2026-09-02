export function renderStartScreen(
  root: HTMLElement,
  onSubmit: (name: string) => void,
): void {
  root.innerHTML = `
    <section class="screen start-screen">
      <h1 class="start-title">직업 짝맞추기</h1>
      <p class="start-subtitle">이름이나 모둠 이름을 적고 시작해요</p>
      <form class="start-form" novalidate>
        <input
          class="start-input"
          type="text"
          name="playerName"
          placeholder="예: 김민준"
          maxlength="20"
          autocomplete="off"
          required
        />
        <button class="start-button" type="submit">시작하기</button>
      </form>
      <p class="start-error" hidden></p>
    </section>
  `;

  const form = root.querySelector<HTMLFormElement>(".start-form")!;
  const input = root.querySelector<HTMLInputElement>(".start-input")!;
  const errorEl = root.querySelector<HTMLParagraphElement>(".start-error")!;
  const button = root.querySelector<HTMLButtonElement>(".start-button")!;

  input.focus();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
      errorEl.hidden = false;
      errorEl.textContent = "이름을 먼저 적어주세요.";
      return;
    }
    errorEl.hidden = true;
    button.disabled = true;
    button.textContent = "시작하는 중...";
    onSubmit(name);
  });
}
