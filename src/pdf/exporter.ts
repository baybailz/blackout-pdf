import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Rect } from "./types.ts";

// Export strategy: rasterize every page and burn the black boxes into the
// pixels, then rebuild a fresh PDF from the images. The original text layer is
// discarded entirely, so redacted content is unrecoverable — unlike tools that
// draw an annotation rectangle over still-present text.
const EXPORT_SCALE = 2; // ~144 DPI

export async function exportRedacted(
  doc: PDFDocumentProxy,
  boxesByPage: Map<number, Rect[]>,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const total = doc.numPages;

  for (let i = 0; i < total; i++) {
    const page = await doc.getPage(i + 1);
    const viewport = page.getViewport({ scale: EXPORT_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    ctx.fillStyle = "#000000";
    for (const r of boxesByPage.get(i) ?? []) {
      ctx.fillRect(
        r.x * EXPORT_SCALE,
        r.y * EXPORT_SCALE,
        r.w * EXPORT_SCALE,
        r.h * EXPORT_SCALE,
      );
    }

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
        "image/jpeg",
        0.92,
      ),
    );
    const jpg = await out.embedJpg(await blob.arrayBuffer());

    const base = page.getViewport({ scale: 1 });
    const outPage = out.addPage([base.width, base.height]);
    outPage.drawImage(jpg, {
      x: 0,
      y: 0,
      width: base.width,
      height: base.height,
    });

    // Free canvas memory promptly on large docs.
    canvas.width = 0;
    canvas.height = 0;
    onProgress?.(i + 1, total);
  }

  return out.save();
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
