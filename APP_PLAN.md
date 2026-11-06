# Speculib — current product plan

This plan supersedes the earlier keyword-only plan, following the current conversation.

## Agreed experience

TypeScript, React, and Electron desktop app. Dark theme, approximately 20/60/20 columns: navigation/search and subject shelves; resource covers/results/PDF reader; librarian conversation.

People can browse or ask in natural language. Automatic categorization assigns multiple subjects per resource, plus fiction/nonfiction and document type. Document, section, and passage context supports semantic retrieval. Learning requests default to nonfiction. Explicit story requests search fiction. Mixed requests keep results separated.

Show results immediately. Retrieve passages and group matches beneath one cover per resource. Whole-book clicks open physical PDF page one; chapter/passage clicks open the source page. Support books, papers, manuals, scanned documents, and resources without covers. OCR is needed for scans; title cards are a fallback for missing covers.

Simple questions receive short grounded answers sourced exclusively from the library. Follow-up requests for more show resources. If evidence is absent, say so. No open-reader chat or selected-passage explanations in current scope.

The background represents the entire library as points of light with apparent depth. Each import adds a light. Explore mode becomes an interactive 3D space with flight controls; approaching a light reveals its cover. Search does not filter the universe. Resources can have multiple subjects for browsing and retrieval.

## Implementation status

See README.md for working features and explicit limitations. The first build implements the desktop shell, local PDF ingestion/text extraction, page-linked retrieval, shelves, reader, and illustrative 3D exploration. Semantic indexing, meaningful spatial topic placement, OCR, chapter-aware chunking, grounded generation, and full automatic classification remain subsequent work.

## Interface copy preference

Use concise functional labels. No promotional slogans, decorative introductory headings, fake coordinates, or redundant workspace breadcrumbs. Keep useful resource counts, source context, import instructions, and action labels. The user explicitly rejected copy such as “Your library,” “A constellation of ideas,” and “My workspace > Library.”

## Uncategorized resources

If automatic categorization finds no subjects, the app asks the user to select existing subjects or add new ones, and confirm fiction/nonfiction. Multiple unresolved imports are prompted one at a time. Saved choices persist and are not overwritten by automatic classification. “Not now” defers the prompt for this session; unresolved resources are prompted again at the next launch. Existing uncategorized resources use the same flow.

## Local librarian and categorizer

The user selected Ollama as the runtime and wants the user to choose the librarian model. Model settings now expose independent librarian and categorization selections from installed local chat models; neither is downloaded or enabled automatically. The librarian has bounded tools for searching, inspecting metadata, reading physical pages, comparing sources, showing covers, and opening requested PDFs. It may refine searches and inspect evidence before answering. Categorization runs separately in the background, preserves manual choices, and asks the user when evidence is insufficient. See README.md for implementation limits, test commands, and local-runtime details.

PDF reading now uses continuous vertical scrolling with a visible scrollbar and explicit Scroll down control. The counter follows the visible page; direct jumps and source-page navigation remain supported. Only nearby PDF pages render to canvases.
