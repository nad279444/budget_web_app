import { NextRequest } from "next/server";
import { runAssistant } from "@/lib/ai/assistant-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "summary"; text: string }
  | { type: "done"; data: unknown }
  | { type: "error"; error: string };

export async function POST(request: NextRequest) {
  let message: unknown;
  try {
    const body = (await request.json()) as { message?: unknown };
    message = body?.message;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Message is required" }, { status: 400 });
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
