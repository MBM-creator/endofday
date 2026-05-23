import { supabaseAdmin } from '@/lib/supabase-admin';
import { detectRunVersion } from '@/lib/paving-qa-dispatch';
import type { PavingQaSetup as PavingQaSetupV1 } from '@/lib/paving-qa-v1-types';
import type { PavingQaSetupV2 } from '@/lib/paving-qa-v2-types';
import { validateIrrigationSetupV1 } from '@/lib/irrigation-qa-v1-setup';
import type { IrrigationQaSetupV1 } from '@/lib/irrigation-qa-v1-types';
import type { IssueSnapshot, SubmissionSnapshot } from '@/lib/paving-qa-v1-graph';

export type QaType = 'paving' | 'irrigation';

export type QaRunRow = {
  id: string;
  job_id: string;
  stage_id: string | null;
  status: string;
  qa_type: QaType;
  setup: unknown;
  setup_version: number | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  supervisor_final_approved_at: string | null;
};

type BundleBase = {
  ok: true;
  run: QaRunRow;
  submissions: SubmissionSnapshot[];
  issues: IssueSnapshot[];
  photoRows: { section_code: string; item_key: string }[];
};

export type PavingRunBundleV1 = BundleBase & {
  qaType: 'paving';
  version: 1;
  setup: PavingQaSetupV1;
};

export type PavingRunBundleV2 = BundleBase & {
  qaType: 'paving';
  version: 2;
  setup: PavingQaSetupV2;
};

export type IrrigationRunBundleV1 = BundleBase & {
  qaType: 'irrigation';
  version: 1;
  setup: IrrigationQaSetupV1;
};

export type QaRunBundle =
  | PavingRunBundleV1
  | PavingRunBundleV2
  | IrrigationRunBundleV1
  | { ok: false; code: 'NOT_FOUND' };

export async function loadQaRunBundle(runId: string, jobId: string): Promise<QaRunBundle> {
  const { data: run, error: runErr } = await supabaseAdmin
    .from('paving_qa_runs')
    .select(
      'id, job_id, stage_id, status, qa_type, setup, setup_version, started_at, updated_at, completed_at, supervisor_final_approved_at'
    )
    .eq('id', runId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (runErr || !run) return { ok: false, code: 'NOT_FOUND' };

  const runRow = {
    ...(run as Omit<QaRunRow, 'qa_type'> & { qa_type?: string | null }),
    qa_type: ((run as { qa_type?: string | null }).qa_type === 'irrigation' ? 'irrigation' : 'paving') as QaType,
  } satisfies QaRunRow;

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

  if (runRow.qa_type === 'irrigation') {
    const parsed = validateIrrigationSetupV1(run.setup);
    if (!parsed.ok) return { ok: false, code: 'NOT_FOUND' };
    return {
      ok: true,
      qaType: 'irrigation',
      version: 1,
      run: runRow,
      setup: parsed.setup,
      submissions,
      issues,
      photoRows: photos,
    };
  }

  const versionInfo = detectRunVersion(run.setup, run.setup_version as number | null);
  if (versionInfo.version === 'unknown') return { ok: false, code: 'NOT_FOUND' };
  if (versionInfo.version === 2) {
    return {
      ok: true,
      qaType: 'paving',
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
    qaType: 'paving',
    version: 1,
    run: runRow,
    setup: versionInfo.setup,
    submissions,
    issues,
    photoRows: photos,
  };
}
