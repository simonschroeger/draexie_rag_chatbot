import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Send, Menu, X,
  Trash2, Upload, Copy, Check,
  ChevronDown, FileText, BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { RagMessage, Conversation, HealthStatus, ServerEvent, Chunk } from './types';
import Mascot from './components/Mascot';

// ── Markdown / table renderer ──────────────────────────────────────────────

marked.use({ gfm: true, breaks: true });

type ContentSegment =
  | { type: 'prose'; text: string }
  | { type: 'table'; title?: string; columns: string[]; rows: string[][] }
  | { type: 'table-error'; raw: string };

function parseContent(text: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  // Only match COMPLETE blocks (opening fence + JSON + closing fence).
  // During streaming, incomplete blocks stay in the trailing prose segment.
  const pattern = /```ui-table\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const prose = text.slice(lastIndex, match.index).trim();
      if (prose) segments.push({ type: 'prose', text: prose });
    }
    try {
      const data = JSON.parse(match[1].trim());
      segments.push({ type: 'table', title: data.title, columns: data.columns ?? [], rows: data.rows ?? [] });
    } catch {
      segments.push({ type: 'table-error', raw: match[1] });
    }
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining.trim()) segments.push({ type: 'prose', text: remaining });
  return segments;
}

function TableBlock({ title, columns, rows }: { title?: string; columns: string[]; rows: string[][] }) {
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-outline-variant">
      {title && (
        <div className="px-4 py-2 bg-surface-container-highest text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant">
          {title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          {columns.length > 0 && (
            <thead className="bg-surface-container-high">
              <tr>
                {columns.map((col, i) => (
                  <th key={i} className="px-4 py-2.5 text-left font-semibold text-on-surface border-b border-outline-variant whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-outline-variant/40 last:border-none hover:bg-surface-container-highest/50 transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2.5 text-on-surface-variant align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarkdownContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const segments = parseContent(text);

  return (
    <div className="space-y-0.5">
      {segments.map((seg, i) => {
        if (seg.type === 'table') {
          return <TableBlock key={i} title={seg.title} columns={seg.columns} rows={seg.rows} />;
        }
        if (seg.type === 'table-error') {
          return (
            <pre key={i} className="draexie-prose text-[11px] text-on-surface-variant/60 whitespace-pre-wrap break-all">
              {seg.raw}
            </pre>
          );
        }
        const html = DOMPurify.sanitize(marked.parse(seg.text) as string, {
          ALLOWED_TAGS: [
            'p','br','strong','em','b','i','u','s','del',
            'h1','h2','h3','h4','h5','h6',
            'ul','ol','li',
            'blockquote','pre','code',
            'sup','sub','mark','a','hr',
          ],
          ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
        });
        const isLast = i === segments.length - 1;
        return (
          <div
            key={i}
            className="draexie-prose"
            dangerouslySetInnerHTML={{ __html: html + (streaming && isLast ? '<span class="cursor-blink"></span>' : '') }}
          />
        );
      })}
    </div>
  );
}

// ── Knowledge panel sources tab ────────────────────────────────────────────

function KnowledgeSources({ sources, chunks }: { sources: string[]; chunks: Chunk[] }) {
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!sources.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-16">
        <FileText size={28} className="text-on-surface-variant/20 mb-3" />
        <p className="text-[11px] text-on-surface-variant/40 font-mono italic leading-relaxed">
          Stell eine Frage,<br />um Quellen zu sehen
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {sources.map(src => {
          const related = chunks.filter(c => c.source === src);
          const hasImages = related.some(c => c.image_url);
          const isOpen = openSrc === src;
          return (
            <div key={src} className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenSrc(isOpen ? null : src)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface-container-high transition-colors text-left"
              >
                <FileText size={11} className={`shrink-0 ${hasImages ? 'text-[#ffda51]' : 'text-primary-container'}`} />
                <span className="text-[11px] font-medium flex-1 min-w-0 truncate">{src}</span>
                {related.length > 0 && (
                  <span className="text-[9px] text-on-surface-variant/50 font-mono shrink-0 mr-1">{related.length}</span>
                )}
                <ChevronDown size={11} className={`text-on-surface-variant/40 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && related.length > 0 && (
                <div className="border-t border-outline-variant divide-y divide-outline-variant/40">
                  {related.map(c => (
                    <div key={c.num} className="px-3 py-2.5 space-y-2">
                      <span className="text-[9px] font-mono text-primary-container/60">[{c.num}]</span>

                      {/* Image preview */}
                      {c.image_url && (
                        <button
                          onClick={() => setLightbox(c.image_url!)}
                          className="block w-full mt-1 rounded-lg overflow-hidden border border-outline-variant hover:border-primary-container/40 transition-colors"
                        >
                          <img
                            src={c.image_url}
                            alt={`Abbildung aus ${src}`}
                            className="w-full object-contain max-h-48 bg-surface-container-highest"
                            loading="lazy"
                          />
                        </button>
                      )}

                      {/* Text excerpt */}
                      {c.text && c.text !== `[Abbildung aus ${src}]` && (
                        <p className="text-[11px] leading-relaxed text-on-surface-variant">
                          {c.text}{c.text.length >= 500 ? '…' : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <img
              src={lightbox}
              alt="Abbildung"
              className="w-full h-full object-contain rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Suggestion chips ───────────────────────────────────────────────────────

function SuggestionChips({ suggestions, onSelect }: { suggestions: string[]; onSelect: (q: string) => void }) {
  if (!suggestions.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {suggestions.map((q, i) => (
        <button key={i} className="suggestion-chip" onClick={() => onSelect(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}

// ── Feedback ───────────────────────────────────────────────────────────────

function FeedbackRow({ convId, question, answer }: { convId: string; question: string; answer: string }) {
  const [voted, setVoted] = useState<string | null>(null);
  const vote = async (rating: 'up' | 'down') => {
    if (voted) return;
    setVoted(rating);
    await fetch('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: convId, rating, question, answer }),
    });
  };
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider">War das hilfreich?</span>
      {(['up', 'down'] as const).map(r => (
        <button
          key={r}
          onClick={() => vote(r)}
          disabled={!!voted}
          className={`text-sm transition-opacity ${voted && voted !== r ? 'opacity-30' : ''} ${voted === r ? 'text-primary-container' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          {r === 'up' ? '👍' : '👎'}
        </button>
      ))}
    </div>
  );
}

// ── Upload modal ───────────────────────────────────────────────────────────

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: (filename: string) => void }) {
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setStatus(`Lädt hoch: ${file.name}…`);
    setIsError(false);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/documents', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) { setStatus(`Fehler: ${data.error}`); setIsError(true); }
      else {
        setStatus(`✓ ${file.name} wird verarbeitet…`);
        onSuccess?.(file.name);
        setTimeout(onClose, 2000);
      }
    } catch { setStatus('Verbindungsfehler.'); setIsError(true); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container-high border border-outline-variant rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider">Dokument hochladen</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div
          className="border-2 border-dashed border-outline-variant rounded-xl p-8 text-center cursor-pointer hover:border-primary-container/50 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        >
          <Upload size={24} className="mx-auto mb-2 text-on-surface-variant" />
          <p className="text-sm text-on-surface-variant">Datei hier ablegen oder klicken</p>
          <p className="text-[10px] text-on-surface-variant/50 mt-1 font-mono">PDF · DOCX · PPTX · XLSX · TXT</p>
        </div>
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        {status && <p className={`mt-3 text-xs font-mono ${isError ? 'text-red-400' : 'text-emerald-400'}`}>{status}</p>}
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [messages, setMessages] = useState<RagMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [convId, setConvId] = useState(() => crypto.randomUUID());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convSearch, setConvSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sources' | 'entities' | 'summary'>('sources');
  const [panelMsgId, setPanelMsgId] = useState<string | null>(null);

  const chatEndRef     = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const streamStart    = useRef(0);
  const tokenCount     = useRef(0);
  const streamingMsgId = useRef('');

  const setMascot = useCallback((state: string) => {
    window.mascot?.setState(state);
  }, []);

  // ── Health poll ────────────────────────────────────────────────────────────
  const pollHealth = useCallback(async () => {
    try {
      const data: HealthStatus = await (await fetch('/health')).json();
      setHealth(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    pollHealth();
    const id = setInterval(pollHealth, 30_000);
    return () => clearInterval(id);
  }, [pollHealth]);

  // ── Conversation list ──────────────────────────────────────────────────────
  const loadConvList = useCallback(async () => {
    try {
      const data: Conversation[] = await (await fetch('/conversations')).json();
      setConversations(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadConvList(); }, [loadConvList]);

  // ── Scroll on new messages ─────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Derived panel data ─────────────────────────────────────────────────────
  const panelMsg    = messages.find(m => m.id === panelMsgId);
  const panelSources = panelMsg?.sources ?? [];
  const panelChunks  = panelMsg?.chunks  ?? [];

  // ── Load conversation ──────────────────────────────────────────────────────
  const loadConversation = async (id: string) => {
    setConvId(id);
    setSidebarOpen(false);
    setPanelMsgId(null);
    try {
      const data: { messages: { role: string; content: string }[] } =
        await (await fetch(`/conversations/${id}`)).json();
      setMessages(data.messages.map((m, i) => ({
        id: String(i),
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })));
    } catch { setMessages([]); }
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/conversations/${id}`, { method: 'DELETE' });
    if (id === convId) { setConvId(crypto.randomUUID()); setMessages([]); setPanelMsgId(null); }
    loadConvList();
  };

  const newConversation = () => {
    setConvId(crypto.randomUUID());
    setMessages([]);
    setPanelMsgId(null);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async (question?: string) => {
    const q = question ?? input.trim();
    if (!q || isStreaming) return;

    setInput('');
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }
    setIsStreaming(true);
    setMascot('searching');
    streamStart.current = Date.now();
    tokenCount.current = 0;

    const userMsg: RagMessage = { id: crypto.randomUUID(), role: 'user', content: q };
    const aiMsg: RagMessage   = { id: crypto.randomUUID(), role: 'assistant', content: '', isStreaming: true };
    streamingMsgId.current = aiMsg.id;

    setMessages(prev => [...prev.filter(m => m.id !== '__welcome__'), userMsg, aiMsg]);

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, conversation_id: convId }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aiSources: string[] = [];
      let aiChunks:  Chunk[]  = [];
      let firstToken = true;

      const processEvents = (raw: string) => {
        const events    = raw.split('\n\n');
        const remainder = events.pop() ?? '';
        for (const ev of events) {
          if (!ev.startsWith('data: ')) continue;
          let parsed: ServerEvent;
          try { parsed = JSON.parse(ev.slice(6)); } catch { continue; }

          if (parsed.sources) {
            aiSources = parsed.sources;
            aiChunks  = parsed.chunks ?? [];
            setMascot('analyzing');
          } else if (parsed.token !== undefined) {
            if (firstToken) { setMascot('generating'); firstToken = false; }
            tokenCount.current += 1;
            setMessages(prev => prev.map(m =>
              m.isStreaming ? { ...m, content: m.content + parsed.token } : m
            ));
          } else if (parsed.done) {
            setMascot('found');
            const doneId = streamingMsgId.current;
            setMessages(prev => prev.map(m =>
              m.isStreaming
                ? { ...m, isStreaming: false, sources: aiSources, chunks: aiChunks, suggestions: parsed.suggestions ?? [] }
                : m
            ));
            setPanelMsgId(doneId);
            setActiveTab('sources');
            setTimeout(() => setMascot('idle'), 3000);
          }
        }
        return remainder;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) { if (buffer.trim()) processEvents(buffer + '\n\n'); break; }
        buffer += decoder.decode(value, { stream: true });
        buffer = processEvents(buffer);
      }

      loadConvList();
    } catch {
      setMascot('error');
      setMessages(prev => prev.map(m =>
        m.isStreaming ? { ...m, isStreaming: false, content: 'Verbindungsfehler. Bitte versuche es erneut.' } : m
      ));
      setTimeout(() => setMascot('idle'), 4000);
    }

    setIsStreaming(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredConvs = conversations.filter(c =>
    c.title.toLowerCase().includes(convSearch.toLowerCase())
  );

  const messageCount = messages.filter(m => m.id !== '__welcome__').length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] bg-surface-container-low text-on-surface overflow-hidden">

      {/* ── Left sidebar overlay (mobile) ───────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Left sidebar ────────────────────────────────────────────────────── */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 w-64 bg-surface-container border-r border-outline-variant flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        {/* Brand */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant shrink-0">
          <div>
            <h1 className="text-base font-bold tracking-tight">DRÄXIE</h1>
            <p className="text-[9px] font-mono text-on-surface-variant uppercase tracking-[0.2em]">Hochschule Landshut</p>
          </div>
          <button className="md:hidden text-on-surface-variant" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* New chat */}
        <div className="p-3 shrink-0">
          <button
            onClick={newConversation}
            className="flex items-center gap-2 w-full px-3 py-2 bg-primary-container text-white rounded-xl text-sm font-semibold hover:brightness-110 active:scale-95 transition-all"
          >
            <Plus size={16} /> Neues Gespräch
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2 shrink-0">
          <input
            value={convSearch}
            onChange={e => setConvSearch(e.target.value)}
            placeholder="Gespräch suchen…"
            className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container/50"
          />
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 min-h-0">
          {filteredConvs.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant/50 text-center mt-4 font-mono">Noch keine Gespräche</p>
          ) : (
            filteredConvs.map(c => (
              <div
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer mb-1 transition-colors ${
                  c.id === convId
                    ? 'bg-primary-container/10 border border-primary-container/20 text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium truncate">{c.title}</p>
                  <p className="text-[10px] font-mono opacity-60">{c.message_count} Nachrichten</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteConversation(c.id); }}
                  className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-red-400 ml-2 shrink-0 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* ── System status (non-technical) ──────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-outline-variant space-y-3 shrink-0">

          {/* Online / offline */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shrink-0 ${health?.status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-[11px] text-on-surface-variant">
              {health?.status === 'ok' ? 'System bereit' : 'Nicht verfügbar'}
            </span>
          </div>

          {/* Last uploaded file */}
          {health?.last_ingestion && (
            <div className="space-y-0.5">
              <p className="text-[9px] uppercase tracking-wider text-on-surface-variant/40 font-mono">Zuletzt importiert</p>
              <p className="text-[11px] text-on-surface truncate">{health.last_ingestion.filename}</p>
            </div>
          )}

          {/* Message count */}
          {messageCount > 0 && (
            <p className="text-[11px] text-on-surface-variant">{messageCount} Nachrichten in diesem Gespräch</p>
          )}
        </div>

        {/* Upload */}
        <div className="p-3 border-t border-outline-variant shrink-0">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 w-full px-3 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-xl text-xs transition-colors"
          >
            <Upload size={14} /> Dokument hochladen
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">

        {/* Minimal top bar (mobile nav only) */}
        <div className="h-8 bg-surface-container-high/60 border-b border-outline-variant px-4 flex items-center gap-3 shrink-0 z-20">
          <button className="md:hidden text-on-surface-variant" onClick={() => setSidebarOpen(true)}>
            <Menu size={16} />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${health?.status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">
              {health?.status === 'ok' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
          <div className="max-w-3xl mx-auto space-y-8 pb-56">

            {/* Welcome */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="text-center pt-12"
              >
                <h2 className="text-2xl font-bold mb-2">Was möchtest du wissen?</h2>
                <p className="text-sm text-on-surface-variant mb-8">Frag DRÄXIE nach Studienordnungen, Prüfungsfristen oder Modulbeschreibungen.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left">
                  {[
                    'Welche Lehrveranstaltungen gibt es im Studium Generale?',
                    'Wie viele ECTS bekomme ich für das Studium Generale?',
                    'Was sind die Voraussetzungen für das Modulstudium?',
                    'Wann endet die Rückmeldefrist für das Wintersemester?',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left px-4 py-3 bg-surface-container border border-outline-variant rounded-xl text-[12px] text-on-surface-variant hover:text-on-surface hover:border-primary-container/40 hover:bg-surface-container-high transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Messages */}
            <AnimatePresence mode="popLayout">
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[78%] bg-primary-container text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-lg">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="w-full space-y-1">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">DRÄXIE</span>
                        {!msg.isStreaming && msg.content && (
                          <button
                            onClick={() => handleCopy(msg.content, msg.id)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-on-surface-variant hover:text-primary-container hover:bg-surface-container-highest rounded transition-all"
                          >
                            {copiedId === msg.id
                              ? <><Check size={11} className="text-emerald-400" /><span className="text-emerald-400">Kopiert</span></>
                              : <><Copy size={11} /><span>Kopieren</span></>
                            }
                          </button>
                        )}
                      </div>

                      {/* Content */}
                      <MarkdownContent text={msg.content} streaming={msg.isStreaming} />

                      {/* Sources button → opens Knowledge Panel */}
                      {!msg.isStreaming && msg.sources && msg.sources.length > 0 && (
                        <button
                          onClick={() => { setPanelMsgId(msg.id); setActiveTab('sources'); }}
                          className={`mt-2 flex items-center gap-1.5 text-[10px] font-mono transition-colors px-2 py-1 rounded-lg border ${
                            panelMsgId === msg.id
                              ? 'text-primary-container border-primary-container/30 bg-primary-container/5'
                              : 'text-on-surface-variant border-outline-variant hover:text-primary-container hover:border-primary-container/30'
                          }`}
                        >
                          <FileText size={10} />
                          <span>Quellen ({msg.sources.length})</span>
                        </button>
                      )}

                      {/* Suggestions */}
                      {!msg.isStreaming && msg.suggestions && msg.suggestions.length > 0 && (
                        <SuggestionChips suggestions={msg.suggestions} onSelect={q => sendMessage(q)} />
                      )}

                      {/* Feedback */}
                      {!msg.isStreaming && msg.content && messages.find(m => m.role === 'user' && messages.indexOf(m) === messages.indexOf(msg) - 1) && (
                        <FeedbackRow
                          convId={convId}
                          question={messages[messages.indexOf(msg) - 1]?.content ?? ''}
                          answer={msg.content}
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* ── Input area ──────────────────────────────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
          <div className="flex justify-center pointer-events-none">
            <Mascot />
          </div>
          <div className="px-4 pb-4 pointer-events-auto">
            <div className="max-w-3xl mx-auto bg-surface-container/90 backdrop-blur-xl border border-outline-variant rounded-2xl p-1.5 flex items-end gap-2 shadow-2xl transition-all focus-within:ring-2 focus-within:ring-primary-container/30">
              <button
                onClick={() => setUploadOpen(true)}
                className="p-2 text-on-surface-variant hover:text-primary-container hover:bg-surface-container-highest rounded-xl transition-all shrink-0"
              >
                <Plus size={18} />
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                placeholder="Stell DRÄXIE eine Frage…"
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-2 placeholder:text-on-surface-variant/50 resize-none leading-relaxed"
                style={{ maxHeight: 140, overflowY: 'auto' }}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isStreaming || !input.trim()}
                className="p-2.5 bg-primary-container text-white rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-center text-on-surface-variant/40 mt-2 font-mono">
              Enter senden · Shift+Enter neue Zeile
            </p>
          </div>
        </div>
      </main>

      {/* ── Right panel — Knowledge Panel ───────────────────────────────────── */}
      <aside className="hidden xl:flex w-72 bg-surface-container border-l border-outline-variant flex-col overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-outline-variant flex items-center gap-2 shrink-0">
          <BookOpen size={14} className="text-primary-container" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Wissensbereich</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant shrink-0">
          {(['sources', 'entities', 'summary'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-primary-container border-primary-container'
                  : 'text-on-surface-variant border-transparent hover:text-on-surface'
              }`}
            >
              {tab === 'sources' ? 'Quellen' : tab === 'entities' ? 'Entitäten' : 'Zusammenfassung'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {activeTab === 'sources' && (
            <KnowledgeSources sources={panelSources} chunks={panelChunks} />
          )}
          {activeTab !== 'sources' && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <p className="text-[11px] text-on-surface-variant/40 font-mono italic">Kommt bald</p>
            </div>
          )}
        </div>
      </aside>

      {/* Upload modal */}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onSuccess={() => setTimeout(pollHealth, 3000)}
        />
      )}
    </div>
  );
}
