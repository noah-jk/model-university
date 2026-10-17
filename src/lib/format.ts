// Small text helpers shared by pages, feeds, and Markdown copies.

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

// ["a", "b", "c"] → "a, b, and c" (or "a, b, or c")
export const listText = (items: readonly string[], joiner: "and" | "or" = "and") =>
  new Intl.ListFormat("en-US", { style: "long", type: joiner === "and" ? "conjunction" : "disjunction" }).format(items);
