"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut, ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type UserMenuProps = {
  name: string;
  email: string;
  image?: string | null;
};

const UserMenu = ({ name, email, image }: UserMenuProps) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
      },
    });
  };

  const initials = (name || email || "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded-full"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {image ? (
          <Image
            src={image}
            alt={name || "User"}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            {initials}
          </span>
        )}
        <ChevronDown size={16} className="hidden text-gray-500 md:block" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
          >
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-gray-900">
                {name || "User"}
              </p>
              <p className="truncate text-xs text-gray-500">{email}</p>
            </div>
            <Button
              variant="ghost"
              className="mt-1 w-full justify-start"
              onClick={handleSignOut}
            >
              <LogOut size={16} />
              Sign out
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default UserMenu;