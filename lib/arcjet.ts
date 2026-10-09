import arcjet, { tokenBucket, type ArcjetNextRequest } from "@arcjet/next";
import type { ArcjetDecision } from "arcjet";

const key = process.env.ARCJET_KEY;

const aj = key
  ? arcjet({
      key,
      characteristics: ["userId"], // Track based on userId
      rules: [
        tokenBucket({
          mode: "LIVE",
          refillRate: 10, // 10 requests
          interval: 3600, // per hour
          capacity: 10, // maximum burst capacity
        }),
      ],
    })
  : null;

/** Consumes one rate-limit token; no-ops (allows) when ARCJET_KEY is not configured. */
export async function rateLimit(
  req: ArcjetNextRequest,
  options: { userId: string; requested: number }
): Promise<ArcjetDecision | null> {
  if (!aj) return null;
  return aj.protect(req, options);
}

export default aj;
