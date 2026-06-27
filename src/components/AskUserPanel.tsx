interface Props {
  question: string;
  options: string[];
  onTap: (option: string) => void;
}

export default function AskUserPanel({ question, options, onTap }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-4 border-t border-neutral-700 bg-neutral-900 px-4 py-6">
      <p className="text-center text-lg text-white">{question}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onTap(opt)}
            aria-label={opt}
            className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
