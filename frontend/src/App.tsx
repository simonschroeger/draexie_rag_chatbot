import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Menu, X,
  Trash2, Upload, Copy, Check,
  ChevronDown, FileText, BookOpen,
  Paperclip, ArrowUp, Square, RotateCcw, Settings,
  ThumbsUp, ThumbsDown, MoreHorizontal, ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { RagMessage, Conversation, HealthStatus, ServerEvent, Chunk } from './types';
import Mascot from './components/Mascot';

// ── Rotating placeholder ───────────────────────────────────────────────────

const PLACEHOLDERS = [
  'Ask about Q3 turnover data…',
  'Which customers are at risk this quarter?',
  'Summarize the HR policy on retention…',
  'What are the top products by margin?',
];

function usePlaceholder() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % PLACEHOLDERS.length); setVisible(true); }, 400);
    }, 4000);
    return () => clearInterval(id);
  }, []);
  return { text: PLACEHOLDERS[idx], visible };
}

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
            title="In neuem Tab öffnen"
          >
            <ExternalLink size={12} /> In neuem Tab
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

function KnowledgeSources({ sources, chunks }: { sources: string[]; chunks: Chunk[] }) {
  const [openSrc, setOpenSrc]         = useState<string | null>(null);
  const [expandedChunks, setExpanded] = useState<Set<number>>(new Set());
  const [viewer, setViewer]           = useState<{ src: string; chunks: Chunk[] } | null>(null);
  const [lightbox, setLightbox]       = useState<string | null>(null);

  const toggleChunk = (num: number) =>
    setExpanded(prev => { const s = new Set(prev); s.has(num) ? s.delete(num) : s.add(num); return s; });

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
          const isOpen  = openSrc === src;
          const dominantType: ChunkType = related.some(c => c.image_url) ? 'image'
            : related.some(c => detectType(c) === 'table') ? 'table'
            : related.some(c => detectType(c) === 'code')  ? 'code'
            : 'text';

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
                <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono shrink-0 ${TYPE_BADGE[dominantType].cls}`}>
                  {TYPE_BADGE[dominantType].label}
                </span>
                <span className="text-[9px] text-on-surface-variant/40 font-mono shrink-0">{related.length}</span>
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
                      <div key={c.num} className="px-3 py-2.5 space-y-1.5">
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
                            {isExpanded ? 'Weniger anzeigen' : 'Alles anzeigen'}
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
          Eingefügt
        </span>
        <p className="text-[11px] text-on-surface-variant leading-relaxed line-clamp-3">
          {att.text.slice(0, 120)}{att.text.length > 120 ? '…' : ''}
        </p>
      </div>
    );
  }

  const isImage = att.file.type.startsWith('image/');
  const statusLabel: Record<AttachmentStatus, string> = {
    uploading:  'Wird hochgeladen…',
    processing: 'Wird verarbeitet…',
    ready:      '✓ Bereit',
    error:      'Fehler beim Upload',
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
        title="Kopieren"
        className={`p-1.5 rounded-lg transition-all ${copied ? 'text-emerald-400' : 'text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-highest'}`}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <button
        onClick={() => toggleVote('up')}
        title="Hilfreich"
        className={`p-1.5 rounded-lg transition-all ${vote === 'up' ? 'text-emerald-400' : 'text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-highest'}`}
      >
        <ThumbsUp size={13} fill={vote === 'up' ? 'currentColor' : 'none'} />
      </button>
      <button
        onClick={() => toggleVote('down')}
        title="Nicht hilfreich"
        className={`p-1.5 rounded-lg transition-all ${vote === 'down' ? 'text-red-400' : 'text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-surface-container-highest'}`}
      >
        <ThumbsDown size={13} fill={vote === 'down' ? 'currentColor' : 'none'} />
      </button>
      {isLast && (
        <button
          onClick={onRegenerate}
          title="Neu generieren"
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

function groupConversations(convs: Conversation[], meta: Record<string, ConvMeta>) {
  const now = Date.now();
  const buckets: [string, Conversation[]][] = [
    ['Heute', []], ['Gestern', []], ['Letzte 7 Tage', []], ['Älter', []],
  ];
  for (const c of convs) {
    const ts = meta[c.id]?.createdAt ?? 0;
    const age = now - ts;
    if (ts && age < MS_DAY)       buckets[0][1].push(c);
    else if (ts && age < 2*MS_DAY) buckets[1][1].push(c);
    else if (ts && age < 7*MS_DAY) buckets[2][1].push(c);
    else                            buckets[3][1].push(c);
  }
  return buckets.filter(([, list]) => list.length > 0);
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sources' | 'entities' | 'summary'>('sources');
  const [panelMsgId, setPanelMsgId] = useState<string | null>(null);

  const [showSysPrompt, setShowSysPrompt] = useState(false);
  const [sysPrompt, setSysPrompt] = useState(() => localStorage.getItem('draxie-sysprompt') ?? '');
  const [isDragOver, setIsDragOver] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [convMeta, setConvMeta] = useState<Record<string, ConvMeta>>(loadConvMeta);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showScrollPill, setShowScrollPill] = useState(false);

  const chatEndRef     = useRef<HTMLDivElement>(null);
  const chatAreaRef    = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const streamStart    = useRef(0);
  const tokenCount     = useRef(0);
  const streamingMsgId = useRef('');
  const abortRef       = useRef<AbortController | null>(null);
  const autoScrollRef  = useRef(true);

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
      if (e.key === 'Escape') {
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
  }, [isStreaming, stopGeneration, openMenuId]);

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
        setAttachments(prev => prev.map(a => a.id === id ? { ...a, kind: 'file' as const, status: 'error' as const } : a));
        return;
      }
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, kind: 'file' as const, status: 'processing' as const } : a));
      // Poll until this file appears as 'ok' in /documents/status
      const poll = setInterval(async () => {
        try {
          const rows: { filename: string; status: string }[] = await (await fetch('/documents/status')).json();
          if (rows.some(r => r.filename === file.name && r.status === 'ok')) {
            clearInterval(poll);
            setAttachments(prev => prev.map(a => a.id === id ? { ...a, kind: 'file' as const, status: 'ready' as const } : a));
            pollHealth();
          }
        } catch { clearInterval(poll); }
      }, 3000);
      setTimeout(() => clearInterval(poll), 120_000);
    } catch {
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, kind: 'file' as const, status: 'error' as const } : a));
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
          m.isStreaming ? { ...m, isStreaming: false, content: 'Verbindungsfehler. Bitte versuche es erneut.' } : m
        ));
        setTimeout(() => setMascot('idle'), 4000);
      }
    }

    abortRef.current = null;
    setIsStreaming(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const filteredConvs = conversations.filter(c =>
    c.title.toLowerCase().includes(convSearch.toLowerCase())
  );

  const messageCount = messages.filter(m => m.id !== '__welcome__').length;

  // last user message — used by Regenerate
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  // id of the last non-streaming assistant message
  const lastAiMsgId = [...messages].reverse().find(m => m.role === 'assistant' && !m.isStreaming)?.id ?? null;

  const placeholder = usePlaceholder();
  const charCount = input.length;
  const CHAR_LIMIT = 4000;

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

        {/* Conversation list — grouped by date */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 min-h-0"
          onClick={() => setOpenMenuId(null)}
        >
          {filteredConvs.length === 0 ? (
            <p className="text-[11px] text-on-surface-variant/50 text-center mt-4 font-mono">Noch keine Gespräche</p>
          ) : (
            groupConversations(filteredConvs, convMeta).map(([label, group]) => (
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
                        <p className="text-[12px] font-medium truncate flex-1 min-w-0">{displayTitle}</p>
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
                              Umbenennen
                            </button>
                            <button
                              onClick={() => { deleteConversation(c.id); setOpenMenuId(null); }}
                              className="w-full text-left px-3 py-2 text-[12px] text-red-400 hover:bg-surface-container transition-colors"
                            >
                              Löschen
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
              <p className="text-sm font-semibold text-primary-container">Datei anhängen</p>
              <p className="text-[11px] text-on-surface-variant mt-1">PDF · DOCX · TXT · PNG · JPG</p>
            </motion.div>
          )}
        </AnimatePresence>

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
                    <div className="w-full space-y-1 group">
                      {/* Header label */}
                      <div className="mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">DRÄXIE</span>
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

              {/* System prompt panel */}
              <AnimatePresence>
                {showSysPrompt && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="bg-surface-container/95 backdrop-blur-xl border border-outline-variant rounded-2xl p-3 shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Systemkontext</span>
                      <button onClick={() => setShowSysPrompt(false)} className="text-on-surface-variant/50 hover:text-on-surface-variant transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={sysPrompt}
                      onChange={e => { setSysPrompt(e.target.value); localStorage.setItem('draxie-sysprompt', e.target.value); }}
                      placeholder="Zusätzliche Anweisungen für DRÄXIE…"
                      className="w-full bg-surface-container-high border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container/50 resize-none font-mono leading-relaxed"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input pill */}
              <div className="group relative bg-surface-container/90 backdrop-blur-xl border border-outline-variant rounded-2xl shadow-2xl transition-all focus-within:ring-2 focus-within:ring-primary-container/30">

                {/* Gear icon — hover to reveal */}
                <button
                  onClick={() => setShowSysPrompt(v => !v)}
                  title="Systemkontext (Ctrl+Shift+P)"
                  className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all text-on-surface-variant/30 group-hover:opacity-100 hover:text-on-surface-variant hover:bg-surface-container-highest ${showSysPrompt ? 'opacity-100 text-primary-container' : 'opacity-0'}`}
                >
                  <Settings size={13} />
                </button>

                <div className="flex items-end gap-2 p-1.5 pr-10">
                  {/* Paperclip */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-on-surface-variant hover:text-primary-container hover:bg-surface-container-highest rounded-xl transition-all shrink-0"
                    title="Datei anhängen"
                  >
                    <Paperclip size={17} />
                  </button>
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
                      title="Generierung stoppen (ESC)"
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

              <p className="text-[10px] text-center text-on-surface-variant/40 font-mono">
                Enter senden · Shift+Enter neue Zeile · ESC stoppen
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
              Neue Nachricht
            </motion.button>
          )}
        </AnimatePresence>
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
