import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Resource } from "./data";
import type { SearchDocument, SearchHit } from "./retrieval-index";
class RetrievalClient {
  private worker = new Worker(
    new URL("./retrieval.worker.ts", import.meta.url),
    { type: "module" },
  );
  private nextId = 0;
  private pending = new Map<
    number,
    { resolve: (r: any) => void; reject: (e: Error) => void }
  >();
  private documents = new Map<string, Resource>();
  private inflight = new Map<string, Promise<SearchHit[]>>();
  private revision = 0;
  private failure: Error | null = null;
  constructor() {
    this.worker.onmessage = ({ data }) => {
      const request = this.pending.get(data.id);
      if (!request) return;
      this.pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.result);
    };
    this.worker.onerror = () =>
      this.fail(
        new Error(
          "Search worker stopped. Reopen the app to rebuild the index.",
        ),
      );
  }
  private fail(error: Error) {
    this.failure = error;
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }
  private request(type: "sync" | "search", data: object): Promise<any> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage({ id, type, ...data });
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  sync(resources: Resource[]) {
    const next = new Map(resources.map((r) => [r.id, r]));
    const removed = [...this.documents.keys()].filter((id) => !next.has(id));
    const documents: SearchDocument[] = resources
      .filter((r) => this.documents.get(r.id) !== r)
      .map(
        ({
          id,
          title,
          author,
          subjects,
          fiction,
          subjectsEdited,
          modelCatalog,
          texts,
        }) => ({
          id,
          title,
          author,
          subjects,
          fiction,
          subjectsEdited,
          modelCatalog,
          texts: this.documents.get(id)?.texts === texts ? undefined : texts,
        }),
      );
    this.documents = next;
    if (!removed.length && !documents.length) return Promise.resolve();
    this.revision++;
    return this.request("sync", { documents, removed });
  }
  search(query: string, enabled = true) {
    const key = this.revision + ":" + query;
    let promise = this.inflight.get(key);
    if (!promise) {
      promise = this.request("search", { query }).finally(() =>
        this.inflight.delete(key),
      );
      this.inflight.set(key, promise);
    }
    return promise;
  }
  dispose() {
    this.fail(new Error("Search closed"));
    this.worker.terminate();
  }
}
export function useRetrieval(
  resources: Resource[],
  query: string,
  enabled = true,
) {
  const client = useRef<RetrievalClient | null>(null);
  const synced = useRef<Promise<unknown>>(Promise.resolve());
  const [indexing, setIndexing] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    query: string;
    resources: Resource[] | null;
    hits: SearchHit[];
  }>({ query: "", resources: null, hits: [] });
  useEffect(() => {
    const instance = new RetrievalClient();
    client.current = instance;
    return () => {
      instance.dispose();
      client.current = null;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setIndexing(true);
    setError("");
    const promise = client.current!.sync(resources);
    synced.current = promise;
    promise
      .then(() => {
        if (!cancelled) setIndexing(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setIndexing(false);
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resources]);
  const runQuery = useCallback(async (q: string) => {
    await synced.current;
    if (!client.current) throw new Error("Search is not ready");
    return client.current.search(q);
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!query || !enabled) {
      setResult({ query: "", resources, hits: [] });
      return;
    }
    runQuery(query)
      .then((hits) => {
        if (!cancelled) {
          setResult({ query, resources, hits });
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setResult({ query, resources, hits: [] });
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query, resources, runQuery, enabled]);
  const current = result.query === query && result.resources === resources;
  const hits = useMemo(
    () => (current ? result.hits : []),
    [current, result.hits],
  );
  const byId = useMemo(() => new Map(hits.map((hit) => [hit.id, hit])), [hits]);
  return {
    hits,
    byId,
    indexing,
    error,
    busy: enabled && !!query && !current && !error,
    runQuery,
  };
}
