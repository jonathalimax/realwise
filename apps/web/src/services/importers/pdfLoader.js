// Browser-side PDF text extractor using pdfjs-dist.
// Lazy-loaded so the ~1.5MB pdfjs chunk only ships when a PDF is actually parsed.

let pdfjsLibPromise = null;

export async function loadPdfJs() {
  if (pdfjsLibPromise) return pdfjsLibPromise;
  pdfjsLibPromise = (async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // Vite handles ?url to give us a real URL for the worker file
    const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  })();
  return pdfjsLibPromise;
}

/**
 * Extract text from a PDF file (browser-side).
 * @param {File|Blob} file
 * @param {string|null} password - optional password for protected PDFs
 * @returns {Promise<{ text: string, requiresPassword: boolean }>}
 */
export async function extractPdfText(file, password = null) {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();

  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      password: password || undefined,
    }).promise;
  } catch (err) {
    // Password-protected PDF: pdfjs throws specific error codes
    if (err?.name === 'PasswordException' || err?.code === 1 /* NEED_PASSWORD */ || err?.code === 2 /* INCORRECT_PASSWORD */) {
      return { text: '', requiresPassword: true };
    }
    throw new Error(`PDF parse failed: ${err?.message || err}`);
  }

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(it => it.str).join(' '));
  }
  return { text: pages.join('\n'), requiresPassword: false };
}
