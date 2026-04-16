import { randomUUID } from 'crypto';

export type CcProjectStatus = 'planning' | 'active';

export interface CcProject {
  project_id: string;
  client_id: string;
  project_title: string;
  client_name: string;
  site_address: string | null;
  status: CcProjectStatus;
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
    const client_id = p.client_id;
    const project_title = p.project_title;
    const client_name = p.client_name;
    const site_address = p.site_address;
    const status = p.status;

    if (!isUuid(project_id)) {
      throw new Error('Invalid Client Connect response: project_id must be a UUID');
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
    if (site_address !== null && typeof site_address !== 'string') {
      throw new Error('Invalid Client Connect response: site_address must be string or null');
    }
    if (!isCcProjectStatus(status)) {
      throw new Error('Invalid Client Connect response: status must be planning or active');
    }

    projects.push({
      project_id,
      client_id,
      project_title,
      client_name,
      site_address: site_address ?? null,
      status,
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

