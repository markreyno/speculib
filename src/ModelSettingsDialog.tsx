import { useEffect, useRef, useState } from "react";
import { RefreshCw, Loader2, X } from "lucide-react";
import type { ModelConnection, ModelSettings } from "./local-models";
export default function ModelSettingsDialog({
  onSaved,
  onClose,
}: {
  onSaved: (settings: ModelSettings) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [connection, setConnection] = useState<ModelConnection | null>(null);
  const [settings, setSettings] = useState<ModelSettings>({
    librarianModel: "",
    categorizerModel: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      if (!window.localModels)
        throw new Error("Model settings are available in the Electron app.");
      const result = await window.localModels.list();
      setConnection(result);
      setSettings(result.settings);
      if (!result.connected) setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load models");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    dialog.current!.showModal();
    void refresh();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="category-dialog model-settings"
      aria-labelledby="model-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            const saved = await window.localModels!.save(settings);
            onSaved(saved);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save models");
            setSaving(false);
          }
        }}
      >
        <div className="model-dialog-heading">
          <h2 id="model-title">Local models</h2>
          <button
            type="button"
            aria-label="Close model settings"
            disabled={saving}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="model-connection">
          <span>
            <i className="local-dot" /> Ollama · 127.0.0.1:11434
          </span>
          <button
            type="button"
            aria-label="Refresh models"
            disabled={loading || saving}
            onClick={() => void refresh()}
          >
            {loading ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <RefreshCw size={15} />
            )}
          </button>
        </div>
        <label htmlFor="librarian-model">Librarian model</label>
        <select
          id="librarian-model"
          disabled={loading || saving}
          value={settings.librarianModel}
          onChange={(e) =>
            setSettings({ ...settings, librarianModel: e.target.value })
          }
        >
          <option value="">Off — use text search</option>
          {settings.librarianModel &&
            !connection?.models.some(
              (m) => m.name === settings.librarianModel,
            ) && (
              <option value={settings.librarianModel}>
                {settings.librarianModel} (unavailable)
              </option>
            )}
          {connection?.models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} · {m.parameters}
            </option>
          ))}
        </select>
        <small>
          Interprets requests, checks context, and answers from retrieved
          sources.
        </small>
        <label htmlFor="categorizer-model">Categorization model</label>
        <select
          id="categorizer-model"
          disabled={loading || saving}
          value={settings.categorizerModel}
          onChange={(e) =>
            setSettings({ ...settings, categorizerModel: e.target.value })
          }
        >
          <option value="">Off — use subject rules</option>
          {settings.categorizerModel &&
            !connection?.models.some(
              (m) => m.name === settings.categorizerModel,
            ) && (
              <option value={settings.categorizerModel}>
                {settings.categorizerModel} (unavailable)
              </option>
            )}
          {connection?.models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} · {m.parameters}
            </option>
          ))}
        </select>
        <small>
          Classifies PDFs in the background. Books with uncertain subjects stay
          on the Uncategorized shelf. Manual choices are preserved.
        </small>
        <p>
          Lists installed local chat models only. Install models in Ollama, then
          refresh. No automatic downloads.
        </p>
        {connection?.connected && !connection.models.length && (
          <p>
            No local chat models found. Embedding-only models cannot act as the
            librarian.
          </p>
        )}
        {error && (
          <p role="alert" className="category-error">
            {error}
          </p>
        )}
        <div className="category-actions">
          <button type="button" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button
            className="import"
            type="submit"
            disabled={loading || saving || !window.localModels}
          >
            {saving ? "Saving…" : "Save models"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
