import { NextRequest } from "next/server";
import { runAssistant } from "@/lib/ai/assistant-core";
import { assistantRateLimit } from "@/lib/arcjet";
import { getCurrentUser } from "@/lib/session";
import { screenAssistantMessage } from "@/lib/ai/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The assistant makes several sequential model/tool round-trips before it can
// stream an answer. Without this, Vercel's default function timeout kills the
// stream mid-response, which the client reports as "stopped unexpectedly".
export const maxDuration = 60;

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "summary"; text: string }
  | { type: "done"; data: unknown }
  | { type: "error"; error: string };

export async function POST(request: NextRequest) {
  let body: { message?: unknown };
  try {
    body = (await request.json()) as { message?: unknown };
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Cheap, in-process guardrail: length cap plus obvious instruction-override
  // patterns. Fails fast before we spend an Arcjet or OpenAI call.
  const rawMessage = body?.message;
  const screen = screenAssistantMessage(rawMessage);
  if (!screen.ok) {
    return Response.json(
      { error: screen.message, code: screen.code },
      { status: 400 }
    );
  }
  const message = rawMessage as string;

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decision = await assistantRateLimit(request, {
    userId: user.id,
    requested: 1,
  });

  if (decision?.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return Response.json(
        {
          error:
            "You're sending messages too quickly. Please wait a moment and try again.",
        },
        { status: 429 }
      );
    }
    return Response.json({ error: "Request blocked" }, { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: StreamEvent) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      try {
        const data = await runAssistant(message, {
          onStatus: (status) => send({ type: "status", message: status }),
          onSummary: (text) => send({ type: "summary", text }),
        });
        send({ type: "done", data });
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Something went wrong",
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
