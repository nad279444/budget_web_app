import { formatMoney, type Currency } from "@/lib/ai/currency";

/** Turns a raw calculator expression into something readable: 300 * 52 / 12 -> 300 × 52 ÷ 12 */
function prettyExpression(expression: string): string {
  return expression
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/\d+(?:\.\d+)?/g, (number) => {
      const value = Number(number);
      if (!Number.isFinite(value)) return number;
      const decimals = Number.isInteger(value) ? 0 : 2;
      return value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: 2,
      });
    });
}

function leadIn(note: string): string {
  return note.trim().replace(/[.:;!?—–-]+$/, "");
}

/**
 * Renders one calculator step as a sentence followed by the verified figures,
 * e.g. "Your weekly groceries of 300 cedis convert to a monthly figure: 300 × 52 ÷ 12 = 1,300 cedis."
 * The numbers always come from the calculator, never from the model's prose.
 */
export function formatMathStep(
  expression: string,
  note: string,
  result: number,
  currency: Currency
): string {
  const lead = leadIn(note);
  const amount = formatMoney(result, currency);
  // A bare number that equals the result means the amount was already monthly,
  // so there is no conversion to show.
  const isIdentity = /^\d+(?:\.\d+)?$/.test(expression) && Number(expression) === result;
  const figures = isIdentity ? amount : `${prettyExpression(expression)} = ${amount}`;
  return `${lead}: ${figures}.`;
}
