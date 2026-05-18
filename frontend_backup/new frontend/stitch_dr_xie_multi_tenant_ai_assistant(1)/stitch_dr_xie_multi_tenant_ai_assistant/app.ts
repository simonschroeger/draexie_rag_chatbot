// ── Types ──────────────────────────────────────────────────────────────────

interface ServerEvent {
  sources?: string[];
  token?: string;
  done?: boolean;
}

// ── DOM refs ───────────────────────────────────────────────────────────────

const chatArea   = document.getElementById("chat-area")    as HTMLElement;
const inputEl    = document.getElementById("question-input") as HTMLTextAreaElement;
const sendBtn    = document.getElementById("send-btn")     as HTMLButtonElement;
const statusDot  = document.getElementById("status-dot")   as HTMLElement;

// ── Auto-resize textarea ───────────────────────────────────────────────────

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
  sendBtn.disabled = inputEl.value.trim().length === 0;
});

// ── Suggestion chips ───────────────────────────────────────────────────────

document.querySelectorAll<HTMLButtonElement>(".suggestion").forEach((btn) => {
  btn.addEventListener("click", () => {
    inputEl.value = btn.dataset.q ?? "";
    sendBtn.disabled = false;
    inputEl.focus();
  });
});

// ── Keyboard shortcut ──────────────────────────────────────────────────────

inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);

// ── Message rendering ──────────────────────────────────────────────────────

function removeWelcome(): void {
  const welcome = chatArea.querySelector(".welcome");
  if (welcome) welcome.remove();
}

function appendUserMessage(text: string): void {
  const el = document.createElement("div");
  el.className = "message user";
  el.innerHTML = `<div class="bubble"></div>`;
  el.querySelector(".bubble")!.textContent = text;
  chatArea.appendChild(el);
  scrollToBottom();
}

function createAiMessage(): { wrapper: HTMLElement; bubble: HTMLElement } {
  const wrapper = document.createElement("div");
  wrapper.className = "message ai";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  bubble.appendChild(cursor);
  wrapper.appendChild(bubble);
  chatArea.appendChild(wrapper);
  scrollToBottom();
  return { wrapper, bubble };
}

function appendSources(wrapper: HTMLElement, sources: string[]): void {
  if (sources.length === 0) return;
  const div = document.createElement("div");
  div.className = "sources";
  div.innerHTML = sources
    .map((s) => `<span class="source-pill" title="${s}">${s}</span>`)
    .join("");
  wrapper.appendChild(div);
}

function scrollToBottom(): void {
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ── Core: send & stream ────────────────────────────────────────────────────

async function sendMessage(): Promise<void> {
  const question = inputEl.value.trim();
  if (!question) return;

  // Reset input
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;
  inputEl.disabled = true;
  statusDot.classList.add("busy");

  removeWelcome();
  appendUserMessage(question);

  const { wrapper, bubble } = createAiMessage();
  const cursor = bubble.querySelector(".cursor")!;
  let answer = "";
  let sources: string[] = [];
  let firstToken = true;

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by \n\n
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        if (!event.startsWith("data: ")) continue;
        let parsed: ServerEvent;
        try {
          parsed = JSON.parse(event.slice(6));
        } catch {
          continue;
        }

        if (parsed.sources) {
          sources = parsed.sources;
        } else if (parsed.token !== undefined) {
          if (firstToken) {
            bubble.innerHTML = "";
            bubble.appendChild(cursor);
            firstToken = false;
          }
          answer += parsed.token;
          // Insert text before the cursor
          cursor.insertAdjacentText("beforebegin", parsed.token);
          scrollToBottom();
        } else if (parsed.done) {
          cursor.remove();
          appendSources(wrapper, sources);
          scrollToBottom();
        }
      }
    }
  } catch (err) {
    cursor.remove();
    bubble.textContent = "Verbindungsfehler. Bitte versuche es erneut.";
    console.error(err);
  }

  inputEl.disabled = false;
  sendBtn.disabled = false;
  statusDot.classList.remove("busy");
  inputEl.focus();
}
