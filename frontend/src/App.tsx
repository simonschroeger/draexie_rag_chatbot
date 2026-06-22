import { useState, useRef, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import {
  Plus, Menu, X,
  Trash2, Upload, Copy, Check,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText, BookOpen,
  Paperclip, ArrowUp, Square, RotateCcw, Settings,
  ThumbsUp, ThumbsDown, MoreHorizontal, ExternalLink, Languages,
  Sun, Moon, Search, MessageSquare, PanelLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import 'katex/dist/katex.min.css';
import DOMPurify from 'dompurify';
import { RagMessage, Conversation, HealthStatus, ServerEvent, Chunk } from './types';
import Mascot from './components/Mascot';

// ── i18n ──────────────────────────────────────────────────────────────────────

type Lang = 'de' | 'en';

const translations = {
  de: {
    newChat:           'Neues Gespräch',
    searchChats:       'Gespräch suchen…',
    noChats:           'Noch keine Gespräche',
    today:             'Heute',
    yesterday:         'Gestern',
    last7days:         'Letzte 7 Tage',
    older:             'Älter',
    unnamed:           'Unbenanntes Gespräch',
    systemReady:       'System bereit',
    unavailable:       'Nicht verfügbar',
    lastImported:      'Zuletzt importiert',
    messages:          (n: number) => `${n} Nachrichten in diesem Gespräch`,
    sources:           (n: number) => `Quellen (${n})`,
    sourcesTab:        'Quellen',
    summaryTab:        'Zusammenfassung',
    wikiTab:           'Wiki',
    showLess:          'Weniger anzeigen',
    showAll:           'Alles anzeigen',
    uploading:         'Wird hochgeladen…',
    processing:        'Wird verarbeitet…',
    uploadError:       'Fehler beim Upload',
    connError:         'Verbindungsfehler. Bitte versuche es erneut.',
    connErrorShort:    'Verbindungsfehler.',
    disclaimer:        'Dräxie kann Fehler machen. Bitte überprüfe wichtige Quellen.',
    inputHints:        'Enter zum Senden · Shift+Enter für eine neue Zeile · ESC zum Stoppen',
    placeholders: [
      'Stelle eine Frage zu deinen Dokumenten…',
      'Was sind die Einarbeitungsthemen für neue Mitarbeiter?',
      'Erkläre den Änderungsmanagement-Prozess…',
      'Was bedeutet die Abkürzung COP?',
    ],
    copyBtn:           'Kopieren',
    helpfulBtn:        'Hilfreich',
    notHelpfulBtn:     'Nicht hilfreich',
    regenerateBtn:     'Neu generieren',
    sysPromptPlaceholder: 'Zusätzliche Anweisungen für DRÄXIE…',
    sysPromptTitle:    'Systemkontext (Ctrl+Shift+P)',
    askToSeeSource:    'Stell eine Frage,\num Quellen zu sehen',
    wikiPlaceholder:   'Wiki-Seiten erscheinen hier,\nsobald sie zur Antwort beitragen',
    commonalities:     'Gemeinsamkeiten',
    analysing:         'Analysiere…',
    welcomeTitle:      'Was möchtest du wissen?',
    welcomeSubtitle:   'Stell Fragen zu internen Prozessen, Produkten und Unternehmensabläufen bei DRÄXLMAIER.',
    knowledgePanel:    'Wissensbereich',
    openInNewTab:      'In neuem Tab',
    dropFileHere:      'Datei hier ablegen oder klicken',
    uploadTitle:       'Dokument hochladen',
    attachFile:        'Datei anhängen',
    newMessage:        'Neue Nachricht',
    rename:            'Umbenennen',
    delete:            'Löschen',
    closeSidebar:      'Sidebar schließen',
    openSidebar:       'Sidebar öffnen',
    closePanel:        'Panel schließen',
    openPanel:         'Wissensbereich öffnen',
    pastedText:        'Eingefügt',
    stopGenerating:    'Generierung stoppen (ESC)',
    wasHelpful:        'War das hilfreich?',
    uploadingFile:     (name: string) => `Lädt hoch: ${name}…`,
    processingFile:    (name: string) => `✓ ${name} wird verarbeitet…`,
    uploadFailed:      (err: string)  => `Fehler: ${err}`,
    questionPool: [
      'Was sind die Schritte im Änderungsmanagement-Prozess?',
      'Wie buche ich Stunden korrekt im SAP?',
      'Welche Produktbestandteile gehören zum DRÄXLMAIER-Portfolio?',
      'Wie läuft die Kostenkalkulation für ein Fahrzeugprojekt ab?',
      'Was sind die wichtigsten Abkürzungen in der Automobilindustrie?',
      'Wie organisiere ich eine Dienstreise korrekt?',
      'Was muss ich bei Kundenterminen beachten?',
      'Wie funktioniert die Logistik und Disposition bei DRÄXLMAIER?',
      'Was ist das CMH-System und wie wird es eingesetzt?',
      'Wie richte ich mein Diensthandy ein?',
      'Welche Segmente hat DRÄXLMAIER und was machen sie?',
      'Was sind die Preisbestandteile in der Angebotskalkulation?',
      'Wie läuft ein neues Fahrzeugprojekt von der Akquise bis zur Serienlieferung ab?',
      'Was sind die typischen Regeltermine im Projektverlauf?',
    ],
  },
  en: {
    newChat:           'New Chat',
    searchChats:       'Search chats…',
    noChats:           'No conversations yet',
    today:             'Today',
    yesterday:         'Yesterday',
    last7days:         'Last 7 days',
    older:             'Older',
    unnamed:           'Unnamed conversation',
    systemReady:       'System ready',
    unavailable:       'Unavailable',
    lastImported:      'Last imported',
    messages:          (n: number) => `${n} messages in this chat`,
    sources:           (n: number) => `Sources (${n})`,
    sourcesTab:        'Sources',
    summaryTab:        'Summary',
    wikiTab:           'Wiki',
    showLess:          'Show less',
    showAll:           'Show all',
    uploading:         'Uploading…',
    processing:        'Processing…',
    uploadError:       'Upload error',
    connError:         'Connection error. Please try again.',
    connErrorShort:    'Connection error.',
    disclaimer:        'Dräxie can make mistakes. Please verify important sources.',
    inputHints:        'Enter to send · Shift+Enter for new line · ESC to stop',
    placeholders: [
      'Ask a question about your documents…',
      'What are the onboarding topics for new employees?',
      'Explain the change management process…',
      'What does the abbreviation COP mean?',
    ],
    copyBtn:           'Copy',
    helpfulBtn:        'Helpful',
    notHelpfulBtn:     'Not helpful',
    regenerateBtn:     'Regenerate',
    sysPromptPlaceholder: 'Additional instructions for DRÄXIE…',
    sysPromptTitle:    'System context (Ctrl+Shift+P)',
    askToSeeSource:    'Ask a question\nto see sources',
    wikiPlaceholder:   'Wiki pages appear here\nonce they contribute to the answer',
    commonalities:     'Commonalities',
    analysing:         'Analysing…',
    welcomeTitle:      'What would you like to know?',
    welcomeSubtitle:   'Ask questions about internal processes, products, and company operations at DRÄXLMAIER.',
    knowledgePanel:    'Knowledge Panel',
    openInNewTab:      'Open in new tab',
    dropFileHere:      'Drop file here or click',
    uploadTitle:       'Upload document',
    attachFile:        'Attach file',
    newMessage:        'New message',
    rename:            'Rename',
    delete:            'Delete',
    closeSidebar:      'Close sidebar',
    openSidebar:       'Open sidebar',
    closePanel:        'Close panel',
    openPanel:         'Open knowledge panel',
    pastedText:        'Pasted',
    stopGenerating:    'Stop generating (ESC)',
    wasHelpful:        'Was this helpful?',
    uploadingFile:     (name: string) => `Uploading: ${name}…`,
    processingFile:    (name: string) => `✓ ${name} processing…`,
    uploadFailed:      (err: string)  => `Error: ${err}`,
    questionPool: [
      'What are the steps in the change management process?',
      'How do I correctly book hours in SAP?',
      'Which product components are part of the DRÄXLMAIER portfolio?',
      'How does cost calculation work for a vehicle project?',
      'What are the key abbreviations used in the automotive industry?',
      'How do I correctly organize a business trip?',
      'What should I keep in mind for customer appointments?',
      'How does logistics and dispatching work at DRÄXLMAIER?',
      'What is the CMH system and how is it used?',
      'How do I set up my company mobile phone?',
      'What segments does DRÄXLMAIER have and what do they do?',
      'What are the pricing components in a quotation calculation?',
      'How does a new vehicle project progress from acquisition to series delivery?',
      'What are the typical regular meetings in the project timeline?',
    ],
  },
} as const;

type T = typeof translations[Lang];
const LangContext = createContext<{ lang: Lang; t: T; setLang: (l: Lang) => void }>({
  lang: 'de', t: translations.de, setLang: () => {},
});
const useLang = () => useContext(LangContext);

// ── Rotating placeholder ───────────────────────────────────────────────────

function usePlaceholder(t: T) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setIdx(0); // reset index on language change
  }, [t]);
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % t.placeholders.length); setVisible(true); }, 400);
    }, 4000);
    return () => clearInterval(id);
  }, [t]);
  return { text: t.placeholders[idx], visible };
}

// ── Search helpers ─────────────────────────────────────────────────────────

function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function highlightInHtml(html: string, query: string, markClass = 'search-highlight'): string {
  if (!query || query.length < 2) return html;
  const normQ = normalizeForSearch(query);
  return html.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
    if (tag) return tag;
    if (!text) return '';
    const normT = normalizeForSearch(text);
    let result = '';
    let i = 0;
    while (i < text.length) {
      const idx = normT.indexOf(normQ, i);
      if (idx === -1) { result += text.slice(i); break; }
      result += text.slice(i, idx);
      result += `<mark class="${markClass}">${text.slice(idx, idx + query.length)}</mark>`;
      i = idx + query.length;
    }
    return result;
  });
}

// ── InChatSearchBar component ──────────────────────────────────────────────

function InChatSearchBar({ query, onQueryChange, matchIdx, matchCount, onNext, onPrev, onClose, inputRef }: {
  query: string;
  onQueryChange: (q: string) => void;
  matchIdx: number;
  matchCount: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="in-chat-search-bar">
      <Search size={13} className="text-on-surface-variant/50 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        placeholder="Suche in diesem Chat…"
        onKeyDown={e => {
          if (e.key === 'Escape') { onClose(); }
          else if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onPrev(); }
          else if (e.key === 'Enter') { e.preventDefault(); onNext(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); onPrev(); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); onNext(); }
        }}
      />
      {query.length >= 2 && (
        <span className="text-[11px] text-on-surface-variant/60 font-mono shrink-0 whitespace-nowrap">
          {matchCount === 0 ? '0 Treffer' : `${matchIdx + 1} von ${matchCount}`}
        </span>
      )}
      <button
        onClick={onPrev}
        disabled={matchCount === 0}
        className="p-1 rounded-lg text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30 transition-all"
        title="Vorheriger Treffer (↑)"
      >
        <ChevronUp size={14} />
      </button>
      <button
        onClick={onNext}
        disabled={matchCount === 0}
        className="p-1 rounded-lg text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30 transition-all"
        title="Nächster Treffer (↓)"
      >
        <ChevronDown size={14} />
      </button>
      <button
        onClick={onClose}
        className="p-1 rounded-lg text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-highest transition-all"
        title="Schließen (ESC)"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Markdown / table renderer ──────────────────────────────────────────────

marked.use(markedKatex({ throwOnError: false }));
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
      const raw = match[1].trim();
      let data: { title?: string; columns?: string[]; rows?: string[][] } | null = null;
      try {
        data = JSON.parse(raw);
      } catch {
        // lenient fallback: replace single quotes and strip trailing commas
        try {
          data = JSON.parse(raw.replace(/'/g, '"').replace(/,(\s*[}\]])/g, '$1'));
        } catch {
          console.warn('[ui-table] JSON parse failed:', raw);
        }
      }
      if (data) {
        segments.push({ type: 'table', title: data.title, columns: data.columns ?? [], rows: data.rows ?? [] });
      } else {
        segments.push({ type: 'table-error', raw });
      }
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

function MarkdownContent({ text, streaming, searchHighlight, isActiveMatch }: { text: string; streaming?: boolean; searchHighlight?: string; isActiveMatch?: boolean }) {
  const segments = parseContent(text);

  return (
    <div className="space-y-0.5">
      {segments.map((seg, i) => {
        if (seg.type === 'table') {
          return <TableBlock key={i} title={seg.title} columns={seg.columns} rows={seg.rows} />;
        }
        if (seg.type === 'table-error') {
          return (
            <p key={i} className="text-[11px] text-on-surface-variant/50 italic">
              [Tabelle konnte nicht geladen werden]
            </p>
          );
        }
        const sanitized = DOMPurify.sanitize(marked.parse(seg.text) as string, {
          ALLOWED_TAGS: [
            'p','br','strong','em','b','i','u','s','del',
            'h1','h2','h3','h4','h5','h6',
            'ul','ol','li',
            'blockquote','pre','code',
            'sup','sub','mark','a','hr',
            'table','thead','tbody','tr','th','td',
            // KaTeX math rendering
            'math','mrow','mi','mo','mn','msup','msub','mfrac','msqrt','mtext',
            'mspace','mover','munder','munderover','mtable','mtr','mtd','annotation',
            'semantics','span',
          ],
          ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'aria-hidden', 'focusable', 'xmlns'],
        });
        // Inject clickable cite badges for [N] / [N, M] markers, skipping code/pre/table blocks
        let html = sanitized.replace(
          /(<code[^>]*>[\s\S]*?<\/code>|<pre[^>]*>[\s\S]*?<\/pre>|<table[^>]*>[\s\S]*?<\/table>)|\[(\d+(?:,\s*\d+)*)\]/g,
          (m, skip, nums) => {
            if (skip) return skip;
            return nums.split(/,\s*/).map(n => `<span class="cite-badge" data-cite="${n}">[${n}]</span>`).join('');
          }
        );
        // Remove orphaned period that appears between adjacent cite badges: [1]. [2] → [1][2]
        html = html.replace(/(<\/span>)\s*\.\s*(<span class="cite-badge")/g, '$1$2');
        // Remove lone period immediately after the last cite badge before a closing block tag
        html = html.replace(/(<span class="cite-badge"[^>]*>\[\d+\]<\/span>)\s*\.\s*(<\/(?:li|p|td|th|div)>)/gi, '$1$2');
        // Apply search highlight after cite-badge injection
        if (searchHighlight && searchHighlight.length >= 2) {
          html = highlightInHtml(html, searchHighlight, isActiveMatch ? 'search-highlight active' : 'search-highlight');
        }
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

// ── Knowledge panel — content detection + rich rendering ──────────────────

type ChunkType = 'image' | 'table' | 'code' | 'text';

function detectType(chunk: Chunk): ChunkType {
  if (chunk.image_url) return 'image';
  const t = chunk.text.trimStart();
  if (t.startsWith('```')) return 'code';
  const lines = t.split('\n').filter(l => l.trim());
  const pipeLines = lines.filter(l => l.includes('|'));
  const hasSep = lines.some(l => /^\|?[\s\-:]+\|/.test(l));
  if (pipeLines.length >= 2 && hasSep) return 'table';
  return 'text';
}

const TYPE_BADGE: Record<ChunkType, { label: string; cls: string }> = {
  image: { label: 'IMAGE', cls: 'bg-[#ffda51]/10 text-[#ffda51]' },
  table: { label: 'TABLE', cls: 'bg-primary-container/10 text-primary-container' },
  code:  { label: 'CODE',  cls: 'bg-[#d0bcff]/10 text-[#d0bcff]' },
  text:  { label: 'TEXT',  cls: 'bg-surface-container-highest text-on-surface-variant/40' },
};

function ChunkContent({ chunk, expanded, onImageClick }: {
  chunk: Chunk; expanded: boolean; onImageClick?: (url: string) => void;
}) {
  const type = detectType(chunk);

  if (type === 'image' && chunk.image_url) {
    return (
      <button
        onClick={() => onImageClick?.(chunk.image_url!)}
        className="block w-full rounded-lg overflow-hidden border border-outline-variant hover:border-primary-container/40 transition-colors"
      >
        <img src={chunk.image_url} alt="" className="w-full object-contain max-h-48 bg-surface-container-highest" loading="lazy" />
      </button>
    );
  }

  if (type === 'table') {
    const html = DOMPurify.sanitize(marked.parse(chunk.text) as string, {
      ALLOWED_TAGS: ['table','thead','tbody','tr','th','td','p','br','strong','em'],
      ALLOWED_ATTR: [],
    });
    return (
      <div
        className={`draexie-prose overflow-x-auto text-[11px] ${!expanded ? 'max-h-24 overflow-hidden' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (type === 'code') {
    const raw = chunk.text.replace(/^```[\w]*\n?/, '').replace(/```\s*$/, '');
    return (
      <pre className={`text-[10px] font-mono bg-surface-container-highest rounded-lg p-2.5 overflow-x-auto leading-relaxed ${!expanded ? 'max-h-24 overflow-hidden' : ''}`}>
        <code>{raw}</code>
      </pre>
    );
  }

  return (
    <p className={`text-[11px] leading-relaxed text-on-surface-variant ${!expanded ? 'line-clamp-4' : ''}`}>
      {chunk.text}
    </p>
  );
}

// ── Document viewer modal ──────────────────────────────────────────────────

function DocViewer({ src, chunks, onClose }: { src: string; chunks: Chunk[]; onClose: () => void }) {
  const { t } = useLang();
  const ext = src.split('.').pop()?.toLowerCase() ?? '';
  const isPdf  = ext === 'pdf';
  const isImg  = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const uploadUrl = `/uploads/${encodeURIComponent(src)}`;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl h-[85vh] bg-surface-container-high border border-outline-variant rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant shrink-0">
          <FileText size={13} className="text-primary-container shrink-0" />
          <span className="text-[12px] font-medium flex-1 min-w-0 truncate">{src}</span>
          <a
            href={uploadUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-on-surface-variant hover:text-primary-container hover:bg-surface-container-highest rounded transition-all"
            title={t.openInNewTab}
          >
            <ExternalLink size={12} /> {t.openInNewTab}
          </a>
          <button onClick={onClose} className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-lg transition-all">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {isPdf ? (
            <iframe src={uploadUrl} className="w-full h-full border-none" title={src} />
          ) : isImg ? (
            <img src={uploadUrl} alt={src} className="w-full h-full object-contain p-4" />
          ) : (
            <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-4">
              {chunks.map(c => {
                const type = detectType(c);
                return (
                  <div key={c.num} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-primary-container/60">[{c.num}]</span>
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${TYPE_BADGE[type].cls}`}>
                        {TYPE_BADGE[type].label}
                      </span>
                    </div>
                    <ChunkContent chunk={c} expanded onImageClick={() => {}} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Knowledge panel sources tab ────────────────────────────────────────────

function KnowledgeSources({ sources, chunks, targetChunkNum }: {
  sources: string[];
  chunks: Chunk[];
  targetChunkNum?: number | null;
}) {
  const { t } = useLang();
  const [openSrc, setOpenSrc]         = useState<string | null>(null);
  const [expandedChunks, setExpanded] = useState<Set<number>>(new Set());
  const [viewer, setViewer]           = useState<{ src: string; chunks: Chunk[] } | null>(null);
  const [lightbox, setLightbox]       = useState<string | null>(null);
  const chunkRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const toggleChunk = (num: number) =>
    setExpanded(prev => { const s = new Set(prev); s.has(num) ? s.delete(num) : s.add(num); return s; });

  useEffect(() => {
    if (!targetChunkNum) return;
    const targetSrc = chunks.find(c => c.num === targetChunkNum)?.source;
    if (!targetSrc) return;
    setOpenSrc(targetSrc);
    setTimeout(() => {
      const el = chunkRefs.current.get(targetChunkNum);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        el.classList.add('highlight-chunk');
        setTimeout(() => el.classList.remove('highlight-chunk'), 1300);
      }
    }, 80);
  }, [targetChunkNum, chunks]);

  if (!sources.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-16">
        <FileText size={28} className="text-on-surface-variant/20 mb-3" />
        <p className="text-[11px] text-on-surface-variant/40 font-mono italic leading-relaxed">
          {t.askToSeeSource.split('\n')[0]}<br />{t.askToSeeSource.split('\n')[1]}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {sources.map(src => {
          const related = chunks.filter(c => c.source === src);
          const isOpen  = openSrc === src;
          const dominantType: ChunkType = related.some(c => c.image_url) ? 'image'
            : related.some(c => detectType(c) === 'table') ? 'table'
            : related.some(c => detectType(c) === 'code')  ? 'code'
            : 'text';
          const chunkNums = related.map(c => c.num).sort((a, b) => a - b);

          return (
            <div key={src} className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
              {/* Source header — click=expand, double-click=viewer */}
              <button
                onClick={() => setOpenSrc(isOpen ? null : src)}
                onDoubleClick={e => { e.preventDefault(); setViewer({ src, chunks: related }); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface-container-high transition-colors text-left select-none"
              >
                <FileText size={11} className={`shrink-0 ${TYPE_BADGE[dominantType].cls.split(' ')[1]}`} />
                <span className="text-[11px] font-medium flex-1 min-w-0 truncate">{src}</span>
                {/* Citation numbers from this source */}
                <span className="flex gap-0.5 shrink-0">
                  {chunkNums.slice(0, 3).map(n => (
                    <span key={n} className="cite-badge">{n}</span>
                  ))}
                  {chunkNums.length > 3 && <span className="text-[9px] text-on-surface-variant/40 font-mono">…</span>}
                </span>
                <ChevronDown size={11} className={`text-on-surface-variant/40 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Chunks */}
              {isOpen && related.length > 0 && (
                <div className="border-t border-outline-variant divide-y divide-outline-variant/40">
                  {related.map(c => {
                    const type = detectType(c);
                    const isExpanded = expandedChunks.has(c.num);
                    const needsExpand = type !== 'image' && (c.text.length > 280 || c.text.split('\n').length > 4);
                    return (
                      <div
                        key={c.num}
                        ref={el => { if (el) chunkRefs.current.set(c.num, el); else chunkRefs.current.delete(c.num); }}
                        className="px-3 py-2.5 space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-primary-container/60">[{c.num}]</span>
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${TYPE_BADGE[type].cls}`}>
                            {TYPE_BADGE[type].label}
                          </span>
                        </div>

                        <ChunkContent
                          chunk={c}
                          expanded={isExpanded}
                          onImageClick={url => setLightbox(url)}
                        />

                        {needsExpand && (
                          <button
                            onClick={() => toggleChunk(c.num)}
                            className="text-[10px] font-mono text-primary-container/60 hover:text-primary-container transition-colors"
                          >
                            {isExpanded ? t.showLess : t.showAll}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Document viewer */}
      {viewer && <DocViewer src={viewer.src} chunks={viewer.chunks} onClose={() => setViewer(null)} />}

      {/* Image lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox} alt="" className="w-full h-full object-contain rounded-xl shadow-2xl" />
            <button onClick={() => setLightbox(null)} className="absolute top-3 right-3 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors">
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
  const { t } = useLang();
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
      <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider">{t.wasHelpful}</span>
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

// ── Attachment types + card ────────────────────────────────────────────────

type AttachmentStatus = 'uploading' | 'processing' | 'ready' | 'error';

type Attachment =
  | { id: string; kind: 'paste'; text: string }
  | { id: string; kind: 'file'; file: File; previewUrl: string | null; status: AttachmentStatus };

function fmtSize(bytes: number) {
  return bytes > 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

function AttachmentCard({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  const { t } = useLang();
  if (att.kind === 'paste') {
    return (
      <div className="relative flex-shrink-0 w-44 bg-surface-container-high border border-outline-variant rounded-xl p-3">
        <button
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 p-0.5 text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
        >
          <X size={11} />
        </button>
        <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-primary-container/15 text-primary-container px-1.5 py-0.5 rounded font-mono mb-1.5">
          {t.pastedText}
        </span>
        <p className="text-[11px] text-on-surface-variant leading-relaxed line-clamp-3">
          {att.text.slice(0, 120)}{att.text.length > 120 ? '…' : ''}
        </p>
      </div>
    );
  }

  const isImage = att.file.type.startsWith('image/');
  const statusLabel: Record<AttachmentStatus, string> = {
    uploading:  t.uploading,
    processing: t.processing,
    ready:      '✓',
    error:      t.uploadError,
  };
  const statusColor: Record<AttachmentStatus, string> = {
    uploading:  'text-on-surface-variant/50',
    processing: 'text-primary-container/70',
    ready:      'text-emerald-400',
    error:      'text-red-400',
  };

  return (
    <div className="relative flex-shrink-0 w-36 bg-surface-container-high border border-outline-variant rounded-xl overflow-hidden">
      <button
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 z-10 p-0.5 bg-surface-container-high/80 rounded-full text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
      >
        <X size={11} />
      </button>
      {isImage && att.previewUrl ? (
        <img
          src={att.previewUrl}
          alt={att.file.name}
          className="w-full h-20 object-cover bg-surface-container"
        />
      ) : (
        <div className="flex items-center justify-center h-20 bg-surface-container">
          <FileText size={22} className="text-on-surface-variant/30" />
        </div>
      )}
      <div className="p-2 pt-1.5">
        <p className="text-[10px] font-medium text-on-surface truncate leading-tight">{att.file.name}</p>
        <p className={`text-[9px] font-mono mt-0.5 ${statusColor[att.status]}`}>
          {att.status === 'ready' || att.status === 'uploading' || att.status === 'error'
            ? statusLabel[att.status]
            : statusLabel[att.status]}
        </p>
      </div>
    </div>
  );
}

// ── Message actions bar ────────────────────────────────────────────────────

function MessageActions({
  msgId, content, isLast, onRegenerate,
}: {
  msgId: string;
  content: string;
  isLast: boolean;
  onRegenerate: () => void;
}) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const storageKey = `draxie-fb-${msgId}`;
  const [vote, setVote] = useState<'up' | 'down' | null>(
    () => localStorage.getItem(storageKey) as 'up' | 'down' | null
  );

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleVote = (v: 'up' | 'down') => {
    const next = vote === v ? null : v;
    setVote(next);
    if (next) localStorage.setItem(storageKey, next);
    else localStorage.removeItem(storageKey);
  };

  return (
    <div className="flex items-center gap-0.5 mt-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
      <button
        onClick={copy}
        title={t.copyBtn}
        className={`p-1.5 rounded-lg transition-all ${copied ? 'text-emerald-400' : 'text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-highest'}`}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <button
        onClick={() => toggleVote('up')}
        title={t.helpfulBtn}
        className={`p-1.5 rounded-lg transition-all ${vote === 'up' ? 'text-emerald-400' : 'text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-highest'}`}
      >
        <ThumbsUp size={13} fill={vote === 'up' ? 'currentColor' : 'none'} />
      </button>
      <button
        onClick={() => toggleVote('down')}
        title={t.notHelpfulBtn}
        className={`p-1.5 rounded-lg transition-all ${vote === 'down' ? 'text-red-400' : 'text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-highest'}`}
      >
        <ThumbsDown size={13} fill={vote === 'down' ? 'currentColor' : 'none'} />
      </button>
      {isLast && (
        <button
          onClick={onRegenerate}
          title={t.regenerateBtn}
          className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-highest transition-all"
        >
          <RotateCcw size={13} />
        </button>
      )}
    </div>
  );
}

// ── Conversation history helpers ───────────────────────────────────────────

type ConvMeta = { createdAt: number; title?: string };

function loadConvMeta(): Record<string, ConvMeta> {
  try { return JSON.parse(localStorage.getItem('draxie-conv-meta') ?? '{}'); } catch { return {}; }
}

const MS_DAY = 86_400_000;

function groupConversations(convs: Conversation[], meta: Record<string, ConvMeta>, t: T) {
  const now = Date.now();
  const buckets: [string, Conversation[]][] = [
    [t.today, []], [t.yesterday, []], [t.last7days, []], [t.older, []],
  ];
  for (const c of convs) {
    const ts = meta[c.id]?.createdAt ?? 0;
    const age = now - ts;
    if (ts && age < MS_DAY)        buckets[0][1].push(c);
    else if (ts && age < 2*MS_DAY) buckets[1][1].push(c);
    else if (ts && age < 7*MS_DAY) buckets[2][1].push(c);
    else                           buckets[3][1].push(c);
  }
  return buckets.filter(([, list]) => list.length > 0);
}

// ── Upload modal ───────────────────────────────────────────────────────────

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess?: (filename: string) => void }) {
  const { t } = useLang();
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setStatus(t.uploadingFile(file.name));
    setIsError(false);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/documents', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) { setStatus(t.uploadFailed(data.error)); setIsError(true); }
      else {
        setStatus(t.processingFile(file.name));
        onSuccess?.(file.name);
        setTimeout(onClose, 2000);
      }
    } catch { setStatus(t.connErrorShort); setIsError(true); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container-high border border-outline-variant rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider">{t.uploadTitle}</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div
          className="border-2 border-dashed border-outline-variant rounded-xl p-8 text-center cursor-pointer hover:border-primary-container/50 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        >
          <Upload size={24} className="mx-auto mb-2 text-on-surface-variant" />
          <p className="text-sm text-on-surface-variant">{t.dropFileHere}</p>
          <p className="text-[10px] text-on-surface-variant/50 mt-1 font-mono">PDF · DOCX · PPTX · XLSX · TXT</p>
        </div>
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        {status && <p className={`mt-3 text-xs font-mono ${isError ? 'text-red-400' : 'text-emerald-400'}`}>{status}</p>}
      </div>
    </div>
  );
}

// ── Meta-question router ──────────────────────────────────────────────────────
// Intercepts identity/capability questions client-side — no RAG call needed.

const _META_DE = [
  /wer bist du/i,
  /was (bist|machst|kannst) du/i,
  /was ist drä?xie/i,
  /stell dich vor/i,
  /über dich/i,
  /erkl.{0,5}r.*drä?xie/i,
  /wie funktionierst du/i,
];

const _META_EN = [
  /who are you/i,
  /what (are|do|can) you/i,
  /what is drä?xie/i,
  /introduce yourself/i,
  /about (you|yourself)/i,
  /tell me about (you|yourself)/i,
  /how do you work/i,
];

const META_RESPONSE_DE = `## Hallo, ich bin DRÄXIE!

Ich bin der interne KI-Assistent von **DRÄXLMAIER**, entwickelt, um Sales-Mitarbeiterinnen und -Mitarbeiter bei der Einarbeitung und im Tagesgeschäft zu unterstützen.

**Was ich mache**
- Ich durchsuche eine interne Wissensdatenbank aus offiziellen Unternehmensunterlagen — Handbücher, Schulungsmaterial, Prozessdokumente und mehr
- Ich beantworte Fragen zu Produkten, Prozessen, Abkürzungen und Projekten
- Jede Antwort enthält Quellenverweise, damit du nachprüfen kannst, woher die Information stammt

**Was ich nicht tue**
- Ich greife nicht auf externe Quellen oder das Internet zu
- Ich antworte ausschließlich auf Basis der lokal bereitgestellten Dokumente — keine Vermutungen, keine externen Daten

Stell mir einfach eine konkrete Frage, und ich zeige dir, was ich weiß!`;

const META_RESPONSE_EN = `## Hello, I'm DRÄXIE!

I'm the internal AI assistant for **DRÄXLMAIER**, built to support sales staff during onboarding and in their day-to-day work.

**What I do**
- Search an internal knowledge base built from official company documents — manuals, training materials, process guides, and more
- Answer questions about products, processes, abbreviations, and projects
- Include source references in every answer so you can verify where information comes from

**What I don't do**
- I don't access external sources or the internet
- I only answer based on the locally provided documents — no guesswork, no external data

Just ask me a specific question and I'll show you what I know!`;

function pickRandom<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function matchMetaQuestion(text: string): string | null {
  if (_META_DE.some(p => p.test(text))) return META_RESPONSE_DE;
  if (_META_EN.some(p => p.test(text))) return META_RESPONSE_EN;
  return null;
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [lang, setLangState] = useState<Lang>(() =>
    (localStorage.getItem('draxie-lang') as Lang) ?? 'de'
  );
  const t = translations[lang];
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('draxie-lang', l);
    setShownQuestions(pickRandom(translations[l].questionPool, 4));
  };

  const [messages, setMessages] = useState<RagMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [convId, setConvId] = useState<string>(() => crypto.randomUUID());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convSearch, setConvSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sources'>('sources');
  const [panelMsgId, setPanelMsgId] = useState<string | null>(null);
  const [panelTargetChunk, setPanelTargetChunk] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('draexie-onboarding-shown'));
  const [theme, setTheme] = useState<'dark'|'light'>(() =>
    (localStorage.getItem('draexie-theme') as 'dark'|'light') ?? 'dark'
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('draexie-theme', theme);
  }, [theme]);

  const [showSysPrompt, setShowSysPrompt] = useState(false);
  const [sysPrompt, setSysPrompt] = useState(() => localStorage.getItem('draxie-sysprompt') ?? '');
  const [isDragOver, setIsDragOver] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [convMeta, setConvMeta] = useState<Record<string, ConvMeta>>(loadConvMeta);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showScrollPill, setShowScrollPill] = useState(false);
  const [leftCollapsed,  setLeftCollapsed]  = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [shownQuestions, setShownQuestions] = useState<string[]>(() => pickRandom(translations[lang].questionPool, 4));
  const [scrollToMsgIdx, setScrollToMsgIdx] = useState<number | null>(null);

  // ── In-chat search state ───────────────────────────────────────────────────
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [inChatDebouncedQuery, setInChatDebouncedQuery] = useState('');
  const [inChatMatchMsgIdx, setInChatMatchMsgIdx] = useState(0);
  const inChatInputRef = useRef<HTMLInputElement>(null);
  const msgIdxRefs = useRef<Map<number, HTMLElement>>(new Map());

  const chatEndRef     = useRef<HTMLDivElement>(null);
  const chatAreaRef    = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const msgRefs        = useRef<Map<string, HTMLElement>>(new Map());
  const streamStart    = useRef(0);
  const tokenCount     = useRef(0);
  const streamingMsgId = useRef('');
  const abortRef       = useRef<AbortController | null>(null);
  const autoScrollRef  = useRef(true);

  // ── In-chat search: debounce ───────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setInChatDebouncedQuery(inChatSearchQuery), 150);
    return () => clearTimeout(timer);
  }, [inChatSearchQuery]);

  const setMascot = useCallback((state: string) => {
    window.mascot?.setState(state);
  }, []);

  // ── In-chat search: computed matching indices ──────────────────────────────
  const inChatMatchingMsgIds = useMemo(() => {
    if (inChatDebouncedQuery.length < 2) return [];
    const q = normalizeForSearch(inChatDebouncedQuery);
    return messages
      .map((m, i) => ({ i, m }))
      .filter(({ m }) =>
        normalizeForSearch(m.content).includes(q) ||
        (m.sources ?? []).some(s => normalizeForSearch(s).includes(q))
      )
      .map(({ i }) => i);
  }, [messages, inChatDebouncedQuery]);

  const inChatMatchSet = useMemo(() => new Set(inChatMatchingMsgIds), [inChatMatchingMsgIds]);

  // ── In-chat search: navigation ─────────────────────────────────────────────
  const goToInChatMatch = useCallback((idx: number) => {
    if (!inChatMatchingMsgIds.length) return;
    const c = ((idx % inChatMatchingMsgIds.length) + inChatMatchingMsgIds.length) % inChatMatchingMsgIds.length;
    setInChatMatchMsgIdx(c);
    const el = msgIdxRefs.current.get(inChatMatchingMsgIds[c]);
    if (el) { autoScrollRef.current = false; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, [inChatMatchingMsgIds]);

  const closeInChatSearch = useCallback(() => {
    setInChatSearchOpen(false);
    setInChatSearchQuery('');
    setInChatDebouncedQuery('');
    setInChatMatchMsgIdx(0);
  }, []);

  // ── In-chat search: auto-navigate when debounced query changes ─────────────
  useEffect(() => {
    if (!inChatSearchOpen || inChatMatchingMsgIds.length === 0) return;
    setInChatMatchMsgIdx(0);
    const el = msgIdxRefs.current.get(inChatMatchingMsgIds[0]);
    if (el) { autoScrollRef.current = false; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inChatDebouncedQuery]); // only fire when debounced query changes

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

  // ── Scroll-to-message (triggered after search result click) ───────────────
  useEffect(() => {
    if (scrollToMsgIdx === null || messages.length === 0) return;
    const msgId = String(scrollToMsgIdx);
    const el = msgRefs.current.get(msgId);
    if (!el) return;
    setScrollToMsgIdx(null);
    setTimeout(() => {
      autoScrollRef.current = false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-msg');
      setTimeout(() => el.classList.remove('highlight-msg'), 1600);
    }, 150);
  }, [messages, scrollToMsgIdx]);

  // ── Conversation list ──────────────────────────────────────────────────────
  const loadConvList = useCallback(async () => {
    try {
      const res = await fetch('/conversations');
      if (!res.ok) return;
      const data: Conversation[] = await res.json();
      if (!Array.isArray(data)) return;
      setConversations(data);
      // Seed localStorage timestamps for any conversations we haven't seen before
      setConvMeta(prev => {
        const next = { ...prev };
        let changed = false;
        data.forEach((c, i) => {
          if (!next[c.id]?.createdAt) {
            // Approximate recency: most recent first, spaced 1 min apart
            next[c.id] = { ...next[c.id], createdAt: Date.now() - i * 60_000 };
            changed = true;
          }
        });
        if (changed) localStorage.setItem('draxie-conv-meta', JSON.stringify(next));
        return changed ? next : prev;
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadConvList(); }, [loadConvList]);

  // ── Conv meta helpers ──────────────────────────────────────────────────────
  const saveConvMeta = useCallback((id: string, patch: Partial<ConvMeta>) => {
    setConvMeta(prev => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      localStorage.setItem('draxie-conv-meta', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScrollRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleChatScroll = useCallback(() => {
    const el = chatAreaRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    autoScrollRef.current = nearBottom;
    setShowScrollPill(!nearBottom);
  }, []);

  const scrollToBottom = () => {
    autoScrollRef.current = true;
    setShowScrollPill(false);
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Derived panel data ─────────────────────────────────────────────────────
  const panelMsg    = messages.find(m => m.id === panelMsgId);
  const panelSources = panelMsg?.sources ?? [];
  const panelChunks  = panelMsg?.chunks  ?? [];

  // ── Load conversation ──────────────────────────────────────────────────────
  const loadConversation = async (id: string, scrollToIndex?: number, searchQuery?: string) => {
    setConvId(id);
    setSidebarOpen(false);
    setPanelMsgId(null);
    if (scrollToIndex !== undefined) {
      setScrollToMsgIdx(scrollToIndex);
      autoScrollRef.current = false; // prevent scroll-to-bottom fighting the jump
    }
    if (searchQuery !== undefined && searchQuery.length >= 2) {
      setInChatSearchQuery(searchQuery);
      setInChatDebouncedQuery(searchQuery); // skip debounce delay
      setInChatSearchOpen(true);
      setInChatMatchMsgIdx(0);
    }
    try {
      const data: { messages: { role: string; content: string; sources?: string[]; chunks?: Chunk[] }[] } =
        await (await fetch(`/conversations/${id}`)).json();
      const mapped: RagMessage[] = data.messages.map((m, i) => ({
        id: String(i),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        sources: m.sources,
        chunks: m.chunks,
      }));
      setMessages(mapped);
      const lastWithSources = [...mapped].reverse().find(m => m.role === 'assistant' && m.sources?.length);
      if (lastWithSources && scrollToIndex === undefined) { setPanelMsgId(lastWithSources.id); setActiveTab('sources'); }
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
    loadConvList();
    setShownQuestions(pickRandom(t.questionPool, 4));
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Stop generation ────────────────────────────────────────────────────────
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setMascot('idle');
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
  }, [setMascot]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setInChatSearchOpen(true);
        setTimeout(() => inChatInputRef.current?.focus(), 50);
        return;
      }
      if (e.key === 'Escape') {
        if (inChatSearchOpen) { closeInChatSearch(); return; }
        if (isStreaming) stopGeneration();
        else if (openMenuId) setOpenMenuId(null);
        else setShowSysPrompt(false);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowSysPrompt(v => !v);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        newConversation();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, stopGeneration, openMenuId, inChatSearchOpen, closeInChatSearch]);

  // ── Onboarding tooltip auto-dismiss ───────────────────────────────────────
  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem('draexie-onboarding-shown', '1');
  }, []);
  useEffect(() => {
    if (!showOnboarding) return;
    const timer = setTimeout(dismissOnboarding, 6000);
    document.addEventListener('click', dismissOnboarding, { once: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', dismissOnboarding);
    };
  }, [showOnboarding, dismissOnboarding]);

  // ── File attachment — creates preview card and uploads in background ──────
  const createFileAttachment = useCallback(async (file: File) => {
    const id = crypto.randomUUID();
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setAttachments(prev => [...prev, { id, kind: 'file', file, previewUrl, status: 'uploading' }]);

    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/documents', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) {
        setAttachments(prev => prev.map(a => a.id === id ? { ...a, kind: 'file' as const, status: 'error' as const } : a) as Attachment[]);
        return;
      }
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, kind: 'file' as const, status: 'processing' as const } : a) as Attachment[]);
      // Poll until this file appears as 'ok' in /documents/status
      const poll = setInterval(async () => {
        try {
          const rows: { filename: string; status: string }[] = await (await fetch('/documents/status')).json();
          if (rows.some(r => r.filename === file.name && r.status === 'ok')) {
            clearInterval(poll);
            setAttachments(prev => prev.map(a => a.id === id ? { ...a, kind: 'file' as const, status: 'ready' as const } : a) as Attachment[]);
            pollHealth();
          }
        } catch { clearInterval(poll); }
      }, 3000);
      setTimeout(() => clearInterval(poll), 120_000);
    } catch {
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, kind: 'file' as const, status: 'error' as const } : a) as Attachment[]);
    }
  }, [pollHealth]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async (question?: string) => {
    const rawQ = question ?? input.trim();
    // Prepend any pasted-text attachments
    const pasteTexts = attachments.filter(a => a.kind === 'paste').map(a => (a as { text: string }).text);
    const q = pasteTexts.length
      ? `[Eingefügter Kontext]\n${pasteTexts.join('\n---\n')}\n\n${rawQ}`
      : rawQ;
    if (!q.trim() || isStreaming) return;

    setInput('');
    setAttachments([]);
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }
    // Record conversation start time on first message
    if (!convMeta[convId]?.createdAt) saveConvMeta(convId, { createdAt: Date.now() });
    autoScrollRef.current = true;
    setShowScrollPill(false);
    setIsStreaming(true);
    setMascot('searching');
    streamStart.current = Date.now();
    tokenCount.current = 0;

    const userMsg: RagMessage = { id: crypto.randomUUID(), role: 'user', content: q };
    const aiMsg: RagMessage   = { id: crypto.randomUUID(), role: 'assistant', content: '', isStreaming: true };
    streamingMsgId.current = aiMsg.id;

    setMessages(prev => [...prev.filter(m => m.id !== '__welcome__'), userMsg, aiMsg]);

    // Reload sidebar so new conversation appears immediately
    const isFirstMsg = messages.filter(m => m.id !== '__welcome__').length === 0;
    if (isFirstMsg) setTimeout(() => loadConvList(), 500);

    // ── Meta-question short-circuit ──────────────────────────────────────────
    const metaHit = matchMetaQuestion(rawQ);
    if (metaHit) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsg.id ? { ...m, isStreaming: false, content: metaHit } : m
      ));
      setPanelMsgId(aiMsg.id);
      setIsStreaming(false);
      setMascot('found');
      setTimeout(() => setMascot('idle'), 3000);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const effectiveQuestion = sysPrompt.trim()
        ? `[Systemkontext]\n${sysPrompt.trim()}\n\n${q}`
        : q;
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: effectiveQuestion, conversation_id: convId }),
        signal: ctrl.signal,
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
            // Auto-generate title after the first AI response in a new conversation
            const currentMessages = messages;
            const isFirstResponse = currentMessages.filter(m => m.role === 'assistant').length <= 1;
            if (isFirstResponse && !convMeta[convId]?.title) {
              fetch(`/conversations/${convId}/title`, { method: 'POST' })
                .then(r => r.json())
                .then(({ title }) => { saveConvMeta(convId, { title }); loadConvList(); })
                .catch(() => {});
            }
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // user stopped — partial message already shown, just clean up
      } else {
        setMascot('error');
        setMessages(prev => prev.map(m =>
          m.isStreaming ? { ...m, isStreaming: false, content: t.connError } : m
        ));
        setTimeout(() => setMascot('idle'), 4000);
      }
    }

    abortRef.current = null;
    setIsStreaming(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── Cross-chat search results ──────────────────────────────────────────────
  type SearchResult = { id: string; title: string; excerpt: string; match_start: number; match_len: number; msg_index?: number; created_at?: string };
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchPending, setSearchPending] = useState(false);

  useEffect(() => {
    if (!convSearch.trim()) { setSearchResults(null); return; }
    setSearchPending(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/conversations/search?q=${encodeURIComponent(convSearch)}`);
        setSearchResults(await res.json());
      } catch { setSearchResults([]); }
      finally { setSearchPending(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [convSearch]);

  const filteredConvs = conversations.filter(c =>
    c.title.toLowerCase().includes(convSearch.toLowerCase())
  );

  const messageCount = messages.filter(m => m.id !== '__welcome__').length;

  // last user message — used by Regenerate
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  // id of the last non-streaming assistant message
  const lastAiMsgId = [...messages].reverse().find(m => m.role === 'assistant' && !m.isStreaming)?.id ?? null;

  const placeholder = usePlaceholder(t);
  const charCount = input.length;
  const CHAR_LIMIT = 4000;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <LangContext.Provider value={{ lang, t, setLang }}>
    <div className="relative flex h-[100dvh] bg-surface-container-low text-on-surface overflow-hidden">

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
      <motion.aside
        initial={false}
        animate={{ width: leftCollapsed ? 56 : 256 }}
        transition={{ type: 'tween', duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className={`fixed md:relative inset-y-0 left-0 z-50 bg-surface-container border-r border-outline-variant flex flex-col transition-transform duration-300 overflow-hidden shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >

        {/* ── Collapsed icon rail ──────────────────────────────────────────────── */}
        {leftCollapsed && (
          <div className="hidden md:flex flex-col items-center gap-1 py-3 h-full w-14">
            {/* Expand */}
            <button
              onClick={() => setLeftCollapsed(false)}
              title={t.openSidebar}
              className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all"
            >
              <PanelLeft size={16} />
            </button>

            <div className="w-6 border-t border-outline-variant/40 my-1" />

            {/* New chat */}
            <button
              onClick={newConversation}
              title={t.newChat}
              className="p-2 rounded-lg text-on-surface-variant hover:text-primary-container hover:bg-surface-container-highest transition-all"
            >
              <Plus size={16} />
            </button>

            {/* History — expands sidebar */}
            <button
              onClick={() => setLeftCollapsed(false)}
              title={t.searchChats}
              className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all"
            >
              <MessageSquare size={16} />
            </button>

            {/* Upload */}
            <button
              onClick={() => setUploadOpen(true)}
              title="Upload"
              className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all"
            >
              <Upload size={16} />
            </button>

            <div className="flex-1" />

            {/* Lang */}
            <button
              onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
              title={lang === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
              className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all"
            >
              <Languages size={14} />
            </button>

            {/* Theme */}
            <button
              onClick={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
              className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        )}

        {/* ── Full expanded sidebar ────────────────────────────────────────────── */}
        {!leftCollapsed && <>

        {/* Brand */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant shrink-0">
          <h1 className="text-base font-bold tracking-tight">DRÄXIE</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors"
              title={lang === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
            >
              <Languages size={11} />
              {lang === 'de' ? 'EN' : 'DE'}
            </button>
            {/* Desktop collapse button */}
            <button
              onClick={() => setLeftCollapsed(true)}
              className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all"
              title={t.closeSidebar}
            >
              <PanelLeft size={14} />
            </button>
            <button className="md:hidden text-on-surface-variant" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* New chat */}
        <div className="p-3 shrink-0">
          <button
            onClick={newConversation}
            className="flex items-center gap-2 w-full px-3 py-2 bg-primary-container text-white rounded-xl text-sm font-semibold hover:brightness-110 active:scale-95 transition-all"
          >
            <Plus size={16} /> {t.newChat}
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2 shrink-0">
          <input
            value={convSearch}
            onChange={e => setConvSearch(e.target.value)}
            placeholder={t.searchChats}
            className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-container/50"
          />
        </div>

        {/* Conversation list — grouped by date, or search results */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 min-h-0"
          onClick={() => setOpenMenuId(null)}
        >
          {/* Search results view */}
          {convSearch.trim() && (
            searchPending ? (
              <p className="text-[11px] text-on-surface-variant/50 text-center mt-4 font-mono">…</p>
            ) : searchResults && searchResults.length === 0 ? (
              <p className="text-[11px] text-on-surface-variant/50 text-center mt-4 font-mono">{t.noChats}</p>
            ) : searchResults ? (
              <div className="space-y-0.5 pt-1">
                {searchResults.map(r => {
                  const before = r.excerpt.slice(0, r.match_start);
                  const match  = r.excerpt.slice(r.match_start, r.match_start + r.match_len);
                  const after  = r.excerpt.slice(r.match_start + r.match_len);
                  // prefer DB created_at, fall back to JS-tracked timestamp
                  const rawDate = r.created_at ?? (convMeta[r.id]?.createdAt ? new Date(convMeta[r.id].createdAt).toISOString() : null);
                  const dateStr = rawDate
                    ? new Date(rawDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
                    : null;
                  return (
                    <div
                      key={r.id}
                      className={`px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                        r.id === convId
                          ? 'bg-primary-container/10 border border-primary-container/20 text-on-surface'
                          : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                      }`}
                      onClick={() => { const q = convSearch; setConvSearch(''); loadConversation(r.id, r.msg_index, q); }}
                    >
                      <div className="flex items-baseline justify-between gap-1 min-w-0">
                        <p className="text-[12px] font-medium truncate flex-1 min-w-0">{r.title}</p>
                        {dateStr && <span className="text-[9px] font-mono text-on-surface-variant/40 shrink-0">{dateStr}</span>}
                      </div>
                      <p className="text-[10px] text-on-surface-variant/60 mt-0.5 line-clamp-2 leading-relaxed">
                        {before}<mark className="bg-primary-container/25 text-on-surface rounded px-0.5">{match}</mark>{after}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null
          )}

          {/* Normal grouped list (hidden while search is active) */}
          {!convSearch.trim() && (
          filteredConvs.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant/50 text-center mt-4 font-mono">{t.noChats}</p>
          ) : (
            groupConversations(filteredConvs, convMeta, t).map(([label, group]) => (
              <div key={label}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 px-2 pt-3 pb-1 font-mono">{label}</p>
                {group.map(c => {
                  const displayTitle = convMeta[c.id]?.title ?? c.title;
                  const isActive = c.id === convId;
                  const menuOpen = openMenuId === c.id;
                  const renaming = renamingId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`group/item relative flex items-center px-2 py-1.5 rounded-lg cursor-pointer mb-0.5 transition-colors ${
                        isActive
                          ? 'bg-primary-container/10 border border-primary-container/20 text-on-surface'
                          : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                      }`}
                      onClick={() => { if (!renaming) loadConversation(c.id); }}
                    >
                      {renaming ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              saveConvMeta(c.id, { title: renameValue.trim() || displayTitle });
                              setRenamingId(null);
                            }
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          onBlur={() => {
                            saveConvMeta(c.id, { title: renameValue.trim() || displayTitle });
                            setRenamingId(null);
                          }}
                          className="flex-1 min-w-0 bg-surface-container-highest border border-primary-container/40 rounded px-1.5 py-0.5 text-[12px] text-on-surface focus:outline-none"
                        />
                      ) : (
                        <p
                          className="text-[12px] font-medium truncate flex-1 min-w-0"
                          onDoubleClick={e => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(displayTitle); }}
                        >{displayTitle}</p>
                      )}

                      {/* … menu button */}
                      <div className="relative ml-1 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : c.id); }}
                          className={`p-1 rounded transition-all text-on-surface-variant/40 hover:text-on-surface-variant ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'}`}
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {menuOpen && (
                          <div
                            className="absolute right-0 top-full mt-1 w-36 bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden py-1"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={() => { setRenameValue(displayTitle); setRenamingId(c.id); setOpenMenuId(null); }}
                              className="w-full text-left px-3 py-2 text-[12px] text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                            >
                              {t.rename}
                            </button>
                            <button
                              onClick={() => { deleteConversation(c.id); setOpenMenuId(null); }}
                              className="w-full text-left px-3 py-2 text-[12px] text-red-400 hover:bg-surface-container transition-colors"
                            >
                              {t.delete}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          ))}
        </div>

        {/* ── Sidebar footer ───────────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-outline-variant shrink-0">
          {health?.last_ingestion && (
            <div className="space-y-0.5 mb-2">
              <p className="text-[9px] uppercase tracking-wider text-on-surface-variant/40 font-mono">{t.lastImported}</p>
              <p className="text-[11px] text-on-surface truncate">{health.last_ingestion.filename}</p>
            </div>
          )}
          {messageCount > 0 && (
            <p className="text-[11px] text-on-surface-variant">{t.messages(messageCount)}</p>
          )}
          {messageCount > 0 && (
            <p className="text-[9px] font-mono text-on-surface-variant/40 mt-0.5">
              Gesprächskontext: {messageCount} Nachrichten
            </p>
          )}
          {/* Light/dark toggle */}
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-highest transition-all"
              title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>

        </>}

      </motion.aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main
        className="flex-1 flex flex-col relative overflow-hidden min-w-0"
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
        onDrop={e => {
          e.preventDefault();
          setIsDragOver(false);
          Array.from(e.dataTransfer.files).forEach(f => createFileAttachment(f));
        }}
      >
        {/* Drag-drop overlay */}
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface-container-low/90 backdrop-blur-sm border-2 border-dashed border-primary-container/50 rounded-none pointer-events-none"
            >
              <Paperclip size={32} className="text-primary-container mb-3" />
              <p className="text-sm font-semibold text-primary-container">{t.attachFile}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">PDF · DOCX · TXT · PNG · JPG</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimal top bar (mobile nav only) */}
        <div className="h-8 bg-surface-container-high/60 border-b border-outline-variant px-4 flex items-center gap-3 shrink-0 z-20">
          <button className="md:hidden text-on-surface-variant" onClick={() => setSidebarOpen(true)}>
            <Menu size={16} />
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => { setInChatSearchOpen(v => !v); if (!inChatSearchOpen) setTimeout(() => inChatInputRef.current?.focus(), 50); }}
              className={`ml-auto p-1.5 rounded-lg transition-all ${inChatSearchOpen ? 'text-primary-container bg-primary-container/10' : 'text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container-highest'}`}
              title="In Chat suchen (Ctrl+F)"
            >
              <Search size={14} />
            </button>
          )}
        </div>

        {/* In-chat search bar */}
        {inChatSearchOpen && (
          <InChatSearchBar
            query={inChatSearchQuery}
            onQueryChange={setInChatSearchQuery}
            matchIdx={inChatMatchMsgIdx}
            matchCount={inChatMatchingMsgIds.length}
            onNext={() => goToInChatMatch(inChatMatchMsgIdx + 1)}
            onPrev={() => goToInChatMatch(inChatMatchMsgIdx - 1)}
            onClose={closeInChatSearch}
            inputRef={inChatInputRef}
          />
        )}

        {/* Chat area */}
        <div
          ref={chatAreaRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 relative"
        >
          <div className="max-w-3xl mx-auto space-y-8 pb-56">

            {/* Welcome */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="text-center pt-12"
              >
                <h2 className="text-2xl font-bold mb-2">{t.welcomeTitle}</h2>
                <p className="text-sm text-on-surface-variant mb-8">{t.welcomeSubtitle}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left">
                  {shownQuestions.map(q => (
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
              {messages.map((msg, msgArrayIdx) => {
                const isMatch = inChatMatchSet.has(msgArrayIdx);
                const isDimmed = inChatDebouncedQuery.length >= 2 && !isMatch;
                const isActiveMatch = isMatch && inChatMatchingMsgIds[inChatMatchMsgIdx] === msgArrayIdx;
                return (
                <motion.div
                  key={msg.id}
                  ref={el => {
                    if (el) {
                      msgRefs.current.set(msg.id, el as HTMLElement);
                      msgIdxRefs.current.set(msgArrayIdx, el as HTMLElement);
                    } else {
                      msgRefs.current.delete(msg.id);
                      msgIdxRefs.current.delete(msgArrayIdx);
                    }
                  }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}${isDimmed ? ' message-dimmed' : ''}${isActiveMatch ? ' message-active-match' : isMatch ? ' message-matched' : ''}`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[78%] bg-primary-container text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-lg">
                      {msg.content}
                    </div>
                  ) : (
                    (() => {
                      const isNoAnswer = msg.content.includes('Dazu habe ich in den verfügbaren Unterlagen leider nichts gefunden');
                      return (
                        <div className="w-full space-y-1 group">
                          {/* Header label */}
                          <div className="mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">DRÄXIE</span>
                          </div>

                          {/* Content — amber border for no-answer; cite-badge clicks handled via delegation */}
                          <div
                            className={isNoAnswer ? 'border-l-2 border-amber-500/50 pl-3' : ''}
                            onClick={e => {
                              const el = (e.target as Element).closest('[data-cite]');
                              if (el) {
                                const n = Number(el.getAttribute('data-cite'));
                                setPanelMsgId(msg.id);
                                setActiveTab('sources');
                                setPanelTargetChunk(n);
                              }
                            }}
                          >
                            <MarkdownContent text={msg.content} streaming={msg.isStreaming} searchHighlight={inChatDebouncedQuery.length >= 2 ? inChatDebouncedQuery : undefined} isActiveMatch={isActiveMatch} />
                          </div>

                          {/* No-answer upload hint */}
                          {isNoAnswer && !msg.isStreaming && (
                            <p className="text-[10px] text-on-surface-variant/50 mt-1 pl-0.5">
                              Dokument noch nicht importiert?{' '}
                              <button
                                onClick={() => setUploadOpen(true)}
                                className="text-amber-400/80 underline underline-offset-2 hover:text-amber-400 transition-colors"
                              >
                                Dokument hinzufügen ↗
                              </button>
                            </p>
                          )}

                          {/* Sources button → opens Knowledge Panel (hidden for no-answer) */}
                          {!msg.isStreaming && !isNoAnswer && msg.sources && msg.sources.length > 0 && (
                            <button
                              onClick={() => { setPanelMsgId(msg.id); setActiveTab('sources'); }}
                              className={`mt-2 flex items-center gap-1.5 text-[10px] font-mono transition-colors px-2 py-1 rounded-lg border ${
                                panelMsgId === msg.id
                                  ? 'text-primary-container border-primary-container/30 bg-primary-container/5'
                                  : 'text-on-surface-variant border-outline-variant hover:text-primary-container hover:border-primary-container/30'
                              }`}
                            >
                              <FileText size={10} />
                              <span>{t.sources(msg.sources.length)}</span>
                            </button>
                          )}

                          {/* Suggestions */}
                          {!msg.isStreaming && msg.suggestions && msg.suggestions.length > 0 && (
                            <SuggestionChips suggestions={msg.suggestions} onSelect={q => sendMessage(q)} />
                          )}

                          {/* Action bar: copy, thumbs, regenerate */}
                          {!msg.isStreaming && msg.content && (
                            <MessageActions
                              msgId={msg.id}
                              content={msg.content}
                              isLast={msg.id === lastAiMsgId}
                              onRegenerate={() => lastUserMsg && sendMessage(lastUserMsg.content)}
                            />
                          )}
                        </div>
                      );
                    })()
                  )}
                </motion.div>
                );
              })}
            </AnimatePresence>

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Mascot — bottom-right corner, above the input bar, never over text */}
        <div className="absolute bottom-40 right-3 z-30 pointer-events-none">
          <Mascot />
        </div>

        {/* ── Input area ──────────────────────────────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
          <div className="px-4 pb-4 pointer-events-auto">
            <div className="max-w-3xl mx-auto space-y-2">

              {/* Attachment preview cards */}
              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                    className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar"
                  >
                    {attachments.map(att => (
                      <AttachmentCard
                        key={att.id}
                        att={att}
                        onRemove={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input pill */}
              <div className="relative bg-surface-container/90 backdrop-blur-xl border border-outline-variant rounded-2xl shadow-2xl transition-all focus-within:ring-2 focus-within:ring-primary-container/30">

                <div className="flex items-end gap-2 p-1.5">
                  {/* Paperclip + onboarding tooltip */}
                  <div className="relative shrink-0">
                    {showOnboarding && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-56 bg-surface-container-highest border border-outline-variant rounded-xl px-3 py-2.5 shadow-xl z-50 pointer-events-none">
                        <p className="text-[10px] text-on-surface leading-relaxed">
                          Eigene Dokumente hinzufügen — klicke hier oder ziehe Dateien ins Chatfenster
                        </p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-outline-variant" />
                      </div>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-on-surface-variant hover:text-primary-container hover:bg-surface-container-highest rounded-xl transition-all"
                      title={t.attachFile}
                    >
                      <Paperclip size={17} />
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.png,.jpg,.jpeg,.webp"
                    onChange={e => { Array.from(e.target.files ?? []).forEach(f => createFileAttachment(f)); e.target.value = ''; }}
                  />

                  {/* Textarea */}
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={input}
                      placeholder={placeholder.text}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm p-2 resize-none leading-relaxed transition-opacity duration-400"
                      style={{
                        maxHeight: 140,
                        overflowY: 'auto',
                        placeholderColor: 'var(--color-on-surface-variant)',
                        opacity: input.length > 0 ? 1 : (placeholder.visible ? 1 : 0.3),
                      } as React.CSSProperties}
                      onChange={e => {
                        setInput(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                      }}
                      onPaste={e => {
                        const text = e.clipboardData.getData('text');
                        if (text.length > 200) {
                          e.preventDefault();
                          setAttachments(prev => [...prev, { id: crypto.randomUUID(), kind: 'paste', text }]);
                        }
                      }}
                    />
                    {/* Character counter */}
                    {charCount > 3500 && (
                      <span className={`absolute bottom-1 right-2 text-[10px] font-mono pointer-events-none ${
                        charCount >= CHAR_LIMIT ? 'text-red-400' : charCount >= 3800 ? 'text-amber-400' : 'text-on-surface-variant/40'
                      }`}>
                        {charCount.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Send / Stop */}
                  {isStreaming ? (
                    <button
                      onClick={stopGeneration}
                      className="p-2.5 bg-surface-container-highest border border-outline-variant text-on-surface-variant rounded-xl hover:text-on-surface hover:border-on-surface-variant/40 active:scale-95 transition-all shrink-0"
                      title={t.stopGenerating}
                    >
                      <Square size={14} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || charCount > CHAR_LIMIT}
                      className="p-2.5 bg-primary-container text-white rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                      <ArrowUp size={16} />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-center text-on-surface-variant/40 select-none">
                {t.disclaimer}
              </p>

              <p className="text-[10px] text-center text-on-surface-variant/40 font-mono">
                {t.inputHints}
              </p>
            </div>
          </div>
        </div>

        {/* ↓ Scroll-to-bottom pill */}
        <AnimatePresence>
          {showScrollPill && (
            <motion.button
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              onClick={scrollToBottom}
              className="absolute bottom-40 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-highest border border-outline-variant rounded-full text-[11px] font-mono text-on-surface-variant shadow-lg hover:text-on-surface hover:border-primary-container/40 transition-all pointer-events-auto"
            >
              <ChevronDown size={13} />
              {t.newMessage}
            </motion.button>
          )}
        </AnimatePresence>

      </main>

      {/* ── Right panel — Knowledge Panel ───────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: rightCollapsed ? 0 : 288 }}
        transition={{ type: 'tween', duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="hidden xl:flex bg-surface-container border-l border-outline-variant flex-col overflow-hidden"
      >

        {/* Header */}
        <div className="p-4 border-b border-outline-variant flex items-center gap-2 shrink-0">
          <BookOpen size={14} className="text-primary-container" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant flex-1">{t.knowledgePanel}</h2>
          <button
            onClick={() => setRightCollapsed(true)}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all"
            title={t.closePanel}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Tabs — sources only */}
        <div className="flex border-b border-outline-variant shrink-0">
          <button
            className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 text-primary-container border-primary-container"
          >
            {t.sourcesTab}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          <KnowledgeSources sources={panelSources} chunks={panelChunks} targetChunkNum={panelTargetChunk} />
        </div>
      </motion.aside>

      {/* ── Right panel re-open tab ──────────────────────────────────────── */}
      <AnimatePresence>
        {rightCollapsed && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.18 }}
            onClick={() => setRightCollapsed(false)}
            className="absolute right-0 top-[14px] z-40 hidden xl:flex flex-col items-center justify-center w-5 py-3 bg-surface-container border border-r-0 border-outline-variant rounded-l-xl text-on-surface-variant hover:text-primary-container hover:bg-surface-container-high transition-colors shadow-lg"
            title={t.openPanel}
          >
            <ChevronLeft size={12} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Upload modal */}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onSuccess={() => setTimeout(pollHealth, 3000)}
        />
      )}
    </div>
    </LangContext.Provider>
  );
}
