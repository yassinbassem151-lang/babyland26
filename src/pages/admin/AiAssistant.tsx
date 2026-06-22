import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Phone, PhoneOff, Download, Loader2, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useVersion } from '@/contexts/VersionContext';
import { Button } from '@/components/ui/button';
import babylandLogo from '@/assets/babyland-logo.jpg';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string; actions?: any[] };

// Web Speech types (browser-specific)
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const AiAssistant = () => {
  const navigate = useNavigate();
  const { activeVersion } = useVersion();
  const [inCall, setInCall] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [muted, setMuted] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Get permissions
  const getPermissions = (): string[] => {
    const auth = sessionStorage.getItem('babyland_admin');
    if (auth === 'true') return ['all'];
    const staffData = sessionStorage.getItem('babyland_staff');
    if (staffData) {
      try { return JSON.parse(staffData).permissions || []; } catch { return []; }
    }
    return [];
  };

  const getVoiceText = (text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= 220) return clean;
    const firstSentences = clean.split(/[.!؟]/).filter(Boolean).slice(0, 2).join('. ');
    return `${(firstSentences || clean).slice(0, 190)}. التفاصيل ظهرتلك على الشاشة.`;
  };

  const splitSpeech = (text: string) => {
    const words = text.split(' ');
    const chunks: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > 120) {
        chunks.push(current.trim());
        current = word;
      } else {
        current = `${current} ${word}`.trim();
      }
    }
    if (current) chunks.push(current);
    return chunks;
  };

  const speak = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (muted || !text) return resolve();
      try {
        window.speechSynthesis.cancel();
        const voices = window.speechSynthesis.getVoices();
        const arVoice = voices.find(v => v.lang === 'ar-EG') || voices.find(v => v.lang.startsWith('ar'));
        const chunks = splitSpeech(getVoiceText(text));
        let index = 0;
        setSpeaking(true);
        const playNext = () => {
          if (index >= chunks.length) {
            setSpeaking(false);
            resolve();
            return;
          }
          const u = new SpeechSynthesisUtterance(chunks[index]);
          u.lang = 'ar-EG';
          u.rate = 1.18;
          u.pitch = 1;
          if (arVoice) u.voice = arVoice;
          u.onend = () => { index += 1; playNext(); };
          u.onerror = () => { setSpeaking(false); resolve(); };
          window.speechSynthesis.speak(u);
        };
        playNext();
      } catch {
        setSpeaking(false);
        resolve();
      }
    });
  };

  const executeActions = async (actions: any[]) => {
    for (const a of actions) {
      if (a.type === 'navigate' && a.path) {
        navigate(a.path);
        if (a.highlight) {
          sessionStorage.setItem('ai_highlight', a.highlight);
          setTimeout(() => window.dispatchEvent(new CustomEvent('ai-highlight', { detail: a.highlight })), 400);
        }
      } else if (a.type === 'export_excel' && a.rows?.length) {
        try {
          const ws = XLSX.utils.json_to_sheet(a.rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, a.title?.slice(0, 30) || 'Data');
          XLSX.writeFile(wb, a.filename.endsWith('.xlsx') ? a.filename : `${a.filename}.xlsx`);
          toast.success(`تم تنزيل ${a.filename}`);
        } catch (e: any) {
          toast.error('فشل تصدير الإكسيل');
        }
      }
    }
  };

  const sendToAI = async (userText: string) => {
    const newMsgs: Msg[] = [...messagesRef.current, { role: 'user', content: userText }];
    setMessages(newMsgs);
    setThinking(true);
    try {
      const apiMessages = newMsgs.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: apiMessages,
          activeVersionId: activeVersion?.id,
          permissions: getPermissions(),
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const text = data.text || 'تمام';
      const actions = data.actions || [];
      setMessages(m => [...m, { role: 'assistant', content: text, actions }]);
      await executeActions(actions);
      await speak(text);
    } catch (e: any) {
      toast.error(e.message || 'حصل خطأ');
      await speak('حصل عندي مشكلة، حاول تاني');
    } finally {
      setThinking(false);
    }
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error('المتصفح ده مش بيدعم التعرف على الصوت. استخدم Chrome.');
      return;
    }
    const rec = new SR();
    rec.lang = 'ar-EG';
    rec.continuous = false;
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
      setTranscript(final || interim);
      if (final.trim()) {
        rec.stop();
        setTranscript('');
        sendToAI(final.trim());
      }
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast.error('مشكلة في الميكروفون');
      }
    };
    rec.onend = () => {
      setListening(false);
    };
    recognitionRef.current = rec;
    try { rec.start(); } catch {}
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const startCall = async () => {
    setInCall(true);
    setMessages([]);
    await speak('جاهز يا باشا، اسألني عن أي حاجة في المحل.');
    setTimeout(() => startListening(), 150);
  };

  const endCall = () => {
    setInCall(false);
    stopListening();
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setThinking(false);
  };

  // Auto-restart listening after assistant speaks
  useEffect(() => {
    if (inCall && !listening && !speaking && !thinking) {
      const t = setTimeout(() => startListening(), 250);
      return () => clearTimeout(t);
    }
  }, [inCall, listening, speaking, thinking]);

  const orbState = thinking ? 'thinking' : speaking ? 'speaking' : listening ? 'listening' : 'idle';

  return (
    <div className="min-h-[calc(100vh-3rem)] -m-6 p-6 relative overflow-hidden bg-gradient-to-br from-[#0a0a2e] via-[#1a0a3e] to-[#0a1a3e]">
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: 'linear-gradient(rgba(0,200,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,100,200,.15) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        animation: 'gridMove 20s linear infinite',
      }} />

      {/* Floating orbs */}
      <div className="absolute top-10 right-10 w-72 h-72 rounded-full blur-3xl opacity-30 bg-pink-500 animate-pulse" />
      <div className="absolute bottom-10 left-10 w-72 h-72 rounded-full blur-3xl opacity-30 bg-cyan-400 animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 flex flex-col items-center min-h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="text-center mb-8 mt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-3">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            <span className="text-xs text-white/80 tracking-widest">BABYLAND AI · v1.0</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
            بيبي - المساعد الذكي
          </h1>
          <p className="text-white/60 mt-2 text-sm">اسألني بصوتك عن أي حاجة في المحل</p>
        </div>

        {/* The Orb */}
        <div className="relative flex items-center justify-center my-8" style={{ width: 320, height: 320 }}>
          {/* Outer rotating rings */}
          <div className={`absolute inset-0 rounded-full border-2 border-cyan-400/30 ${inCall ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '8s' }} />
          <div className={`absolute inset-4 rounded-full border-2 border-pink-400/30 ${inCall ? 'animate-spin-slow-reverse' : ''}`} style={{ animationDuration: '12s' }} />
          <div className={`absolute inset-8 rounded-full border border-purple-400/40 ${inCall ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '6s' }} />

          {/* Pulse waves when listening/speaking */}
          {(listening || speaking) && (
            <>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/20 to-pink-400/20 animate-ping" />
              <div className="absolute inset-4 rounded-full bg-gradient-to-r from-cyan-400/30 to-pink-400/30 animate-ping" style={{ animationDelay: '0.3s' }} />
            </>
          )}

          {/* Glow */}
          <div className={`absolute inset-12 rounded-full blur-2xl transition-all duration-500 ${
            orbState === 'listening' ? 'bg-cyan-400/60' :
            orbState === 'speaking' ? 'bg-pink-400/60' :
            orbState === 'thinking' ? 'bg-purple-400/60' :
            'bg-gradient-to-r from-cyan-400/30 to-pink-400/30'
          } ${inCall ? 'animate-pulse' : ''}`} />

          {/* Main button */}
          <button
            onClick={inCall ? endCall : startCall}
            disabled={thinking}
            className={`relative w-56 h-56 rounded-full overflow-hidden shadow-2xl transition-all duration-500 hover:scale-105 active:scale-95 ${
              inCall ? 'ring-4 ring-pink-400/50' : 'ring-4 ring-cyan-400/40'
            }`}
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.9), rgba(255,255,255,.6))',
              boxShadow: '0 0 80px rgba(0,200,255,.5), 0 0 120px rgba(255,100,200,.3), inset 0 0 40px rgba(255,255,255,.5)',
            }}
          >
            <img src={babylandLogo} alt="Babyland AI" className="w-full h-full object-contain p-2" />
            {/* Overlay state icon */}
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${inCall ? 'opacity-100 bg-black/30' : 'opacity-0'}`}>
              {thinking ? (
                <Loader2 className="h-16 w-16 text-white animate-spin" />
              ) : (
                <Mic className={`h-16 w-16 text-white ${listening ? 'animate-pulse' : ''}`} />
              )}
            </div>
          </button>
        </div>

        {/* Status */}
        <div className="text-center mb-4 h-8">
          {!inCall && <p className="text-white/70">اضغط على الدائرة لبدء المكالمة</p>}
          {inCall && thinking && <p className="text-purple-300 animate-pulse">بفكر...</p>}
          {inCall && speaking && <p className="text-pink-300">بتكلم...</p>}
          {inCall && listening && <p className="text-cyan-300">بسمعك... {transcript && `"${transcript}"`}</p>}
          {inCall && !thinking && !speaking && !listening && <p className="text-white/60">جاهز</p>}
        </div>

        {/* Controls */}
        {inCall && (
          <div className="flex gap-3 mb-6">
            <Button
              onClick={() => setMuted(!muted)}
              variant="outline"
              size="icon"
              className="rounded-full border-white/20 bg-white/5 backdrop-blur-xl text-white hover:bg-white/10 w-12 h-12"
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button
              onClick={endCall}
              size="icon"
              className="rounded-full bg-red-500 hover:bg-red-600 w-14 h-14 shadow-lg shadow-red-500/50"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        )}

        {/* Transcript / history */}
        {messages.length > 0 && (
          <div ref={scrollRef} className="w-full max-w-2xl max-h-64 overflow-y-auto space-y-2 p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-cyan-600/30 text-white border border-cyan-400/30'
                    : 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-white border border-pink-400/30'
                }`}>
                  {m.content}
                  {m.actions?.filter((a: any) => a.type === 'export_excel').map((a: any, j: number) => (
                    <div key={j} className="mt-2 flex items-center gap-1.5 text-xs text-cyan-200">
                      <Download className="h-3 w-3" /> {a.filename}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Example prompts */}
        {!inCall && messages.length === 0 && (
          <div className="mt-6 grid grid-cols-2 gap-2 max-w-2xl w-full text-sm">
            {[
              'كام طلب النهاردة؟',
              'وريني المنتجات اللي قربت تخلص',
              'اعمللي إكسيل بمبيعات الأسبوع',
              'مين أكتر عميل بيشتري؟',
            ].map((p, i) => (
              <div key={i} className="px-4 py-3 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/70 text-center">
                "{p}"
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes gridMove {
          0% { background-position: 0 0; }
          100% { background-position: 50px 50px; }
        }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin-slow-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        .animate-spin-slow-reverse { animation: spin-slow-reverse 12s linear infinite; }
      `}</style>
    </div>
  );
};

export default AiAssistant;
