import type { Product } from "../types";

interface Props {
  product: Product;
  onAdd: (p: Product) => void;
}

export default function ProductCard({ product, onAdd }: Props) {
  return (
    <div
      data-product-id={product.id}
      className="flex flex-col rounded border border-neutral-800 bg-neutral-900 p-4"
    >
      <div className="mb-3 text-center text-5xl">{product.imageEmoji}</div>
      <h3 className="text-sm font-semibold text-white">{product.name}</h3>
      <p className="mt-1 text-xs text-neutral-400">{product.brand} · {product.category}</p>
      <p className="mt-1 text-xs text-neutral-500">{product.specs}</p>
      <div className="mt-auto flex items-end justify-between pt-3">
        <span className="text-lg font-bold text-white">{product.price} ₾</span>
        {product.inStock ? (
          <button
            onClick={() => onAdd(product)}
            aria-label={`კალათში დამატება: ${product.name}`}
            className="rounded bg-white px-3 py-1 text-xs font-medium text-black"
          >
            კალათში დამატება
          </button>
        ) : (
          <span className="text-xs text-red-400">არ არის მარაგში</span>
        )}
      </div>
    </div>
  );
}
