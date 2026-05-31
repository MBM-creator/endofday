import type { QaType } from '@/lib/qa-run-bundle';

export function qaRunPath(orgSlug: string, jobId: string, runId: string, qaType: QaType): string {
  if (qaType === 'irrigation') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/irrigation/${runId}`;
  }
  if (qaType === 'fencing') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/fencing/${runId}`;
  }
  if (qaType === 'sign_off') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/sign-off/${runId}`;
  }
  return `/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`;
}

export function qaSupervisorPath(orgSlug: string, jobId: string, runId: string, qaType: QaType): string {
  if (qaType === 'irrigation') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/irrigation/${runId}/supervisor`;
  }
  if (qaType === 'fencing') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/fencing/${runId}/supervisor`;
  }
  if (qaType === 'sign_off') {
    return `/t/${orgSlug}/jobs/${jobId}/qa/sign-off/${runId}/supervisor`;
  }
  return `/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}/supervisor`;
}

export function qaEvidencePath(orgSlug: string, jobId: string, runId: string): string {
  return `/t/${orgSlug}/jobs/${jobId}/qa/runs/${runId}/evidence`;
}

export function qaTypeLabel(qaType: QaType | null | undefined): string {
  switch (qaType) {
    case 'irrigation':
      return 'Irrigation';
    case 'fencing':
      return 'Fencing';
    case 'sign_off':
      return 'Sign-off';
    case 'paving':
      return 'Paving';
    default:
      return 'QA';
  }
}

export function urgencyLabel(urgency: string): string {
  switch (urgency) {
    case 'blocked_by_issue':
      return 'Blocked by unresolved issue';
    case 'submitted_not_cleared':
      return 'Submitted, not cleared';
    case 'missing_evidence':
      return 'Missing required evidence';
    case 'stale_activity':
      return 'Active but stale';
    case 'possible_missing_run':
      return 'Possible missing QA run (inferred from stage/template)';
    default:
      return urgency;
  }
}
