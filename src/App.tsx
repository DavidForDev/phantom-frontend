import { useState, useRef, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  Search,
  BarChart3,
  Tag,
  Gift,
  MoreHorizontal,
  Bot,
  User,
} from "lucide-react";
import ChatInput from "./components/ChatInput";
import ThinkingIndicator from "./components/ThinkingIndicator";
import PhantomLoader from "./components/PhantomLoader";
import MarkdownMessage from "./components/MarkdownMessage";
import { JarvisOrb, type JarvisPaletteValues } from "jarvis-ai-web-animation";

const PHANTOM_PALETTE: JarvisPaletteValues = {
  core: 0xf5e8ff,
  primary: 0xa855f7,
  secondary: 0x22d3ee,
  tertiary: 0xec4899,
  deep: 0x1e0a3c,
  fallback:
    "radial-gradient(circle at 50% 50%, #f5e8ff 0%, #a855f7 28%, #6d28d9 55%, #1e0a3c 80%, transparent)",
};
import { useVisitor } from "./hooks/useVisitor";
import { useVoiceSession } from "./hooks/useVoiceSession";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

const SUGGESTIONS = [
  { icon: <Search className="h-4 w-4 text-purple-500" />, label: "მოძებნე პროდუქტი" },
  { icon: <BarChart3 className="h-4 w-4 text-green-500" />, label: "შეადარე ფასები" },
  { icon: <ShoppingCart className="h-4 w-4 text-orange-500" />, label: "კალათში დამატება" },
  { icon: <Tag className="h-4 w-4 text-red-500" />, label: "ფასდაკლებები" },
  { icon: <Gift className="h-4 w-4 text-blue-500" />, label: "რეკომენდაცია" },
  { icon: <MoreHorizontal className="h-4 w-4 text-gray-500" />, label: "სხვა" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  statuses?: string[];
}

function App() {
  const visitorId = useVisitor();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(visitorId !== null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const voice = useVoiceSession({
    visitorId,
    onTurnComplete: () => {
      setMessages((prev) => {
        const next = [...prev];
        const userText = voiceTranscriptsRef.current.input.trim();
        const assistantText = voiceTranscriptsRef.current.output.trim();
        if (userText) next.push({ role: "user", content: userText });
        if (assistantText) next.push({ role: "assistant", content: assistantText });
        return next;
      });
      voiceTranscriptsRef.current = { input: "", output: "" };
    },
  });

  const voiceTranscriptsRef = useRef({ input: "", output: "" });
  useEffect(() => {
    voiceTranscriptsRef.current = { input: voice.inputTranscript, output: voice.outputTranscript };
  }, [voice.inputTranscript, voice.outputTranscript]);

  const voiceActive = voice.status !== "idle" && voice.status !== "error";

  const toggleVoice = useCallback(() => {
    if (voiceActive) {
      voice.stop();
    } else {
      voice.start().catch((err) => console.error("[voice] start failed", err));
    }
  }, [voice, voiceActive]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (!visitorId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/messages?visitorId=${encodeURIComponent(visitorId)}`);
        if (!res.ok) return;
        const history: Message[] = await res.json();
        if (!cancelled && history.length > 0) {
          setMessages(history.map((m) => ({ role: m.role, content: m.content })));
        }
      } catch (err) {
        console.error("[messages] load failed:", err);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visitorId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setThinking(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Stream opened — stop thinking, add empty assistant message
      setThinking(false);
      setMessages((prev) => [...prev, { role: "assistant", content: "", statuses: [] }]);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const updateLast = (mut: (m: Message) => Message) =>
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = mut(updated[updated.length - 1]);
          return updated;
        });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const evt = JSON.parse(data) as
              | { type?: "text" | "status"; text: string };
            const type = evt.type ?? "text";
            if (type === "text") {
              updateLast((m) => ({ ...m, content: m.content + evt.text }));
            } else if (type === "status") {
              updateLast((m) => ({
                ...m,
                statuses: [...(m.statuses ?? []), evt.text],
              }));
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error("[chat] error:", err);
      setThinking(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "შეცდომა მოხდა. გთხოვთ სცადოთ თავიდან." },
      ]);
    }
  }, [input, messages, thinking, visitorId]);

  const hasMessages = messages.length > 0;

  const orbActive = voiceActive || thinking;

  return (
    <div className="relative flex h-screen font-sans text-slate-200 overflow-hidden bg-[#070313]">
      {/* Cosmic background layers */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 10%, rgba(139,92,246,0.25), transparent 60%)," +
            "radial-gradient(ellipse 60% 50% at 80% 90%, rgba(56,189,248,0.15), transparent 60%)," +
            "radial-gradient(ellipse 50% 60% at 10% 80%, rgba(217,70,239,0.12), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col min-w-0">
        {/* Sticky header — small orb appears once chatting starts (text chat only) */}
        {(hasMessages || thinking) && !voiceActive && !historyLoading && (
          <header className="flex items-center gap-3 px-6 pt-5 pb-2">
            <div style={{ width: 48, height: 48 }}>
              <JarvisOrb
                size="avatar"
                palette={PHANTOM_PALETTE}
                state={orbActive ? "thinking" : "idle"}
                breathing
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-100">ფანტომი</div>
              <div className="text-[11px] text-slate-400">
                {thinking ? "ფიქრობს..." : "ხელმისაწვდომია"}
              </div>
            </div>
          </header>
        )}

        {/* Main area */}
        {historyLoading ? (
          <main className="flex flex-1 items-center justify-center px-6">
            <PhantomLoader />
          </main>
        ) : voiceActive ? (
          <VoiceMode voice={voice} />
        ) : hasMessages || thinking ? (
          <main className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className="flex gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      msg.role === "assistant"
                        ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/30"
                        : "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1 max-w-full">
                    {msg.statuses && msg.statuses.length > 0 && (
                      <div className="flex flex-col gap-0.5 text-xs italic px-1 text-purple-300/70">
                        {msg.statuses.map((s, idx) => (
                          <span key={idx}>{s}</span>
                        ))}
                      </div>
                    )}
                    {msg.content && (
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed backdrop-blur-md ${
                          msg.role === "assistant"
                            ? "bg-white/[0.04] border border-white/10 text-slate-100"
                            : "bg-gradient-to-br from-purple-600/80 to-fuchsia-600/70 border border-purple-400/30 text-white shadow-lg shadow-purple-500/20 whitespace-pre-wrap"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <MarkdownMessage>{msg.content}</MarkdownMessage>
                        ) : (
                          msg.content
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {thinking && <ThinkingIndicator />}
              <div ref={bottomRef} />
            </div>
          </main>
        ) : (
          <main className="flex flex-1 flex-col items-center justify-center px-6">
            <div className="mb-8 flex justify-center">
              <div style={{ width: 340, height: 340 }}>
                <JarvisOrb
                  size="hero"
                  palette={PHANTOM_PALETTE}
                  state={orbActive ? "thinking" : "idle"}
                  breathing
                  breathingIntensity={1.4}
                  interactive
                />
              </div>
            </div>

            <h2 className="mb-2 text-center text-4xl font-semibold leading-tight text-slate-100 md:text-5xl">
              რა გაინტერესებთ
            </h2>
            <h2 className="mb-10 text-center text-4xl font-semibold leading-tight text-slate-100 md:text-5xl">
              დღეს?
            </h2>

            <div className="mb-12 flex flex-wrap justify-center gap-2.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 backdrop-blur-md transition hover:border-purple-400/40 hover:bg-purple-500/10 hover:text-purple-200"
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          </main>
        )}
        {voice.errorMessage && (
          <div className="mx-auto w-full max-w-3xl px-4 pb-2">
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {voice.errorMessage}
            </div>
          </div>
        )}

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          voiceStatus={voice.status}
          onToggleVoice={toggleVoice}
        />
      </div>
    </div>
  );
}

export default App;

/* ── Voice-only immersive view ───────────────────────────────── */

function VoiceMode({ voice }: { voice: ReturnType<typeof useVoiceSession> }) {
  const status = voice.status;
  const statusLabel =
    status === "connecting"
      ? "ვუკავშირდები..."
      : status === "speaking"
      ? "ვლაპარაკობ"
      : status === "listening"
      ? "გისმენთ"
      : "მზადაა";

  const dotColor =
    status === "listening"
      ? "bg-emerald-400"
      : status === "speaking"
      ? "bg-purple-400"
      : status === "connecting"
      ? "bg-amber-400"
      : "bg-slate-400";

  // Size grows when connection is ready & a voice level is detected
  const baseSize = 320;
  const reactiveSize = baseSize + voice.audioLevel * 90;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="mb-10 flex justify-center">
        <div
          style={{
            width: reactiveSize,
            height: reactiveSize,
            transition: "width 120ms ease-out, height 120ms ease-out",
          }}
        >
          <JarvisOrb
            size="hero"
            palette={PHANTOM_PALETTE}
            state="thinking"
            intensity={0.7 + voice.audioLevel * 1.1}
            breathing
            breathingIntensity={1.6}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <span className={`h-2 w-2 rounded-full ${dotColor} animate-pulse`} />
        <span className="text-sm font-medium tracking-wide text-slate-200">
          {statusLabel}
        </span>
      </div>

      <div className="w-full max-w-xl space-y-3 text-center">
        {voice.inputTranscript && (
          <p className="text-base text-slate-300">
            <span className="text-purple-300 font-medium">თქვენ: </span>
            {voice.inputTranscript}
          </p>
        )}
        {voice.outputTranscript && (
          <p className="text-base text-slate-100">
            <span className="text-purple-300 font-medium">ფანტომი: </span>
            {voice.outputTranscript}
          </p>
        )}
      </div>
    </main>
  );
}
