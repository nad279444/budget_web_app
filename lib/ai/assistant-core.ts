import OpenAI from "openai";
import { zodResponsesFunction, zodTextFormat } from "openai/helpers/zod";
import { revalidatePath } from "next/cache";
import {
  assistantMessageSchema,
  calculatorArgsSchema,
  createBudgetArgsSchema,
  createTransactionArgsSchema,
  assistantReplySchema,
  type AssistantReply,
} from "@/lib/ai/schemas";
import { tryEvaluateExpression } from "@/lib/ai/calculator";
import { buildAssistantSystemPrompt } from "@/lib/ai/persona";
import { formatMathStep } from "@/lib/ai/reasoning";
import {
  describeCurrency,
  detectCurrency,
  formatMoney,
  type Currency,
} from "@/lib/ai/currency";
import { ASSISTANT_MODEL, openai } from "@/lib/openai";
import { db } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

const TOOLS = [
  zodResponsesFunction({
    name: "calculator",
    description:
      "Performs exact arithmetic. Use it for EVERY calculation: converting weekly/daily amounts to monthly, summing expenses, computing savings targets. Every call needs a `note` sentence explaining the step in the user's own currency.",
    parameters: calculatorArgsSchema,
  }),
  zodResponsesFunction({
    name: "create_budget",
    description:
      "Saves the user's proposed total monthly budget to their account (replaces any existing budget). Call it once you have a final monthly budget amount.",
    parameters: createBudgetArgsSchema,
  }),
  zodResponsesFunction({
    name: "create_transaction",
    description:
      "Records an already-happened expense or income the user reported with an exact amount (e.g. 'I spent 250 cedis on groceries'). Amounts are in the user's currency. Does NOT create the monthly budget — that is create_budget.",
    parameters: createTransactionArgsSchema,
  }),
];

export type AssistantResult = AssistantReply & {
  budgetSaved: boolean;
  transactionsRecorded: number;
  currency: Currency;
};

export type ChatResult = ActionResult<AssistantResult>;

/** Hooks the transport layer (server action or SSE route) can subscribe to. */
export type AssistantCallbacks = {
  /** Human-readable progress updates emitted between model/tool rounds. */
  onStatus?: (message: string) => void;
  /** The user-facing summary as it streams in (always the full text so far). */
  onSummary?: (summarySoFar: string) => void;
};

/**
 * Runs the full assistant pipeline: tool-calling loop for math/persistence,
 * then a streamed structured reply. Streaming the final structured output lets
 * the transport show the summary to the user before the whole object is done.
 */
export async function runAssistant(
  rawMessage: string,
  callbacks: AssistantCallbacks = {}
): Promise<AssistantResult> {
  const message = assistantMessageSchema.parse(rawMessage);
  const userId = await requireUserId();

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const currency = detectCurrency(message);
  const spendingContext = await buildSpendingContext(userId, currency);
  const systemPrompt = buildAssistantSystemPrompt(
    new Date().toDateString(),
    user.name,
    spendingContext,
    describeCurrency(currency)
  );

  let input: OpenAI.Responses.ResponseInputItem[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ];

  let budgetSaved = false;
  let transactionsRecorded = 0;
  const mathSteps: string[] = [];
  let lastCalcResult: number | undefined;
  // history keeps the FULL conversation (system + user + every tool call and
  // result) so the final structured parse has all the context it needs.
  const history: OpenAI.Responses.ResponseInputItem[] = [...input];
  const MAX_ROUNDS = 8;

  callbacks.onStatus?.("Reading your message…");

  let response = await openai.responses.create({
    model: ASSISTANT_MODEL,
    input,
    tools: TOOLS,
    tool_choice: "auto",
  });

  // Tool-calling loop. The model may need several calculator rounds before
  // saving a budget. Every function call MUST be answered before the next
  // request (and before the final parse) or the API rejects the input.
  for (let round = 0; ; round++) {
    const calls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call"
    );

    if (calls.length === 0) {
      history.push(...(response.output as OpenAI.Responses.ResponseInputItem[]));
      break;
    }

    callbacks.onStatus?.(
      round === 0 ? "Running the numbers…" : "Still crunching…"
    );

    const toolOutputs: OpenAI.Responses.ResponseInputItem[] = [];
    for (const call of calls) {
      const output = await executeTool(call.name, call.arguments);
      if (call.name === "create_budget" && output.saved) {
        budgetSaved = true;
        revalidatePath("/dashboard");
      }
      if (call.name === "create_transaction" && output.saved) {
        transactionsRecorded += 1;
        revalidatePath("/dashboard");
      }
      if (call.name === "calculator" && typeof output.result === "number") {
        lastCalcResult = output.result;
        try {
          const args = calculatorArgsSchema.parse(
            JSON.parse(call.arguments) as unknown
          );
          mathSteps.push(
            formatMathStep(args.expression, args.note, output.result, currency)
          );
        } catch {
          // ignore unparseable arguments
        }
      }
      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(output),
      });
    }

    history.push(
      ...(response.output as OpenAI.Responses.ResponseInputItem[]),
      ...toolOutputs
    );

    if (round >= MAX_ROUNDS) break;

    input = [
      ...(response.output as OpenAI.Responses.ResponseInputItem[]),
      ...toolOutputs,
    ];
    response = await openai.responses.create({
      model: ASSISTANT_MODEL,
      input,
      tools: TOOLS,
      tool_choice: "auto",
    });
  }

  callbacks.onStatus?.("Writing your answer…");

  // Stream the final structured reply so the transport can render the summary
  // as soon as its characters arrive instead of waiting for the full object.
  const replyStream = openai.responses.stream({
    model: ASSISTANT_MODEL,
    input: history,
    text: { format: zodTextFormat(assistantReplySchema, "assistant_reply") },
  });

  let jsonText = "";
  let lastSummary = "";
  for await (const event of replyStream) {
    if (event.type === "response.output_text.delta") {
      jsonText += event.delta;
      const summary = extractStreamingSummary(jsonText);
      if (summary && summary !== lastSummary) {
        lastSummary = summary;
        callbacks.onSummary?.(summary);
      }
    }
  }

  const final = await replyStream.finalResponse();
  const parsed = final.output_parsed as AssistantReply | null;
  if (!parsed) {
    throw new Error("The assistant did not produce a structured reply");
  }

  // The chain-of-thought shown to the user is the ACTUAL calculator calls the
  // model executed (ground truth), not the model's own prose.
  let reasoning =
    mathSteps.length > 0 ? mathSteps.join("\n") : parsed.reasoning;

  // Prefer the model's proposed budget, but fall back to the concrete result
  // of its final calculator call. We deliberately do NOT sum the free-form
  // habits: their monthly equivalents are not calculator-verified and can be
  // wrong even when the budget total is right.
  let proposedMonthlyBudget =
    parsed.proposedMonthlyBudget ?? lastCalcResult ?? null;

  if (
    proposedMonthlyBudget !== null &&
    lastCalcResult !== undefined &&
    Math.abs(proposedMonthlyBudget - lastCalcResult) > 1
  ) {
    reasoning += `\nVerified calculator total: ${formatMoney(lastCalcResult, currency)}`;
    proposedMonthlyBudget = lastCalcResult;
  }

  // Persist the budget whenever a positive total exists, so the feature
  // always works even if the model forgot the create_budget tool call.
  let savedBudget = budgetSaved || parsed.monthlyBudgetSaved;
  if (proposedMonthlyBudget !== null && proposedMonthlyBudget > 0) {
    await db.budget.upsert({
      where: { userId },
      update: { amount: proposedMonthlyBudget },
      create: { userId, amount: proposedMonthlyBudget },
    });
    savedBudget = true;
    revalidatePath("/dashboard");
  }

  return {
    ...parsed,
    reasoning,
    proposedMonthlyBudget,
    budgetSaved: savedBudget,
    transactionsRecorded,
    currency,
  };
}

/**
 * The structured reply is streamed as JSON. `summary` is the first property, so
 * we can pull the growing string value straight out of the partial JSON without
 * a full parse. Tolerates incomplete escapes and returns the decoded text.
 */
export function extractStreamingSummary(snapshot: string): string {
  const key = snapshot.indexOf('"summary"');
  if (key === -1) return "";
  const colon = snapshot.indexOf(":", key);
  if (colon === -1) return "";

  let i = colon + 1;
  while (i < snapshot.length && /\s/.test(snapshot[i])) i++;
  if (snapshot[i] !== '"') return "";
  i++;

  let raw = "";
  for (; i < snapshot.length; i++) {
    const ch = snapshot[i];
    if (ch === "\\") {
      if (i + 1 >= snapshot.length) return decodeJsonString(raw);
      raw += snapshot[i + 1];
      i++;
      continue;
    }
    if (ch === '"') break;
    raw += ch;
  }

  return decodeJsonString(raw);
}

function decodeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

async function executeTool(
  name: string,
  rawArguments: string
): Promise<{
  result?: number;
  error?: string;
  saved?: boolean;
  totalMonthlyAmount?: number;
  amount?: number;
  type?: string;
  category?: string;
  description?: string;
  date?: string;
}> {
  try {
    const parsed = JSON.parse(rawArguments) as unknown;

    if (name === "calculator") {
      const args = calculatorArgsSchema.parse(parsed);
      const evaluated = tryEvaluateExpression(args.expression);
      if (!evaluated.ok) return { error: evaluated.error };
      return { result: evaluated.result };
    }

    if (name === "create_budget") {
      const args = createBudgetArgsSchema.parse(parsed);
      const userId = await requireUserId();
      await db.budget.upsert({
        where: { userId },
        update: { amount: args.totalMonthlyAmount },
        create: { userId, amount: args.totalMonthlyAmount },
      });
      return { saved: true, totalMonthlyAmount: args.totalMonthlyAmount };
    }

    if (name === "create_transaction") {
      const args = createTransactionArgsSchema.parse(parsed);
      const userId = await requireUserId();
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return { error: "User not found" };

      const date = args.date ? new Date(args.date) : new Date();
      if (Number.isNaN(date.getTime())) return { error: "Invalid date" };

      await db.transaction.create({
        data: {
          type: args.type,
          amount: args.amount,
          description: args.description ?? null,
          date,
          category: args.category,
          userId: user.id,
        },
      });

      return {
        saved: true,
        amount: args.amount,
        type: args.type,
        category: args.category,
        description: args.description ?? "",
        date: date.toISOString(),
      };
    }

    return { error: `Unknown tool: ${name}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid tool arguments",
    };
  }
}

async function buildSpendingContext(
  userId: string,
  currency: Currency
): Promise<string> {
  const since = new Date();
  since.setDate(1);
  since.setMonth(since.getMonth() - 2);

  const transactions = await db.transaction.findMany({
    where: { userId, date: { gte: since } },
    select: { type: true, amount: true, category: true, date: true },
    orderBy: { date: "desc" },
  });

  if (transactions.length === 0) return "";

  const byCategory = new Map<string, number>();
  const monthsSeen = new Set<string>();
  let totalExpense = 0;
  let totalIncome = 0;

  for (const transaction of transactions) {
    const amount = transaction.amount.toNumber();
    monthsSeen.add(
      `${transaction.date.getFullYear()}-${transaction.date.getMonth()}`
    );
    if (transaction.type === "EXPENSE") {
      byCategory.set(
        transaction.category,
        (byCategory.get(transaction.category) ?? 0) + amount
      );
      totalExpense += amount;
    } else {
      totalIncome += amount;
    }
  }

  const money = (value: number) => formatMoney(value, currency);
  const monthCount = Math.max(1, monthsSeen.size);
  const monthlyIncome = totalIncome / monthCount;
  const monthlyExpense = totalExpense / monthCount;
  const savingsLeft = totalIncome > 0 ? monthlyIncome - monthlyExpense : null;

  const sortedCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const [topCategory, topAmount] = sortedCategories[0] ?? ["", 0];

  const lines = [
    `- Months covered: ${monthCount} (from ${transactions.length} transactions)`,
    `- Total income over that period: ${money(totalIncome)}`,
    `- Total expenses over that period: ${money(totalExpense)}`,
    `- Monthly average income: ${money(monthlyIncome)}`,
    `- Monthly average expenses: ${money(monthlyExpense)}`,
    `- Money left to save each month (income - expenses): ${
      savingsLeft === null
        ? "unknown — no income recorded, so ask the user for their monthly income"
        : money(savingsLeft)
    }`,
    `- Expenses by category over that period: ${
      sortedCategories.length > 0
        ? sortedCategories
            .map(([category, amount]) => `${category}: ${money(amount)}`)
            .join(", ")
        : "none"
    }`,
  ];

  if (topCategory && totalExpense > 0) {
    const share = Math.round((topAmount / totalExpense) * 100);
    lines.push(
      `- Biggest expense: ${topCategory} at ${money(topAmount)}, ${share}% of everything spent`
    );
  }

  return lines.join("\n");
}
