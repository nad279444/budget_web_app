import type { Budget, Transaction } from "@prisma/client";
import type {
  SerializedBudget,
  SerializedTransaction,
} from "./types";

export function serializeTransaction<T extends Transaction>(
  transaction: T
): Omit<T, "amount"> & { amount: number } {
  return { ...transaction, amount: transaction.amount.toNumber() };
}

export function serializeBudget<T extends Budget>(budget: T): Omit<T, "amount"> & { amount: number } {
  return { ...budget, amount: budget.amount.toNumber() };
}

export function serializeTransactions<T extends Transaction>(
  transactions: T[]
): (Omit<T, "amount"> & { amount: number })[] {
  return transactions.map(serializeTransaction);
}

export type { SerializedBudget, SerializedTransaction };