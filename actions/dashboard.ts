"use server";

import { db } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { serializeTransactions } from "@/lib/serialize";
import type { SerializedTransaction } from "@/lib/types";

export async function getDashboardData(): Promise<SerializedTransaction[]> {
  const userId = await requireUserId();

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const transactions = await db.transaction.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });

  return serializeTransactions(transactions);
}