import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export function normalizeSupabaseError(err: unknown): {
  code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
} {
  if (err === null || err === undefined) {
    return { code: null, message: '', details: null, hint: null };
  }
  const o = err as Record<string, unknown>;
  return {
    code: typeof o.code === 'string' ? o.code : null,
    message: typeof o.message === 'string' ? o.message : String(err),
    details: typeof o.details === 'string' ? o.details : null,
    hint: typeof o.hint === 'string' ? o.hint : null,
  };
}

export async function validateJobForOrg(
  jobId: string,
  orgSlug: string,
  requestId: string
): Promise<
  | {
      ok: true;
      organisationId: string;
      job: {
        id: string;
        name: string;
        active_stage_id: string | null;
        cc_project_id: string | null;
        cc_quote_id: string | null;
        cc_client_id: string | null;
        cc_project_title_snapshot: string | null;
        cc_client_name_snapshot: string | null;
      };
    }
  | NextResponse
> {
  if (!jobId || !isValidUuid(jobId)) {
    return NextResponse.json({ ok: false, message: 'Job not found' }, { status: 404 });
  }
  if (!orgSlug.trim()) {
    return NextResponse.json({ ok: false, message: 'orgSlug is required' }, { status: 400 });
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organisations')
    .select('id')
    .eq('slug', orgSlug.trim())
    .single();

  if (orgError || !org) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        message:
          process.env.NODE_ENV === 'development' && orgError
            ? `Invalid organisation: ${orgError.message}`
            : 'Invalid organisation',
      },
      { status: 404 }
    );
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, name, organisation_id, active_stage_id, cc_project_id, cc_quote_id, cc_client_id, cc_project_title_snapshot, cc_client_name_snapshot'
    )
    .eq('id', jobId)
    .eq('organisation_id', org.id)
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        message:
          process.env.NODE_ENV === 'development' && jobError ? `Job not found: ${jobError.message}` : 'Job not found',
      },
      { status: 404 }
    );
  }

  return {
    ok: true,
    organisationId: org.id as string,
    job: {
      id: job.id as string,
      name: String(job.name),
      active_stage_id: (job.active_stage_id as string | null) ?? null,
      cc_project_id: (job.cc_project_id as string | null) ?? null,
      cc_quote_id: (job.cc_quote_id as string | null) ?? null,
      cc_client_id: (job.cc_client_id as string | null) ?? null,
      cc_project_title_snapshot: (job.cc_project_title_snapshot as string | null) ?? null,
      cc_client_name_snapshot: (job.cc_client_name_snapshot as string | null) ?? null,
    },
  };
}

export async function validateStageBelongsToJob(
  stageId: string | null | undefined,
  jobId: string,
  requestId: string
): Promise<{ ok: true } | NextResponse> {
  if (stageId == null || String(stageId).trim() === '') {
    return { ok: true };
  }
  const sid = String(stageId).trim();
  if (!isValidUuid(sid)) {
    return NextResponse.json({ ok: false, requestId, message: 'Invalid stage' }, { status: 400 });
  }
  const { data: stage, error } = await supabaseAdmin
    .from('stages')
    .select('id, job_id')
    .eq('id', sid)
    .maybeSingle();
  if (error || !stage || stage.job_id !== jobId) {
    return NextResponse.json({ ok: false, requestId, message: 'Stage not found' }, { status: 404 });
  }
  return { ok: true };
}
