interface Props {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (c: string) => void;
}

export default function Filters({
  categories,
  activeCategory,
  onCategoryChange,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-neutral-800 px-4 py-3">
      <button
        onClick={() => onCategoryChange("")}
        aria-label="ყველა კატეგორია"
        className={`rounded-full px-3 py-1 text-sm ${
          activeCategory === ""
            ? "bg-white text-black"
            : "bg-neutral-800 text-neutral-300"
        }`}
      >
        ყველა
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onCategoryChange(cat)}
          aria-label={`კატეგორია: ${cat}`}
          className={`rounded-full px-3 py-1 text-sm ${
            activeCategory === cat
              ? "bg-white text-black"
              : "bg-neutral-800 text-neutral-300"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
