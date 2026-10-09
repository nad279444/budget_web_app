import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const getCurrentUser = cache(async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    return session?.user ?? null;
  } catch (error) {
    console.error("Failed to resolve session:", error);
    return null;
  }
});

/** Returns the authenticated user's id or throws if unauthenticated. */
export const requireUserId = cache(async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user.id;
});