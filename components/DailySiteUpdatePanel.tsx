'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react';
import { ClientConnectJobSummary } from '@/components/ClientConnectJobSummary';
import { DailySiteUpdateHistory, type DailySiteUpdateApiRow } from '@/components/DailySiteUpdateHistory';
import type { CcProject } from '@/lib/cc-client';
import {
  DAILY_SITE_UPDATE_MAX_FIELD_LENGTH,
  NO_ACTIVE_STAGE_WARNING,
  type OnTrackStatus,
  type StaffRole,
} from '@/lib/daily-site-update-shared';

interface JobSummary {
  id: string;
  name: string;
  active_stage_id?: string | null;
  cc_project_id?: string | null;
  cc_quote_id?: string | null;
  cc_client_id?: string | null;
  cc_project_title_snapshot?: string | null;
  cc_client_name_snapshot?: string | null;
}

interface ActiveStageSummary {
  id: string;
  name: string;
  cc_section_trade: string | null;
}

interface ProgressContext {
  plannedHours: number | null;
  hoursUsed: number | null;
  hoursRemaining: number | null;
  hoursSource: string | null;
}

interface TodayBundle {
  ok?: boolean;
  job?: JobSummary;
  ccProject?: CcProject | null;
  activeStage?: ActiveStageSummary | null;
  noActiveStage?: boolean;
  noActiveStageWarning?: string | null;
  progressContext?: ProgressContext | null;
  qaEvidenceWarning?: { message: string; activeRunId: string; qaType?: string } | null;
  recentUpdates?: DailySiteUpdateApiRow[];
  reportDate?: string;
  viewerRole?: StaffRole;
  message?: string;
}

interface DailySiteUpdatePanelProps {
  orgSlug: string;
  jobId: string;
  jobName: string;
  job: JobSummary;
}

const ON_TRACK_OPTIONS: { value: OnTrackStatus; label: string }[] = [
  { value: 'on_track', label: 'On track' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'off_track', label: 'Off track' },
  { value: 'unknown', label: 'Unknown' },
];

const EMPTY_FORM = {
  progressToday: '',
  issuesFaced: '',
  issuesFacedNone: false,
  problemsResolved: '',
  problemsResolvedNone: false,
  preventionPlan: '',
  preventionPlanNone: false,
  onTrackStatus: 'on_track' as OnTrackStatus,
  onTrackNotes: '',
};

function formatHours(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} h`;
}

export function DailySiteUpdatePanel({ orgSlug, jobId, jobName, job }: DailySiteUpdatePanelProps) {
  const [bundle, setBundle] = useState<TodayBundle | null>(null);
  const [updates, setUpdates] = useState<DailySiteUpdateApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [showVoided, setShowVoided] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canViewVoided =
    bundle?.viewerRole === 'supervisor' || bundle?.viewerRole === 'admin';

  const loadBundle = useCallback(async () => {
    const res = await fetch(
      `/api/jobs/${jobId}/daily-site-updates/today?orgSlug=${encodeURIComponent(orgSlug)}`
    );
    const data = (await res.json()) as TodayBundle;
    if (!res.ok || !data.ok) {
      throw new Error(typeof data.message === 'string' ? data.message : 'Failed to load daily site update');
    }
    return data;
  }, [jobId, orgSlug]);

  const loadList = useCallback(
    async (includeVoided: boolean) => {
      const params = new URLSearchParams({ orgSlug, limit: '20' });
      if (includeVoided) params.set('includeVoided', '1');
      const res = await fetch(`/api/jobs/${jobId}/daily-site-updates?${params.toString()}`);
      const data = (await res.json()) as { ok?: boolean; updates?: DailySiteUpdateApiRow[]; message?: string };
      if (!res.ok || !data.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Failed to load history');
      }
      return data.updates ?? [];
    },
    [jobId, orgSlug]
  );

  const refresh = useCallback(async () => {
    const [todayData, listData] = await Promise.all([loadBundle(), loadList(showVoided)]);
    setBundle(todayData);
    setUpdates(listData);
  }, [loadBundle, loadList, showVoided]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([loadBundle(), loadList(false)])
      .then(([todayData, listData]) => {
        if (cancelled) return;
        setBundle(todayData);
        setUpdates(listData);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load daily site update');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadBundle, loadList]);

  useEffect(() => {
    if (!canViewVoided) return;
    loadList(showVoided)
      .then(setUpdates)
      .catch(() => {});
  }, [canViewVoided, showVoided, loadList]);

  const notesRequired =
    form.onTrackStatus === 'at_risk' ||
    form.onTrackStatus === 'off_track' ||
    form.onTrackStatus === 'unknown';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/jobs/${jobId}/daily-site-updates?orgSlug=${encodeURIComponent(orgSlug)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            progressToday: form.progressToday,
            issuesFaced: form.issuesFaced,
            issuesFacedNone: form.issuesFacedNone,
            problemsResolved: form.problemsResolved,
            problemsResolvedNone: form.problemsResolvedNone,
            preventionPlan: form.preventionPlan,
            preventionPlanNone: form.preventionPlanNone,
            onTrackStatus: form.onTrackStatus,
            onTrackNotes: form.onTrackNotes,
          }),
        }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        savedAtJobLevelOnly?: boolean;
      };
      if (!res.ok || !data.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Failed to submit');
      }
      setForm(EMPTY_FORM);
      setSubmitSuccess(
        data.savedAtJobLevelOnly ? NO_ACTIVE_STAGE_WARNING : 'Daily site update submitted.'
      );
      await refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVoid(updateId: string, voidReason: string) {
    setVoidingId(updateId);
    try {
      const res = await fetch(
        `/api/jobs/${jobId}/daily-site-updates/${updateId}/void?orgSlug=${encodeURIComponent(orgSlug)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voidReason }),
        }
      );
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Failed to void update');
      }
      await refresh();
    } finally {
      setVoidingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-600">Loading daily site update…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {loadError}
      </div>
    );
  }

  const activeStage = bundle?.activeStage ?? null;
  const progressContext = bundle?.progressContext ?? null;
  const qaWarning = bundle?.qaEvidenceWarning ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Daily site update</h2>
        <p className="mt-1 text-sm text-gray-600">{jobName}</p>
        <ClientConnectJobSummary
          job={job}
          compact
          className="mt-1"
          emptyText="No Client Connect project linked."
        />

        {activeStage ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-sm font-medium text-[#698F00]">{activeStage.name}</span>
            {activeStage.cc_section_trade && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {activeStage.cc_section_trade.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {NO_ACTIVE_STAGE_WARNING}
          </div>
        )}

        {progressContext && (
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Progress context
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Read-only labour budget context from this stage. Actual time tracking is not integrated yet.
            </p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Planned</dt>
                <dd className="font-medium text-gray-900">{formatHours(progressContext.plannedHours)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Used</dt>
                <dd className="font-medium text-gray-900">{formatHours(progressContext.hoursUsed)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Remaining</dt>
                <dd className="font-medium text-gray-900">{formatHours(progressContext.hoursRemaining)}</dd>
              </div>
            </dl>
          </div>
        )}

        {qaWarning && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {qaWarning.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="dsu-progress">
              What progress was made today?
            </label>
            <textarea
              id="dsu-progress"
              required
              rows={3}
              maxLength={DAILY_SITE_UPDATE_MAX_FIELD_LENGTH}
              value={form.progressToday}
              onChange={(e) => setForm((prev) => ({ ...prev, progressToday: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="dsu-issues">
                What issues did you face?
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.issuesFacedNone}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      issuesFacedNone: e.target.checked,
                      issuesFaced: e.target.checked ? '' : prev.issuesFaced,
                    }))
                  }
                />
                No issues today
              </label>
            </div>
            <textarea
              id="dsu-issues"
              rows={2}
              maxLength={DAILY_SITE_UPDATE_MAX_FIELD_LENGTH}
              disabled={form.issuesFacedNone}
              value={form.issuesFaced}
              onChange={(e) => setForm((prev) => ({ ...prev, issuesFaced: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="dsu-resolved">
                What problems did you resolve?
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.problemsResolvedNone}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      problemsResolvedNone: e.target.checked,
                      problemsResolved: e.target.checked ? '' : prev.problemsResolved,
                    }))
                  }
                />
                Nothing resolved today
              </label>
            </div>
            <textarea
              id="dsu-resolved"
              rows={2}
              maxLength={DAILY_SITE_UPDATE_MAX_FIELD_LENGTH}
              disabled={form.problemsResolvedNone}
              value={form.problemsResolved}
              onChange={(e) => setForm((prev) => ({ ...prev, problemsResolved: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="dsu-prevention">
                How can we eliminate/prevent those problems in future?
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.preventionPlanNone}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      preventionPlanNone: e.target.checked,
                      preventionPlan: e.target.checked ? '' : prev.preventionPlan,
                    }))
                  }
                />
                No prevention action required
              </label>
            </div>
            <textarea
              id="dsu-prevention"
              rows={2}
              maxLength={DAILY_SITE_UPDATE_MAX_FIELD_LENGTH}
              disabled={form.preventionPlanNone}
              value={form.preventionPlan}
              onChange={(e) => setForm((prev) => ({ ...prev, preventionPlan: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="dsu-on-track">
              Are we on track?
            </label>
            <select
              id="dsu-on-track"
              value={form.onTrackStatus}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  onTrackStatus: e.target.value as OnTrackStatus,
                }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {ON_TRACK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="dsu-on-track-notes">
              On-track notes{notesRequired ? ' (required)' : ''}
            </label>
            <textarea
              id="dsu-on-track-notes"
              rows={2}
              maxLength={DAILY_SITE_UPDATE_MAX_FIELD_LENGTH}
              required={notesRequired}
              value={form.onTrackNotes}
              onChange={(e) => setForm((prev) => ({ ...prev, onTrackNotes: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {submitError && <p className="text-sm text-red-700">{submitError}</p>}
          {submitSuccess && <p className="text-sm text-[#698F00]">{submitSuccess}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#698F00] px-4 py-2 text-sm font-medium text-white hover:bg-[#5a7d00] disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit daily site update'}
          </button>
        </form>
      </div>

      <DailySiteUpdateHistory
        orgSlug={orgSlug}
        jobId={jobId}
        updates={updates}
        showVoided={showVoided}
        onToggleShowVoided={() => setShowVoided((prev) => !prev)}
        canViewVoided={canViewVoided}
        onVoid={handleVoid}
        voidingId={voidingId}
      />
    </div>
  );
}
