"use client";

import { useState } from "react";
import { Bot, Lightbulb, Send, Sparkles, User, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoney, type Currency } from "@/lib/ai/currency";
import type { AssistantReply } from "@/lib/ai/schemas";

type AssistantData = AssistantReply & {
  budgetSaved: boolean;
  transactionsRecorded: number;
  currency: Currency;
};

type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; data?: AssistantData };

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "summary"; text: string }
  | { type: "done"; data: AssistantData }
  | { type: "error"; error: string };

const SUGGESTIONS = [
  "I spend $1,800 on rent, $300 on groceries, and about $200 eating out every month",
  "I buy a $6 coffee every day and my streaming subscriptions total $45 a month",
  "I dropped $400 on clothes last month and I need to stop impulse shopping",
];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  biweekly: "bi-weekly",
  monthly: "monthly",
  yearly: "yearly",
  once: "one-off",
};

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const hasInsights = (
  insights: AssistantReply["insights"] | undefined
): boolean =>
  Boolean(
    insights &&
      (insights.topCategory || insights.savingsLeft || insights.whereToSave)
  );

const AssistantChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [streamingText, setStreamingText] = useState("");

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setStatus("Connecting…");
    setStreamingText("");

    let done = false;

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "The assistant is unavailable right now");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleEvent = (event: StreamEvent) => {
        if (event.type === "status") {
          setStatus(event.message);
        } else if (event.type === "summary") {
          setStreamingText(event.text);
        } else if (event.type === "done") {
          done = true;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: event.data.summary,
              data: event.data,
            },
          ]);
        } else if (event.type === "error") {
          done = true;
          toast.error(event.error || "Something went wrong");
        }
      };

      // Server-sent events arrive as `data: <json>\n\n` blocks.
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const line = chunk
            .split("\n")
            .find((entry) => entry.startsWith("data:"));
          if (line) {
            try {
              handleEvent(JSON.parse(line.slice(5).trim()) as StreamEvent);
            } catch {
              // ignore malformed frame
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }

      if (!done) {
        toast.error("The assistant stopped unexpectedly. Try again.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
      setStatus("");
      setStreamingText("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Money Chat</h1>
        <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
          Describe how you spend money and I&apos;ll build you a budget, run the
          numbers, and point out savings.
        </p>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Try one of these
            </p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => sendMessage(suggestion)}
                className="block w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex max-w-[85%] items-end gap-2">
              <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Bot size={14} />
              </span>
              <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm text-card-foreground">
                {streamingText ? (
                  <span className="whitespace-pre-line">
                    {streamingText}
                    <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-primary align-middle" />
                  </span>
                ) : (
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                        style={{ animationDelay: "300ms" }}
                      />
                    </span>
                    {status && <span className="text-xs">{status}</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tell me how you spend your money..."
          className="h-11 flex-1 rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={loading}
        />
        <Button type="submit" size="lg" className="h-11 gap-2 px-5" disabled={loading}>
          <Send size={16} />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
};

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] items-end gap-2">
          <div className="rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">
            {message.content}
          </div>
          <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <User size={14} />
          </span>
        </div>
      </div>
    );
  }

  const data = message.data;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-3">
        <div className="flex items-end gap-2">
          <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Bot size={14} />
          </span>
          <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm text-card-foreground">
            {message.content}
          </div>
        </div>

        {data && (
          <div className="ml-9 space-y-3">
            {data.transactionsRecorded > 0 && (
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                <CheckCircle2 size={14} className="text-primary" />
                Recorded {data.transactionsRecorded}{" "}
                {data.transactionsRecorded === 1
                  ? "transaction"
                  : "transactions"}
              </div>
            )}

            {data.reasoning && (
              <details className="rounded-xl border border-border bg-muted/50 p-4">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  How I did the math
                </summary>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                  {data.reasoning}
                </p>
              </details>
            )}

            {data.habits.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles size={12} /> Extracted spending habits
                </p>
                <ul className="space-y-1.5">
                  {data.habits.map((habit, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="capitalize text-muted-foreground">
                        {capitalize(habit.category)}
                        <span className="text-muted-foreground/70">
                          {" "}
                          · {FREQUENCY_LABELS[habit.frequency] ?? habit.frequency}
                        </span>
                      </span>
                      <span className="font-medium text-foreground">
                        {formatMoney(habit.monthlyEquivalent, data.currency)}/mo
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.proposedMonthlyBudget !== null && (
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
                <span className="text-sm text-foreground">
                  Proposed monthly budget
                </span>
                <span className="flex items-center gap-2 font-semibold text-primary">
                  {formatMoney(data.proposedMonthlyBudget, data.currency)}
                  {data.budgetSaved && (
                    <CheckCircle2 size={16} className="text-primary" />
                  )}
                </span>
              </div>
            )}

            {hasInsights(data.insights) && (
              <div className="rounded-xl border border-tertiary/30 bg-tertiary/5 p-4 text-sm text-foreground">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">
                  <Lightbulb size={12} /> Insights
                </p>
                <ul className="mt-2 space-y-2">
                  {data.insights.topCategory && (
                    <li>
                      <span className="font-semibold">
                        Where your money goes:
                      </span>{" "}
                      {data.insights.topCategory}
                    </li>
                  )}
                  {data.insights.savingsLeft && (
                    <li>
                      <span className="font-semibold">Left to save:</span>{" "}
                      {data.insights.savingsLeft}
                    </li>
                  )}
                  {data.insights.whereToSave && (
                    <li>
                      <span className="font-semibold">Where to put it:</span>{" "}
                      {data.insights.whereToSave}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {data.savingsTip && (
              <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm">
                <p className="font-semibold text-tertiary-foreground">
                  Savings tip
                </p>
                <p className="mt-1 text-muted-foreground">{data.savingsTip}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistantChat;
