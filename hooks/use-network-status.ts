"use client";

import { useEffect, useState } from "react";

type NetworkInformation = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

const getConnection = (): NetworkInformation | undefined => {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
};

const detectSlow = (connection?: NetworkInformation): boolean => {
  if (!connection) return false;
  const slowType =
    connection.effectiveType === "slow-2g" || connection.effectiveType === "2g";
  const slowDownlink =
    typeof connection.downlink === "number" && connection.downlink < 0.5;
  return slowType || slowDownlink;
};

export type NetworkStatus = {
  online: boolean;
  slow: boolean;
};

/**
 * Tracks connectivity using the browser `online`/`offline` events and the
 * Network Information API (where supported) to flag slow connections.
 */
export function useNetworkStatus(): NetworkStatus {
  const [online, setOnline] = useState(true);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const connection = getConnection();

    const sync = () => {
      const isOnline =
        typeof navigator === "undefined" ? true : navigator.onLine;
      setOnline(isOnline);
      setSlow(isOnline ? detectSlow(connection) : false);
    };

    const handleOnline = () => sync();
    const handleOffline = () => {
      setOnline(false);
      setSlow(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    connection?.addEventListener?.("change", sync);

    sync();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      connection?.removeEventListener?.("change", sync);
    };
  }, []);

  return { online, slow };
}
