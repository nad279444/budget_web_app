import { BarLoader } from "react-spinners";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h1 className="text-6xl font-bold tracking-tight gradient-title">
          Dashboard
        </h1>
        <Link href="/transaction/create">
          <Button className="gap-2">
            <Plus size={16} />
            <span className="hidden sm:inline">Add Transaction</span>
          </Button>
        </Link>
      </div>
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#0D9488" />}
      >
        {children}
      </Suspense>
    </div>
  );
}
