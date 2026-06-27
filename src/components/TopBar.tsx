interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  cartCount: number;
  onCartToggle: () => void;
}

export default function TopBar({
  search,
  onSearchChange,
  onSearchSubmit,
  cartCount,
  onCartToggle,
}: Props) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-4 py-3">
      <span className="text-xl font-bold text-white mr-2">ფანტომი</span>

      <div className="flex flex-1 max-w-lg">
        <input
          type="text"
          placeholder="ძებნა..."
          aria-label="ძებნა"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
          className="flex-1 rounded-l bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none"
        />
        <button
          onClick={onSearchSubmit}
          aria-label="ძებნა"
          className="rounded-r bg-white px-4 py-2 text-sm font-medium text-black"
        >
          ძებნა
        </button>
      </div>

      <button
        onClick={onCartToggle}
        aria-label="კალათა"
        className="relative ml-auto rounded bg-neutral-800 px-3 py-2 text-sm text-white"
      >
        🛒 კალათა
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {cartCount}
          </span>
        )}
      </button>
    </header>
  );
}
