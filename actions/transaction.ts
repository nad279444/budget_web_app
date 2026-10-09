"use server";

import { requireUserId } from "@/lib/session";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { zodTextFormat } from "openai/helpers/zod";
import { receiptScanSchema } from "@/lib/ai/schemas";
import { OPENAI_MODEL, openai } from "@/lib/openai";
import { rateLimit } from "@/lib/arcjet";
import { request } from "@arcjet/next";
import { serializeTransaction, serializeTransactions } from "@/lib/serialize";
import { transactionInputSchema } from "@/lib/schemas";
import type { TransactionInput } from "@/lib/schemas";
import type { ActionResult, SerializedTransaction } from "@/lib/types";
import type { RecurringInterval, TransactionType } from "@prisma/client";

// Create Transaction
export async function createTransaction(
  rawData: TransactionInput
): Promise<ActionResult<SerializedTransaction>> {
  try {
    const data = transactionInputSchema.parse(rawData);

    const userId = await requireUserId();

    // Get request data for ArcJet
    const req = await request();

    // Check rate limit
    const decision = await rateLimit(req, {
      userId,
      requested: 1, // Specify how many tokens to consume
    });

    if (decision?.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const { remaining, reset } = decision.reason;
        console.error({
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            remaining,
            resetInSeconds: reset,
          },
        });

        throw new Error("Too many requests. Please try again later.");
      }

      throw new Error("Request blocked");
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const transaction = await db.transaction.create({
      data: {
        type: data.type,
        amount: data.amount,
        description: data.description ?? null,
        date: data.date,
        category: data.category,
        isRecurring: data.isRecurring,
        recurringInterval: data.recurringInterval ?? null,
        userId: user.id,
        nextRecurringDate:
          data.isRecurring && data.recurringInterval
            ? calculateNextRecurringDate(data.date, data.recurringInterval)
            : null,
      },
    });

    revalidatePath("/dashboard");

    return { success: true, data: serializeTransaction(transaction) };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
}

export async function getTransaction(
  id: string
): Promise<SerializedTransaction> {
  const userId = await requireUserId();

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) throw new Error("User not found");

  const transaction = await db.transaction.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!transaction) throw new Error("Transaction not found");

  return serializeTransaction(transaction);
}

export async function updateTransaction(
  id: string,
  rawData: TransactionInput
): Promise<ActionResult<SerializedTransaction>> {
  try {
    const data = transactionInputSchema.parse(rawData);

    const userId = await requireUserId();

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new Error("User not found");

    const transaction = await db.transaction.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!transaction) throw new Error("Transaction not found");

    const updated = await db.transaction.update({
      where: {
        id,
        userId: user.id,
      },
      data: {
        type: data.type,
        amount: data.amount,
        description: data.description ?? null,
        date: data.date,
        category: data.category,
        isRecurring: data.isRecurring,
        recurringInterval: data.recurringInterval ?? null,
        nextRecurringDate:
          data.isRecurring && data.recurringInterval
            ? calculateNextRecurringDate(data.date, data.recurringInterval)
            : null,
      },
    });

    revalidatePath("/dashboard");

    return { success: true, data: serializeTransaction(updated) };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
}

// Get User Transactions
export async function getUserTransactions(
  query: Record<string, unknown> = {}
): Promise<ActionResult<SerializedTransaction[]>> {
  try {
    const userId = await requireUserId();

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const transactions = await db.transaction.findMany({
      where: {
        userId: user.id,
        ...query,
      },
      orderBy: {
        date: "desc",
      },
    });

    return {
      success: true,
      data: serializeTransactions(transactions),
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
}

// Delete transactions
export async function bulkDeleteTransactions(
  transactionIds: string[]
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new Error("User not found");

    await db.transaction.deleteMany({
      where: {
        id: { in: transactionIds },
        userId: user.id,
      },
    });

    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export type ScannedReceipt = {
  amount: number;
  date: Date;
  description: string;
  category: string;
  merchantName: string;
};

// Scan Receipt
export async function scanReceipt(file: File): Promise<ScannedReceipt> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
      Analyze this receipt image and extract the following information:
      - Total amount (just the number)
      - Date (in ISO format)
      - Description or items purchased (brief summary)
      - Merchant/store name
      - Suggested category (one of: ${receiptScanSchema.shape.category.options})

      If it's not a receipt, return an empty object.
    `;

    const response = await openai.responses.parse({
      model: OPENAI_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: `data:${file.type || "image/jpeg"};base64,${base64String}`,
              detail: "high",
            },
          ],
        },
      ],
      text: { format: zodTextFormat(receiptScanSchema, "receipt") },
    });

    const data = response.output_parsed;
    if (!data) {
      throw new Error("Invalid response format from the AI");
    }

    return {
      amount: data.amount,
      date: new Date(data.date),
      description: data.description,
      category: data.category,
      merchantName: data.merchantName,
    };
  } catch (error) {
    console.error("Error scanning receipt:", error);
    throw new Error("Failed to scan receipt");
  }
}

// Helper function to calculate next recurring date
function calculateNextRecurringDate(
  startDate: Date | string,
  interval: RecurringInterval
): Date {
  const date = new Date(startDate);

  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date;
}

export type { TransactionType };