import { useRef, useCallback, type KeyboardEvent } from "react";
import { Send, Paperclip, Mic, MicOff, BookOpen, Sparkles } from "lucide-react";
import type { VoiceStatus } from "../hooks/useVoiceSession";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  voiceStatus?: VoiceStatus;
  onToggleVoice?: () => void;
}

export default function ChatInput({ value, onChange, onSend, voiceStatus = "idle", onToggleVoice }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSend();
    }
  };

  const canSend = value.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <div className="group relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(139,92,246,0.35)] transition-all focus-within:border-purple-400/40 focus-within:shadow-[0_8px_40px_-8px_rgba(139,92,246,0.55)]">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          placeholder="მკითხე რაიმე..."
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm text-slate-100 placeholder-slate-500 outline-none leading-relaxed"
        />

        {/* Bottom bar — inside the card */}
        <div className="flex items-center justify-between px-3 pb-3">
          {/* Left actions */}
          <div className="flex items-center gap-0.5">
            <ActionBtn icon={<Paperclip className="h-4 w-4" />} label="მიმაგრება" />
            <VoiceBtn status={voiceStatus} onClick={onToggleVoice} />
            <ActionBtn icon={<BookOpen className="h-4 w-4" />} label="შაბლონები" />
            <ActionBtn icon={<Sparkles className="h-4 w-4" />} label="AI მოდელი" />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] tabular-nums text-slate-500 select-none">
              {value.length > 0 && `${value.length}/3000`}
            </span>
            <button
              onClick={onSend}
              disabled={!canSend}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                canSend
                  ? "bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/40 hover:shadow-purple-400/50 hover:brightness-110 active:scale-95"
                  : "bg-white/5 text-slate-600 cursor-not-allowed"
              }`}
              aria-label="გაგზავნა"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-center text-[11px] text-slate-500">
        ფანტომი AI შეიძლება შეცდეს. გადაამოწმეთ მნიშვნელოვანი ინფორმაცია.
      </p>
    </div>
  );
}

/* ── Small icon button ── */

function ActionBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
      aria-label={label}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function VoiceBtn({ status, onClick }: { status: VoiceStatus; onClick?: () => void }) {
  const isActive = status !== "idle" && status !== "error";
  const isConnecting = status === "connecting";

  const label =
    status === "idle" || status === "error"
      ? "ხმოვანი"
      : status === "connecting"
      ? "ვუკავშირდები..."
      : status === "listening"
      ? "ვუსმენ"
      : "ვლაპარაკობ";

  const dotColor =
    status === "listening"
      ? "bg-red-400"
      : status === "speaking"
      ? "bg-emerald-400"
      : status === "connecting"
      ? "bg-amber-400"
      : "bg-slate-500";

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
        isActive
          ? "bg-purple-500/20 text-purple-200 ring-1 ring-purple-400/40 hover:bg-purple-500/30"
          : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
      }`}
      aria-label={label}
      title={label}
    >
      {isActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      <span className="hidden sm:inline">{label}</span>
      {isActive && (
        <span className={`ml-0.5 h-2 w-2 rounded-full ${dotColor} ${isConnecting ? "" : "animate-pulse"}`} />
      )}
    </button>
  );
}
