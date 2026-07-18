import { useCallback, useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import Landing from "./components/Landing.tsx";
import Editor from "./components/Editor.tsx";
import { loadPdf } from "./pdf/loader.ts";
import { activateFromCheckoutRedirect, isPro } from "./license.ts";

export interface LoadedDoc {
  doc: PDFDocumentProxy;
  filename: string;
}

export default function App() {
  const [loaded, setLoaded] = useState<LoadedDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justActivated, setJustActivated] = useState(false);
  const [pro, setPro] = useState(isPro());

  useEffect(() => {
    if (activateFromCheckoutRedirect()) {
      setJustActivated(true);
      setPro(true);
    }
  }, []);

  const openFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const doc = await loadPdf(await file.arrayBuffer());
      setLoaded({ doc, filename: file.name });
    } catch (e) {
      console.error(e);
      setError(
        "Couldn't open that file. Make sure it's a PDF (password-protected PDFs aren't supported yet).",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    loaded?.doc.destroy();
    setLoaded(null);
  }, [loaded]);

  return loaded ? (
    <Editor key={loaded.filename} loaded={loaded} onClose={reset} />
  ) : (
    <>
      {justActivated && (
        <div className="activated-banner">
          ✓ Pro activated on this device — unlimited pages. Thank you!
        </div>
      )}
      <Landing onFile={openFile} loading={loading} error={error} pro={pro} />
    </>
  );
}
