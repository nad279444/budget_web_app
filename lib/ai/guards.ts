/**
 * Cheap, in-process guardrails for the AI assistant input boundary.
 *
 * These are heuristic only: they cost nothing (no network, no model inference)
 * and are meant to fail fast on obvious instruction-override attempts. They are
 * NOT a security boundary — real protection lives at the tool layer, where every
 * action is validated and scoped to the requesting user.
 */

export const MAX_ASSISTANT_MESSAGE_LENGTH = 2000;

const INJECTION_PATTERNS: readonly RegExp[] = [
  /\bignore\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions?|prompts?|messages?|rules?|directions?)\b/i,
  /\bdisregard\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions?|prompts?|rules?|directions?)\b/i,
  /\b(?:reveal|print|repeat|show|leak|expose|output)\s+(?:me\s+)?(?:your\s+|the\s+)?(?:system\s*prompt|initial\s*prompt|hidden\s*instructions?|developer\s*message|original\s*instructions?)\b/i,
  /\b(?:system|developer)\s*(?:prompt|message|instructions?)\b/i,
  /\b(?:you\s+are\s+now|from\s+now\s+on\s+you\s+(?:are|will|must)|act\s+as|pretend\s+to\s+be|role-?play\s+as)\b/i,
  /\b(?:do\s+not|don'?t|never)\s+follow\s+(?:your|the)\s+(?:instructions?|rules?|guidelines?)\b/i,
  /\boverride\s+(?:the\s+)?(?:system|safety|security)\s*(?:prompt|instructions?|rules?)\b/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
];

export type MessageScreen =
  | { ok: true }
  | {
      ok: false;
      code: "EMPTY" | "TOO_LONG" | "SUSPECTED_INJECTION";
      message: string;
    };

/** Validates raw assistant input without touching the network. */
export function screenAssistantMessage(raw: unknown): MessageScreen {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, code: "EMPTY", message: "Message is required" };
  }

  if (raw.length > MAX_ASSISTANT_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: "TOO_LONG",
      message: `Message is too long (max ${MAX_ASSISTANT_MESSAGE_LENGTH} characters)`,
    };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(raw)) {
      return {
        ok: false,
        code: "SUSPECTED_INJECTION",
        message:
          "I can only help with your budget and spending, and I can't change how I work. Try something like \"I spend 300 cedis a week on groceries.\"",
      };
    }
  }

  return { ok: true };
}
