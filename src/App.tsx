import ModelSettingsDialog from "./ModelSettingsDialog";
import { runLibrarianAgent } from "./librarian-agent";
import type { ModelSettings } from "./local-models";
import type { SearchHit } from "./retrieval-index";
import { useRetrieval } from "./useRetrieval";
import {
  catalogSubjects,
  catalogVersion,
  refreshCatalog,
  needsCategory,
  cleanSubjects,
} from "./catalog";
import CategoryPrompt from "./CategoryPrompt";
import { terms, wantsFiction } from "./retrieval";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Library,
  Compass,
  ArrowUpRight,
  ArrowUp,
  Orbit,
  Upload,
  MessageSquare,
  Maximize2,
  Clock3,
  Settings2,
  Square,
  ChevronLeft,
  ChevronRight,
  X,
  Grid2X2,
  List,
  SlidersHorizontal,
  Sparkles,
  FolderOpen,
  Check,
  Loader2,
  MoreHorizontal,
  Quote,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Universe from "./Universe";
import { clusterPosition } from "./space";
import { db, samples, type Resource } from "./data";
pdfjs.GlobalWorkerOptions.workerSrc = worker;
type Message = {
  role: "user" | "assistant";
  text: string;
  source?: { id: string; page: number };
  sources?: { id: string; page: number }[];
};
function Cover({ book }: { book: Resource }) {
  return (
    <div
      className={"cover design-" + book.design}
      style={{ "--cover": book.color } as React.CSSProperties}
    >
      {book.cover ? (
        <img src={book.cover} alt={book.title} />
      ) : (
        <>
          <div className="cover-top">THE SPECULIB COLLECTION</div>
          <div className="cover-name">{book.title}</div>
          <div className="cover-art">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="cover-author">{book.author}</div>
        </>
      )}
    </div>
  );
}
function Reader({
  book,
  page,
  onClose,
}: {
  book: Resource;
  page: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(page);
  const [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!book.data) return;
    let cancelled = false;
    let doc: pdfjs.PDFDocumentProxy | undefined;
    let task: pdfjs.RenderTask | undefined;
    const loading = pdfjs.getDocument({ data: book.data.slice(0) });
    (async () => {
      doc = await loading.promise;
      const p = await doc.getPage(current);
      if (cancelled) return;
      const view = p.getViewport({ scale: 1.5 });
      canvas.current!.width = view.width;
      canvas.current!.height = view.height;
      task = p.render({
        canvasContext: canvas.current!.getContext("2d")!,
        viewport: view,
      });
      await task.promise;
    })().catch((e) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
      task?.cancel();
      void loading.destroy();
    };
  }, [book, current]);
  return (
    <div className="reader">
      <div className="reader-toolbar">
        <button onClick={onClose}>
          <ArrowLeft size={16} /> Library
        </button>
        <span>{book.title}</span>
        <div>
          <button
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => setCurrent((p) => p - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <input
            aria-label="Page number"
            type="number"
            min="1"
            max={book.pages}
            value={current}
            onChange={(e) =>
              setCurrent(
                Math.max(1, Math.min(book.pages, Number(e.target.value) || 1)),
              )
            }
          />
          <small>/ {book.pages}</small>
          <button
            aria-label="Next page"
            disabled={current >= book.pages}
            onClick={() => setCurrent((p) => p + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="paper-area">
        {book.data ? (
          <>
            <canvas ref={canvas} />
            {error && <p>{error}</p>}
          </>
        ) : (
          <div className="demo-reader">
            <BookOpen size={40} />
            <h2>This is a preview resource</h2>
            <p>Import a PDF to read your own books here.</p>
            <button onClick={onClose}>Back to your library</button>
          </div>
        )}
      </div>
    </div>
  );
}
export default function App() {
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    try {
      return localStorage.getItem("speculib.leftCollapsed") === "true";
    } catch {
      return false;
    }
  });
  const [rightCollapsed, setRightCollapsed] = useState(() => {
    try {
      return localStorage.getItem("speculib.rightCollapsed") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("speculib.leftCollapsed", String(leftCollapsed));
      localStorage.setItem("speculib.rightCollapsed", String(rightCollapsed));
    } catch {
      /* Layout remains usable when storage is unavailable. */
    }
  }, [leftCollapsed, rightCollapsed]);
  const [books, setBooks] = useState<Resource[]>([]);
  const [modelSettings, setModelSettings] = useState<ModelSettings>({
    librarianModel: "",
    categorizerModel: "",
  });
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(!window.localModels);
  const [modelQuery, setModelQuery] = useState<string | null>(null);
  const [modelResults, setModelResults] = useState<{
    query: string;
    hits: SearchHit[];
  } | null>(null);
  const [activity, setActivity] = useState("Searching library…");
  const activeAgent = useRef<AbortController | null>(null);
  const categorizing = useRef(false);
  const categoryAttempts = useRef(new Set<string>());
  const [categoryTick, setCategoryTick] = useState(0);
  const booksRef = useRef(books);
  booksRef.current = books;
  const settingsRef = useRef(modelSettings);
  settingsRef.current = modelSettings;
  useEffect(() => {
    let cancelled = false;
    window.localModels
      ?.settings()
      .then((settings) => {
        if (!cancelled) setModelSettings(settings);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setModelsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [loaded, setLoaded] = useState(false);
  const [shelf, setShelf] = useState("All resources");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [exploring, setExploring] = useState(false);
  const [selected, setSelected] = useState<{
    book: Resource;
    page: number;
  } | null>(null);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const askSequence = useRef(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState("");
  const [list, setList] = useState(false);
  const [sort, setSort] = useState("recent");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Resource | null>(null);
  const [deferredCategories, setDeferredCategories] = useState<Set<string>>(
    () => new Set(),
  );
  const file = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const display = books.length ? books : samples;
  const usingModel = modelQuery === search;
  const retrieval = useRetrieval(display, search, !usingModel);
  const resultById = useMemo(
    () =>
      usingModel
        ? new Map(
            (modelResults?.query === search ? modelResults.hits : []).map(
              (h) => [h.id, h],
            ),
          )
        : retrieval.byId,
    [usingModel, modelResults, search, retrieval.byId],
  );
  const searchBusy = usingModel ? asking : retrieval.busy;
  useEffect(() => {
    const model = modelSettings.categorizerModel;
    if (
      !modelsLoaded ||
      asking ||
      !model ||
      !window.localModels ||
      categorizing.current
    )
      return;
    const book = books.find(
      (b) =>
        !b.subjectsEdited &&
        b.texts?.some((t) => t.trim()) &&
        b.modelCatalog?.model !== model &&
        !categoryAttempts.current.has(b.id + ":" + model),
    );
    if (!book) return;
    const attempt = book.id + ":" + model;
    categoryAttempts.current.add(attempt);
    categorizing.current = true;
    setBooks((old) =>
      old.map((b) =>
        b.id === book.id ? { ...b, classificationStatus: "pending" } : b,
      ),
    );
    const count = book.texts!.length;
    const indices = [
      ...new Set([
        0,
        1,
        2,
        3,
        ...Array.from({ length: 8 }, (_, i) =>
          Math.floor((i * Math.max(0, count - 1)) / 7),
        ),
      ]),
    ]
      .filter((i) => i < count)
      .slice(0, 12);
    window.localModels
      .classify(
        {
          title: book.title,
          author: book.author,
          pages: indices.map((i) => ({ page: i + 1, text: book.texts![i] })),
        },
        "category-" + book.id,
      )
      .then(async (catalog) => {
        const latest = booksRef.current.find((b) => b.id === book.id);
        if (
          !latest ||
          latest.subjectsEdited ||
          settingsRef.current.categorizerModel !== model
        )
          return;
        const updated: Resource = {
          ...latest,
          subjects: catalog.needsUser
            ? ["Uncategorized"]
            : cleanSubjects(catalog.subjects),
          fiction:
            catalog.fiction === "unknown"
              ? latest.fiction
              : catalog.fiction === "fiction",
          modelCatalog: catalog,
          classificationStatus: "complete",
          catalogVersion,
        };
        await db("put", updated);
        setBooks((old) =>
          old.map((b) =>
            b.id === updated.id && !b.subjectsEdited ? updated : b,
          ),
        );
      })
      .catch((error) => {
        if (String(error?.message).includes("Categorization paused"))
          categoryAttempts.current.delete(attempt);
        setBooks((old) =>
          old.map((b) =>
            b.id === book.id && !b.subjectsEdited
              ? { ...b, classificationStatus: "failed" }
              : b,
          ),
        );
      })
      .finally(() => {
        categorizing.current = false;
        setCategoryTick((t) => t + 1);
      });
  }, [
    books,
    modelSettings.categorizerModel,
    modelsLoaded,
    categoryTick,
    asking,
  ]);
  useEffect(() => {
    db("get")
      .then(async (b: Resource[]) => {
        const updated = b.map((book) =>
          refreshCatalog(
            book.classificationStatus === "pending"
              ? { ...book, classificationStatus: "failed" }
              : book,
          ),
        );
        await Promise.all(
          updated.filter((r, i) => r !== b[i]).map((r) => db("put", r)),
        );
        setBooks(updated);
        setLoaded(true);
      })
      .catch(() => {
        setStatus("Local storage is unavailable. Please restart the app.");
        setLoaded(true);
      });
  }, []);
  useEffect(() => {
    if (messages.length) {
      const pane = chatEnd.current?.parentElement;
      if (pane) pane.scrollTop = pane.scrollHeight;
    }
  }, [messages]);
  const select = useCallback((book: Resource) => {
    setSelected({ book, page: 1 });
    setExploring(false);
  }, []);
  async function importFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      try {
        if (!f.name.toLowerCase().endsWith(".pdf"))
          throw Error("Choose a PDF file.");
        setStatus("Reading " + f.name + "…");
        const data = await f.arrayBuffer();
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
        )
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
        if (await db("has", hash)) {
          setStatus(f.name + " is already in your library.");
          continue;
        }
        const pdf = await pdfjs.getDocument({ data: data.slice(0) }).promise;
        try {
          const metadata = await pdf.getMetadata();
          const info = metadata.info as { Title?: string; Author?: string };
          const texts: string[] = [];
          let cover = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            setStatus(`Indexing ${f.name} · ${i} / ${pdf.numPages}`);
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            texts.push(
              content.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" "),
            );
            if (i === 1) {
              const viewport = page.getViewport({ scale: 0.45 });
              const c = document.createElement("canvas");
              c.width = viewport.width;
              c.height = viewport.height;
              await page.render({
                canvasContext: c.getContext("2d")!,
                viewport,
              }).promise;
              cover = c.toDataURL("image/jpeg", 0.8);
            }
          }
          const title =
            info.Title?.trim() ||
            f.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
          const topics = catalogSubjects(title, texts);
          const b: Resource = {
            id: hash,
            title,
            author: info.Author || "Unknown author",
            subjects: topics.length ? topics : ["Uncategorized"],
            fiction: false,
            catalogVersion,
            color: "#91a99a",
            design: books.length % 6,
            pages: pdf.numPages,
            added: Date.now(),
            cover,
            data,
            texts,
          };
          await db("put", b);
          setBooks((old) => [...old, b]);
          setStatus(
            texts.join("").trim()
              ? `Added “${title}” · subjects suggested; edit to correct fiction and categories.`
              : `Added “${title}” · scanned PDF: OCR is needed before it can be searched.`,
          );
        } finally {
          await pdf.destroy();
        }
      } catch (e) {
        setStatus(
          `Could not import ${f.name}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    if (file.current) file.current.value = "";
  }
  async function ask(text = input) {
    if (!text.trim()) return;
    setInput("");
    const prior = messages.filter((m) => m.role === "user").at(-1)?.text;
    const request =
      /^(tell me more|more|show resources)/i.test(text) && prior ? prior : text;
    const ts = terms(request);
    const fiction = wantsFiction(request);
    activeAgent.current?.abort();
    const sequence = ++askSequence.current;
    setMessages((m) => [...m, { role: "user", text }]);
    setAsking(true);
    setQuery(request);
    setSearch(request);
    setShelf("All resources");
    setFilter(fiction ? "fiction" : "nonfiction");
    setSelected(null);
    try {
      if (modelSettings.librarianModel && window.localModels && books.length) {
        setModelQuery(request);
        setModelResults({ query: request, hits: [] });
        const controller = new AbortController();
        activeAgent.current = controller;
        const timeout = setTimeout(() => controller.abort(), 120000);
        try {
          const result = await runLibrarianAgent({
            api: window.localModels,
            question: request,
            history: messages,
            books,
            search: retrieval.runQuery,
            key: "librarian-" + sequence,
            signal: controller.signal,
            onActivity: (value) => {
              if (sequence === askSequence.current) setActivity(value);
            },
            onShow: (hits) => {
              if (sequence === askSequence.current) {
                setModelResults({ query: request, hits });
                setFilter(
                  hits.some((h) => books.find((b) => b.id === h.id)?.fiction)
                    ? hits.some(
                        (h) => !books.find((b) => b.id === h.id)?.fiction,
                      )
                      ? "all"
                      : "fiction"
                    : "nonfiction",
                );
              }
            },
            onOpen: (book, page) => {
              if (sequence === askSequence.current) setSelected({ book, page });
            },
          });
          if (sequence === askSequence.current)
            setMessages((m) => [
              ...m,
              {
                role: "assistant",
                text: result.answer,
                sources: result.sources,
              },
            ]);
        } finally {
          clearTimeout(timeout);
          if (activeAgent.current === controller) activeAgent.current = null;
        }
        return;
      }
      setModelQuery(null);
      const candidates =
        books.length && ts.length
          ? (await retrieval.runQuery(request)).flatMap((hit) => {
              const book = books.find((b) => b.id === hit.id);
              return book && book.fiction === fiction ? [{ book, ...hit }] : [];
            })
          : [];
      if (sequence !== askSequence.current) return;
      let response = "";
      let source: Message["source"];
      if (!books.length)
        response =
          "Your library is ready for its first PDF. Import a resource and I can search its text and bring you back to the source. The books on display are preview covers.";
      else if (!ts.length)
        response =
          "Tell me a subject, title, or phrase to look for in your library.";
      else if (!candidates.length)
        response =
          "I couldn’t find supporting material in your library. Try another subject or import a resource that covers it.";
      else {
        const simple = /^(what is|what are|define|who is)\b/i.test(request);
        if (simple && candidates[0].excerpt) {
          response =
            "Here’s a passage from your library:\n“" +
            candidates[0].excerpt +
            "…”";
          source = { id: candidates[0].book.id, page: candidates[0].page };
        } else
          response = `I found ${candidates.length} ${fiction ? "fiction" : "nonfiction"} resource${candidates.length === 1 ? "" : "s"} in your library. They’re on the shelf in the middle. Select a cover to open it, or a passage to jump to its page.`;
      }
      setMessages((m) => [...m, { role: "assistant", text: response, source }]);
    } catch (error) {
      if (sequence === askSequence.current && modelSettings.librarianModel) {
        setModelQuery(null);
        setActivity("Searching library…");
      }
      if (sequence === askSequence.current)
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text:
              error instanceof Error
                ? error.message
                : "Search failed. Please try again.",
          },
        ]);
    } finally {
      if (sequence === askSequence.current) setAsking(false);
    }
  }
  const shown = useMemo(
    () =>
      display
        .filter(
          (b) =>
            (shelf === "All resources" ||
              shelf === "Recently added" ||
              b.subjects.includes(shelf)) &&
            (filter === "all" || b.fiction === (filter === "fiction")) &&
            (!search || resultById.has(b.id)),
        )
        .sort((a, b) =>
          search
            ? (resultById.get(b.id)?.score || 0) -
              (resultById.get(a.id)?.score || 0)
            : sort === "title"
              ? a.title.localeCompare(b.title)
              : b.added - a.added,
        ),
    [display, shelf, filter, search, sort, resultById],
  );
  const allSubjects = Array.from(new Set(display.flatMap((b) => b.subjects)));
  const uncategorized = books.find(
    (b) =>
      modelsLoaded &&
      needsCategory(b) &&
      !deferredCategories.has(b.id) &&
      !(
        modelSettings.categorizerModel &&
        b.texts?.some((t) => t.trim()) &&
        !b.subjectsEdited &&
        !categoryAttempts.current.has(
          b.id + ":" + modelSettings.categorizerModel,
        )
      ),
  );
  return (
    <div
      className={`app ${exploring ? "exploring" : ""} ${leftCollapsed ? "left-collapsed" : ""} ${rightCollapsed ? "right-collapsed" : ""}`}
    >
      <Universe books={display} exploring={exploring} onSelect={select} />
      <header className="app-bar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setExploring(false);
            setSelected(null);
          }}
          aria-label="Speculib library"
        >
          <Orbit size={25} strokeWidth={1.3} />
          <span>speculib</span>
        </a>
        <div className="mode-switch" aria-label="View mode">
          <button
            className={!exploring ? "active" : ""}
            onClick={() => setExploring(false)}
          >
            <Library size={15} /> Library
          </button>
          <button
            className={exploring ? "active" : ""}
            onClick={() => setExploring(true)}
          >
            <Orbit size={15} /> Explore
          </button>
        </div>
        <div className="header-actions">
          <button
            className="model-settings-trigger"
            title="Model settings"
            aria-label="Model settings"
            onClick={() => setShowModelSettings(true)}
          >
            <Settings2 size={18} />
          </button>
          <span className="app-status">
            <i className="local-dot" /> Local library{" "}
            <span>{books.length} PDFs</span>
          </span>
        </div>
      </header>
      <input
        ref={file}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => void importFiles(e.target.files)}
      />
      {exploring ? (
        <>
          <button className="exit-explore" onClick={() => setExploring(false)}>
            <ArrowLeft size={16} /> Return to library
          </button>
          <div className="explore-caption">
            <span>{display.length} resources</span>
          </div>
          <div className="flight-help">
            Drag to look around <span>·</span> Scroll to move closer{" "}
            <span>·</span> WASD to fly <span>·</span> Double-click a cover to
            open
          </div>
        </>
      ) : (
        <>
          <aside
            id="library-navigation"
            className={`sidebar ${leftCollapsed ? "panel-collapsed" : ""}`}
            aria-label="Library navigation"
          >
            <button
              className="panel-toggle left-toggle"
              aria-label={
                leftCollapsed
                  ? "Expand library navigation"
                  : "Collapse library navigation"
              }
              title={
                leftCollapsed
                  ? "Expand library navigation"
                  : "Collapse library navigation"
              }
              aria-expanded={!leftCollapsed}
              aria-controls="library-navigation"
              onClick={() => setLeftCollapsed((value) => !value)}
            >
              {leftCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <div className="sidebar-head">
              <Library size={17} />
              <span>Library</span>
            </div>
            <form
              className="searchbox"
              onSubmit={(e) => {
                e.preventDefault();
                activeAgent.current?.abort();
                askSequence.current++;
                setAsking(false);
                setModelQuery(null);
                setModelResults(null);
                setSearch(query);
                setSelected(null);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search library"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!e.target.value) setSearch("");
                }}
                placeholder="Search library"
              />
              {query && (
                <button
                  type="button"
                  title="Clear search"
                  onClick={() => {
                    setQuery("");
                    setSearch("");
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </form>

            <button
              className={
                "nav-item " + (shelf === "All resources" ? "chosen" : "")
              }
              onClick={() => {
                setShelf("All resources");
                setSearch("");
                setQuery("");
                setSelected(null);
              }}
            >
              <Library size={17} /> All resources{" "}
              <small>{display.length}</small>
            </button>
            <button
              className={
                "nav-item " + (shelf === "Recently added" ? "chosen" : "")
              }
              onClick={() => {
                setShelf("Recently added");
                setSelected(null);
              }}
            >
              <Clock3 size={17} /> Recently added
            </button>
            <button className="nav-item" onClick={() => setExploring(true)}>
              <Orbit size={17} /> Explore <ArrowUpRight size={14} />
            </button>
            <div className="nav-label shelves-label">
              Subjects <span>{allSubjects.length}</span>
            </div>
            <div className="shelves">
              {allSubjects.map((s) => (
                <button
                  key={s}
                  className={"nav-item " + (shelf === s ? "chosen" : "")}
                  onClick={() => {
                    setShelf(s);
                    setSearch("");
                    setQuery("");
                    setSelected(null);
                  }}
                >
                  <span
                    className="shelf-dot"
                    style={{ background: clusterPosition(s).color }}
                  />
                  {s}
                  <small>
                    {display.filter((b) => b.subjects.includes(s)).length}
                  </small>
                </button>
              ))}
            </div>
            <button className="import" onClick={() => file.current?.click()}>
              <Upload size={16} /> Import PDFs <Plus size={14} />
            </button>
            <div className="sidebar-bottom">
              <div className="local-dot" />
              <div>Stored locally</div>
            </div>
          </aside>
          <main className="main">
            {selected ? (
              <Reader
                book={selected.book}
                page={selected.page}
                onClose={() => setSelected(null)}
              />
            ) : (
              <div className="library-content">
                <section
                  className="map-stage"
                  aria-label="Entire library subject map"
                >
                  <div className="map-legend">
                    {Array.from(new Set(display.map((b) => b.subjects[0])))
                      .slice(0, 5)
                      .map((subject) => (
                        <span key={subject}>
                          <i
                            style={{
                              background: clusterPosition(subject).color,
                            }}
                          />
                          {subject}
                        </span>
                      ))}
                  </div>
                  <button
                    className="enter-space"
                    onClick={() => setExploring(true)}
                  >
                    <Maximize2 size={15} /> Explore in 3D
                  </button>
                </section>
                <section className="resource-panel" aria-label="Resources">
                  <div className="resource-heading">
                    <div>
                      <h1>{search ? "Search results" : shelf}</h1>
                      <span>
                        {shown.length}{" "}
                        {shown.length === 1 ? "resource" : "resources"}
                      </span>
                    </div>
                    {search && (
                      <button
                        className="clear-results"
                        onClick={() => {
                          setQuery("");
                          setSearch("");
                        }}
                      >
                        <X size={13} /> Clear search
                      </button>
                    )}
                  </div>
                  {search && (
                    <p className="search-context">Results for “{search}”</p>
                  )}
                  <div className="library-tools">
                    <div className="tabs">
                      {["all", "nonfiction", "fiction"].map((f) => (
                        <button
                          className={filter === f ? "active" : ""}
                          onClick={() => setFilter(f)}
                          key={f}
                        >
                          {f === "all"
                            ? "All"
                            : f === "nonfiction"
                              ? "Nonfiction"
                              : "Fiction"}
                        </button>
                      ))}
                    </div>
                    <div className="view-tools">
                      <select
                        aria-label="Sort resources"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="recent">Recently added</option>
                        <option value="title">Title A–Z</option>
                      </select>
                      <button
                        title="Grid view"
                        className={!list ? "active" : ""}
                        onClick={() => setList(false)}
                      >
                        <Grid2X2 size={16} />
                      </button>
                      <button
                        title="List view"
                        className={list ? "active" : ""}
                        onClick={() => setList(true)}
                      >
                        <List size={17} />
                      </button>
                    </div>
                  </div>
                  {!books.length && loaded && (
                    <div className="preview-note">
                      Preview resources. Import a PDF to start.
                    </div>
                  )}
                  {searchBusy && (
                    <p className="search-progress" role="status">
                      <Loader2 size={14} className="spin" /> Searching library…
                    </p>
                  )}
                  {retrieval.error && (
                    <p className="search-progress" role="alert">
                      {retrieval.error}
                    </p>
                  )}
                  <div className="resource-scroll">
                    <div className={"book-grid " + (list ? "list-view" : "")}>
                      {shown.map((b) => {
                        const m = search ? resultById.get(b.id) : null;
                        return (
                          <article className="book" key={b.id}>
                            <button
                              className="cover-button"
                              onClick={() => select(b)}
                              aria-label={"Open " + b.title}
                            >
                              <Cover book={b} />
                              <span className="open-cover">
                                <BookOpen size={18} /> Open resource
                              </span>
                            </button>
                            <div className="book-info">
                              <div className="book-meta">
                                <span>
                                  {b.fiction ? "Fiction" : "Nonfiction"}
                                </span>
                                <button
                                  title="Edit resource details"
                                  onClick={() =>
                                    setEditing({
                                      ...b,
                                      subjects: [...b.subjects],
                                    })
                                  }
                                >
                                  <MoreHorizontal size={17} />
                                </button>
                              </div>
                              <button
                                className="book-title"
                                onClick={() => select(b)}
                              >
                                {b.title}
                              </button>
                              <p>{b.author}</p>
                              <div className="subject-tags">
                                {b.subjects.slice(0, 2).map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => {
                                      setShelf(s);
                                      setSearch("");
                                      setQuery("");
                                    }}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                              {m && (
                                <div className="match-info">
                                  {m.whole
                                    ? m.reason
                                    : `Passage · page ${m.page}`}
                                  {m.passages.slice(0, 3).map((p) => (
                                    <button
                                      key={p.page}
                                      title={p.excerpt}
                                      onClick={() =>
                                        setSelected({ book: b, page: p.page })
                                      }
                                    >
                                      <Quote size={12} /> Read passage · p.{" "}
                                      {p.page}
                                      <ArrowUpRight size={12} />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {!shown.length && !searchBusy && !retrieval.error && (
                      <div className="empty">
                        <Search size={28} />
                        <h2>No resources found</h2>
                        <p>Try another topic or broaden your filters.</p>
                        <button
                          onClick={() => {
                            setSearch("");
                            setQuery("");
                            setFilter("all");
                            setShelf("All resources");
                          }}
                        >
                          Show all resources
                        </button>
                      </div>
                    )}
                  </div>
                  <footer className="library-footer">
                    <span>
                      {shown.length} resources <span>·</span>{" "}
                      {books.length ? "Local library" : "Preview collection"}
                    </span>
                  </footer>
                </section>
              </div>
            )}
          </main>
          <aside
            id="librarian-panel"
            className={`librarian ${rightCollapsed ? "panel-collapsed" : ""}`}
            aria-label="Librarian"
          >
            <button
              className="panel-toggle right-toggle"
              aria-label={
                rightCollapsed ? "Expand librarian" : "Collapse librarian"
              }
              title={rightCollapsed ? "Expand librarian" : "Collapse librarian"}
              aria-expanded={!rightCollapsed}
              aria-controls="librarian-panel"
              onClick={() => setRightCollapsed((value) => !value)}
            >
              {rightCollapsed ? (
                <PanelRightOpen size={18} />
              ) : (
                <PanelRightClose size={18} />
              )}
            </button>
            <div className="librarian-heading">
              <MessageSquare size={18} />
              <div>
                <h2>Librarian</h2>
                <span className="model-identity">
                  {modelSettings.librarianModel || "Text search"}
                </span>
              </div>
              <button
                title="Clear conversation"
                onClick={() => {
                  activeAgent.current?.abort();
                  askSequence.current++;
                  setAsking(false);
                  setMessages([]);
                }}
              >
                <Plus size={17} />
              </button>
            </div>
            <div className="chat-body">
              {messages.length === 0 ? (
                <>
                  <div className="chat-empty-symbol">
                    <MessageSquare size={26} strokeWidth={1.2} />
                  </div>
                  <h3>What are you looking for?</h3>
                  <p className="chat-intro">
                    Search across your books, down to the page.
                  </p>
                  {[
                    "Find books about machine learning",
                    "Find stories about artificial intelligence",
                    "Do I have any cooking books?",
                  ].map((t, i) => (
                    <button
                      className="suggestion"
                      key={t}
                      onClick={() => ask(t)}
                    >
                      <span>
                        {i === 0 ? (
                          <BookOpen size={15} />
                        ) : i === 1 ? (
                          <Sparkles size={15} />
                        ) : (
                          <Search size={15} />
                        )}
                      </span>
                      {t}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={"message " + m.role}>
                    <small>
                      {m.role === "assistant" ? "LIBRARIAN" : "YOU"}
                    </small>
                    <p>{m.text}</p>
                    {(m.sources || (m.source ? [m.source] : [])).map(
                      (source, i) => (
                        <button
                          key={source.id + ":" + source.page + ":" + i}
                          className="source-link"
                          onClick={() => {
                            const b = books.find((b) => b.id === source.id);
                            if (b) setSelected({ book: b, page: source.page });
                          }}
                        >
                          Open source · p. {source.page}
                          <ArrowUpRight size={13} />
                        </button>
                      ),
                    )}
                  </div>
                ))
              )}
              {asking && (
                <p className="search-progress" role="status">
                  <Loader2 size={14} className="spin" /> {activity}
                  {modelSettings.librarianModel && (
                    <button
                      title="Stop librarian"
                      aria-label="Stop librarian"
                      onClick={() => {
                        activeAgent.current?.abort();
                        askSequence.current++;
                        setAsking(false);
                      }}
                    >
                      <Square size={12} />
                    </button>
                  )}
                </p>
              )}
              <div ref={chatEnd} />
            </div>
            <div className="chat-compose">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask();
                }}
              >
                <textarea
                  aria-label="Ask your librarian"
                  placeholder="Ask about your library…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask();
                    }
                  }}
                />
                <div>
                  <span>Enter to send</span>
                  <button aria-label="Send message" disabled={!input.trim()}>
                    <ArrowUp size={17} />
                  </button>
                </div>
              </form>
              <small>
                <BookOpen size={11} /> Uses only your library
              </small>
            </div>
          </aside>
        </>
      )}
      {status && (
        <div className="toast" role="status">
          {status.startsWith("Indexing") || status.startsWith("Reading") ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}
          <span>{status}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setStatus("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {showModelSettings && (
        <ModelSettingsDialog
          onClose={() => setShowModelSettings(false)}
          onSaved={(settings) => {
            activeAgent.current?.abort();
            askSequence.current++;
            setAsking(false);
            setModelQuery(null);
            for (const book of books)
              if (book.classificationStatus === "pending")
                void window.localModels?.cancel("category-" + book.id);
            categoryAttempts.current.clear();
            setBooks((old) =>
              old.map((book) =>
                book.classificationStatus === "pending"
                  ? { ...book, classificationStatus: "failed" }
                  : book,
              ),
            );
            setModelSettings(settings);
            setStatus("Local model settings saved.");
          }}
        />
      )}
      {uncategorized && !editing && !exploring && !showModelSettings && (
        <CategoryPrompt
          key={uncategorized.id}
          book={uncategorized}
          subjects={cleanSubjects(allSubjects)}
          onLater={() =>
            setDeferredCategories((old) => new Set([...old, uncategorized.id]))
          }
          onSave={async (subjects, fiction) => {
            const updated = {
              ...uncategorized,
              subjects,
              fiction,
              subjectsEdited: true,
              modelCatalog: undefined,
              classificationStatus: undefined,
              catalogVersion,
            };
            await db("put", updated);
            setBooks((old) =>
              old.map((b) => (b.id === updated.id ? updated : b)),
            );
          }}
        />
      )}
      {editing && (
        <div className="modal-backdrop">
          <form
            className="edit-modal"
            onSubmit={async (e) => {
              e.preventDefault();
              if (books.some((b) => b.id === editing.id)) {
                const saved = {
                  ...editing,
                  subjectsEdited: true,
                  modelCatalog: undefined,
                  classificationStatus: undefined,
                  catalogVersion,
                };
                await db("put", saved);
                setBooks((old) =>
                  old.map((b) => (b.id === editing.id ? saved : b)),
                );
              } else
                setStatus(
                  "Preview resources cannot be changed. Import your own PDF first.",
                );
              setEditing(null);
            }}
          >
            <div>
              <h2>Resource details</h2>
              <button type="button" onClick={() => setEditing(null)}>
                <X size={20} />
              </button>
            </div>
            <label>
              Title
              <input
                required
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            <label>
              Author
              <input
                value={editing.author}
                onChange={(e) =>
                  setEditing({ ...editing, author: e.target.value })
                }
              />
            </label>
            <label>
              Subjects · separated by commas
              <input
                value={editing.subjects.join(", ")}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    subjects: e.target.value.split(",").map((s) => s.trim()),
                  })
                }
              />
            </label>
            <label>
              Classification
              <select
                value={editing.fiction ? "fiction" : "nonfiction"}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    fiction: e.target.value === "fiction",
                  })
                }
              >
                <option value="nonfiction">Nonfiction</option>
                <option value="fiction">Fiction</option>
              </select>
            </label>
            <p>
              Automatic subjects are suggestions. Confirm the classification to
              keep retrieval relevant.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                onClick={async () => {
                  if (books.some((b) => b.id === editing.id)) {
                    await db("delete", editing.id);
                    setBooks((old) => old.filter((b) => b.id !== editing.id));
                  }
                  setEditing(null);
                }}
              >
                Remove from library
              </button>
              <button className="import" type="submit">
                Save details
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
