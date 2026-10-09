"use server";

import { db } from "@/lib/prisma";
import { subDays } from "date-fns";
import type { TransactionType } from "@prisma/client";

const USER_ID = "65794a34-f1b2-4610-ab22-c90e416ea2cc"; // put user id from database

// Categories with their typical amount ranges
const CATEGORIES: Record<
  TransactionType,
  { name: string; range: [number, number] }[]
> = {
  INCOME: [
    { name: "salary", range: [5000, 8000] },
    { name: "freelance", range: [1000, 3000] },
    { name: "investments", range: [500, 2000] },
    { name: "other-income", range: [100, 1000] },
  ],
  EXPENSE: [
    { name: "housing", range: [1000, 2000] },
    { name: "transportation", range: [100, 500] },
    { name: "groceries", range: [200, 600] },
    { name: "utilities", range: [100, 300] },
    { name: "entertainment", range: [50, 200] },
    { name: "food", range: [50, 150] },
    { name: "shopping", range: [100, 500] },
    { name: "healthcare", range: [100, 1000] },
    { name: "education", range: [200, 1000] },
    { name: "travel", range: [500, 2000] },
  ],
};

function getRandomAmount(min: number, max: number): number {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function getRandomCategory(type: TransactionType): {
  category: string;
  amount: number;
} {
  const categories = CATEGORIES[type];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const amount = getRandomAmount(category.range[0], category.range[1]);
  return { category: category.name, amount };
}

export async function seedTransactions(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // Generate 90 days of transactions
    const transactions: {
      id: string;
      type: TransactionType;
      amount: number;
      description: string;
      date: Date;
      category: string;
      status: "COMPLETED";
      userId: string;
      createdAt: Date;
      updatedAt: Date;
    }[] = [];

    for (let i = 90; i >= 0; i--) {
      const date = subDays(new Date(), i);

      // Generate 1-3 transactions per day
      const transactionsPerDay = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < transactionsPerDay; j++) {
        // 40% chance of income, 60% chance of expense
        const type: TransactionType =
          Math.random() < 0.4 ? "INCOME" : "EXPENSE";
        const { category, amount } = getRandomCategory(type);

        const transaction = {
          id: crypto.randomUUID(),
          type,
          amount,
          description: `${
            type === "INCOME" ? "Received" : "Paid for"
          } ${category}`,
          date,
          category,
          status: "COMPLETED" as const,
          userId: USER_ID,
          createdAt: date,
          updatedAt: date,
        };

        transactions.push(transaction);
      }
    }

    // Insert transactions in batches
    await db.$transaction(async (tx) => {
      // Clear existing transactions
      await tx.transaction.deleteMany({
        where: { userId: USER_ID },
      });

      // Insert new transactions
      await tx.transaction.createMany({
        data: transactions,
      });
    });

    return {
      success: true,
      message: `Created ${transactions.length} transactions`,
    };
  } catch (error) {
    console.error("Error seeding transactions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
