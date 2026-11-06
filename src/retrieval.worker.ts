/// <reference lib="webworker" />
import { RetrievalIndex } from "./retrieval-index";
import type { SearchDocument } from "./retrieval-index";
const index = new RetrievalIndex();
self.onmessage = (
  event: MessageEvent<{
    id: number;
    type: "sync" | "search";
    documents?: SearchDocument[];
    removed?: string[];
    query?: string;
  }>,
) => {
  const message = event.data;
  try {
    if (message.type === "sync") {
      for (const id of message.removed || []) index.remove(id);
      for (const doc of message.documents || []) index.upsert(doc);
      self.postMessage({ id: message.id, result: index.stats });
    } else
      self.postMessage({
        id: message.id,
        result: index.search(message.query || ""),
      });
  } catch (error) {
    self.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : "Search failed",
    });
  }
};
