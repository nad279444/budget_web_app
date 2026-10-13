"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

const HIDDEN_PATHS = ["/assistant", "/sign-in", "/sign-up"];

const FloatingChatButton = () => {
  const pathname = usePathname();

  if (HIDDEN_PATHS.some((path) => pathname.startsWith(path))) {
    return null;
  }

  return (
    <Link
      href="/assistant"
      aria-label="Open Money Chat"
      title="Chat with your money coach"
      className="group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-primary/40 [animation-duration:2.5s]" />
      <MessageCircle
        size={24}
        className="relative animate-bounce [animation-duration:1.2s]"
      />
    </Link>
  );
};

export default FloatingChatButton;
