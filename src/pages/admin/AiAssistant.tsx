import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Send, Download, Loader2, Sparkles, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string; actions?: any[] };

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const STORAGE_KEY = 'babyland_bibi_chat';

const AiAssistant = () => {
  const navigate = useNavigate();
  const { activeVersion } = useVersion();
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const getPermissions = (): string[] => {
    const auth = sessionStorage.getItem('babyland_admin');
    if (auth === 'true') return ['all'];
    const staffData = sessionStorage.getItem('babyland_staff');
    if (staffData) {
      try { return JSON.parse(staffData).permissions || []; } catch { return []; }
    }
    return [];
  };

  const executeActions = async (actions: any[]) => {
    for (const a of actions) {
      if (a.type === 'navigate' && a.path) {
        navigate(a.path);
        if (a.highlight) {
          sessionStorage.setItem('ai_highlight', String(a.highlight));
          setTimeout(() => window.dispatchEvent(new CustomEvent('ai-highlight', { detail: a.highlight })), 400);
        }
      } else if (a.type === 'export_excel' && a.rows?.length) {
        try {
          const ws = XLSX.utils.json_to_sheet(a.rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, (a.title || 'Data').slice(0, 30));
          const fname = a.filename.endsWith('.xlsx') ? a.filename : `${a.filename}.xlsx`;
          XLSX.writeFile(wb, fname);
          toast.success(`تم تنزيل ${fname}`);
        } catch {
          toast.error('فشل تصدير الإكسيل');
        }
      }
    }
  };

  const send = async (text: string) => {
    const userText = text.trim();
    if (!userText || thinking) return;
    const newMsgs: Msg[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMsgs);
    setInput('');
    setThinking(true);
    try {
      const apiMessages = newMsgs.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: apiMessages,
          activeVersionId: activeVersion?.id,
          permissions: getPermissions(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const replyText = data.text || 'تمام';
      const actions = data.actions || [];
      setMessages(m => [...m, { role: 'assistant', content: replyText, actions }]);
      await executeActions(actions);
    } catch (e: any) {
      toast.error(e.message || 'حصل خطأ');
      setMessages(m => [...m, { role: 'assistant', content: 'حصل عندي مشكلة، حاول تاني.' }]);
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error('المتصفح ده مش بيدعم التعرف على الصوت. استخدم Chrome.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = 'ar-EG';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      let final = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setInput(prev => {
        const base = prev.trim();
        const piece = (final || interim).trim();
        if (!piece) return base;
        return base ? `${base} ${piece}` : piece;
      });
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error !== 'no-speech' && e.error !== 'aborted') toast.error('مشكلة في الميكروفون');
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try { rec.start(); } catch {}
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const examples = [
    'كام طلب النهاردة؟',
    'وريني المنتجات اللي قربت تخلص',
    'اعمللي إكسيل بمبيعات الأسبوع',
    'مين أكتر عميل بيشتري؟',
  ];

  return (
    <div className="min-h-[calc(100vh-3rem)] -m-6 relative overflow-hidden bg-gradient-to-br from-[#0a0a2e] via-[#1a0a3e] to-[#0a1a3e] flex flex-col">
      {/* Background fx */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,200,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,100,200,.15) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
      }} />
      <div className="absolute top-10 right-10 w-72 h-72 rounded-full blur-3xl opacity-20 bg-pink-500 animate-pulse pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 rounded-full blur-3xl opacity-20 bg-cyan-400 animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />

      {/* Header */}
      <div className="relative z-10 px-6 py-4 border-b border-white/10 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-pink-500 flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Sparkles className="h-6 w-6 text-white" />
            <span className="absolute inset-0 rounded-full border border-white/30 animate-ping opacity-50" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
              بيبي · المساعد الذكي
            </h1>
            <p className="text-xs text-white/50">شات نصي مع إدخال صوتي · تحليلات وإكسيل من بيانات حقيقية</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button onClick={clearChat} variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10">
            <Trash2 className="h-4 w-4 ml-1" /> مسح
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto text-center mt-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <span className="text-xs text-white/80 tracking-widest">BABYLAND AI · v2.0</span>
            </div>
            <h2 className="text-3xl font-bold text-white">إزيك يا باشا؟ اسألني أي حاجة عن المحل</h2>
            <p className="text-white/60">اكتب أو دوس على المايك واتكلم. هرد عليك بتحليل من البيانات الحقيقية، ولو طلبت إكسيل هنزّله بصفوف فعلية.</p>
            <div className="grid grid-cols-2 gap-2 max-w-xl mx-auto">
              {examples.map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p)}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 text-white/80 text-sm text-right transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-gradient-to-r from-cyan-500/30 to-cyan-600/30 text-white border border-cyan-400/30'
                : 'bg-white/5 backdrop-blur-xl text-white border border-pink-400/20'
            }`}>
              {m.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none [&>*]:my-2 [&_table]:border [&_table]:border-white/20 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-white/20 [&_td]:border [&_td]:border-white/20">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
              {m.actions?.filter((a: any) => a.type === 'export_excel').map((a: any, j: number) => (
                <div key={j} className="mt-2 flex items-center gap-1.5 text-xs text-cyan-200">
                  <Download className="h-3 w-3" /> {a.filename} ({a.rows?.length || 0} صف)
                </div>
              ))}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-pink-400/20 text-white/70 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> بفكر وبحلل البيانات...
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="relative z-10 p-4 border-t border-white/10 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto flex items-end gap-2">
          <Button
            type="button"
            onClick={startListening}
            disabled={thinking}
            size="icon"
            className={`rounded-full h-12 w-12 shrink-0 transition-all ${
              listening
                ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50 animate-pulse'
                : 'bg-gradient-to-br from-cyan-500 to-pink-500 hover:opacity-90 shadow-lg shadow-pink-500/30'
            }`}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={listening ? 'بسمعك...' : 'اكتب سؤالك أو دوس المايك واتكلم...'}
            disabled={thinking}
            rows={1}
            className="flex-1 min-h-12 max-h-32 resize-none bg-white/5 backdrop-blur-xl border-white/10 text-white placeholder:text-white/40 focus-visible:ring-pink-400/50"
          />
          <Button
            onClick={() => send(input)}
            disabled={!input.trim() || thinking}
            size="icon"
            className="rounded-full h-12 w-12 shrink-0 bg-gradient-to-br from-pink-500 to-cyan-500 hover:opacity-90 shadow-lg shadow-cyan-500/30"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AiAssistant;
