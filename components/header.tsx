import React from "react";
import { Button } from "./ui/button";
import { PenBox, User, Menu } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/session";
import UserMenu from "./auth/user-menu";

const Header = async () => {
  const user = await getCurrentUser();

  const links = user
    ? [
        { href: "/assistant", label: "Money Chat" },
        { href: "/dashboard", label: "Dashboard" },
        { href: "/transaction/create", label: "Add Transaction" },
      ]
    : [
        { href: "/#features", label: "Features" },
        { href: "/#how-it-works", label: "How it works" },
        { href: "/#testimonials", label: "Stories" },
      ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src={"/logo.jpg"}
            alt="Wealth Logo"
            width={200}
            height={60}
            priority
            className="h-10 w-auto object-contain"
          />
        </Link>

        {/* Primary navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/transaction/create" className="hidden sm:block">
                <Button className="gap-2">
                  <PenBox size={16} />
                  <span className="hidden lg:inline">Add Transaction</span>
                </Button>
              </Link>
              <UserMenu
                name={user.name ?? ""}
                email={user.email}
                image={user.image}
              />
            </>
          ) : (
            <Link href="/sign-in">
              <Button className="gap-2">
                <User size={16} />
                Sign in
              </Button>
            </Link>
          )}

          {/* Mobile menu (no-JS, CSS-only) */}
          <details className="group relative md:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden">
              <Menu size={18} />
            </summary>
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-lg">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {link.label}
                </Link>
              ))}
              {!user && (
                <Link
                  href="/sign-in"
                  className="mt-1 flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  <User size={16} /> Sign in
                </Link>
              )}
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
};

export default Header;
