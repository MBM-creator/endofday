import { fetchCcProjects, type CcProject, type CcProjectTrade } from '@/lib/cc-client';

type JobWithClientConnect = {
  cc_project_id?: string | null;
};

export type QaCheckType = 'paving' | 'irrigation';

export function getApplicableQaChecks(project: CcProject | null): QaCheckType[] {
  if (!project) return ['paving'];
  const trades = new Set<CcProjectTrade>(project.trades);
  const checks: QaCheckType[] = [];
  if (trades.has('paving')) checks.push('paving');
  if (trades.has('irrigation')) checks.push('irrigation');
  return checks;
}

export async function loadCcProjectForJob(
  job: JobWithClientConnect,
  requestId?: string
): Promise<CcProject | null> {
  if (!job.cc_project_id) return null;
  try {
    const projects = await fetchCcProjects(requestId);
    return projects.find((project) => project.project_id === job.cc_project_id) ?? null;
  } catch (err) {
    console.warn('[CC PROJECT CONTEXT] skipped', {
      requestId,
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
}
