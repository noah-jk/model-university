// Small text helpers shared by pages, feeds, and Markdown copies.

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

// ["a", "b", "c"] → "a, b, and c"
export const listText = (items: readonly string[]) =>
  new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(items);
