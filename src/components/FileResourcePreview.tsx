'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { FileText } from 'lucide-react';
import { toAbsoluteAssetUrl } from '@/lib/assetUrl';

const SecurePdfViewer = dynamic(() => import('@/components/SecurePdfViewer'), { ssr: false });
const OfficeFilePreview = dynamic(() => import('@/components/OfficeFilePreview'), { ssr: false });

export { toAbsoluteAssetUrl } from '@/lib/assetUrl';

const PREVIEWABLE = new Set(['pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx']);

function extFromBasename(path: string): string {
  const base = path.split('/').pop() || path;
  const parts = base.split('.');
  if (parts.length < 2) return '';
  const ext = (parts.pop() || '').toLowerCase();
  return ext.length <= 5 ? ext : '';
}

/** Toma la extensión del primer candidato que tenga una (prioriza archivo_url sobre título). */
export function getFileExt(...candidates: (string | null | undefined)[]): string {
  for (const raw of candidates) {
    if (!raw) continue;
    const refMatch = raw.match(/[?&]ref=([^&]+)/i);
    if (refMatch) {
      const fromRef = extFromBasename(decodeURIComponent(refMatch[1]));
      if (fromRef) return fromRef;
    }
    const fromPath = extFromBasename(raw.split('?')[0].split('#')[0]);
    if (fromPath) return fromPath;
  }
  return '';
}

function parseCsvPreview(text: string, maxRows = 40): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(0, maxRows)
    .filter((line) => line.length > 0)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
}

interface FileResourcePreviewProps {
  fileName: string;
  fileUrl?: string | null;
  localFile?: File | null;
  maxHeight?: number;
  hideToolbar?: boolean;
  /** Visor PDF en canvas (solo lectura, sin descarga del navegador). */
  securePdf?: boolean;
  /** Flechas laterales de página (lectura embebida). Por defecto: igual que securePdf. */
  showSideNav?: boolean;
}

export default function FileResourcePreview({
  fileName,
  fileUrl,
  localFile,
  maxHeight = 420,
  hideToolbar = true,
  securePdf = false,
  showSideNav,
}: FileResourcePreviewProps) {
  const ext = getFileExt(fileName, fileUrl, localFile?.name);
  const [csvRows, setCsvRows] = useState<string[][] | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [csvError, setCsvError] = useState('');

  const previewSource = useMemo(() => {
    if (localFile && blobUrl) return blobUrl;
    if (fileUrl) return toAbsoluteAssetUrl(fileUrl);
    return null;
  }, [localFile, blobUrl, fileUrl]);

  useEffect(() => {
    let revoked: string | null = null;

    if (localFile) {
      revoked = URL.createObjectURL(localFile);
      setBlobUrl(revoked);
    } else {
      setBlobUrl(null);
    }

    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [localFile]);

  useEffect(() => {
    if (ext !== 'csv') {
      setCsvRows(null);
      setCsvError('');
      return;
    }

    const loadCsv = async () => {
      try {
        let text = '';
        if (localFile) {
          text = await localFile.text();
        } else if (fileUrl) {
          const res = await fetch(toAbsoluteAssetUrl(fileUrl));
          if (!res.ok) throw new Error('No se pudo cargar el CSV');
          text = await res.text();
        } else {
          return;
        }
        setCsvRows(parseCsvPreview(text));
        setCsvError('');
      } catch {
        setCsvRows(null);
        setCsvError('No se pudo mostrar la vista previa del CSV.');
      }
    };

    loadCsv();
  }, [ext, localFile, fileUrl]);

  if (!PREVIEWABLE.has(ext)) {
    return (
      <div style={fallbackBox}>
        <FileText size={20} color="#64748B" />
        <span style={{ fontSize: '13px', color: '#64748B' }}>
          Vista previa no disponible para .{ext || 'archivo'}.
        </span>
      </div>
    );
  }

  if (ext === 'pdf' && (fileUrl || localFile)) {
    return (
      <SecurePdfViewer
        fileUrl={fileUrl}
        localFile={localFile}
        maxHeight={maxHeight}
        title={fileName}
        showSideNav={showSideNav ?? false}
      />
    );
  }

  if (ext === 'csv') {
    if (csvError) {
      return <div style={fallbackBox}>{csvError}</div>;
    }
    if (!csvRows || csvRows.length === 0) {
      return <div style={fallbackBox}>Cargando vista previa del CSV...</div>;
    }
    return (
      <div style={{ maxHeight, overflow: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <tbody>
            {csvRows.map((row, ri) => (
              <tr key={ri} style={{ backgroundColor: ri === 0 ? '#F1F5F9' : '#fff' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ border: '1px solid var(--border)', padding: '6px 8px', verticalAlign: 'top' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (['doc', 'docx', 'xls', 'xlsx'].includes(ext) && (previewSource || localFile || fileUrl)) {
    return (
      <OfficeFilePreview
        fileName={fileName}
        fileUrl={fileUrl}
        localFile={localFile}
        ext={ext}
        maxHeight={maxHeight}
      />
    );
  }

  return (
    <div style={fallbackBox}>
      <FileText size={20} color="#64748B" />
      <span style={{ fontSize: '13px', color: '#64748B' }}>Selecciona o sube un archivo para ver la vista previa.</span>
    </div>
  );
}

const fallbackBox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '16px',
  borderRadius: '8px',
  border: '1px dashed var(--border)',
  backgroundColor: '#FAFBFD',
};
