import bookSubjects from "./book-subjects.json" with { type: "json" };
export { bookSubjects };
import type { Resource } from "./data";
export const catalogVersion = 4;
export function cleanSubjects(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((s) => s.trim())
    .filter((s) => {
      const key = s.toLowerCase();
      if (!key || key === "uncategorized" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export function needsCategory(book: Resource): boolean {
  return (
    book.classificationStatus !== "pending" &&
    cleanSubjects(book.subjects).length === 0
  );
}
export const topicRules: Record<string, string[]> = {
  Cooking: [
    "cooking",
    "cookbook",
    "cookery",
    "culinary",
    "cuisine",
    "baking",
    "recipes",
  ],
  "Machine Learning": [
    "machine learning",
    "neural networks",
    "deep learning",
    "training data",
  ],
  "Computer Science": [
    "software",
    "programming",
    "algorithms",
    "computer science",
    "databases",
    "distributed systems",
    "data intensive applications",
  ],
  Science: ["physics", "biology", "chemistry", "scientific", "proton"],
  Mathematics: ["mathematics", "calculus", "algebra", "statistics"],
  History: ["historical", "history", "civilization"],
  Philosophy: ["philosophy", "ethics", "epistemology"],
};
export function normalize(text: string) {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function contains(text: string, phrase: string) {
  return (" " + normalize(text) + " ").includes(" " + normalize(phrase) + " ");
}
// Recipe alone is ambiguous: software books also contain recipes and ingredients.
export function cookingEvidence(text: string) {
  return (
    /\b(cook(?:ing|book|ery)|culinary|cuisine|baking)\b/i.test(text) ||
    (/\b(recipe|recipes|ingredients)\b/i.test(text) &&
      /\b(oven|tablespoons?|teaspoons?|flour|simmer|saute|chopped|preheat)\b/i.test(
        text,
      ))
  );
}
const subjectPhrases = bookSubjects
  .filter((subject) => !(subject in topicRules))
  .map((subject) => ({ subject, phrase: " " + normalize(subject) + " " }));
// These labels often appear in titles and prose with a different meaning.
const ambiguousLabels = new Set([
  "Art",
  "Business",
  "Careers",
  "Communication",
  "Design",
  "Education",
  "Engineering",
  "Film",
  "Health",
  "History",
  "Leadership",
  "Management",
  "Reference",
  "Religion",
  "Science",
  "Technology",
  "Travel",
]);
const builtInSubjects = new Set(bookSubjects);

export function pageSubjects(text: string, isTitle = false) {
  const normalized = " " + normalize(text) + " ";
  const ruleMatches = Object.entries(topicRules)
    .filter(([subject, words]) =>
      subject === "Cooking"
        ? cookingEvidence(text)
        : words.some((word) => normalized.includes(" " + word + " ")),
    )
    .map(([subject]) => subject);
  return [
    ...ruleMatches,
    ...subjectPhrases
      .filter(({ subject, phrase }) =>
        ambiguousLabels.has(subject)
          ? isTitle && normalized === phrase
          : normalized.includes(phrase),
      )
      .map(({ subject }) => subject),
  ];
}
export function catalogSubjects(title: string, pages: string[]) {
  const titles = pageSubjects(title, true);
  const counts = new Map<string, number>();
  const distinctPages = new Set<string>();
  for (const page of pages) {
    const normalized = normalize(page);
    if (!normalized || distinctPages.has(normalized)) continue;
    distinctPages.add(normalized);
    for (const subject of pageSubjects(page)) {
      counts.set(subject, (counts.get(subject) || 0) + 1);
    }
  }
  const minimum = Math.max(3, Math.ceil(distinctPages.size * 0.2));
  const subjects = Array.from(
    new Set([
      ...titles,
      ...[...counts]
        .filter(([, count]) => count >= minimum)
        .sort((a, b) => b[1] - a[1])
        .map(([s]) => s),
    ]),
  );
  return subjects.length ? subjects.slice(0, 3) : ["Uncategorized"];
}
export function refreshCatalog(book: Resource): Resource {
  if (
    book.catalogVersion === catalogVersion ||
    book.subjectsEdited ||
    book.modelCatalog
  )
    return book;
  const customSubjects = book.subjects.filter(
    (s) => !builtInSubjects.has(s) && s !== "Uncategorized",
  );
  const inferred = catalogSubjects(book.title, book.texts || []);
  const subjects = [...new Set([...customSubjects, ...inferred])].filter(
    (s) => s !== "Uncategorized",
  );
  return {
    ...book,
    subjects: subjects.length ? subjects : ["Uncategorized"],
    catalogVersion,
  };
}
