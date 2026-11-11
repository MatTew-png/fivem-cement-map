const DEFAULT_ICON_FALLBACK = '/blips/radar_player_king_white.png';

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

export function resolvePublicAssetUrl(assetPath: string): string {
  const trimmed = assetPath.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const baseEnv =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL
      ? (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
      : '/';
  const normalizedBase = baseEnv.endsWith('/') ? baseEnv : `${baseEnv}/`;
  const cleanRel = trimmed.replace(/^\/+/, '');
  return `${normalizedBase}${cleanRel}`;
}

export function isImageIconString(icon?: string | null): boolean {
  if (!icon) return false;
  const trimmed = icon.trim();
  return trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export function sanitizeIconUrl(
  url?: string | null,
  fallback = DEFAULT_ICON_FALLBACK
): string {
  if (!url) return resolvePublicAssetUrl(fallback);
  const trimmed = url.trim();
  if (/["'<>\\\r\n\0]/.test(trimmed)) {
    return resolvePublicAssetUrl(fallback);
  }
  if (trimmed.startsWith('/')) {
    return resolvePublicAssetUrl(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    // Reject javascript:, data:, vbscript:, or malformed URLs
  }
  return resolvePublicAssetUrl(fallback);
}
