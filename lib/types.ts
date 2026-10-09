import type {
  Budget,
  Transaction,
  User,
  RecurringInterval,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

export type {
  RecurringInterval,
  TransactionStatus,
  TransactionType,
};

/** Prisma Decimal fields are serialized to numbers before reaching the client. */
export type SerializedTransaction = Omit<Transaction, "amount"> & {
  amount: number;
};

export type SerializedBudget = Omit<Budget, "amount"> & { amount: number };

export type SerializedUser = Pick<User, "id" | "name" | "email" | "image">;

export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  subcategories?: string[];
};
