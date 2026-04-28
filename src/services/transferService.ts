export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createTransferFilename(prefix: string, title: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = slugify(title) || 'untitled';
  return `elqira-${prefix}-${slug}-${stamp}.json`;
}

export function downloadJsonFile(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
