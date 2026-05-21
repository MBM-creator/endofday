import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseRunSetup } from '@/lib/paving-qa-v1-catalog';
import {
  buildSubmissionMap,
  computeSectionUiStates,
  type IssueSnapshot,
  type SubmissionSnapshot,
} from '@/lib/paving-qa-v1-graph';
import type { PavingQaSetup } from '@/lib/paving-qa-v1-types';

export type PavingQaRunRow = {
  id: string;
  job_id: string;
  stage_id: string | null;
  status: string;
  setup: unknown;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  supervisor_final_approved_at: string | null;
};

export async function loadRunBundle(
  runId: string,
  jobId: string
): Promise<
  | {
      ok: true;
      run: PavingQaRunRow;
      setup: PavingQaSetup;
      submissions: SubmissionSnapshot[];
      issues: IssueSnapshot[];
      photoRows: { section_code: string; item_key: string }[];
    }
  | { ok: false; code: 'NOT_FOUND' }
> {
  const { data: run, error: runErr } = await supabaseAdmin
    .from('paving_qa_runs')
    .select(
      'id, job_id, stage_id, status, setup, started_at, updated_at, completed_at, supervisor_final_approved_at'
    )
    .eq('id', runId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (runErr || !run) {
    return { ok: false, code: 'NOT_FOUND' };
  }

  const setup = parseRunSetup(run.setup);
  if (!setup) {
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

  return {
    ok: true,
    run: run as PavingQaRunRow,
    setup,
    submissions,
    issues,
    photoRows: (photoRows ?? []) as { section_code: string; item_key: string }[],
  };
}

export function computeRunSectionStates(
  setup: PavingQaSetup,
  submissions: SubmissionSnapshot[],
  photoRows: { section_code: string; item_key: string }[],
  issues: IssueSnapshot[]
) {
  return computeSectionUiStates(setup, submissions, photoRows, issues);
}

export { buildSubmissionMap };
