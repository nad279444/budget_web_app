/*
  Warnings:

  - You are about to drop the column `accountId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `accounts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_accountId_fkey";

-- DropIndex
DROP INDEX "transactions_accountId_idx";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "accountId";

-- DropTable
DROP TABLE "accounts";

-- DropEnum
DROP TYPE "AccountType";
