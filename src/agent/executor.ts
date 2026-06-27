import type { AgentAction } from "./types";
import { getElementByRef } from "./perception";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function executeAction(action: AgentAction): Promise<void> {
  switch (action.kind) {
    case "type": {
      const el = getElementByRef(action.ref);
      if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        console.warn(`[executor] ref ${action.ref} is not a typeable element`);
        return;
      }
      el.focus();
      // Use the native setter so React's synthetic onChange fires
      const nativeSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(el),
        "value"
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, action.text);
      } else {
        el.value = action.text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      console.log(`[executor] type "${action.text}" into ref ${action.ref}`);
      await delay(400);
      break;
    }

    case "click": {
      const el = getElementByRef(action.ref);
      if (!el) {
        console.warn(`[executor] ref ${action.ref} not found`);
        return;
      }
      (el as HTMLElement).click();
      console.log(`[executor] click ref ${action.ref}`);
      await delay(600);
      break;
    }

    case "scroll": {
      const amount = action.direction === "down" ? 400 : -400;
      window.scrollBy({ top: amount, behavior: "smooth" });
      console.log(`[executor] scroll ${action.direction}`);
      await delay(500);
      break;
    }

    case "ask_user":
    case "done":
      // No DOM action — control returns to the loop/UI
      console.log(`[executor] ${action.kind}: ${action.kind === "done" ? action.message : action.question}`);
      break;
  }
}
