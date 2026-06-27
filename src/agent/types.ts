export type AgentAction =
  | { kind: "click"; ref: number }
  | { kind: "type"; ref: number; text: string }
  | { kind: "scroll"; direction: "up" | "down" }
  | { kind: "ask_user"; question: string; options: string[] }
  | { kind: "done"; message: string };
