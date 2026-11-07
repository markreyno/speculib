import { useEffect, useRef, useState } from "react";
import { BookOpen, Check } from "lucide-react";
import type { Resource } from "./data";
import { bookSubjects, cleanSubjects } from "./catalog";
export default function CategoryPrompt({
  book,
  subjects,
  onSave,
  onLater,
}: {
  book: Resource;
  subjects: string[];
  onSave: (subjects: string[], fiction: boolean) => Promise<void>;
  onLater: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [custom, setCustom] = useState("");
  const [fiction, setFiction] = useState(book.fiction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const options = cleanSubjects([...bookSubjects, ...subjects]).sort((a, b) =>
    a.localeCompare(b),
  );
  const matching = options.filter(
    (subject) =>
      chosen.includes(subject) ||
      subject.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const values = cleanSubjects([...chosen, ...custom.split(",")]);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="category-dialog"
      aria-labelledby="category-title"
      aria-describedby="category-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onLater();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!values.length || saving) return;
          setSaving(true);
          setError("");
          try {
            await onSave(values, fiction);
          } catch {
            setError("Could not save the category. Please try again.");
            setSaving(false);
          }
        }}
      >
        <h2 id="category-title">Which subjects does this belong to?</h2>
        <p id="category-description">
          I couldn’t categorize this PDF. Choose its subjects so I can find it
          later.
        </p>
        <div className="category-resource">
          {book.cover ? (
            <img src={book.cover} alt="" />
          ) : (
            <BookOpen size={28} />
          )}
          <div>
            <strong>{book.title}</strong>
            <span>{book.author}</span>
          </div>
        </div>
        <fieldset disabled={saving}>
          <legend>Book categories</legend>
          <input
            aria-label="Filter book categories"
            placeholder="Find a category"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="category-options">
            {matching.map((s) => (
              <button
                type="button"
                key={s}
                aria-pressed={chosen.includes(s)}
                onClick={() =>
                  setChosen((old) =>
                    old.includes(s) ? old.filter((v) => v !== s) : [...old, s],
                  )
                }
              >
                {chosen.includes(s) && <Check size={12} />} {s}
              </button>
            ))}
            {!matching.length && (
              <span>No matching categories. Add a subject below.</span>
            )}
          </div>
          <label htmlFor="category-custom">Add subjects</label>
          <input
            id="category-custom"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. Gardening, Botany"
          />
          <small>Separate multiple subjects with commas.</small>
          <label htmlFor="category-fiction">Classification</label>
          <select
            id="category-fiction"
            value={fiction ? "fiction" : "nonfiction"}
            onChange={(e) => setFiction(e.target.value === "fiction")}
          >
            <option value="nonfiction">Nonfiction</option>
            <option value="fiction">Fiction</option>
          </select>
        </fieldset>
        {error && (
          <p role="alert" className="category-error">
            {error}
          </p>
        )}
        <div className="category-actions">
          <button type="button" disabled={saving} onClick={onLater}>
            Not now
          </button>
          <button
            type="submit"
            className="import"
            disabled={!values.length || saving}
          >
            {saving ? "Saving…" : "Save subjects"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
