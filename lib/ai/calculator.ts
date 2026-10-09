const MAX_LENGTH = 300;
const MAX_DEPTH = 50;

type Token = "op" | "paren" | "num";

function tokenize(source: string): { type: Token; value: string }[] {
  const cleaned = source
    .replace(/×|✕/g, "*")
    .replace(/÷/g, "/")
    .replace(/−|–/g, "-")
    // strip thousands separators between digits (e.g. "1,800")
    .replace(/(\d),(\d)/g, "$1$2")
    .trim();

  if (cleaned.length > MAX_LENGTH) {
    throw new Error("Expression too long");
  }

  const tokens: { type: Token; value: string }[] = [];
  const re = /\d+\.?\d*|\.\d+|[+\-*/%()]/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(cleaned)) !== null) {
    const gap = cleaned.slice(last, match.index);
    if (gap.trim() !== "") {
      throw new Error(`Unsupported character: ${gap.trim()}`);
    }
    const value = match[0];
    tokens.push({
      type: /[+\-*/%]/.test(value) ? "op" : /[()]/.test(value) ? "paren" : "num",
      value,
    });
    last = match.index + value.length;
  }
  if (last < cleaned.length) {
    throw new Error(`Unsupported character: ${cleaned.slice(last).trim()}`);
  }
  if (tokens.length === 0) {
    throw new Error("Empty expression");
  }
  return tokens;
}

export function evaluateExpression(source: string): number {
  const tokens = tokenize(source);
  let i = 0;
  let depth = 0;

  const current = () => tokens[i];
  const advance = () => tokens[i++];

  function parseExpression(): number {
    let left = parseTerm();
    while (current() && (current().value === "+" || current().value === "-" || current().value === "%")) {
      const op = advance().value;
      const right = parseTerm();
      left = op === "+" ? left + right : op === "-" ? left - right : left % right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    while (current() && (current().value === "*" || current().value === "/")) {
      const op = advance().value;
      const right = parseUnary();
      if (op === "/" && right === 0) throw new Error("Division by zero");
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function parseUnary(): number {
    const token = current();
    if (token && token.value === "-") {
      advance();
      return -parseUnary();
    }
    if (token && token.value === "+") {
      advance();
      return parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = advance();
    if (!token) throw new Error("Unexpected end of expression");

    if (token.type === "paren" && token.value === "(") {
      depth += 1;
      if (depth > MAX_DEPTH) throw new Error("Expression is too nested");
      const value = parseExpression();
      const closing = advance();
      if (!closing || closing.value !== ")") {
        throw new Error("Missing closing parenthesis");
      }
      depth -= 1;
      return value;
    }

    if (token.type === "num") {
      const value = Number(token.value);
      if (!Number.isFinite(value)) throw new Error(`Invalid number: ${token.value}`);
      return value;
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }

  const result = parseExpression();
  if (i < tokens.length) {
    throw new Error(`Unexpected token: ${tokens[i].value}`);
  }
  if (!Number.isFinite(result)) throw new Error("Result is not a finite number");

  return Math.round(result * 100) / 100;
}

/** Safe wrapper for tool execution that never throws. */
export function tryEvaluateExpression(source: string): { ok: true; result: number } | { ok: false; error: string } {
  try {
    return { ok: true, result: evaluateExpression(source) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid expression" };
  }
}