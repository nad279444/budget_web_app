import { getDashboardData } from "@/actions/dashboard";
import { getCurrentBudget } from "@/actions/budget";
import { BudgetProgress } from "./_components/budget-progress";
import { DashboardOverview } from "./_components/transaction-overview";
import { TransactionTable } from "./_components/transaction-table";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const [transactions, budgetData] = await Promise.all([
    getDashboardData(),
    getCurrentBudget(),
  ]);

  if (!transactions || transactions.length === 0) {
    redirect("/transaction/create");
  }

  return (
    <div className="space-y-8">
      {/* Budget Progress */}
      <BudgetProgress
        initialBudget={budgetData?.budget}
        currentExpenses={budgetData?.currentExpenses || 0}
      />

      {/* Dashboard Overview */}
      <DashboardOverview transactions={transactions || []} />

      {/* All Transactions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">All Transactions</h2>
        <TransactionTable transactions={transactions || []} />
      </div>
    </div>
  );
}