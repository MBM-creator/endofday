import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  buildSubmissionMap,
  computeSectionUiStates,
  type IssueSnapshot,
  type SubmissionSnapshot,
} from '@/lib/paving-qa-v1-graph';
import type { PavingQaSetup as PavingQaSetupV1 } from '@/lib/paving-qa-v1-types';
import type { PavingQaSetupV2 } from '@/lib/paving-qa-v2-types';
import { detectRunVersion } from '@/lib/paving-qa-dispatch';

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
  const { data: run, error: runErr } = await supabaseAdmin
    .from('paving_qa_runs')
    .select(
      'id, job_id, stage_id, status, setup, setup_version, started_at, updated_at, completed_at, supervisor_final_approved_at'
    )
    .eq('id', runId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (runErr || !run) {
    return { ok: false, code: 'NOT_FOUND' };
  }

  const runRow = run as PavingQaRunRow;
  const versionInfo = detectRunVersion(run.setup, run.setup_version as number | null);

  if (versionInfo.version === 'unknown') {
    return { ok: false, code: 'NOT_FOUND' };
  }

  const { data: subRows } = await supabaseAdmin
    .from('paving_qa_section_submissions')
    .select('section_code, submission_status, answers, submitted_at')
    .eq('run_id', runId);

  const submissions: SubmissionSnapshot[] = (subRows ?? []).map((r) => ({
    section_code: r.section_code as string,
    submission_status: r.submission_status as string,
    answers: (r.answers as Record<string, { result?: string; note?: string }>) ?? {},
    submitted_at: r.submitted_at as string | null | undefined,
  }));

  const { data: issueRows } = await supabaseAdmin
    .from('paving_qa_issues')
    .select('id, section_code, item_key, severity, status, title')
    .eq('run_id', runId);

  const issues: IssueSnapshot[] = (issueRows ?? []).map((r) => ({
    id: r.id as string,
    section_code: r.section_code as string,
    item_key: r.item_key as string,
    severity: r.severity as string,
    status: r.status as string,
    title: (r.title as string) ?? null,
  }));

  const { data: photoRows } = await supabaseAdmin
    .from('paving_qa_photos')
    .select('section_code, item_key')
    .eq('run_id', runId);

  const photos = (photoRows ?? []) as { section_code: string; item_key: string }[];

  if (versionInfo.version === 2) {
    return {
      ok: true,
      version: 2,
      run: runRow,
      setup: versionInfo.setup,
      submissions,
      issues,
      photoRows: photos,
    };
  }

  return {
    ok: true,
    version: 1,
    run: runRow,
    setup: versionInfo.setup,
    submissions,
    issues,
    photoRows: photos,
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
