import { useState, useRef, useEffect, useCallback } from "react";
import {
  Inbox,
  Sparkles,
  MailOpen,
  Star,
  Search,
  MoreHorizontal,
  Bot,
  User,
} from "lucide-react";
import ChatInput from "./components/ChatInput";
import ThinkingIndicator from "./components/ThinkingIndicator";
import PhantomLoader from "./components/PhantomLoader";
import MarkdownMessage from "./components/MarkdownMessage";
import SiriOrb from "./components/smoothui/siri-orb";

const ORB_COLORS = {
  bg: "oklch(8% 0.05 280)",
  c1: "oklch(75% 0.20 320)",
  c2: "oklch(78% 0.16 220)",
  c3: "oklch(72% 0.20 290)",
};
import { useVisitor } from "./hooks/useVisitor";
import { useVoiceSession } from "./hooks/useVoiceSession";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface Suggestion {
  icon: React.ReactNode;
  label: string;
  prompt?: string;
  fill?: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: <Inbox className="h-4 w-4 text-purple-400" />,
    label: "ბოლო მეილები",
    prompt: "მაჩვენე ბოლო 5 მეილი მოკლედ.",
  },
  {
    icon: <Sparkles className="h-4 w-4 text-amber-400" />,
    label: "შემიჯამე დღევანდელი",
    prompt: "შემიჯამე დღევანდელი მეილები — ვინ მომწერა და რა მთავარია.",
  },
  {
    icon: <MailOpen className="h-4 w-4 text-emerald-400" />,
    label: "წაუკითხავი",
    prompt: "მაჩვენე წაუკითხავი მეილები.",
  },
  {
    icon: <Star className="h-4 w-4 text-yellow-400" />,
    label: "მნიშვნელოვანი",
    prompt: "მაჩვენე მნიშვნელოვანი მეილები.",
  },
  {
    icon: <Search className="h-4 w-4 text-blue-400" />,
    label: "ძებნა მეილში",
    fill: "მოძებნე მეილში: ",
  },
  {
    icon: <MoreHorizontal className="h-4 w-4 text-slate-500" />,
    label: "სხვა",
    fill: "",
  },
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

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
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
            <SiriOrb
              size="48px"
              colors={ORB_COLORS}
              animationDuration={orbActive ? 8 : 20}
            />
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
              <SiriOrb
                size="340px"
                colors={ORB_COLORS}
                animationDuration={orbActive ? 10 : 24}
              />
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
                  onClick={() => {
                    if (s.prompt) {
                      handleSend(s.prompt);
                    } else if (s.fill !== undefined) {
                      setInput(s.fill);
                    }
                  }}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 backdrop-blur-md transition hover:border-purple-400/40 hover:bg-purple-500/10 hover:text-purple-200 active:scale-95"
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

  // Keep the orb's own rotation steady (avoids the jarring flash from
  // changing animation-duration mid-flight). Instead, breathe via a smooth
  // scale + halo opacity driven by the user's voice level.
  const level = voice.audioLevel;
  const orbScale = 1 + level * 0.12;
  const haloOpacity = 0.35 + level * 0.55;
  const haloScale = 1 + level * 0.25;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="relative mb-10 flex justify-center">
        {/* Reactive halo — breathes with the user's voice */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            style={{
              width: 380,
              height: 380,
              opacity: haloOpacity,
              transform: `scale(${haloScale})`,
              transition: "opacity 180ms ease-out, transform 180ms ease-out",
              background:
                "radial-gradient(circle, rgba(168,85,247,0.55) 0%, rgba(56,189,248,0.30) 35%, rgba(236,72,153,0.18) 55%, transparent 75%)",
              filter: "blur(28px)",
              borderRadius: "9999px",
            }}
          />
        </div>

        {/* The orb itself — spins steadily, scales gently with voice */}
        <div
          style={{
            transform: `scale(${orbScale})`,
            transition: "transform 180ms ease-out",
          }}
        >
          <SiriOrb size="380px" colors={ORB_COLORS} animationDuration={14} />
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
