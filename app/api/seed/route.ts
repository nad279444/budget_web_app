import { seedTransactions } from "@/actions/seed";

export async function GET(): Promise<Response> {
  const result = await seedTransactions();
  return Response.json(result);
}