import type { Resource } from "./data";
import { normalize, cookingEvidence } from "./catalog.ts";
import { terms } from "./retrieval.ts";
export type SearchDocument = Pick<
  Resource,
  | "id"
  | "title"
  | "author"
  | "subjects"
  | "fiction"
  | "subjectsEdited"
  | "texts"
  | "modelCatalog"
>;
export type SearchHit = {
  id: string;
  score: number;
  page: number;
  excerpt: string;
  whole: boolean;
  reason: string;
  passages: { page: number; excerpt: string; hits: number }[];
};
type Page = {
  id: number;
  bookId: string;
  page: number;
  text: string;
  normalized: string;
  cooking: boolean;
  tokens: Set<string>;
};
type Book = {
  source: SearchDocument;
  title: string;
  author: string;
  subjects: string[];
  pageIds: number[];
  cookingPages: number;
  cookingTitle: boolean;
};
const has = (text: string, term: string) => text.includes(" " + term + " ");
const padded = (s: string) => " " + normalize(s) + " ";
export class RetrievalIndex {
  private books = new Map<string, Book>();
  private pages = new Map<number, Page>();
  private postings = new Map<string, Set<number>>();
  private nextId = 0;
  private cache = new Map<string, SearchHit[]>();
  remove(id: string) {
    const book = this.books.get(id);
    if (!book) return;
    for (const pageId of book.pageIds) {
      const page = this.pages.get(pageId)!;
      for (const token of page.tokens) {
        const posting = this.postings.get(token)!;
        posting.delete(pageId);
        if (!posting.size) this.postings.delete(token);
      }
      this.pages.delete(pageId);
    }
    this.books.delete(id);
    this.cache.clear();
  }
  upsert(source: SearchDocument) {
    const previous = this.books.get(source.id);
    if (
      previous &&
      (source.texts === undefined || source.texts === previous.source.texts)
    ) {
      this.books.set(source.id, {
        ...previous,
        source: { ...source, texts: previous.source.texts },
        title: padded(source.title),
        author: padded(source.author),
        subjects: [
          ...source.subjects,
          ...(source.modelCatalog?.keywords || []),
          source.modelCatalog?.domain || "",
          source.modelCatalog?.summary || "",
        ].map(padded),
        cookingTitle: cookingEvidence(source.title),
      });
      this.cache.clear();
      return;
    }
    this.remove(source.id);
    const book: Book = {
      source,
      title: padded(source.title),
      author: padded(source.author),
      subjects: [
        ...source.subjects,
        ...(source.modelCatalog?.keywords || []),
        source.modelCatalog?.domain || "",
        source.modelCatalog?.summary || "",
      ].map(padded),
      pageIds: [],
      cookingPages: 0,
      cookingTitle: cookingEvidence(source.title),
    };
    source.texts?.forEach((text, i) => {
      const normalized = padded(text);
      const tokens = new Set(
        normalized
          .trim()
          .split(" ")
          .filter((t) => t.length > 1),
      );
      const page: Page = {
        id: this.nextId++,
        bookId: source.id,
        page: i + 1,
        text,
        normalized,
        cooking: cookingEvidence(text),
        tokens,
      };
      book.pageIds.push(page.id);
      if (page.cooking) book.cookingPages++;
      this.pages.set(page.id, page);
      for (const token of tokens) {
        let posting = this.postings.get(token);
        if (!posting) {
          posting = new Set();
          this.postings.set(token, posting);
        }
        posting.add(page.id);
      }
    });
    this.books.set(source.id, book);
    this.cache.clear();
  }
  search(query: string): SearchHit[] {
    const cacheKey = normalize(query);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const ts = terms(query).map(normalize);
    if (!ts.length) return [];
    const cooking =
      /\b(cooking|cookbooks?|cookery|culinary|cuisine|baking)\b/i.test(query);
    const bookRequest =
      /\b(books?|cookbooks?|resources?|recommend)\b/i.test(query) &&
      !/\b(chapters?|passages?|sections?|mentions?)\b/i.test(query);
    const matched = new Map<number, { hits: number; term: string }>();
    for (const term of ts) {
      const lists = term.split(" ").map((token) => this.postings.get(token));
      if (lists.some((p) => !p)) continue;
      lists.sort((a, b) => a!.size - b!.size);
      for (const id of lists[0]!) {
        if (!lists.every((p) => p!.has(id))) continue;
        const page = this.pages.get(id)!;
        if (cooking && !page.cooking) continue;
        if (!has(page.normalized, term)) continue;
        const prev = matched.get(id);
        matched.set(id, {
          hits: (prev?.hits || 0) + 1,
          term: prev?.term || term,
        });
      }
    }
    const grouped = new Map<
      string,
      { page: Page; hits: number; term: string }[]
    >();
    for (const [id, m] of matched) {
      const page = this.pages.get(id)!;
      let group = grouped.get(page.bookId);
      if (!group) {
        group = [];
        grouped.set(page.bookId, group);
      }
      group.push({ page, ...m });
    }
    const results: SearchHit[] = [];
    for (const [id, b] of this.books) {
      const titleMatch = ts.some((t) => has(b.title, t));
      const subjectMatch = ts.some((t) => b.subjects.some((s) => has(s, t)));
      const authorMatch = ts.some((t) => has(b.author, t));
      const trustedCooking =
        b.source.subjectsEdited &&
        b.source.subjects.some((s) => has(s, "cooking"));
      const cookingBook =
        b.cookingTitle ||
        trustedCooking ||
        b.cookingPages >= Math.max(2, Math.ceil(b.pageIds.length * 0.08));
      if (
        cooking &&
        !(bookRequest
          ? cookingBook
          : b.cookingTitle || trustedCooking || b.cookingPages > 0)
      )
        continue;
      const top = (grouped.get(id) || [])
        .sort((a, b) => b.hits - a.hits || a.page.page - b.page.page)
        .slice(0, 5);
      const score =
        (titleMatch ? 12 : 0) +
        (subjectMatch ? 8 : 0) +
        (authorMatch ? 6 : 0) +
        top.reduce((n, p) => n + p.hits, 0);
      if (!score) continue;
      const passages = top.map(({ page, hits, term }) => {
        const pattern = term
          .split(" ")
          .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("[\\W_]+");
        const start = Math.max(
          0,
          page.text.search(new RegExp(pattern, "i")) - 100,
        );
        return {
          page: page.page,
          excerpt: page.text.slice(start, start + 360),
          hits,
        };
      });
      const whole = !!(cooking
        ? cookingBook
        : titleMatch || subjectMatch || authorMatch);
      results.push({
        id,
        score,
        page: passages[0]?.page ?? 1,
        excerpt: passages[0]?.excerpt ?? "",
        whole,
        reason: whole
          ? `Subject match: ${b.source.subjects.join(", ")}`
          : passages.length
            ? `Relevant text on page ${passages[0].page}`
            : "",
        passages,
      });
    }
    results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    if (this.cache.size >= 24)
      this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(cacheKey, results);
    return results;
  }
  get stats() {
    return {
      books: this.books.size,
      pages: this.pages.size,
      tokens: this.postings.size,
      cachedQueries: this.cache.size,
    };
  }
}
