import arcjet, { createMiddleware, detectBot, shield } from "@arcjet/next";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "wealth.session_token";

const isProtectedRoute = (pathname: string) =>
  /^\/(dashboard|transaction|assistant)(\/|$)/.test(pathname);

// Create Arcjet middleware
const aj = arcjet({
  key: process.env.ARCJET_KEY ?? "",
  // characteristics: ["userId"], // Track based on authenticated user id
  rules: [
    // Shield protection for content and security
    shield({
      mode: "LIVE",
    }),
    detectBot({
      mode: "LIVE", // will block requests. Use "DRY_RUN" to log only
      allow: [
        "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
        "GO_HTTP", // For Inngest
        // See the full list at https://arcjet.com/bot-list
      ],
    }),
  ],
});

// Route guard - redirects unauthenticated users to /sign-in
const authGuard = async (req: NextRequest) => {
  if (
    isProtectedRoute(req.nextUrl.pathname) &&
    !req.cookies.has(SESSION_COOKIE)
  ) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set(
      "redirect",
      req.nextUrl.pathname + req.nextUrl.search
    );
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
};

// Chain middlewares - ArcJet runs first, then the auth guard
export default createMiddleware(aj, authGuard);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};