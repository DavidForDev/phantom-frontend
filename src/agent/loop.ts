import type { AgentAction } from "./types";
import type { PageElement } from "./perception";
import { scanPage, serializeForLLM } from "./perception";
import { executeAction } from "./executor";

const API = import.meta.env.VITE_API_URL;

export interface AgentStep {
  elements: string;
  action: AgentAction;
  userAnswer?: string; // filled after ask_user is answered
}

export type OnAskUser = (
  question: string,
  options: string[]
) => Promise<string>;

export type OnStep = (step: AgentStep & { thought?: string }) => void;

// ── LLM-backed getNextAction via backend ──

async function getNextActionFromBackend(
  goal: string,
  elements: PageElement[],
  history: AgentStep[]
): Promise<AgentAction> {
  const serialized = serializeForLLM(elements);

  const res = await fetch(`${API}/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      goal,
      elements: serialized,
      history: history.map((s) => ({
        elements: s.elements,
        action: s.action,
        userAnswer: s.userAnswer,
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(`Backend returned ${res.status}`);
  }

  return res.json();
}

// ── Ref guardrail ──

function validateRef(action: AgentAction, elements: PageElement[]): boolean {
  if ("ref" in action && action.ref !== undefined) {
    return elements.some((e) => e.ref === action.ref);
  }
  return true;
}

const FALLBACK: AgentAction = {
  kind: "ask_user",
  question: "რა ტიპის პროდუქტი გაინტერესებთ?",
  options: ["ლეპტოპი", "ტელეფონი", "ყურსასმენი", "ტაბლეტი"],
};

// ── Main loop with pause/resume ──

export async function runAgent(
  initialGoal: string,
  onAskUser: OnAskUser,
  onStep?: OnStep
): Promise<AgentStep[]> {
  const history: AgentStep[] = [];
  const MAX_STEPS = 25;
  let goal = initialGoal;

  for (let i = 0; i < MAX_STEPS; i++) {
    await new Promise((r) => setTimeout(r, 300));

    let elements = scanPage();
    const serialized = serializeForLLM(elements);
    console.log(
      `[loop] step ${i + 1}, ${elements.length} elements, goal: "${goal}"`
    );

    let action: AgentAction;
    try {
      action = await getNextActionFromBackend(goal, elements, history);
    } catch (err) {
      console.error("[loop] backend error, falling back:", err);
      action = FALLBACK;
    }

    // Ref guardrail
    if (!validateRef(action, elements)) {
      console.warn(`[loop] invalid ref ${(action as any).ref}, re-scanning...`);
      await new Promise((r) => setTimeout(r, 200));
      elements = scanPage();
      if (!validateRef(action, elements)) {
        console.warn("[loop] ref still invalid, falling back");
        action = FALLBACK;
      }
    }

    console.log(`[loop] action:`, action);

    const step: AgentStep = { elements: serialized, action };
    history.push(step);
    onStep?.({ ...step, thought: (action as any).thought });

    if (action.kind === "ask_user") {
      // PAUSE: surface question to UI, wait for tap
      const answer = await onAskUser(action.question, action.options);
      console.log(`[loop] user answered: "${answer}"`);
      step.userAnswer = answer;
      // Enrich the goal with the user's answer
      goal = `${goal}. მომხმარებელმა აირჩია: ${answer}`;
      // Continue loop — don't break
      continue;
    }

    if (action.kind === "done") {
      await executeAction(action);
      break;
    }

    await executeAction(action);
  }

  return history;
}
