import { loadQaRunBundle } from '@/lib/qa-run-bundle';
import {
  buildSubmissionMap,
  computeSectionUiStates,
  type IssueSnapshot,
  type SubmissionSnapshot,
} from '@/lib/paving-qa-v1-graph';
import type { PavingQaSetup as PavingQaSetupV1 } from '@/lib/paving-qa-v1-types';
import type { PavingQaSetupV2 } from '@/lib/paving-qa-v2-types';

export type PavingQaRunRow = {
  id: string;
  job_id: string;
  stage_id: string | null;
  status: string;
  setup: unknown;
  setup_version: number | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  supervisor_final_approved_at: string | null;
};

export type RunBundleV1 = {
  ok: true;
  version: 1;
  run: PavingQaRunRow;
  setup: PavingQaSetupV1;
  submissions: SubmissionSnapshot[];
  issues: IssueSnapshot[];
  photoRows: { section_code: string; item_key: string }[];
};

export type RunBundleV2 = {
  ok: true;
  version: 2;
  run: PavingQaRunRow;
  setup: PavingQaSetupV2;
  submissions: SubmissionSnapshot[];
  issues: IssueSnapshot[];
  photoRows: { section_code: string; item_key: string }[];
};

export type RunBundle = RunBundleV1 | RunBundleV2 | { ok: false; code: 'NOT_FOUND' };

export async function loadRunBundle(runId: string, jobId: string): Promise<RunBundle> {
  const typed = await loadQaRunBundle(runId, jobId);
  if (!typed.ok || typed.qaType !== 'paving') return { ok: false, code: 'NOT_FOUND' };
  return typed.version === 2
    ? {
        ok: true,
        version: 2,
        run: typed.run,
        setup: typed.setup,
        submissions: typed.submissions,
        issues: typed.issues,
        photoRows: typed.photoRows,
      }
    : {
        ok: true,
        version: 1,
        run: typed.run,
        setup: typed.setup,
        submissions: typed.submissions,
        issues: typed.issues,
        photoRows: typed.photoRows,
      };
}

export function computeRunSectionStates(
  setup: PavingQaSetupV1,
  submissions: SubmissionSnapshot[],
  photoRows: { section_code: string; item_key: string }[],
  issues: IssueSnapshot[]
) {
  return computeSectionUiStates(setup, submissions, photoRows, issues);
}

export { buildSubmissionMap };
