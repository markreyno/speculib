import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  Maximize,
  Minimize,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import type { Resource } from "./data";
const PdfPage = memo(function PdfPage({
  document,
  page,
  width,
  active,
  onRatio,
}: {
  document: pdfjs.PDFDocumentProxy;
  page: number;
  width: number;
  active: boolean;
  onRatio: (page: number, ratio: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active || !width) return;
    let cancelled = false;
    let task: pdfjs.RenderTask | undefined;
    let source: pdfjs.PDFPageProxy | undefined;
    setReady(false);
    setError("");
    (async () => {
      source = await document.getPage(page);
      if (cancelled) return;
      const base = source.getViewport({ scale: 1 });
      onRatio(page, base.width / base.height);
      const scale = Math.min(
        (width / base.width) * Math.min(devicePixelRatio, 1.5),
        Math.sqrt(2500000 / (base.width * base.height)),
      );
      const viewport = source.getViewport({ scale });
      const target = canvas.current;
      if (!target || cancelled) return;
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      task = source.render({
        canvasContext: target.getContext("2d")!,
        viewport,
      });
      await task.promise;
      if (!cancelled) setReady(true);
    })().catch((e) => {
      if (!cancelled && e?.name !== "RenderingCancelledException")
        setError("Could not render this page.");
    });
    return () => {
      cancelled = true;
      task?.cancel();
      source?.cleanup();
      const target = canvas.current;
      if (target) {
        target.width = 0;
        target.height = 0;
      }
    };
  }, [document, page, width, active, onRatio]);
  return active ? (
    <>
      {!ready && !error && (
        <span className="pdf-page-loading" role="status">
          <Loader2 size={18} className="spin" /> Loading page {page}…
        </span>
      )}
      <canvas
        ref={canvas}
        role="img"
        aria-label={`PDF page ${page}`}
        style={{ visibility: ready ? "visible" : "hidden" }}
      />
      {error && (
        <p className="pdf-page-loading" role="alert">
          {error}
        </p>
      )}
    </>
  ) : null;
});
export default function Reader({
  book,
  page,
  onClose,
}: {
  book: Resource;
  page: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(page);
  const [document, setDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(0.773);
  const [ratios, setRatios] = useState<Map<number, number>>(new Map());
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const reader = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const frames = useRef(new Map<number, HTMLDivElement>());
  const activeRef = useRef(active);
  activeRef.current = active;
  const positioned = useRef(false);
  useEffect(() => {
    const element = reader.current;
    if (!element) return;
    const owner = element.ownerDocument;
    const sync = () => setFullscreen(owner.fullscreenElement === element);
    owner.addEventListener("fullscreenchange", sync);
    return () => owner.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    const element = reader.current;
    if (!element) return;
    setFullscreenError("");
    try {
      if (element.ownerDocument.fullscreenElement === element) {
        await element.ownerDocument.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch {
      setFullscreenError("Could not change fullscreen mode.");
    }
  }
  const jump = useCallback(
    (number: number) => {
      const target = Math.max(1, Math.min(book.pages, number));
      setCurrent(target);
      frames.current
        .get(target)
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    },
    [book.pages],
  );
  const trackCurrent = useCallback(() => {
    if (!positioned.current || !area.current) return;
    const bounds = area.current.getBoundingClientRect();
    let best = 0;
    let visiblePage = 0;
    for (const p of activeRef.current) {
      const rect = frames.current.get(p)?.getBoundingClientRect();
      if (!rect) continue;
      const overlap = Math.max(
        0,
        Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top),
      );
      if (overlap > best) {
        best = overlap;
        visiblePage = p;
      }
    }
    if (visiblePage) setCurrent(visiblePage);
  }, []);
  const onRatio = useCallback(
    (p: number, value: number) =>
      setRatios((old) => {
        if (Math.abs((old.get(p) || ratio) - value) < 0.001) return old;
        const next = new Map(old);
        next.set(p, value);
        return next;
      }),
    [ratio],
  );
  useEffect(() => trackCurrent(), [active, trackCurrent]);
  useEffect(() => {
    if (!book.data) return;
    let cancelled = false;
    const loading = pdfjs.getDocument({ data: book.data.slice(0) });
    (async () => {
      const doc = await loading.promise;
      const first = await doc.getPage(1);
      const viewport = first.getViewport({ scale: 1 });
      if (cancelled) return;
      setRatio(viewport.width / viewport.height);
      setDocument(doc);
    })().catch(() => {
      if (!cancelled) setError("Could not open this PDF.");
    });
    return () => {
      cancelled = true;
      void loading.destroy();
    };
  }, [book]);
  useEffect(() => {
    const root = area.current;
    if (!root) return;
    const resize = () => {
      const style = getComputedStyle(root);
      setWidth(
        Math.min(
          1100,
          Math.max(
            100,
            root.clientWidth -
              parseFloat(style.paddingLeft) -
              parseFloat(style.paddingRight),
          ),
        ),
      );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document || !area.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setActive((old) => {
          const next = new Set(old);
          for (const entry of entries) {
            const p = Number((entry.target as HTMLElement).dataset.page);
            if (entry.isIntersecting) next.add(p);
            else next.delete(p);
          }
          if (next.size === old.size && [...next].every((p) => old.has(p)))
            return old;
          activeRef.current = next;
          return next;
        });
        trackCurrent();
      },
      { root: area.current, rootMargin: "350px 0px", threshold: 0 },
    );
    for (const element of frames.current.values()) observer.observe(element);
    const frame = requestAnimationFrame(() => {
      jump(page);
      positioned.current = true;
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [document, jump, page, trackCurrent]);
  return (
    <div
      className="reader"
      ref={reader}
      onKeyDown={(event) => {
        if (event.key === "Escape" && fullscreen) {
          event.preventDefault();
          void toggleFullscreen();
        }
      }}
    >
      <div className="reader-toolbar">
        <button onClick={onClose}>
          <ArrowLeft size={16} /> Library
        </button>
        <span>{book.title}</span>
        <div>
          <button
            type="button"
            title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen PDF"}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen PDF"}
            disabled={!book.data}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <button
            title="Scroll down"
            aria-label="Scroll down"
            onClick={() => {
              area.current?.focus({ preventScroll: true });
              area.current?.scrollBy({
                top: area.current.clientHeight * 0.8,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              });
            }}
          >
            <ArrowDown size={16} />
          </button>
          <button
            aria-label="Previous page"
            disabled={current <= 1 || !document}
            onClick={() => jump(current - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <input
            aria-label="Page number"
            type="number"
            min="1"
            max={book.pages}
            value={current}
            onChange={(e) => jump(Number(e.target.value) || 1)}
          />
          <small>/ {book.pages}</small>
          <button
            aria-label="Next page"
            disabled={current >= book.pages || !document}
            onClick={() => jump(current + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      {fullscreenError && (
        <p className="reader-loading" role="alert">
          {fullscreenError}
        </p>
      )}
      <div
        className="paper-area"
        ref={area}
        role="region"
        aria-label="PDF document"
        tabIndex={0}
        onScroll={trackCurrent}
      >
        {!book.data ? (
          <div className="demo-reader">
            <BookOpen size={40} />
            <h2>This is a preview resource</h2>
            <p>Import a PDF to read your own books here.</p>
            <button onClick={onClose}>Back to your library</button>
          </div>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : !document ? (
          <p className="reader-loading" role="status">
            <Loader2 size={18} className="spin" /> Opening PDF…
          </p>
        ) : (
          Array.from({ length: document.numPages }, (_, i) => (
            <div
              key={i}
              className="pdf-page-frame"
              data-page={i + 1}
              ref={(element) => {
                if (element) frames.current.set(i + 1, element);
                else frames.current.delete(i + 1);
              }}
              style={{ aspectRatio: ratios.get(i + 1) || ratio }}
            >
              <PdfPage
                document={document}
                page={i + 1}
                width={width}
                active={active.has(i + 1)}
                onRatio={onRatio}
              />
              <span className="pdf-page-label">Page {i + 1}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
