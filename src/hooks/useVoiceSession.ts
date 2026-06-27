import { useCallback, useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const WS_URL = API.replace(/^http/, "ws") + "/voice";
const OUTPUT_SAMPLE_RATE = 24000;

export type VoiceStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

interface UseVoiceSessionOptions {
  visitorId: string | null;
  onTurnComplete?: () => void;
}

interface UseVoiceSessionReturn {
  status: VoiceStatus;
  inputTranscript: string;
  outputTranscript: string;
  errorMessage: string | null;
  audioChunkCount: number;
  audioLevel: number;
  start: () => Promise<void>;
  stop: () => void;
  sendText: (text: string) => void;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: ArrayBufferLike): string {
  const view = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin);
}

function pcm16ToFloat32(pcm: ArrayBufferLike): Float32Array<ArrayBuffer> {
  const view = new Int16Array(pcm);
  const out = new Float32Array(view.length);
  for (let i = 0; i < view.length; i++) out[i] = view[i] / 0x8000;
  return out;
}

export function useVoiceSession({ visitorId, onTurnComplete }: UseVoiceSessionOptions): UseVoiceSessionReturn {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [inputTranscript, setInputTranscript] = useState("");
  const [outputTranscript, setOutputTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioChunkCount, setAudioChunkCount] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackTimeRef = useRef<number>(0);
  const readyRef = useRef(false);
  const errorReceivedRef = useRef(false);
  const audioChunkCountRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRafRef = useRef<number | null>(null);

  const playAudioChunk = useCallback((audioBytes: Uint8Array) => {
    setStatus("speaking");

    const ctx = outputCtxRef.current;
    if (!ctx) {
      console.warn("[voice] audio chunk arrived but no output AudioContext");
      return;
    }
    if (audioBytes.byteLength < 2) return;

    try {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const slice = audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength);
      const floats = pcm16ToFloat32(slice);
      if (floats.length === 0) return;

      const buffer = ctx.createBuffer(1, floats.length, OUTPUT_SAMPLE_RATE);
      buffer.copyToChannel(floats, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startAt = Math.max(now, playbackTimeRef.current);
      source.start(startAt);
      playbackTimeRef.current = startAt + buffer.duration;
    } catch (err) {
      console.error("[voice] playAudioChunk failed", err);
    }
  }, []);

  const stop = useCallback(() => {
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    inputCtxRef.current?.close().catch(() => {});
    inputCtxRef.current = null;
    outputCtxRef.current?.close().catch(() => {});
    outputCtxRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
      wsRef.current.close();
    }
    wsRef.current = null;
    playbackTimeRef.current = 0;
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (status !== "idle" && status !== "error") return;
    setErrorMessage(null);
    setInputTranscript("");
    setOutputTranscript("");
    setStatus("connecting");
    readyRef.current = false;
    errorReceivedRef.current = false;
    audioChunkCountRef.current = 0;
    setAudioChunkCount(0);

    try {
      // Don't pin sampleRate — Safari and some Chrome configs throw on non-device rates.
      // AudioBuffers we create at OUTPUT_SAMPLE_RATE will be auto-resampled by the context.
      let outputCtx: AudioContext;
      try {
        outputCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      } catch {
        outputCtx = new AudioContext();
      }
      outputCtxRef.current = outputCtx;
      await outputCtx.resume();
      console.log("[voice] output AudioContext ready, sampleRate=", outputCtx.sampleRate, "state=", outputCtx.state);

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "start", visitorId }));
      };

      ws.onmessage = async (event) => {
        let msg: { type: string; audio?: string; text?: string; message?: string };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "ready") {
          readyRef.current = true;
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
          });
          streamRef.current = stream;

          const inputCtx = new AudioContext();
          inputCtxRef.current = inputCtx;
          await inputCtx.audioWorklet.addModule("/pcm-recorder-worklet.js");
          const source = inputCtx.createMediaStreamSource(stream);
          const worklet = new AudioWorkletNode(inputCtx, "pcm-recorder");
          workletNodeRef.current = worklet;

          worklet.port.onmessage = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const audio = bytesToBase64(e.data as ArrayBuffer);
            ws.send(JSON.stringify({ type: "audio", audio }));
          };

          source.connect(worklet);

          // Tap the same mic stream for visual reactivity
          const analyser = inputCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.7;
          source.connect(analyser);
          analyserRef.current = analyser;

          const buf = new Uint8Array(analyser.frequencyBinCount);
          let lastUpdate = 0;
          let smoothed = 0;
          const tick = (t: number) => {
            const a = analyserRef.current;
            if (!a) return;
            a.getByteTimeDomainData(buf);
            let sumSq = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sumSq += v * v;
            }
            const rms = Math.sqrt(sumSq / buf.length);
            // Soft compression — moderate speech around 0.3-0.5, loud around 0.7-0.9
            const compressed = Math.min(Math.pow(rms * 2.4, 0.7), 1);
            // Asymmetric smoothing: rise fast, fall slow (feels organic, not jittery)
            const ALPHA_RISE = 0.45;
            const ALPHA_FALL = 0.12;
            smoothed +=
              (compressed - smoothed) *
              (compressed > smoothed ? ALPHA_RISE : ALPHA_FALL);
            // Throttle UI updates ~15fps; CSS transitions handle the rest
            if (t - lastUpdate > 70) {
              setAudioLevel(smoothed);
              lastUpdate = t;
            }
            levelRafRef.current = requestAnimationFrame(tick);
          };
          levelRafRef.current = requestAnimationFrame(tick);

          setStatus("listening");
        } else if (msg.type === "audio" && msg.audio) {
          audioChunkCountRef.current += 1;
          setAudioChunkCount(audioChunkCountRef.current);
          if (audioChunkCountRef.current === 1 || audioChunkCountRef.current % 25 === 0) {
            console.log("[voice] audio chunks received:", audioChunkCountRef.current);
          }
          playAudioChunk(base64ToBytes(msg.audio));
        } else if (msg.type === "input_transcript" && msg.text) {
          setInputTranscript((prev) => prev + msg.text);
        } else if (msg.type === "output_transcript" && msg.text) {
          setOutputTranscript((prev) => prev + msg.text);
        } else if (msg.type === "turn_complete") {
          setStatus("listening");
          onTurnComplete?.();
        } else if (msg.type === "error") {
          errorReceivedRef.current = true;
          setErrorMessage(msg.message ?? "Voice session error");
          setStatus("error");
        }
      };

      ws.onerror = () => {
        setErrorMessage("WebSocket error");
        setStatus("error");
      };

      ws.onclose = () => {
        if (!readyRef.current && !errorReceivedRef.current) {
          setErrorMessage("Voice session ended before it was ready (check backend logs)");
          setStatus("error");
        }
        stop();
      };
    } catch (err) {
      console.error("[voice] start error", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to start voice session");
      setStatus("error");
      stop();
    }
  }, [status, visitorId, playAudioChunk, stop, onTurnComplete]);

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[voice] sendText called but WS not open");
      return;
    }
    ws.send(JSON.stringify({ type: "text", text }));
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { status, inputTranscript, outputTranscript, errorMessage, audioChunkCount, audioLevel, start, stop, sendText };
}
