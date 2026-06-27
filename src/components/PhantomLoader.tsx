import { useEffect, useState } from "react";
import { Ghost } from "lucide-react";

const PHRASES = [
  "ფანტომი იხსენებს თქვენს საუბარს...",
  "ვაბრუნებ მეხსიერებას...",
  "ვისმენ თქვენი ბოლო ნაყიდის ისტორიას...",
  "ცოტა ხანში მზად ვიქნები...",
  "ფანტომი ფიქრობს რა გითხრათ...",
];

export default function PhantomLoader() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % PHRASES.length);
    }, 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="phantom-float text-purple-500">
          <Ghost className="h-20 w-20 drop-shadow-[0_8px_16px_rgba(168,85,247,0.4)]" strokeWidth={1.5} />
        </div>
        <div className="phantom-shadow absolute -bottom-2 h-3 w-16 rounded-full bg-purple-400 blur-md" />
      </div>
      <p
        key={idx}
        className="phantom-fade text-base font-medium text-gray-600"
      >
        {PHRASES[idx]}
      </p>
    </div>
  );
}
