"use server";

import OpenAI from "openai";
import { zodResponsesFunction, zodTextFormat } from "openai/helpers/zod";
import { revalidatePath } from "next/cache";
import {
  assistantMessageSchema,
  assistantReplySchema,
  calculatorArgsSchema,
  createBudgetArgsSchema,
  type AssistantReply,
} from "@/lib/ai/schemas";
import { tryEvaluateExpression } from "@/lib/ai/calculator";
import { buildAssistantSystemPrompt } from "@/lib/ai/persona";
import { formatMathStep } from "@/lib/ai/reasoning";
import { describeCurrency, detectCurrency, formatMoney, type Currency } from "@/lib/ai/currency";
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
];

type ChatResult = ActionResult<
  AssistantReply & { budgetSaved: boolean; currency: Currency }
>;

export async function chatWithAssistant(
  rawMessage: string
): Promise<ChatResult> {
  try {
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
    const mathSteps: string[] = [];
    let lastCalcResult: number | undefined;
    // history keeps the FULL conversation (system + user + every tool call and
    // result) so the final structured parse has all the context it needs.
    const history: OpenAI.Responses.ResponseInputItem[] = [...input];
    const MAX_ROUNDS = 8;

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
        // Final assistant message: keep it in history for the parse.
        history.push(...(response.output as OpenAI.Responses.ResponseInputItem[]));
        break;
      }

      const toolOutputs: OpenAI.Responses.ResponseInputItem[] = [];
      for (const call of calls) {
        const output = await executeTool(call.name, call.arguments);
        if (call.name === "create_budget" && output.saved) {
          budgetSaved = true;
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

    const final = await openai.responses.parse({
      model: ASSISTANT_MODEL,
      input: history,
      text: { format: zodTextFormat(assistantReplySchema, "assistant_reply") },
    });

    const parsed = final.output_parsed;
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
      success: true,
      data: {
        ...parsed,
        reasoning,
        proposedMonthlyBudget,
        budgetSaved: savedBudget,
        currency,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}

async function executeTool(
  name: string,
  rawArguments: string
): Promise<{ result?: number; error?: string; saved?: boolean; totalMonthlyAmount?: number }> {
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