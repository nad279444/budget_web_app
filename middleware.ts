import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "wealth.session_token";

const isProtectedRoute = (pathname: string) =>
  /^\/(dashboard|transaction|assistant)(\/|$)/.test(pathname);

export function middleware(req: NextRequest) {
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
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
