'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface IssueRow {
  id: string;
  section_code: string;
  item_key: string;
  severity: string;
  status: string;
  title: string | null;
}

type StaffRole = 'field' | 'supervisor' | 'admin';

export default function PavingQaSupervisorPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';
  const runId = (params?.runId as string) ?? '';

  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [run, setRun] = useState<{ status: string; supervisor_final_approved_at: string | null } | null>(null);
  const [sectionStates, setSectionStates] = useState<{ section: string; cleared: boolean }[]>([]);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [finalBusy, setFinalBusy] = useState(false);
  const [proceedReason, setProceedReason] = useState('');

  const refresh = useCallback(async () => {
    const [res, meRes] = await Promise.all([
      fetch(`/api/jobs/${jobId}/qa/runs/${runId}?orgSlug=${encodeURIComponent(orgSlug)}`),
      fetch(`/api/auth/me?orgSlug=${encodeURIComponent(orgSlug)}`),
    ]);
    const d = await res.json();
    const me = await meRes.json();
    if (!res.ok || !d?.ok) throw new Error(d?.message ?? 'load');
    if (meRes.ok && me?.staff?.role) {
      setStaffRole(me.staff.role as StaffRole);
    }
    setIssues(Array.isArray(d.issues) ? d.issues : []);
    setRun({ status: d.run?.status, supervisor_final_approved_at: d.run?.supervisor_final_approved_at ?? null });
    setSectionStates(Array.isArray(d.sectionStates) ? d.sectionStates : []);
  }, [jobId, orgSlug, runId]);

  useEffect(() => {
    if (!orgSlug || !jobId || !runId) return;
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch(() => {
        if (!cancelled) setErr('Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, jobId, runId, refresh]);

  async function act(issueId: string, action: string, reason?: string) {
    setBusyId(issueId);
    setErr(null);
    try {
      const res = await fetch(
        `/api/jobs/${jobId}/qa/runs/${runId}/issues/${issueId}?orgSlug=${encodeURIComponent(orgSlug)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason }),
        }
      );
      const d = await res.json();
      if (!res.ok) {
        setErr(typeof d?.message === 'string' ? d.message : 'Action failed');
        return;
      }
      await refresh();
    } catch {
      setErr('Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function finalApprove() {
    setFinalBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/jobs/${jobId}/qa/runs/${runId}/final-approval?orgSlug=${encodeURIComponent(orgSlug)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
      );
      const d = await res.json();
      if (!res.ok) {
        setErr(typeof d?.message === 'string' ? d.message : 'Final approval failed');
        return;
      }
      await refresh();
    } catch {
      setErr('Final approval failed');
    } finally {
      setFinalBusy(false);
    }
  }

  const allCleared = sectionStates.length > 0 && sectionStates.every((s) => s.cleared);
  const openIssues = issues.filter((i) => ['open', 'rectification_required', 'evidence_requested'].includes(i.status));
  const canSupervise = staffRole === 'supervisor' || staffRole === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href={`/t/${orgSlug}/jobs/${jobId}/qa/paving/${runId}`} className="text-sm text-[#698F00] hover:underline">
          ← Run overview
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Supervisor</h1>
        <p className="text-sm text-gray-600 mt-1">Actions are recorded under your signed-in staff account.</p>
        {!loading && !canSupervise && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            Your role can view this QA run, but supervisor actions require a supervisor or admin account.
          </div>
        )}

        {err && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">{err}</div>}
        {loading && <p className="mt-4 text-gray-600">Loading…</p>}

        {!loading && run?.supervisor_final_approved_at && (
          <p className="mt-4 text-[#698F00] font-medium">This run has final approval recorded.</p>
        )}

        {!loading && !run?.supervisor_final_approved_at && (
          <>
            <h2 className="mt-8 text-lg font-semibold text-gray-900">Open issues</h2>
            <ul className="mt-2 space-y-3">
              {openIssues.length === 0 && <li className="text-sm text-gray-600">No open issues.</li>}
              {openIssues.map((iss) => (
                <li key={iss.id} className="border border-gray-200 rounded-lg p-3 bg-white text-sm">
                  <p className="font-medium text-gray-900">{iss.title ?? iss.item_key}</p>
                  <p className="text-gray-600">
                    {iss.section_code} · {iss.severity} · {iss.status}
                  </p>
                  {canSupervise && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === iss.id}
                        className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                        onClick={() => act(iss.id, 'request_evidence')}
                      >
                        Request evidence
                      </button>
                      <button
                        type="button"
                        disabled={busyId === iss.id}
                        className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                        onClick={() => act(iss.id, 'require_rectification')}
                      >
                        Require rectification
                      </button>
                      <button
                        type="button"
                        disabled={busyId === iss.id}
                        className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                        onClick={() => act(iss.id, 'approve_rectification')}
                      >
                        Approve rectification
                      </button>
                      <button
                        type="button"
                        disabled={busyId === iss.id || !proceedReason.trim()}
                        className="px-2 py-1 text-xs bg-amber-50 border border-amber-200 rounded"
                        onClick={() => act(iss.id, 'approve_to_proceed', proceedReason.trim())}
                      >
                        Approve to proceed
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {canSupervise && (
              <div className="mt-4">
                <label className="text-xs text-gray-600">Reason for “approve to proceed” (required)</label>
                <textarea
                  className="w-full mt-1 border border-gray-300 rounded px-2 py-1 text-sm"
                  rows={2}
                  value={proceedReason}
                  onChange={(e) => setProceedReason(e.target.value)}
                />
              </div>
            )}

            <h2 className="mt-10 text-lg font-semibold text-gray-900">Final approval</h2>
            <p className="text-sm text-gray-600 mt-1">
              Available when every applicable section is cleared and the run is still active.
            </p>
            <button
              type="button"
              disabled={finalBusy || !canSupervise || !allCleared || run?.status !== 'active'}
              className="mt-3 px-4 py-2 bg-[#698F00] text-white rounded-lg font-medium disabled:bg-gray-400"
              onClick={() => finalApprove()}
            >
              {finalBusy ? 'Saving…' : 'Record final approval'}
            </button>
            {!allCleared && <p className="mt-2 text-xs text-amber-800">Not all sections are cleared yet.</p>}
          </>
        )}
      </div>
    </div>
  );
}
