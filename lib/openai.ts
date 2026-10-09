import OpenAI from "openai";

const apiKey = process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY ?? "";

export const openai = new OpenAI({ apiKey });

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
export const ASSISTANT_MODEL =
  process.env.OPENAI_ASSISTANT_MODEL ?? (process.env.OPENAI_MODEL ?? "gpt-4.1-mini");