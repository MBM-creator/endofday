import type { CcProject } from '@/lib/cc-client';

export function ccClientDisplayName(project: Pick<CcProject, 'client_name' | 'client_contact'>): string {
  const clientName = project.client_name.trim();
  const clientContact = project.client_contact?.trim();
  return clientContact ? `${clientName} — ${clientContact}` : clientName;
}

/** Label for linked-project pickers: client name and site address only. */
export function ccProjectPickerLabel(
  project: Pick<CcProject, 'client_name' | 'site_address'>
): string {
  return [project.client_name.trim(), project.site_address?.trim()].filter(Boolean).join(' — ');
}

export function clientConnectAbsoluteUrl(portalBaseUrl: string | null | undefined, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!portalBaseUrl) return path;
  const base = portalBaseUrl.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function clientConnectVariationsUrl(
  portalBaseUrl: string | null | undefined,
  quoteId: string | null,
  variationHref?: string | null
): string | null {
  const path = variationHref ?? (quoteId ? `/quotes/${quoteId}/variations` : null);
  if (!path) return null;
  return clientConnectAbsoluteUrl(portalBaseUrl, path);
}
