import { randomUUID } from 'crypto';

export type CcProjectStatus = 'planning' | 'active';
export type CcProjectTrade =
  | 'paving'
  | 'concrete'
  | 'carpentry_decking'
  | 'demo'
  | 'fencing'
  | 'irrigation'
  | 'mulching'
  | 'planting'
  | 'electrical'
  | 'other';

export interface CcProjectVariation {
  id: string;
  variation_id: string;
  quote_id: string | null;
  number: number | null;
  title: string | null;
  status: string;
  variation_status: string | null;
  total_inc_gst: number | null;
  accepted_at: string | null;
  section_id: string | null;
  section_name: string | null;
  section_trade: CcProjectTrade | null;
  team_signed_at: string | null;
  client_signed_at: string | null;
  href: string | null;
}

export interface CcProjectSection {
  id: string;
  name: string;
  trade: CcProjectTrade | null;
}

export interface CcProject {
  project_id: string;
  quote_id: string | null;
  client_id: string;
  project_title: string;
  client_name: string;
  client_contact: string | null;
  site_address: string | null;
  status: CcProjectStatus;
  trades: CcProjectTrade[];
  sections: CcProjectSection[];
  variations: CcProjectVariation[];
}

export interface CcProjectsResponseOk {
  ok: true;
  projects: CcProject[];
}

export interface CcProjectsResponseError {
  ok: false;
  error: string;
}

export type CcProjectsResponse = CcProjectsResponseOk | CcProjectsResponseError;

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedProjects: CcProject[] | null = null;
let cacheTimestampMs = 0;

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isCcProjectStatus(value: unknown): value is CcProjectStatus {
  return value === 'planning' || value === 'active';
}

function isCcProjectTrade(value: unknown): value is CcProjectTrade {
  return (
    value === 'paving' ||
    value === 'concrete' ||
    value === 'carpentry_decking' ||
    value === 'demo' ||
    value === 'fencing' ||
    value === 'irrigation' ||
    value === 'mulching' ||
    value === 'planting' ||
    value === 'electrical' ||
    value === 'other'
  );
}

function optionalString(value: unknown, fieldName: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Invalid Client Connect response: ${fieldName} must be string or null`);
  }
  return value;
}

function optionalUuid(value: unknown, fieldName: string): string | null {
  if (value == null) return null;
  if (!isUuid(value)) {
    throw new Error(`Invalid Client Connect response: ${fieldName} must be a UUID or null`);
  }
  return value;
}

function optionalNumber(value: unknown, fieldName: string): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid Client Connect response: ${fieldName} must be a number or null`);
  }
  return value;
}

function optionalTrade(value: unknown, fieldName: string): CcProjectTrade | null {
  if (value == null) return null;
  if (!isCcProjectTrade(value)) {
    throw new Error(`Invalid Client Connect response: ${fieldName} is not a supported trade`);
  }
  return value;
}

function validateCcProjectVariations(payload: unknown): CcProjectVariation[] {
  if (payload == null) return [];
  if (!Array.isArray(payload)) {
    throw new Error('Invalid Client Connect response: variations must be an array');
  }

  return payload.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid Client Connect response: variation must be an object');
    }
    const v = item as Record<string, unknown>;
    if (!isUuid(v.id)) {
      throw new Error('Invalid Client Connect response: variation id must be a UUID');
    }
    if (!isUuid(v.variation_id)) {
      throw new Error('Invalid Client Connect response: variation_id must be a UUID');
    }
    if (typeof v.status !== 'string' || v.status.trim() === '') {
      throw new Error('Invalid Client Connect response: variation status must be a non-empty string');
    }

    return {
      id: v.id,
      variation_id: v.variation_id,
      quote_id: optionalUuid(v.quote_id, 'variation quote_id'),
      number: optionalNumber(v.number, 'variation number'),
      title: optionalString(v.title, 'variation title'),
      status: v.status,
      variation_status: optionalString(v.variation_status, 'variation_status'),
      total_inc_gst: optionalNumber(v.total_inc_gst, 'variation total_inc_gst'),
      accepted_at: optionalString(v.accepted_at, 'variation accepted_at'),
      section_id: optionalUuid(v.section_id, 'variation section_id'),
      section_name: optionalString(v.section_name, 'variation section_name'),
      section_trade: optionalTrade(v.section_trade, 'variation section_trade'),
      team_signed_at: optionalString(v.team_signed_at, 'variation team_signed_at'),
      client_signed_at: optionalString(v.client_signed_at, 'variation client_signed_at'),
      href: optionalString(v.href, 'variation href'),
    };
  });
}

function validateCcProjectSections(payload: unknown): CcProjectSection[] {
  if (payload == null) return [];
  if (!Array.isArray(payload)) {
    throw new Error('Invalid Client Connect response: sections must be an array');
  }

  return payload.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid Client Connect response: section must be an object');
    }
    const s = item as Record<string, unknown>;
    if (!isUuid(s.id)) {
      throw new Error('Invalid Client Connect response: section id must be a UUID');
    }
    if (typeof s.name !== 'string' || s.name.trim() === '') {
      throw new Error('Invalid Client Connect response: section name must be a non-empty string');
    }
    return {
      id: s.id,
      name: s.name,
      trade: optionalTrade(s.trade, 'section trade'),
    };
  });
}

function validateCcProjectsResponse(payload: unknown): CcProjectsResponseOk {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid Client Connect response: expected object');
  }
  const obj = payload as Record<string, unknown>;
  if (obj.ok !== true) {
    throw new Error('Invalid Client Connect response: ok flag must be true for success');
  }
  if (!Array.isArray(obj.projects)) {
    throw new Error('Invalid Client Connect response: projects must be an array');
  }

  const projects: CcProject[] = [];
  for (const item of obj.projects) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid Client Connect response: project must be an object');
    }
    const p = item as Record<string, unknown>;
    const project_id = p.project_id;
    const quote_id = p.quote_id;
    const client_id = p.client_id;
    const project_title = p.project_title;
    const client_name = p.client_name;
    const client_contact = p.client_contact;
    const site_address = p.site_address;
    const status = p.status;
    const tradesRaw = p.trades;

    if (!isUuid(project_id)) {
      throw new Error('Invalid Client Connect response: project_id must be a UUID');
    }
    if (quote_id != null && !isUuid(quote_id)) {
      throw new Error('Invalid Client Connect response: quote_id must be a UUID or null');
    }
    if (!isUuid(client_id)) {
      throw new Error('Invalid Client Connect response: client_id must be a UUID');
    }
    if (typeof project_title !== 'string' || project_title.trim() === '') {
      throw new Error('Invalid Client Connect response: project_title must be a non-empty string');
    }
    if (typeof client_name !== 'string' || client_name.trim() === '') {
      throw new Error('Invalid Client Connect response: client_name must be a non-empty string');
    }
    if (client_contact !== null && client_contact !== undefined && typeof client_contact !== 'string') {
      throw new Error('Invalid Client Connect response: client_contact must be string or null');
    }
    if (site_address !== null && typeof site_address !== 'string') {
      throw new Error('Invalid Client Connect response: site_address must be string or null');
    }
    if (!isCcProjectStatus(status)) {
      throw new Error('Invalid Client Connect response: status must be planning or active');
    }
    if (tradesRaw != null && !Array.isArray(tradesRaw)) {
      throw new Error('Invalid Client Connect response: trades must be an array');
    }

    const trades = Array.isArray(tradesRaw)
      ? tradesRaw.filter((trade): trade is CcProjectTrade => isCcProjectTrade(trade))
      : [];

    projects.push({
      project_id,
      quote_id: quote_id ?? null,
      client_id,
      project_title,
      client_name,
      client_contact: typeof client_contact === 'string' && client_contact.trim() !== ''
        ? client_contact
        : null,
      site_address: site_address ?? null,
      status,
      trades,
      sections: validateCcProjectSections(p.sections),
      variations: validateCcProjectVariations(p.variations),
    });
  }

  return { ok: true, projects };
}

export async function fetchCcProjects(requestId?: string): Promise<CcProject[]> {
  const baseUrl = process.env.CC_BASE_URL;
  const internalKey = process.env.CC_INTERNAL_API_KEY;

  if (!baseUrl || !internalKey) {
    throw new Error('Client Connect configuration missing: CC_BASE_URL or CC_INTERNAL_API_KEY');
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/api/internal/eod/projects`;

  const effectiveRequestId = requestId || randomUUID().slice(0, 8);
  const now = Date.now();

  console.log('[EOD->CC PROJECT FETCH]', {
    requestId: effectiveRequestId,
  });

  let liveError: unknown = null;

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-internal-key': internalKey,
          'x-request-id': effectiveRequestId,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to reach Client Connect: ${msg}`);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new Error('Invalid Client Connect response: could not parse JSON');
    }

    if (!response.ok) {
      const obj = json as { ok?: unknown; error?: unknown };
      const errorMsg =
        typeof obj?.error === 'string' && obj.error.trim() !== ''
          ? obj.error
          : `Client Connect error: HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    const validated = validateCcProjectsResponse(json);
    cachedProjects = validated.projects;
    cacheTimestampMs = now;
    return validated.projects;
  } catch (err) {
    liveError = err;
    const ageMs = now - cacheTimestampMs;
    if (cachedProjects && ageMs >= 0 && ageMs <= CACHE_TTL_MS) {
      console.warn('[CC PROJECT FETCH FALLBACK]', {
        reason: err instanceof Error ? err.message : 'unknown',
        cacheAgeMs: ageMs,
        cachedCount: cachedProjects.length,
      });
      return cachedProjects;
    }
  }

  // If we reach here, live fetch failed and no valid cache is available.
  if (liveError instanceof Error) {
    throw liveError;
  }
  throw new Error('Unknown error while fetching Client Connect projects');
}
