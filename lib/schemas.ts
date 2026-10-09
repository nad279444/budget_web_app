import { z } from "zod";

export const transactionSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: z.string().min(1, "Amount is required"),
    description: z.string().optional(),
    date: z.date({ message: "Date is required" }),
    category: z.string().min(1, "Category is required"),
    isRecurring: z.boolean().default(false),
    recurringInterval: z
      .enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isRecurring && !data.recurringInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Recurring interval is required for recurring transactions",
        path: ["recurringInterval"],
      });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionSchema>;

/** Shape accepted by createTransaction/updateTransaction after the form parses amount. */
export const transactionInputSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().optional().nullable(),
  date: z.date(),
  category: z.string().min(1),
  isRecurring: z.boolean().default(false),
  recurringInterval: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
  receiptUrl: z.string().url().optional().nullable(),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;
