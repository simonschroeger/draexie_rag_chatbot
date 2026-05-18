// ── Types ──────────────────────────────────────────────────────────────────

interface Chunk        { num: number; source: string; text: string; }
interface ServerEvent  { sources?: string[]; chunks?: Chunk[]; token?: string; done?: boolean; }
interface Conversation { id: string; title: string; created_at: string; message_count: number; }
interface Message      { role: "user" | "assistant"; content: string; }

// ── State ──────────────────────────────────────────────────────────────────

let currentConversationId: string = crypto.randomUUID();
let _allConvs: Conversation[] = [];

// ── DOM refs ───────────────────────────────────────────────────────────────

const chatArea         = document.getElementById("chat-area")         as HTMLElement;
const inputEl          = document.getElementById("question-input")    as HTMLTextAreaElement;
const sendBtn          = document.getElementById("send-btn")          as HTMLButtonElement;
const statusDot        = document.getElementById("status-dot")        as HTMLElement;
const convList         = document.getElementById("conv-list")         as HTMLElement;
const newChatBtn       = document.getElementById("new-chat-btn")      as HTMLButtonElement;
const sidebarToggle    = document.getElementById("sidebar-toggle")    as HTMLButtonElement;
const sidebarClose     = document.getElementById("sidebar-close")     as HTMLButtonElement;
const sidebarOverlay   = document.getElementById("sidebar-overlay")   as HTMLElement;
const sidebar          = document.getElementById("sidebar")           as HTMLElement;
const uploadBtn        = document.getElementById("upload-btn")        as HTMLButtonElement;
const uploadModal      = document.getElementById("upload-modal")      as HTMLElement;
const uploadModalClose = document.getElementById("upload-modal-close") as HTMLButtonElement;
const uploadDrop       = document.getElementById("upload-drop")       as HTMLElement;
const uploadFileInput  = document.getElementById("upload-file-input") as HTMLInputElement;
const uploadStatus     = document.getElementById("upload-status")     as HTMLElement;
const convSearch       = document.getElementById("conv-search")       as HTMLInputElement;

// ── Health polling ─────────────────────────────────────────────────────────

async function pollHealth(): Promise<void> {
  try {
    const res  = await fetch("/health");
    const data = await res.json();
    statusDot.title     = `${data.status} · ${data.qdrant.chunks} chunks · ${data.ollama.model}`;
    statusDot.className = "status-dot" + (data.status === "ok" ? "" : " busy");
  } catch {
    statusDot.className = "status-dot error";
    statusDot.title     = "Server nicht erreichbar";
  }
}
pollHealth();
setInterval(pollHealth, 30_000);

// ── Sidebar ────────────────────────────────────────────────────────────────

function openSidebar(): void {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("open");
}

function closeSidebar(): void {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("open");
}

sidebarToggle?.addEventListener("click", () => {
  sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
});
sidebarClose?.addEventListener("click", closeSidebar);
sidebarOverlay?.addEventListener("click", closeSidebar);

// ── New conversation ───────────────────────────────────────────────────────

newChatBtn?.addEventListener("click", () => {
  currentConversationId = crypto.randomUUID();
  clearChat();
  closeSidebar();
  inputEl.focus();
});

function clearChat(): void {
  chatArea.innerHTML = `
    <div class="welcome">
      <div class="welcome-avatar">
        <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;font-size:32px;">smart_toy</span>
      </div>
      <h2>Was möchtest du wissen?</h2>
      <p>Frag mich nach Studienordnungen, Prüfungsfristen oder Modulbeschreibungen der Hochschule Landshut.</p>
      <div class="suggestions">
        <button class="suggestion" data-q="Welche Lehrveranstaltungen gibt es im Studium Generale?">
          <span class="material-symbols-outlined">school</span>
          Studium Generale Kurse
        </button>
        <button class="suggestion" data-q="Wie viele ECTS bekomme ich für das Studium Generale?">
          <span class="material-symbols-outlined">account_balance</span>
          ECTS im Studium Generale
        </button>
        <button class="suggestion" data-q="Was sind die Voraussetzungen für das Modulstudium?">
          <span class="material-symbols-outlined">menu_book</span>
          Modulstudium Voraussetzungen
        </button>
        <button class="suggestion" data-q="Wann endet die Rückmeldefrist für das Wintersemester?">
          <span class="material-symbols-outlined">event</span>
          Rückmeldefristen WS
        </button>
      </div>
    </div>`;
  bindSuggestions();
}

// ── Suggestions ────────────────────────────────────────────────────────────

function bindSuggestions(): void {
  document.querySelectorAll<HTMLButtonElement>(".suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      inputEl.value = btn.dataset.q ?? "";
      sendBtn.disabled = false;
      inputEl.focus();
    });
  });
}
bindSuggestions();

// ── Conv search ────────────────────────────────────────────────────────────

convSearch?.addEventListener("input", () => {
  const q = convSearch.value.toLowerCase();
  renderConversationList(_allConvs.filter((c) => c.title.toLowerCase().includes(q)));
});

// ── Input resize & keyboard ────────────────────────────────────────────────

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
  sendBtn.disabled = inputEl.value.trim().length === 0;
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) sendMessage(); }
});
sendBtn.addEventListener("click", sendMessage);

// ── Conversation sidebar ───────────────────────────────────────────────────

async function loadConversationList(): Promise<void> {
  try {
    const convs: Conversation[] = await (await fetch("/conversations")).json();
    _allConvs = convs;
    renderConversationList(convs);
  } catch {
    convList.innerHTML = `<p class="conv-empty">Keine früheren Gespräche</p>`;
  }
}

function renderConversationList(convs: Conversation[]): void {
  if (!convs.length) {
    convList.innerHTML = `<p class="conv-empty">Noch keine Gespräche</p>`;
    return;
  }
  convList.innerHTML = convs.map((c) => `
    <div class="conv-item ${c.id === currentConversationId ? "active" : ""}" data-id="${c.id}">
      <span class="conv-title">${escHtml(c.title)}</span>
      <span class="conv-meta">${c.message_count} Nachrichten</span>
      <button class="conv-delete" data-id="${c.id}" title="Löschen">×</button>
    </div>`).join("");

  convList.querySelectorAll<HTMLElement>(".conv-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).classList.contains("conv-delete")) return;
      loadConversation(el.dataset.id!);
    });
  });
  convList.querySelectorAll<HTMLButtonElement>(".conv-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteConversation(btn.dataset.id!);
    });
  });
}

async function loadConversation(id: string): Promise<void> {
  currentConversationId = id;
  closeSidebar();
  try {
    const data: { messages: Message[] } = await (await fetch(`/conversations/${id}`)).json();
    chatArea.innerHTML = "";
    for (const msg of data.messages) {
      if (msg.role === "user") appendUserMessage(msg.content);
      else { const { bubble } = createAiMessage(); bubble.textContent = msg.content; }
    }
    scrollToBottom();
    loadConversationList();
  } catch { clearChat(); }
}

async function deleteConversation(id: string): Promise<void> {
  await fetch(`/conversations/${id}`, { method: "DELETE" });
  if (id === currentConversationId) { currentConversationId = crypto.randomUUID(); clearChat(); }
  loadConversationList();
}

// ── Message rendering ──────────────────────────────────────────────────────

function removeWelcome(): void { chatArea.querySelector(".welcome")?.remove(); }

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

  const row = document.createElement("div");
  row.className = "ai-row";

  const avatar = document.createElement("div");
  avatar.className = "ai-avatar";
  avatar.innerHTML = `<span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;font-size:14px;">smart_toy</span>`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  bubble.appendChild(cursor);

  row.appendChild(avatar);
  row.appendChild(bubble);
  wrapper.appendChild(row);
  chatArea.appendChild(wrapper);
  scrollToBottom();
  return { wrapper, bubble };
}

// ── Sources with citation popout ───────────────────────────────────────────

function appendSources(wrapper: HTMLElement, sources: string[], chunks: Chunk[]): void {
  if (!sources.length) return;

  const div = document.createElement("div");
  div.className = "sources";
  div.innerHTML = `<span class="sources-label">Quellen</span>`;

  for (const source of sources) {
    const related = chunks.filter((c) => c.source === source);
    const pill    = document.createElement("div");
    pill.className = "source-pill";

    const label = document.createElement("span");
    label.className = "source-label";
    label.innerHTML = `<span class="mat-icon">description</span>${escHtml(source)}`;
    pill.appendChild(label);

    if (related.length) {
      const popout = document.createElement("div");
      popout.className = "citation-popout";
      popout.innerHTML = related.map((c) => `
        <div class="citation-chunk">
          <div class="citation-num">[${c.num}]</div>
          <div class="citation-text">${escHtml(c.text)}${c.text.length >= 500 ? "…" : ""}</div>
        </div>`).join('<hr class="citation-hr">');
      pill.appendChild(popout);
    }

    div.appendChild(pill);
  }

  wrapper.appendChild(div);
}

// ── Feedback buttons ───────────────────────────────────────────────────────

function appendFeedback(wrapper: HTMLElement, question: string, getAnswer: () => string): void {
  const row = document.createElement("div");
  row.className = "feedback-row";

  const label = document.createElement("span");
  label.className = "feedback-label";
  label.textContent = "War das hilfreich?";
  row.appendChild(label);

  for (const [rating, emoji] of [["up", "👍"], ["down", "👎"]] as const) {
    const btn = document.createElement("button");
    btn.className = "feedback-btn";
    btn.textContent = emoji;
    btn.title = rating === "up" ? "Hilfreiche Antwort" : "Nicht hilfreiche Antwort";
    btn.addEventListener("click", async () => {
      if (row.dataset.voted) return;
      row.dataset.voted = "1";
      row.querySelectorAll<HTMLButtonElement>(".feedback-btn").forEach((b) => {
        b.classList.toggle("selected", b === btn);
        b.disabled = true;
      });
      await fetch("/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: currentConversationId,
          rating,
          question,
          answer: getAnswer(),
        }),
      });
    });
    row.appendChild(btn);
  }

  wrapper.appendChild(row);
}

// ── Core: send & stream ────────────────────────────────────────────────────

async function sendMessage(): Promise<void> {
  const question = inputEl.value.trim();
  if (!question) return;

  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled  = true;
  inputEl.disabled  = true;
  statusDot.classList.add("busy");

  removeWelcome();
  appendUserMessage(question);

  const { wrapper, bubble } = createAiMessage();
  const cursor = bubble.querySelector(".cursor")!;
  let sources: string[]  = [];
  let chunks:  Chunk[]   = [];
  let answer             = "";
  let firstToken         = true;

  try {
    const response = await fetch("/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ question, conversation_id: currentConversationId }),
    });

    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        if (!event.startsWith("data: ")) continue;
        let parsed: ServerEvent;
        try { parsed = JSON.parse(event.slice(6)); } catch { continue; }

        if (parsed.sources) {
          sources = parsed.sources;
          chunks  = parsed.chunks ?? [];
        } else if (parsed.token !== undefined) {
          if (firstToken) { bubble.innerHTML = ""; bubble.appendChild(cursor); firstToken = false; }
          answer += parsed.token;
          cursor.insertAdjacentText("beforebegin", parsed.token);
          scrollToBottom();
        } else if (parsed.done) {
          cursor.remove();
          appendSources(wrapper, sources, chunks);
          appendFeedback(wrapper, question, () => answer);
          scrollToBottom();
          loadConversationList();
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

// ── Upload modal ───────────────────────────────────────────────────────────

function openUploadModal(): void {
  uploadModal.classList.add("open");
}

function closeUploadModal(): void {
  uploadModal.classList.remove("open");
  uploadStatus.textContent = "";
  uploadStatus.className   = "upload-status";
  uploadFileInput.value    = "";
}

uploadBtn?.addEventListener("click", openUploadModal);
uploadModalClose?.addEventListener("click", closeUploadModal);
uploadModal?.addEventListener("click", (e) => {
  if (e.target === uploadModal) closeUploadModal();
});

uploadDrop?.addEventListener("click", () => uploadFileInput.click());

uploadDrop?.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadDrop.classList.add("drag-over");
});
uploadDrop?.addEventListener("dragleave", () => uploadDrop.classList.remove("drag-over"));
uploadDrop?.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadDrop.classList.remove("drag-over");
  const file = e.dataTransfer?.files[0];
  if (file) uploadFile(file);
});

uploadFileInput?.addEventListener("change", () => {
  const file = uploadFileInput.files?.[0];
  if (file) uploadFile(file);
});

async function uploadFile(file: File): Promise<void> {
  uploadStatus.textContent = `Lädt hoch: ${file.name}…`;
  uploadStatus.className   = "upload-status";

  const form = new FormData();
  form.append("file", file);

  try {
    const res  = await fetch("/documents", { method: "POST", body: form });
    const data = await res.json();
    if (data.error) {
      uploadStatus.textContent = `Fehler: ${data.error}`;
      uploadStatus.className   = "upload-status error";
    } else {
      uploadStatus.textContent = `✓ ${file.name} wird verarbeitet…`;
      uploadStatus.className   = "upload-status success";
      setTimeout(closeUploadModal, 2000);
    }
  } catch {
    uploadStatus.textContent = "Verbindungsfehler beim Upload.";
    uploadStatus.className   = "upload-status error";
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function scrollToBottom(): void { chatArea.scrollTop = chatArea.scrollHeight; }

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Init ───────────────────────────────────────────────────────────────────

loadConversationList();
