"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";

const NetworkStatus = () => {
  const { online, slow } = useNetworkStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      toast.error("No internet connection. Some features may not work.", {
        id: "network-offline",
        duration: Infinity,
      });
      return;
    }

    if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("You're back online.", {
        id: "network-offline",
        duration: 2500,
      });
    }
  }, [online]);

  useEffect(() => {
    if (online && slow) {
      toast.warning("Slow internet connection detected.", {
        id: "network-slow",
        duration: 4000,
      });
    }
  }, [online, slow]);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive shadow-sm backdrop-blur"
    >
      <WifiOff size={16} />
      No internet connection
    </div>
  );
};

export default NetworkStatus;
