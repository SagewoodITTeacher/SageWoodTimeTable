export function sanitizeError(error: unknown): { code: string; message: string } {
  if (!(error instanceof Error)) {
    return { code: 'unknown', message: String(error) };
  }
  const code = (error as { code?: string }).code ?? 'unknown';
  const message = error.message
    // Strip email-shaped strings
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[redacted-email]')
    // Strip 28-char Firebase UIDs (heuristic — UIDs are alphanumeric, 28 chars)
    .replace(/\b[A-Za-z0-9]{28}\b/g, '[redacted-uid]');
  return { code, message };
}
