export type Currency = {
  /** Symbol used before the amount, e.g. "$", "₵", "€". */
  symbol: string;
  /** The word form the user used, e.g. "dollars", "cedis". */
  name: string;
  /** "prefix" when they wrote a symbol ($100), "suffix" when they wrote a word (100 cedis). */
  style: "prefix" | "suffix";
};

export const DEFAULT_CURRENCY: Currency = {
  symbol: "$",
  name: "dollars",
  style: "prefix",
};

const RULES: { pattern: RegExp; base: Omit<Currency, "style"> }[] = [
  {
    pattern: /\bghana\s*cedis?\b|\bcedis?\b|\bghs\b|gh¢/i,
    base: { symbol: "₵", name: "cedis" },
  },
  { pattern: /\bnairas?\b|\bngn\b|₦/i, base: { symbol: "₦", name: "naira" } },
  {
    pattern: /\bpounds?(?:\s+sterling)?\b|\bgbp\b|£/i,
    base: { symbol: "£", name: "pounds" },
  },
  { pattern: /\beuros?\b|\beur\b|€/i, base: { symbol: "€", name: "euros" } },
  { pattern: /\brupees?\b|\binr\b|₹/i, base: { symbol: "₹", name: "rupees" } },
  {
    pattern: /\bk[es]?\s*shillings?\b|\bksh\b/i,
    base: { symbol: "KSh", name: "shillings" },
  },
  {
    pattern: /\b(?:south\s+african\s+)?rands?\b|\bzar\b/i,
    base: { symbol: "R", name: "rand" },
  },
  { pattern: /\bdollars?\b|\busd\b|\$/i, base: { symbol: "$", name: "dollars" } },
];

/** Picks the currency the user wrote their amounts in, defaulting to USD. */
export function detectCurrency(text: string): Currency {
  for (const rule of RULES) {
    const match = text.match(rule.pattern);
    if (!match) continue;
    // A literal like "$100" or "GH₵" keeps the symbol out front; a word like
    // "cedis" is written after the amount.
    const style = /[^\sA-Za-z]/.test(match[0]) ? "prefix" : "suffix";
    return { ...rule.base, style };
  }
  return DEFAULT_CURRENCY;
}

/** Formats an amount exactly the way the user writes money. */
export function formatMoney(value: number, currency: Currency = DEFAULT_CURRENCY): string {
  const amount = Math.round(value * 100) / 100;
  const decimals = Number.isInteger(amount) ? 0 : 2;
  const grouped = amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  });
  return currency.style === "suffix" ? `${grouped} ${currency.name}` : `${currency.symbol}${grouped}`;
}

/** Describes the currency for the system prompt so the coach mirrors the user's wording. */
export function describeCurrency(currency: Currency): string {
  const written = currency.style === "prefix" ? currency.symbol : currency.name;
  return `Money in this conversation is written as ${written} (symbol ${currency.symbol}, word "${currency.name}"). Always write money in that same form — never convert a currency, never invent an exchange rate.`;
}
