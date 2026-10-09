"use client";

import { useState } from "react";
import { Bot, Lightbulb, Send, Sparkles, User, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { chatWithAssistant } from "@/actions/assistant";
import { Button } from "@/components/ui/button";
import { formatMoney, type Currency } from "@/lib/ai/currency";
import type { AssistantReply } from "@/lib/ai/schemas";

type ChatMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      data?: AssistantReply & { budgetSaved: boolean; currency: Currency };
    };

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

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const result = await chatWithAssistant(trimmed);

      if (result.success && result.data) {
        const data = result.data;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.summary,
            data,
          },
        ]);
      } else if (!result.success) {
        toast.error(result.error || "Something went wrong");
      } else {
        toast.error("Sorry, I couldn't process that. Try rephrasing.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          Money Chat
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Describe how you spend money and I&apos;ll build you a budget, run
          the numbers, and point out savings.
        </p>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Try one of these
            </p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => sendMessage(suggestion)}
                className="block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600"
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
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-blue-400"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-blue-400"
                style={{ animationDelay: "300ms" }}
              />
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
          className="h-11 flex-1 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={loading}
        />
        <Button type="submit" size="lg" className="h-11 px-5" disabled={loading}>
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
          <div className="rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-sm text-white">
            {message.content}
          </div>
          <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <User size={14} className="text-blue-600" />
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
          <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Bot size={14} className="text-emerald-600" />
          </span>
          <div className="rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800">
            {message.content}
          </div>
        </div>

        {data && (
          <div className="ml-9 space-y-3">
            {data.reasoning && (
              <details className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
                  How I did the math
                </summary>
                <p className="mt-2 whitespace-pre-line text-sm text-gray-600">
                  {data.reasoning}
                </p>
              </details>
            )}

            {data.habits.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Sparkles size={12} /> Extracted spending habits
                </p>
                <ul className="space-y-1.5">
                  {data.habits.map((habit, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="capitalize text-gray-600">
                        {capitalize(habit.category)}
                        <span className="text-gray-400">
                          {" "}
                          · {FREQUENCY_LABELS[habit.frequency] ?? habit.frequency}
                        </span>
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatMoney(habit.monthlyEquivalent, data.currency)}/mo
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.proposedMonthlyBudget !== null && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <span className="text-sm text-emerald-800">
                  Proposed monthly budget
                </span>
                <span className="flex items-center gap-2 font-semibold text-emerald-700">
                  {formatMoney(
                    data.proposedMonthlyBudget,
                    data.currency
                  )}
                  {data.budgetSaved && (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  )}
                </span>
              </div>
            )}

            {hasInsights(data.insights) && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-600">
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
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-semibold">Savings tip</p>
                <p className="mt-1">{data.savingsTip}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistantChat;