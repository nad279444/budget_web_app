import { z } from "zod";
import { defaultCategories } from "@/data/categories";

export const expenseCategoryIds = defaultCategories
  .filter((category) => category.type === "EXPENSE")
  .map((category) => category.id) as [string, ...string[]];

export const incomeCategoryIds = defaultCategories
  .filter((category) => category.type === "INCOME")
  .map((category) => category.id) as [string, ...string[]];

export const frequencySchema = z.enum([
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
  "once",
]);

export const calculatorArgsSchema = z.object({
  expression: z
    .string()
    .min(2, "Expression must not be empty")
    .max(300, "Expression is too long")
    .describe(
      "Arithmetic expression using + - * / % and parentheses, numbers only. Example: (1800+300*52/12)"
    ),
  note: z
    .string()
    .min(10, "Explain what this calculation is for")
    .max(240, "Explanation is too long")
    .describe(
      "One plain-English clause explaining this step, in the user's own wording and currency. " +
        "It is printed as '<note>: <expression> = <result>', so do NOT end it with a colon, " +
        "a full stop, or the RESULT number. Example: \"Your weekly groceries of 300 cedis convert to a monthly figure\""
    ),
});

export const createBudgetArgsSchema = z.object({
  totalMonthlyAmount: z
    .number()
    .positive("Budget must be greater than zero")
    .max(100_000_000, "Budget amount is unreasonably large")
    .describe("Proposed total monthly budget in the user's currency"),
});

export const createTransactionArgsSchema = z
  .object({
    type: z
      .enum(["INCOME", "EXPENSE"])
      .describe("Whether this is money in (INCOME) or money out (EXPENSE)"),
    amount: z
      .number()
      .positive("Amount must be greater than zero")
      .describe("The exact amount in the user's currency"),
    description: z
      .string()
      .min(1)
      .max(300)
      .nullable()
      .describe("Short description or merchant name, e.g. 'Groceries at Shoprite'"),
    category: z
      .string()
      .min(1)
      .describe("One of the valid category ids from the expense/income category map"),
    date: z
      .string()
      .nullable()
      .describe("The date of the transaction as an ISO string (YYYY-MM-DD). Defaults to today"),
  })
  .superRefine((data, ctx) => {
    const ids = data.type === "EXPENSE" ? expenseCategoryIds : incomeCategoryIds;
    if (!ids.includes(data.category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: `Must be one of: ${ids.join(", ")}`,
      });
    }
  });

export const spendingHabitSchema = z.object({
  category: z.enum(expenseCategoryIds, { error: "Must be a valid expense category" }),
  amount: z
    .number()
    .nonnegative()
    .describe("How much is spent per period, in the user's currency"),
  frequency: frequencySchema.describe("How often this expense occurs"),
  monthlyEquivalent: z
    .number()
    .nonnegative()
    .describe("The amount normalized to a monthly value in the user's currency"),
});

export const assistantInsightsSchema = z.object({
  topCategory: z
    .string()
    .max(400)
    .nullable()
    .describe(
      "Which category eats the most money, with its amount and its share of total spending, " +
        "taken verbatim from the spending context. Null when there are no recorded transactions."
    ),
  savingsLeft: z
    .string()
    .max(400)
    .nullable()
    .describe(
      "How much is left to put away each month after expenses, copied verbatim from the " +
        "spending context (monthly income minus monthly expenses) and written in the user's currency. " +
        "Null when income is unknown — never estimate it."
    ),
  whereToSave: z
    .string()
    .max(400)
    .nullable()
    .describe(
      "One concrete place to park that leftover money (emergency fund, high-yield savings, " +
        "debt payoff, etc.) chosen for this user's situation. No invented rates or returns."
    ),
});

export const assistantReplySchema = z.object({
  summary: z
    .string()
    .min(5, "Reply is too short")
    .max(1500, "Reply is too long")
    .describe(
      "Your main reply to the user in Savvy Sal's voice. Write this FIRST — it is streamed " +
        "to the user while the rest of the structured reply is still being generated."
    ),
  reasoning: z
    .string()
    .min(1, "Reply must include your step-by-step calculation")
    .max(2400, "Reasoning is too long")
    .describe(
      "Chain-of-thought used to compute the budget, written for the user: one sentence per " +
        "calculator call stating the expense in the user's currency, followed by the exact " +
        "expression and its result (e.g. \"Your weekly groceries of 300 cedis convert to a " +
        "monthly figure: 300 × 52 ÷ 12 = 1,300 cedis.\"). This mirrors the calculator calls " +
        "you actually ran, ending with the total."
    ),
  habits: z
    .array(spendingHabitSchema)
    .describe(
      "EXACT list of the spending habits the user mentioned, one entry per mentioned " +
        "expense and never any extra entries. Use the user's exact amounts and the " +
        "calculator-confirmed monthly equivalents. Do not build an allocation or pad the list."
    ),
  proposedMonthlyBudget: z
    .number()
    .nullable()
    .describe("The monthly budget you proposed, or null if none"),
  monthlyBudgetSaved: z
    .boolean()
    .describe("True only if the create_budget tool call actually succeeded"),
  insights: assistantInsightsSchema.describe(
    "Three insights for the user: what they spend the most on, how much is left to save, " +
      "and where to put those savings"
  ),
  savingsTip: z
    .string()
    .nullable()
    .describe(
      "One specific, actionable way the user can save money — ideally aimed at their " +
        "biggest spending category, written in their currency"
    ),
});

export const assistantMessageSchema = z
  .string()
  .min(1, "Message is required")
  .max(2000, "Message is too long");

export const receiptScanSchema = z.object({
  amount: z.number().nonnegative().describe("The total amount paid"),
  date: z.string().describe("The receipt date as an ISO string"),
  description: z.string().describe("Brief summary of items purchased"),
  merchantName: z.string().describe("The merchant or store name"),
  category: z.enum(expenseCategoryIds, { error: "Must be a valid expense category" }),
});

export const insightsSchema = z
  .array(z.string())
  .length(3, "Expected exactly 3 insights");

export const userReplySchema = z.object({
  message: z.string().min(1).max(1500),
});

export type Frequency = z.infer<typeof frequencySchema>;
export type SpendingHabit = z.infer<typeof spendingHabitSchema>;
export type AssistantInsights = z.infer<typeof assistantInsightsSchema>;
export type AssistantReply = z.infer<typeof assistantReplySchema>;