export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageElement {
  ref: number;
  tag: string;
  type: string | null;
  label: string;
  value: string;
  rect: ElementRect;
  productId?: string;
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[data-product-id]",
].join(",");

// Keep a ref→node map so the executor can retrieve DOM nodes later
let refMap: Map<number, Element> = new Map();

function isVisible(el: Element): boolean {
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function extractLabel(el: Element): string {
  // 1. aria-label
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.trim();

  // 2. visible innerText (short — first 80 chars)
  const text = (el as HTMLElement).innerText?.trim();
  if (text) return text.slice(0, 80);

  // 3. placeholder (inputs)
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) return placeholder.trim();

  // 4. title
  const title = el.getAttribute("title");
  if (title) return title.trim();

  // 5. value (for inputs with pre-filled values)
  const val = (el as HTMLInputElement).value;
  if (val) return val.trim().slice(0, 80);

  return "";
}

function extractValue(el: Element): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return el.value;
  }
  return "";
}

function findProductId(el: Element): string | undefined {
  // Walk up to find closest data-product-id
  const card = el.closest("[data-product-id]");
  if (card) return card.getAttribute("data-product-id") ?? undefined;
  return undefined;
}

export function scanPage(): PageElement[] {
  refMap = new Map();
  const seen = new Set<Element>();
  const results: PageElement[] = [];
  let ref = 0;

  const candidates = document.querySelectorAll(INTERACTIVE_SELECTOR);

  for (const el of candidates) {
    if (seen.has(el)) continue;
    seen.add(el);

    // Skip the debug button itself
    if (el.getAttribute("data-debug") === "perception") continue;

    if (!isVisible(el)) continue;

    const r = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();

    const entry: PageElement = {
      ref,
      tag,
      type: el.getAttribute("type"),
      label: extractLabel(el),
      value: extractValue(el),
      rect: {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
      },
    };

    const pid = findProductId(el);
    if (pid) entry.productId = pid;

    refMap.set(ref, el);
    results.push(entry);
    ref++;
  }

  return results;
}

export function getElementByRef(ref: number): Element | undefined {
  return refMap.get(ref);
}

export function serializeForLLM(elements: PageElement[]): string {
  return elements
    .map((el) => {
      let line = `[${el.ref}] ${el.tag}`;
      if (el.type) line += `(${el.type})`;
      line += `  "${el.label}"`;
      if (el.value) line += `  value="${el.value}"`;
      if (el.productId) line += `  (productId: ${el.productId})`;
      return line;
    })
    .join("\n");
}
