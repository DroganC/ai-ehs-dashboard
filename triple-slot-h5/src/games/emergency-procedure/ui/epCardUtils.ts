import type { CardAccent } from "../model/types";

export function getSuitForAccent(accent: CardAccent | undefined): {
  suit: string;
  isRed: boolean;
} {
  switch (accent) {
    case "danger":
      return { suit: "♥", isRed: true };
    case "warning":
      return { suit: "♦", isRed: true };
    default:
      return { suit: "♠", isRed: false };
  }
}

export function firstGrapheme(text: string): string {
  const t = text.trim();
  if (!t) return "?";
  const arr = Array.from(t);
  return arr[0] ?? "?";
}
