import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  BarChart3, 
  LayoutGrid, 
  Database, 
  Settings, 
  Sun, 
  LogOut, 
  Menu, 
  Search, 
  UserCircle2, 
  Terminal, 
  Cpu, 
  Mic, 
  Send, 
  ChevronRight,
  Code2,
  Box,
  History,
  Activity,
  Workflow,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Milestone, ArtifactData, Message } from './types';
import { TimelineArtifact } from './components/TimelineArtifact';
import { ArtifactRenderer } from './components/ArtifactRenderer';

const parseArtifacts = (content: string): { cleanContent: string; artifact?: Message['artifact'] } => {
  const artifactRegex = /<artifact(?:\s+type="([^"]*)")?(?:\s+name="([^"]*)")?>([\s\S]*?)<\/artifact>/i;
  const match = content.match(artifactRegex);

    if (match) {
    const [fullMatch, typeStr, nameStr, artifactContent] = match;
    const type = (typeStr || 'component') as 'component' | 'html';
    const name = nameStr || 'Unnamed Artifact';
    
    let data = null;
    let cleanArtifactContent = artifactContent.trim();
    
    if (type === 'component') {
      try {
        data = JSON.parse(cleanArtifactContent);
      } catch (e) {
        console.error("Failed to parse component data as JSON", e);
      }
    }

    return {
      cleanContent: content.replace(fullMatch, '').trim(),
      artifact: {
        type,
        name,
        data,
        content: cleanArtifactContent,
        bufferContent: cleanArtifactContent
      }
    };
  }

  return { cleanContent: content };
};

const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'user',
    content: 'Can you visualize the timeline for the projected Acme Corp acquisition based on the Q3 strategic plan?'
  },
  {
    id: '2',
    role: 'assistant',
    content: 'I\'ve analyzed the Q3 strategic plan regarding the Acme Corp acquisition. I\'ll generate an interactive timeline component for you to track the milestones.\n\n<artifact type="component" name="AcquisitionTimeline">\n{\n  "title": "Acme Corp Acquisition",\n  "status": "In Progress",\n  "milestones": [\n    {\n      "id": "m1",\n      "date": "2024-10-15",\n      "title": "Initial Letter of Intent (LOI)",\n      "status": "completed",\n      "description": "Formal LOI signed by both executive boards.",\n      "risk_level": "low"\n    },\n    {\n      "id": "m2",\n      "date": "2024-11-01",\n      "title": "Due Diligence Phase 1",\n      "status": "in-progress",\n      "description": "Financial and legal review of core assets.",\n      "risk_level": "medium"\n    },\n    {\n      "id": "m3",\n      "date": "2024-12-10",\n      "title": "Regulatory Approval Filing",\n      "status": "pending",\n      "description": "Submission to FTC and international bodies.",\n      "risk_level": "high"\n    },\n    {\n      "id": "m4",\n      "date": "2025-02-28",\n      "title": "Target Deal Closure",\n      "status": "pending",\n      "description": "Final signatures and public announcement.",\n      "risk_level": "medium"\n    }\n  ]\n}\n</artifact>'
  }
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES.map(m => {
    const { cleanContent, artifact } = parseArtifacts(m.content);
    return { ...m, content: cleanContent, artifact };
  }));
  const [input, setInput] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      let aiContent = "I'm analyzing your request.";
      if (input.toLowerCase().includes('website') || input.toLowerCase().includes('preview')) {
        aiContent = 'I will create a simple dashboard preview for you as requested.\n\n<artifact type="html" name="DashboardPreview">\n<!DOCTYPE html>\n<html>\n<head>\n<style>\nbody { font-family: sans-serif; background: #0f172a; color: white; padding: 20px; }\n.card { background: #1e293b; padding: 15px; border-radius: 10px; border: 1px solid #334155; }\nh2 { color: #38bdf8; margin-top: 0; }\n</style>\n</head>\n<body>\n<div class="card">\n<h2>Executive Snapshot</h2>\n<p>Revenue: $4.2M (+12%)</p>\n<p>Active Projects: 24</p>\n<p>Risk Score: Low</p>\n</div>\n</body>\n</html>\n</artifact>';
      } else {
        aiContent = "I've processed your request. How else can I assist with your data analysis?";
      }

      const { cleanContent, artifact } = parseArtifacts(aiContent);
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanContent,
        artifact
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-[100dvh] bg-surface-container-low text-on-surface overflow-hidden">
      {/* Drawer Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-container border-r border-outline-variant transform transition-transform duration-300 md:relative md:translate-x-0 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center">
              <Workflow className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Draexie</h1>
              <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest leading-none">Analytical Engine</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            <button className="flex items-center gap-3 w-full px-3 py-2 bg-primary-container text-white rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-95 mb-4">
              <Plus size={18} /> New Analysis
            </button>
            
            {[
              { icon: BarChart3, label: 'Intelligence' },
              { icon: LayoutGrid, label: 'Generative UI', active: true },
              { icon: Database, label: 'Datasets' },
              { icon: Settings, label: 'Settings' }
            ].map((item) => (
              <button 
                key={item.label}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm transition-colors ${
                  item.active 
                    ? 'bg-surface-container-high text-primary-container border-l-2 border-primary-container rounded-l-none' 
                    : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                }`}
              >
                <item.icon size={18} /> {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-1 pt-4 border-t border-outline-variant">
            <button className="flex items-center gap-3 w-full px-3 py-2 text-on-surface-variant hover:text-on-surface text-sm">
              <Sun size={18} /> Toggle Theme
            </button>
            <button className="flex items-center gap-3 w-full px-3 py-2 text-on-surface-variant hover:text-on-surface text-sm">
              <LogOut size={18} /> Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top bar (Mobile) */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-outline-variant bg-surface-container/80 backdrop-blur-md">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)}><Menu size={20} /></button>
          <span className="font-bold">Draexie</span>
          <div className="flex gap-3"><Search size={20} /><UserCircle2 size={20} /></div>
        </header>

        {/* Global System Overlay */}
        <div className="h-8 bg-surface-container-high/50 border-b border-outline-variant px-6 flex items-center justify-between text-[10px] font-mono tracking-wider z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_#3b82f6]" />
              <span className="text-primary-container uppercase">Interceptor Active</span>
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span>|</span>
              <span className="uppercase">Stream: PARSING_ARTIFACT</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-on-surface-variant opacity-60">
            <span>Buffer_chunks: 42</span>
            <Cpu size={12} />
          </div>
        </div>

        {/* Chat / Canvas Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
          <div className="max-w-[1200px] mx-auto space-y-8 pb-32">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {message.role === 'user' ? (
                    <div className="max-w-[80%] bg-primary-container text-white p-4 rounded-2xl rounded-tr-none shadow-lg">
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                  ) : (
                    <div className="w-full space-y-4">
                      {/* Assistant Response Header */}
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
                          <Sparkles size={16} className="text-primary-container" />
                        </div>
                        <div className="flex-1 space-y-4 pt-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Draexie Assistant</span>
                              <span className="text-[9px] px-1.5 py-0.5 bg-primary-container/10 border border-primary-container/30 text-primary-container rounded font-mono uppercase">Architect Mode</span>
                            </div>
                            <button 
                              onClick={() => handleCopy(message.content, message.id)}
                              className="p-1 px-2 text-[10px] uppercase font-bold tracking-wider text-on-surface-variant hover:text-primary-container hover:bg-surface-container-highest rounded transition-all flex items-center gap-1.5"
                              title="Copy response"
                            >
                              {copiedId === message.id ? (
                                <>
                                  <Check size={12} className="text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-sm text-on-surface leading-relaxed max-w-2xl">{message.content}</p>
                        </div>
                      </div>

                      {/* Artifact View */}
                      {message.artifact && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                          {/* Stream Buffer */}
                          <div className="bento-card bg-surface-container-low flex flex-col h-[480px]">
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant">
                              <span className="flex items-center gap-2 text-xs font-mono text-on-surface-variant tracking-tighter">
                                <Terminal size={14} className="text-primary-container" /> Stream Buffer
                              </span>
                              <div className="flex gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400/50" />
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50" />
                              </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 bg-black/20 rounded-xl scanline">
                              <pre className="font-mono text-[11px] text-primary-container/80 leading-relaxed overflow-x-hidden whitespace-pre-wrap">
                                {message.artifact.bufferContent}
                                <span className="inline-block w-1.5 h-3 bg-primary-container ml-1 animate-pulse" />
                              </pre>
                            </div>
                          </div>

                          {/* Rendered View */}
                          <div className="bento-card h-[480px] flex flex-col pt-4">
                            <div className="flex items-center justify-between mb-4 px-2">
                              <span className="flex items-center gap-2 text-xs font-bold text-primary-container uppercase tracking-widest">
                                <Box size={14} /> Rendered Artifact
                              </span>
                              <button className="flex items-center gap-1 px-2 py-1 bg-surface-container-highest border border-outline-variant rounded text-[10px] font-mono text-on-surface-variant hover:text-on-surface transition-colors">
                                <ChevronRight size={10} /> View Source
                              </button>
                            </div>
                            <div className="flex-1 p-2 rounded-xl border border-outline-variant/30 overflow-hidden bg-surface-container-low">
                              <ArtifactRenderer artifact={message.artifact} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 z-30 pointer-events-none">
          <div className="max-w-[800px] mx-auto bg-surface-container/90 backdrop-blur-xl border border-outline-variant rounded-2xl p-1.5 flex items-center gap-2 shadow-2xl pointer-events-auto transition-all focus-within:ring-2 focus-within:ring-primary-container/30">
            <button className="p-2 text-on-surface-variant hover:text-primary-container hover:bg-surface-container-highest rounded-xl transition-all">
              <Plus size={20} />
            </button>
            <input 
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-2 placeholder:text-on-surface-variant/50"
              placeholder="Ask Draexie to analyze data or build UI..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className="p-2 text-on-surface-variant hover:text-primary-container hover:bg-surface-container-highest rounded-xl transition-all">
              <Mic size={20} />
            </button>
            <button 
              onClick={handleSend}
              className="p-2.5 bg-primary-container text-white rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-[10px] text-center text-on-surface-variant/50 mt-3 font-mono">
            Artifacts are generative insights. Cross-validate critical metrics.
          </p>
        </div>
      </main>

      {/* Right Dev Panel */}
      <aside className="hidden xl:flex w-80 bg-surface-container border-l border-outline-variant flex-col overflow-hidden">
        <div className="p-6 border-b border-outline-variant">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-1">Co-Developer Tools</h2>
          <p className="text-[11px] text-on-surface-variant/70 italic">Generative UI Framework v2.4</p>
        </div>

        <div className="flex border-b border-outline-variant">
          {[
            { id: 'schemas', icon: Database, label: 'Schemas' },
            { id: 'stream', icon: Activity, label: 'Stream' },
            { id: 'history', icon: History, label: 'Versions' }
          ].map((tab, idx) => (
            <button 
              key={tab.id}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                idx === 0 ? 'text-primary-container border-b-2 border-primary-container bg-primary-container/5' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Metrics Bento Card */}
          <div className="bento-card !p-4 bg-surface-container-low space-y-4">
            <div className="flex justify-between items-center text-[10px] font-bold text-primary-container tracking-wider uppercase">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary-container animate-pulse rounded-full" />
                Active Component
              </div>
            </div>
            <div className="font-mono text-sm">Timeline.tsx</div>
            <div className="space-y-2 text-[11px] text-on-surface-variant font-mono">
              <div className="flex justify-between"><span>Props:</span> <span className="text-on-surface font-bold">4</span></div>
              <div className="flex justify-between"><span>Engine:</span> <span className="text-on-surface">React 19</span></div>
              <div className="flex justify-between"><span>Context:</span> <span className="text-on-surface">DraexieCore</span></div>
            </div>
          </div>

          <div className="bento-card !p-4 bg-surface-container-low">
             <div className="flex justify-between items-center text-[10px] font-bold text-on-surface-variant/70 tracking-wider uppercase mb-3">
              Registered Schemas
            </div>
            <div className="space-y-1">
              {[
                { name: 'DataChart', icon: BarChart3 },
                { name: 'Timeline', icon: ChevronRight, active: true },
                { name: 'MetricGrid', icon: LayoutGrid }
              ].map(s => (
                <div key={s.name} className={`flex items-center justify-between p-2 rounded-lg text-[11px] font-mono transition-colors ${
                  s.active ? 'bg-primary-container/10 text-primary-container outline outline-primary-container/20' : 'text-on-surface-variant hover:bg-surface-container-highest'
                }`}>
                  <div className="flex items-center gap-2"><s.icon size={12} /> {s.name}</div>
                  {s.active && <div className="w-1 h-1 rounded-full bg-primary-container" />}
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card !p-4 bg-surface-container-low">
            <div className="flex justify-between items-center text-[10px] font-bold text-on-surface-variant/70 tracking-wider uppercase mb-3">
              Stream Metrics
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-container p-2 rounded-xl border border-outline-variant">
                <div className="text-[8px] uppercase tracking-widest text-on-surface-variant mb-1">Latency</div>
                <div className="text-sm font-mono text-emerald-400">124ms</div>
              </div>
              <div className="bg-surface-container p-2 rounded-xl border border-outline-variant">
                <div className="text-[8px] uppercase tracking-widest text-on-surface-variant mb-1">Tks/sec</div>
                <div className="text-sm font-mono text-primary-container">68.2</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-outline-variant bg-surface-container-high/30">
          <div className="text-[10px] font-bold text-center tracking-[0.3em] uppercase text-on-surface-variant/30">Draexie DevCore</div>
        </div>
      </aside>
    </div>
  );
}
