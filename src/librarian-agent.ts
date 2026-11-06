import type { Resource } from "./data";
import type { SearchHit } from "./retrieval-index";
import type { AgentMessage, LocalModels } from "./local-models";
import { wantsFiction } from "./retrieval.ts";
export type LibrarianResult = {
  answer: string;
  hits: SearchHit[];
  sources: { id: string; page: number }[];
};
export async function runLibrarianAgent({
  api,
  question,
  history,
  books,
  search,
  key,
  signal,
  onActivity,
  onShow,
  onOpen,
}: {
  api: LocalModels;
  question: string;
  history: { role: string; text: string }[];
  books: Resource[];
  search: (q: string) => Promise<SearchHit[]>;
  key: string;
  signal: AbortSignal;
  onActivity: (activity: string) => void;
  onShow: (hits: SearchHit[]) => void;
  onOpen: (book: Resource, page: number) => void;
}): Promise<LibrarianResult> {
  const resources = new Map(books.map((b) => [b.id, b]));
  const seen = new Map<string, SearchHit>();
  const verified = new Set<string>();
  const calls = new Set<string>();
  const messages: AgentMessage[] = [
    ...history.slice(-4).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.text.slice(0, 1200),
    })),
    { role: "user", content: question },
  ];
  let shown: SearchHit[] = [];
  let callCount = 0;
  const foodRequest =
    /\b(cooking|cookbooks?|cookery|culinary|cuisine|baking)\b/i.test(question);
  const wholeBookRequest =
    /\b(books?|cookbooks?|resources?)\b/i.test(question) &&
    !/\b(passages?|chapters?|sections?)\b/i.test(question);
  const originalFoodHits = foodRequest
    ? new Set((await search(question)).map((h) => h.id))
    : null;
  const both = /\bboth\b/i.test(question) && /fiction/i.test(question);
  const genre = both
    ? "both"
    : wantsFiction(question)
      ? "fiction"
      : "nonfiction";
  const check = () => {
    if (signal.aborted) throw new Error("Librarian request stopped");
  };
  const stop = () => {
    void api.cancel(key);
  };
  signal.addEventListener("abort", stop, { once: true });
  const ids = (value: unknown, max = 12) =>
    Array.isArray(value)
      ? [
          ...new Set(value.filter((v): v is string => typeof v === "string")),
        ].slice(0, max)
      : [];
  const get = (id: unknown) => {
    const b = typeof id === "string" ? resources.get(id) : undefined;
    if (!b) throw new Error("Resource ID is not in this library");
    return b;
  };
  const metadata = (b: Resource) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    subjects: b.subjects,
    fiction: b.fiction,
    pages: b.pages,
    summary: b.modelCatalog?.summary || "",
    domain: b.modelCatalog?.domain || "",
    documentType: b.modelCatalog?.documentType || "",
  });
  const remember = (b: Resource) => {
    if (!seen.has(b.id))
      seen.set(b.id, {
        id: b.id,
        score: 1,
        page: 1,
        excerpt: "",
        whole: true,
        reason: "Resource metadata",
        passages: [],
      });
  };
  const read = (b: Resource, pages: number[]) =>
    pages.slice(0, 3).map((page) => {
      if (!Number.isInteger(page) || page < 1 || page > b.pages)
        throw new Error("Page is outside this PDF");
      const text = b.texts?.[page - 1] || "";
      if (text.trim()) {
        verified.add(b.id + ":" + page);
        const hit = seen.get(b.id)!;
        if (!hit.passages.some((p) => p.page === page))
          hit.passages.push({ page, excerpt: text.slice(0, 1800), hits: 1 });
      }
      return {
        page,
        text: text.slice(0, 1800),
        ...(text.trim()
          ? {}
          : { note: "No extracted text on this page; OCR may be needed." }),
      };
    });
  const select = (value: unknown) =>
    ids(value)
      .filter(
        (id) => seen.has(id) && (!originalFoodHits || originalFoodHits.has(id)),
      )
      .map((id) => seen.get(id)!);
  const finish = (args: Record<string, unknown>): LibrarianResult => {
    const hits = select(args.resourceIds);
    const sources = (Array.isArray(args.sources) ? args.sources : [])
      .filter(
        (s): s is { id: string; page: number } =>
          !!s &&
          typeof s === "object" &&
          typeof s.id === "string" &&
          Number.isInteger(s.page) &&
          hits.some((h) => h.id === s.id) &&
          verified.has(s.id + ":" + s.page),
      )
      .slice(0, 5);
    let answer =
      typeof args.answer === "string" ? args.answer.slice(0, 4000) : "";
    if (!hits.length && !answer.includes("?"))
      answer =
        "I couldn’t find supporting resources in your library for that request.";
    if (
      /^(what is|what are|who is|why |how does|how do|define |explain )/i.test(
        question,
      ) &&
      hits.length &&
      !sources.length
    )
      answer =
        "I found related resources, but not enough verified page evidence to answer that question.";
    if (
      /\b(compare|difference|similarities|contrast)\b/i.test(question) &&
      hits.length > 1 &&
      new Set(sources.map((s) => s.id)).size < 2
    )
      answer =
        "I found resources to compare, but need verified passages from each before making a comparison.";
    if (
      !/^(what is|what are|who is|why |how does|how do|define |explain )/i.test(
        question,
      ) &&
      !/\b(compare|difference|similarities|contrast)\b/i.test(question) &&
      !answer.includes("?")
    )
      answer = hits.length
        ? `Found ${hits.length} matching ${hits.length === 1 ? "resource" : "resources"} in your library.`
        : "I couldn’t find supporting resources in your library for that request.";
    onShow(hits);
    return {
      answer: answer || "Here are the matching resources.",
      hits,
      sources,
    };
  };
  try {
    for (let round = 0; round < 8; round++) {
      check();
      onActivity(
        round ? "Checking library context…" : "Understanding your request…",
      );
      const response = await api.agentStep({ messages }, key);
      check();
      messages.push(response);
      const toolCalls = response.tool_calls || [];
      if (!toolCalls.length) {
        if (!seen.size)
          throw new Error(
            "This model did not use the library tools. Try a different librarian model.",
          );
        const candidates = [...seen].slice(0, 12).map(([id, hit]) => ({
          ...metadata(resources.get(id)!),
          passages: hit.passages,
        }));
        const result = await api.answer({ question, candidates }, key);
        return finish({
          answer: result.answer,
          resourceIds: result.resourceIds,
          sources: result.sources,
        });
      }
      for (const call of toolCalls) {
        check();
        if (++callCount > 16)
          throw new Error(
            "Librarian reached its tool limit. Try a more specific request.",
          );
        const name = call.function.name;
        const args = call.function.arguments || {};
        const fingerprint = JSON.stringify([name, args]);
        if (calls.has(fingerprint)) {
          messages.push({
            role: "tool",
            tool_name: name,
            content: JSON.stringify({
              error:
                "This call was already made. Use its previous result or finish.",
            }),
          });
          continue;
        }
        calls.add(fingerprint);
        if (name === "finish") return finish(args);
        let result: unknown;
        try {
          switch (name) {
            case "search_library": {
              onActivity("Searching the library…");
              if (typeof args.query !== "string" || !args.query.trim())
                throw new Error("A search query is required");
              const hits = (
                await search(
                  args.query.slice(0, 500) +
                    (foodRequest
                      ? " cooking" + (wholeBookRequest ? " book" : "")
                      : ""),
                )
              )
                .filter((h) => {
                  const b = resources.get(h.id);
                  return (
                    b &&
                    (genre === "both" || b.fiction === (genre === "fiction"))
                  );
                })
                .slice(0, 10);
              check();
              for (const h of hits)
                seen.set(h.id, { ...h, passages: [...h.passages] });
              result = hits.map((h) => ({
                ...metadata(resources.get(h.id)!),
                passages: h.passages.slice(0, 2),
              }));
              break;
            }
            case "get_resource": {
              onActivity("Inspecting a resource…");
              const b = get(args.id);
              remember(b);
              result = metadata(b);
              break;
            }
            case "read_pages": {
              onActivity("Reading source pages…");
              const b = get(args.id);
              remember(b);
              if (!Array.isArray(args.pages))
                throw new Error("Provide physical page numbers");
              result = {
                resource: metadata(b),
                pages: read(
                  b,
                  args.pages.filter((n): n is number => typeof n === "number"),
                ),
              };
              break;
            }
            case "compare_resources": {
              onActivity("Comparing sources…");
              const chosen = ids(args.ids, 4);
              if (chosen.length < 2)
                throw new Error("Choose at least two resource IDs");
              const matches =
                typeof args.query === "string"
                  ? await search(
                      args.query.slice(0, 500) +
                        (foodRequest
                          ? " cooking" + (wholeBookRequest ? " book" : "")
                          : ""),
                    )
                  : [];
              check();
              result = chosen.map((id) => {
                const b = get(id);
                remember(b);
                const hit = matches.find((h) => h.id === id) || seen.get(id)!;
                seen.set(id, { ...hit, passages: [...hit.passages] });
                return {
                  ...metadata(b),
                  pages: read(
                    b,
                    hit.passages.slice(0, 2).map((p) => p.page),
                  ),
                };
              });
              break;
            }
            case "show_resources": {
              onActivity("Bringing up resources…");
              shown = select(args.ids);
              onShow(shown);
              result = { shownResourceIds: shown.map((h) => h.id) };
              break;
            }
            case "open_resource": {
              if (!/\b(open|read|pull up|bring up)\b/i.test(question))
                throw new Error(
                  "The user must explicitly ask to open a PDF. Use show_resources for covers.",
                );
              const b = get(args.id);
              const page = typeof args.page === "number" ? args.page : 1;
              if (!Number.isInteger(page) || page < 1 || page > b.pages)
                throw new Error("Invalid page");
              remember(b);
              onOpen(b, page);
              result = { opened: b.id, page };
              break;
            }
            default:
              throw new Error("Unknown library tool");
          }
        } catch (error) {
          result = {
            error: error instanceof Error ? error.message : "Tool failed",
          };
        }
        messages.push({
          role: "tool",
          tool_name: name,
          content: JSON.stringify(result).slice(0, 6500),
        });
      }
    }
    throw new Error(
      "Librarian reached its reasoning limit. Try narrowing the request.",
    );
  } finally {
    signal.removeEventListener("abort", stop);
  }
}
