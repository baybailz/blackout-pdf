import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoadedDoc } from "../App.tsx";
import type { ManualBox, Rect, Suggestion, PageInfo } from "../pdf/types.ts";
import { findSuggestions } from "../pdf/textSearch.ts";
import { exportRedacted, downloadBytes } from "../pdf/exporter.ts";
import { PATTERNS, CUSTOM_PATTERN_ID } from "../pdf/patterns.ts";
import { FREE_PAGE_LIMIT } from "../config.ts";
import { isPro } from "../license.ts";
import PageView from "./PageView.tsx";
import UpgradeModal from "./UpgradeModal.tsx";

interface Props {
  loaded: LoadedDoc;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PATTERNS.map((p) => [p.id, p.label]),
);
CATEGORY_LABELS[CUSTOM_PATTERN_ID] = "Custom terms";

const suggestionKey = (s: Suggestion) =>
  `${s.pageIndex}:${s.categoryId}:${s.text}:${Math.round(s.rect.x)},${Math.round(s.rect.y)}`;

let boxId = 0;

export default function Editor({ loaded, onClose }: Props) {
  const { doc, filename } = loaded;
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [manualBoxes, setManualBoxes] = useState<ManualBox[]>([]);
  const [customTerms, setCustomTerms] = useState<string[]>([]);
  const [termInput, setTermInput] = useState("");
  const [scanning, setScanning] = useState(true);
  const [exporting, setExporting] = useState<null | { done: number; total: number }>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pro, setPro] = useState(isPro());
  const acceptedKeys = useRef(new Set<string>());

  // Scan (and re-scan when custom terms change), preserving accepted state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setScanning(true);
      const infos: PageInfo[] = [];
      const found: Suggestion[] = [];
      for (let i = 0; i < doc.numPages; i++) {
        const page = await doc.getPage(i + 1);
        const vp = page.getViewport({ scale: 1 });
        infos.push({ index: i, width: vp.width, height: vp.height });
        const s = await findSuggestions(page, i, customTerms);
        if (cancelled) return;
        found.push(...s);
      }
      for (const s of found) {
        if (acceptedKeys.current.has(suggestionKey(s))) s.accepted = true;
      }
      setPages(infos);
      setSuggestions(found);
      setScanning(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, customTerms]);

  const setAccepted = useCallback((ids: string[], accepted: boolean) => {
    setSuggestions((prev) =>
      prev.map((s) => {
        if (!ids.includes(s.id)) return s;
        const next = { ...s, accepted };
        const key = suggestionKey(s);
        if (accepted) acceptedKeys.current.add(key);
        else acceptedKeys.current.delete(key);
        return next;
      }),
    );
  }, []);

  const addManualBox = useCallback((pageIndex: number, rect: Rect) => {
    setManualBoxes((prev) => [...prev, { id: `m${boxId++}`, pageIndex, rect }]);
  }, []);

  const removeManualBox = useCallback((id: string) => {
    setManualBoxes((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const byCategory = useMemo(() => {
    const m = new Map<string, Suggestion[]>();
    for (const s of suggestions) {
      const arr = m.get(s.categoryId) ?? [];
      arr.push(s);
      m.set(s.categoryId, arr);
    }
    return m;
  }, [suggestions]);

  const acceptedCount =
    suggestions.filter((s) => s.accepted).length + manualBoxes.length;

  const addTerm = () => {
    const t = termInput.trim();
    if (t.length >= 2 && !customTerms.includes(t)) {
      setCustomTerms((prev) => [...prev, t]);
    }
    setTermInput("");
  };

  const doExport = async () => {
    if (!pro && doc.numPages > FREE_PAGE_LIMIT) {
      setShowUpgrade(true);
      return;
    }
    setExporting({ done: 0, total: doc.numPages });
    try {
      const byPage = new Map<number, Rect[]>();
      for (const s of suggestions) {
        if (!s.accepted) continue;
        byPage.set(s.pageIndex, [...(byPage.get(s.pageIndex) ?? []), s.rect]);
      }
      for (const b of manualBoxes) {
        byPage.set(b.pageIndex, [...(byPage.get(b.pageIndex) ?? []), b.rect]);
      }
      const bytes = await exportRedacted(doc, byPage, (done, total) =>
        setExporting({ done, total }),
      );
      downloadBytes(bytes, filename.replace(/\.pdf$/i, "") + "-redacted.pdf");
    } catch (e) {
      console.error(e);
      alert("Export failed — please report this. " + String(e));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="editor">
      <aside className="sidebar">
        <button className="link-btn" onClick={onClose}>
          ← New file
        </button>
        <h2 className="filename" title={filename}>
          {filename}
        </h2>
        <p className="meta">
          {doc.numPages} page{doc.numPages === 1 ? "" : "s"}
          {scanning ? " · scanning…" : ""}
        </p>

        <div className="categories">
          {[...PATTERNS.map((p) => p.id), CUSTOM_PATTERN_ID].map((cat) => {
            const items = byCategory.get(cat) ?? [];
            if (cat === CUSTOM_PATTERN_ID && customTerms.length === 0) return null;
            const accepted = items.filter((s) => s.accepted).length;
            return (
              <div className="category" key={cat}>
                <div className="cat-head">
                  <span>
                    {CATEGORY_LABELS[cat]} <em>({items.length})</em>
                  </span>
                  {items.length > 0 && (
                    <button
                      className="mini-btn"
                      onClick={() =>
                        setAccepted(
                          items.map((s) => s.id),
                          accepted !== items.length,
                        )
                      }
                    >
                      {accepted === items.length ? "Clear all" : "Redact all"}
                    </button>
                  )}
                </div>
                {items.length > 0 && (
                  <ul>
                    {items.slice(0, 50).map((s) => (
                      <li key={s.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={s.accepted}
                            onChange={(e) => setAccepted([s.id], e.target.checked)}
                          />
                          <span className="match-text">{s.text}</span>
                          <span className="match-page">p{s.pageIndex + 1}</span>
                        </label>
                      </li>
                    ))}
                    {items.length > 50 && <li className="meta">…and {items.length - 50} more</li>}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div className="custom-term">
          <input
            value={termInput}
            placeholder="Add name or term to find…"
            onChange={(e) => setTermInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTerm()}
          />
          <button className="mini-btn" onClick={addTerm}>
            Find
          </button>
        </div>
        {customTerms.length > 0 && (
          <p className="meta terms-list">
            Searching: {customTerms.join(", ")}{" "}
            <button className="link-btn" onClick={() => setCustomTerms([])}>
              clear
            </button>
          </p>
        )}

        <p className="tip">Tip: drag on any page to draw a redaction box.</p>

        <div className="export-area">
          <button
            className="btn export-btn"
            disabled={exporting !== null || acceptedCount === 0}
            onClick={doExport}
          >
            {exporting
              ? `Exporting ${exporting.done}/${exporting.total}…`
              : `Export redacted PDF (${acceptedCount})`}
          </button>
          {!pro && doc.numPages > FREE_PAGE_LIMIT && (
            <p className="meta">
              {doc.numPages} pages — free covers {FREE_PAGE_LIMIT}.{" "}
              <button className="link-btn" onClick={() => setShowUpgrade(true)}>
                Upgrade
              </button>
            </p>
          )}
        </div>
      </aside>

      <main className="pages">
        {pages.map((p) => (
          <PageView
            key={p.index}
            doc={doc}
            page={p}
            suggestions={suggestions.filter((s) => s.pageIndex === p.index)}
            manualBoxes={manualBoxes.filter((b) => b.pageIndex === p.index)}
            onToggleSuggestion={(id, accepted) => setAccepted([id], accepted)}
            onAddBox={addManualBox}
            onRemoveBox={removeManualBox}
          />
        ))}
      </main>

      {showUpgrade && (
        <UpgradeModal
          pageCount={doc.numPages}
          onClose={() => setShowUpgrade(false)}
          onActivated={() => {
            setPro(true);
            setShowUpgrade(false);
          }}
        />
      )}
    </div>
  );
}
