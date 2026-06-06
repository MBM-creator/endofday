import type { QaType } from '@/lib/qa-run-bundle';
import type { QaCheckType } from '@/lib/cc-project-context';

export type QaHubRun = {
  id: string;
  status: string;
  started_at: string;
  completed_at?: string | null;
  supervisor_final_approved_at?: string | null;
  qa_type?: string | null;
};

export function normalizeQaType(qaType: string | null | undefined): QaType {
  if (qaType === 'irrigation' || qaType === 'fencing' || qaType === 'sign_off') {
    return qaType;
  }
  return 'paving';
}

export function qaTypeDisplayLabel(qaType: string | null | undefined): string {
  switch (normalizeQaType(qaType)) {
    case 'irrigation':
      return 'Irrigation';
    case 'fencing':
      return 'Fencing';
    case 'sign_off':
      return 'Supervisor sign-off';
    case 'paving':
    default:
      return 'Paving';
  }
}

export function runDisplayStatus(run: QaHubRun): string {
  if (run.status === 'active') return 'Active';
  if (run.status === 'cancelled') return 'Cancelled';
  if (run.status === 'completed') {
    return run.supervisor_final_approved_at ? 'Approved' : 'Completed';
  }
  return 'Completed';
}

const QA_HUB_DATE_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Australia/Melbourne',
  hour12: true,
});

export function formatQaDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return QA_HUB_DATE_FORMATTER.format(date);
}

export function qaRunPath(orgSlug: string, jobId: string, runId: string, qaType: string | null | undefined): string {
  const type = normalizeQaType(qaType);
  if (type === 'irrigation') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/irrigation/${runId}`;
  }
  if (type === 'fencing') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/fencing/${runId}`;
  }
  if (type === 'sign_off') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/sign-off/${runId}`;
  }
  return `/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`;
}

export function qaNewRunPath(orgSlug: string, jobId: string, qaType: QaType | QaCheckType): string {
  if (qaType === 'irrigation') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/irrigation/new`;
  }
  if (qaType === 'fencing') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/fencing/new`;
  }
  if (qaType === 'sign_off') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/sign-off/new`;
  }
  return `/t/${orgSlug}/jobs/${jobId}/qa/paving/new`;
}

export function currentRunActionLabel(run: QaHubRun): string {
  return run.status === 'active' ? 'Continue QA' : 'View QA';
}

function sortByStartedDesc(a: QaHubRun, b: QaHubRun): number {
  return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
}

export function bucketHubRuns(runs: QaHubRun[]): { activeRuns: QaHubRun[]; historyRuns: QaHubRun[] } {
  const activeRuns = runs.filter((run) => run.status === 'active').sort(sortByStartedDesc);
  const historyRuns = runs.filter((run) => run.status !== 'active').sort(sortByStartedDesc);
  return { activeRuns, historyRuns };
}

export function activeRunForType(runs: QaHubRun[], qaType: QaType): QaHubRun | undefined {
  return runs.find((run) => run.status === 'active' && normalizeQaType(run.qa_type) === qaType);
}

export const QA_CHECK_DESCRIPTIONS: Record<QaCheckType, string> = {
  paving:
    'Evidence run for paving works, base preparation, set-out, surface and supervisor sign-off.',
  irrigation:
    'Evidence run for irrigation water source checks, before-cover records, controller setup, testing and handover.',
  fencing:
    'Evidence run for fencing property protection, set-out, post holes, frame, cladding, gates and final supervisor review.',
};

export const SIGN_OFF_DESCRIPTION =
  'No trade-specific checklist applies to this project. Record completion evidence and supervisor review instead.';
