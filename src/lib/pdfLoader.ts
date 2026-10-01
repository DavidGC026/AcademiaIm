import { toAssetUrl } from '@/lib/assetUrl';

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type GetDocumentParams = Parameters<PdfjsModule['getDocument']>[0];

let pdfjsPromise: Promise<PdfjsModule> | null = null;

function pdfAssetsOrigin(): string {
  const base = toAssetUrl('/pdfjs');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${base}`;
}

function workerSrc(): string {
  return `${pdfAssetsOrigin()}/pdf.worker.min.mjs`;
}

/** pdf.js desde node_modules; assets estáticos en /public/pdfjs (basePath-aware). */
async function loadPdfjs(): Promise<PdfjsModule> {
  if (typeof window === 'undefined') {
    throw new Error('pdf.js solo está disponible en el cliente');
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((mod) => {
      const pdfjs = mod as PdfjsModule;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function openPdfDocument(source: { data: ArrayBuffer } & Partial<GetDocumentParams>) {
  const pdfjs = await loadPdfjs();
  const assets = pdfAssetsOrigin();
  return pdfjs.getDocument({
    ...source,
    cMapUrl: `${assets}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}/standard_fonts/`,
    wasmUrl: `${assets}/wasm/`,
  } as GetDocumentParams).promise;
}
