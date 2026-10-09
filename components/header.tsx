import React from "react";
import { Button } from "./ui/button";
import { PenBox, LayoutDashboard, User, Bot } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/session";
import UserMenu from "./auth/user-menu";

const Header = async () => {
  const user = await getCurrentUser();

  return (
    <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/">
          <Image
            src={"/logo.jpg"}
            alt="Wealth Logo"
            width={200}
            height={60}
            className="h-12 w-auto object-contain"
          />
        </Link>

        {/* Navigation Links - Different for signed in/out users */}
        <div className="hidden md:flex items-center space-x-8">
          {!user && (
            <>
              <a href="#features" className="text-gray-600 hover:text-blue-600">
                Features
              </a>
              <a
                href="#testimonials"
                className="text-gray-600 hover:text-blue-600"
              >
                Testimonials
              </a>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <Link href="/assistant">
                <Button variant="ghost" className="flex items-center gap-2">
                  <Bot size={18} />
                  <span className="hidden md:inline">Money Chat</span>
                </Button>
              </Link>
              <Link href="/transaction/create">
                <Button className="flex items-center gap-2">
                  <PenBox size={18} />
                  <span className="hidden md:inline">Add Transaction</span>
                </Button>
              </Link>
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-blue-600 flex items-center gap-2"
              >
                <Button variant="outline">
                  <LayoutDashboard size={18} />
                  <span className="hidden md:inline">Dashboard</span>
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
              <Button variant="outline" className="flex items-center gap-2">
                <User size={18} />
                Login
              </Button>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;