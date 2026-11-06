# Speculib

A personal PDF library built with TypeScript, React, Electron, PDF.js, and Three.js.

## Run

- `npm install`
- `npm run desktop` — development desktop app
- `npm run build` — typecheck and production bundle
- `npm start` — open the production build (build first)
- `npm run dev` — browser development preview

The first launch may download the Electron runtime. Imported PDFs and extracted page text are stored in IndexedDB in the local app profile. Original files are not modified. Browser preview and Electron have separate local libraries.

## Working in this build

- Dark three-column library, shelves, grid/list layouts, filters, sorting, and reader.
- Local multi-PDF import, SHA-256 duplicate detection, first-page covers, metadata extraction, per-page text extraction, and persistence.
- Multiple suggested subjects, editable metadata and fiction classification.
- Text retrieval with a small related-term dictionary; source passages link to physical PDF pages. Whole-resource covers open page one.
- Entire-library star field and 3D traversal. Scroll to approach, drag to orbit, WASD to fly, double-click a nearby cover to read.
- Clearly labeled fictional preview covers before the first import; these are not used as answer sources.

## Still to implement

This is the first functional foundation, not the complete librarian backend. Optional local Ollama models now support tool-driven librarian responses and evidence-based categorization. It does not yet include embeddings, section-aware chunking, chapter detection, or OCR. Scanned PDFs can be opened but their image-only pages are not searchable. With the categorization model off, subjects use text rules and fiction defaults to nonfiction until corrected. Model categorization uses sampled pages and asks for user input when evidence is insufficient. The spatial layout is illustrative, not an embedding projection. Real topic clusters and a smooth camera transition remain pending.

With the librarian model off, simple questions quote a matching passage. With a selected local model, the librarian uses bounded library tools and verified page references. No PDF content is sent to a remote service.

## UI verification

`npm run test:ui` builds and launches Electron with an isolated test profile under `.qa/`. It checks both panel collapses, document overflow at 1440×900 and 1000×720, grid/list views, fiction filtering, search, Explore, PDF import/duplicate detection, physical page navigation, and persistence. It does not modify the normal library. Review captures are written under `.impeccable/review/`.

The interface uses floating navigation and librarian panels, a visible subject constellation, and an internally scrolling resource browser. Both side panel states persist independently. UI fonts are bundled locally.

Uncategorized PDFs prompt for user-selected subjects (existing or new), plus fiction/nonfiction. Batch imports are handled one at a time. Choosing “Not now” defers until next launch. Manual choices persist and are preserved by automatic recategorization. The UI smoke test covers the queue, deferral, saved custom subjects, and classification filtering.

## Retrieval performance

Retrieval runs in a dedicated Web Worker. It normalizes each page once and maintains token-to-page postings, using those to select candidates before phrase validation and ranking. Searches return up to five source passages per matching resource. Document edits invalidate a bounded 24-query cache; metadata-only edits reuse page postings. The worker receives text and search metadata, never PDF buffers or cover images. The renderer reuses search hits for filtering, sorting, and result cards. Stale responses cannot replace newer search results.

The map renders a still background during normal library use and pauses its Explore animation when the document is hidden. Duplicate import checks read only the resource key instead of loading every stored PDF.

`npm run benchmark:retrieval` compares the old scan with the index on a synthetic 1,500-page (~9.85 million character) corpus. One measured run was 396 ms for a single old scan versus 9.17 ms for an indexed query; initial index construction took 161 ms off the UI thread. These are synthetic local measurements, not guarantees for every PDF or library size.

`npm run benchmark:ui` uses an isolated Electron profile and the same-sized synthetic corpus. The measured first query, including any wait for indexing, took 237 ms while 14 UI timer ticks ran; the Long Tasks observer recorded no main-thread long tasks during the query. Typing and changing views issued no extra search messages. The script verifies grounded librarian retrieval and reports renderer errors.


## Local Ollama models and librarian tools

Start Ollama, then open the sliders button in the top-right app bar (Model settings). Choose the librarian model and the categorization model independently. They may use the same installed weights or different models. Defaults are off. Only local chat models are listed; embedding-only and known cloud models are excluded. Models are never downloaded automatically. Settings are stored in the Electron profile's `models.json`, not browser local storage.

Electron's narrow preload bridge talks to the fixed loopback Ollama endpoint (`127.0.0.1:11434`). Model calls never run on the renderer thread. No arbitrary filesystem, shell, network, or deletion tools are exposed to the model.

The librarian can call `search_library`, `get_resource`, `read_pages`, `compare_resources`, `show_resources`, `open_resource`, and `finish`. It can refine its search and inspect source pages before answering. The loop is capped at 8 rounds/16 calls and 120 seconds, and has a Stop button. Native Ollama tool calling is used when available; a schema-constrained next-tool adapter handles missing native tool calls. Model quality varies; invalid output produces an actionable error while indexed text search remains available. Resource results and citations must refer to actual library IDs/pages. Explicit cooking constraints cannot be discarded by broadening a tool query. Resource discovery confirmations are generated from validated matches rather than model-generated book lists.

Categorization is a separate background job: it samples up to 12 physical pages, requests subjects, domain, summary, keywords, document type and fiction classification, and validates evidence quotes against those samples. Insufficient evidence requests user input. Manual corrections win. Librarian calls preempt categorization, which resumes after the conversation operation completes. This is sample-based classification, not a claim to have read every page.

`node --experimental-strip-types scripts/ollama-smoke.mjs [model]` checks the installed local model against synthetic cooking/software books. `node scripts/ollama-ui-smoke.mjs` uses an isolated Electron profile to verify the model picker, saved role choices, and a real local inference; it does not alter the normal library or its model settings. Live checks were run with the already installed `qwen3:0.6b`; this small model required the structured tool adapter and explicit intent constraints in the recipe-disambiguation check. Larger-model accuracy is not established by that test.
