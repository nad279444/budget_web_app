"use server";

import {
  runAssistant,
  type ChatResult,
} from "@/lib/ai/assistant-core";

export async function chatWithAssistant(
  rawMessage: string
): Promise<ChatResult> {
  try {
    const data = await runAssistant(rawMessage);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}
