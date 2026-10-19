export const RESOURCE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'] as const;
export const RESOURCE_ACCEPT = RESOURCE_EXTENSIONS.map((extension) => `.${extension}`).join(',');
export const MAX_RESOURCE_SIZE_MB = 25;
export const MAX_RESOURCE_SIZE_BYTES = MAX_RESOURCE_SIZE_MB * 1024 * 1024;

/** Los recursos se sirven desde el mismo dominio; no aceptar contenido web ejecutable. */
export function validateResourceFile(file: { name: string; size: number }): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!RESOURCE_EXTENSIONS.some((allowed) => allowed === extension)) {
    return 'Tipo de archivo no permitido. Usa PDF, imágenes, documentos de Office o CSV.';
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return 'El archivo está vacío o tiene un tamaño inválido.';
  if (file.size > MAX_RESOURCE_SIZE_BYTES) return `El archivo supera los ${MAX_RESOURCE_SIZE_MB} MB.`;
  return null;
}
