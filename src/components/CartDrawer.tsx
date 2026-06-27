import type { CartItem } from "../types";

interface Props {
  items: CartItem[];
  onClose: () => void;
  onRemove: (productId: number) => void;
}

export default function CartDrawer({ items, onClose, onRemove }: Props) {
  const total = items.reduce((s, i) => s + i.product.price * i.qty, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-neutral-950 border-l border-neutral-800 p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">კალათა</h2>
          <button
            onClick={onClose}
            aria-label="კალათის დახურვა"
            className="text-neutral-400 text-xl"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-neutral-500 text-sm">კალათა ცარიელია</p>
        ) : (
          <>
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.product.id}
                  className="flex items-center justify-between rounded bg-neutral-900 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item.product.imageEmoji} {item.product.name}</p>
                    <p className="text-xs text-neutral-400">
                      {item.qty} × {item.product.price} ₾
                    </p>
                  </div>
                  <button
                    onClick={() => onRemove(item.product.id)}
                    aria-label={`წაშლა: ${item.product.name}`}
                    className="ml-3 text-xs text-red-400"
                  >
                    წაშლა
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-neutral-800 pt-4 flex justify-between">
              <span className="text-sm text-neutral-300">ჯამი:</span>
              <span className="text-lg font-bold text-white">{total} ₾</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
