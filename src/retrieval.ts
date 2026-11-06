import type { Resource } from "./data";
import { contains, normalize, cookingEvidence } from "./catalog.ts";
const synonyms: Record<string, string[]> = {
  "machine learning": [
    "neural networks",
    "neural network",
    "deep learning",
    "model training",
    "learning from data",
  ],
  ai: ["artificial intelligence", "neural networks", "machine learning"],
  cooking: [
    "cookbook",
    "cookbooks",
    "cookery",
    "culinary",
    "cuisine",
    "baking",
  ],
  cookbook: ["cooking", "cookery", "culinary", "cuisine", "baking"],
  proton: ["protons", "atomic nucleus"],
};
const stop = new Set(
  "show everything related about have books book resource resources document documents pdf pdfs what the any find want wanna looking look learn tell more can could would you does that with from stuff please stories story novel novels need give get some something anything there this these those librarian library for and are how which where who help recommend recommendations recommendation bring read reading me my your all".split(
    " ",
  ),
);
export function terms(q: string) {
  const clean = normalize(q);
  const words = clean.split(" ").filter((t) => t.length > 2 && !stop.has(t));
  return Array.from(
    new Set([
      ...words,
      ...Object.entries(synonyms)
        .filter(([k]) => contains(clean, k))
        .flatMap(([, v]) => v),
    ]),
  );
}
export function wantsFiction(q: string) {
  return (
    /\b(stories|story|fiction|novels?|plot)\b/i.test(q) &&
    !/\b(nonfiction|non-fiction|non fiction)\b/i.test(q)
  );
}
export function match(r: Resource, q: string) {
  const ts = terms(q);
  const cooking =
    /\b(cooking|cookbooks?|cookery|culinary|cuisine|baking)\b/i.test(q);
  const bookRequest =
    /\b(books?|cookbooks?|resources?|recommend)\b/i.test(q) &&
    !/\b(chapters?|passages?|sections?|mentions?)\b/i.test(q);
  const titleMatch = ts.some((t) => contains(r.title, t));
  const subjectMatch = ts.some((t) => r.subjects.some((s) => contains(s, t)));
  // Cooking metadata from older imports may have come from an engineering metaphor.
  const cookingPages = (r.texts || []).filter(cookingEvidence).length;
  const cookingTitle = cookingEvidence(r.title);
  const trustedCooking = r.subjectsEdited && r.subjects.includes("Cooking");
  const cookingBook =
    cookingTitle ||
    trustedCooking ||
    cookingPages >= Math.max(2, Math.ceil((r.texts?.length || 0) * 0.08));
  const allowed =
    !cooking ||
    (bookRequest
      ? cookingBook
      : cookingTitle || trustedCooking || cookingPages > 0);
  let score = allowed ? (titleMatch ? 12 : 0) + (subjectMatch ? 8 : 0) : 0;
  const passages: { page: number; excerpt: string; hits: number }[] = [];
  if (allowed)
    r.texts?.forEach((text, i) => {
      if (cooking && !cookingEvidence(text)) return;
      const hits = ts.reduce((n, t) => n + (contains(text, t) ? 1 : 0), 0);
      if (!hits) return;
      const lower = text.toLowerCase();
      const word = ts.find((t) => contains(text, t))!;
      const index = Math.max(0, lower.indexOf(word) - 100);
      passages.push({
        page: i + 1,
        excerpt: text.slice(index, index + 360),
        hits,
      });
    });
  passages.sort((a, b) => b.hits - a.hits || a.page - b.page);
  score += passages.slice(0, 5).reduce((n, p) => n + p.hits, 0);
  if (!allowed) score = 0;
  const whole = allowed && (cooking ? cookingBook : titleMatch || subjectMatch);
  return {
    score,
    page: passages[0]?.page ?? 1,
    excerpt: passages[0]?.excerpt ?? "",
    passages,
    whole,
    reason: whole
      ? `Subject match: ${r.subjects.join(", ")}`
      : passages.length
        ? `Relevant text on page ${passages[0].page}`
        : "",
  };
}
