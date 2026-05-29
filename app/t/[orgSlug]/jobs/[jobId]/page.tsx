'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ClientConnectJobSummary } from '@/components/ClientConnectJobSummary';
import { ClientConnectVariationsSummary } from '@/components/ClientConnectVariationsSummary';
import type { CcProject } from '@/lib/cc-client';
import { compressImageForUpload } from '@/lib/client-image-compression';

interface Job {
  id: string;
  organisation_id: string;
  name: string;
  site_id: string | null;
  created_at: string;
  active_stage_id?: string | null;
  cc_project_id?: string | null;
  cc_client_id?: string | null;
  cc_project_title_snapshot?: string | null;
  cc_client_name_snapshot?: string | null;
}

interface ChecklistTemplateItem {
  id: string;
  item_type: string;
  label: string;
  sort_order: number;
}

interface Stage {
  id: string;
  job_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  checklist_template_id?: string | null;
  cc_project_id?: string | null;
  cc_section_id?: string | null;
  cc_section_name_snapshot?: string | null;
  cc_section_trade?: string | null;
  checklist_templates?: { name: string; checklist_template_items?: ChecklistTemplateItem[] } | null;
}

interface ChecklistTemplate {
  id: string;
  name: string;
}

interface PreCommencementPhoto {
  id: string;
  storage_path: string;
  created_at: string;
  url: string;
}

interface JobBrief {
  id: string;
  job_id: string;
  content: string | null;
  updated_at: string;
}

interface QaRun {
  id: string;
  stage_id: string | null;
  status: string;
  qa_type?: 'paving' | 'irrigation' | 'fencing' | string | null;
}

const MAX_PHOTOS = 10;

function normaliseMatchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findSuggestedCcProject(job: Job, projects: CcProject[]): CcProject | null {
  if (job.cc_project_id || projects.length === 0) return null;
  const jobName = normaliseMatchText(job.name);
  if (!jobName) return null;

  return (
    projects.find((project) => normaliseMatchText(project.project_title) === jobName) ??
    projects.find((project) => normaliseMatchText(project.project_title).includes(jobName)) ??
    null
  );
}

function supportedQaTypeForStage(stage: Stage): 'paving' | 'irrigation' | 'fencing' | null {
  const trade = stage.cc_section_trade;
  if (trade === 'paving' || trade === 'irrigation' || trade === 'fencing') return trade;

  const templateName = normaliseMatchText(stage.checklist_templates?.name ?? '');
  const stageName = normaliseMatchText(stage.name);
  if (templateName.includes('paving') || stageName.includes('paving')) return 'paving';
  if (templateName.includes('irrigation') || stageName.includes('irrigation')) return 'irrigation';
  if (templateName.includes('fencing') || stageName.includes('fencing')) return 'fencing';
  return null;
}

function qaTypeLabel(type: 'paving' | 'irrigation' | 'fencing'): string {
  if (type === 'paving') return 'Paving';
  if (type === 'irrigation') return 'Irrigation';
  return 'Fencing';
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';

  const [job, setJob] = useState<Job | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [photos, setPhotos] = useState<PreCommencementPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [photoIdRemoving, setPhotoIdRemoving] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [brief, setBrief] = useState<JobBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [isEditingBrief, setIsEditingBrief] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSavingBrief, setIsSavingBrief] = useState(false);
  const [stageName, setStageName] = useState('');
  const [isSubmittingStage, setIsSubmittingStage] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [stageIdSettingActive, setStageIdSettingActive] = useState<string | null>(null);
  const [activeStageError, setActiveStageError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [stageIdUpdatingTemplate, setStageIdUpdatingTemplate] = useState<string | null>(null);
  const [templateUpdateError, setTemplateUpdateError] = useState<string | null>(null);
  const [activeStageStatus, setActiveStageStatus] = useState<{
    completions: Record<string, string>;
    dailyNote: string | null;
    endOfDaySubmitted: boolean;
  } | null>(null);

  const [ccProjects, setCcProjects] = useState<CcProject[]>([]);
  const [ccProjectsLoading, setCcProjectsLoading] = useState(false);
  const [ccProjectsError, setCcProjectsError] = useState<string | null>(null);
  const [ccSelectedProjectId, setCcSelectedProjectId] = useState<string>('');
  const [ccMappingSaving, setCcMappingSaving] = useState(false);
  const [ccMappingError, setCcMappingError] = useState<string | null>(null);
  const [manualCcProjectTitle, setManualCcProjectTitle] = useState('');
  const [manualCcClientName, setManualCcClientName] = useState('');
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const [hideConfirmText, setHideConfirmText] = useState('');
  const [hideJobSaving, setHideJobSaving] = useState(false);
  const [hideJobError, setHideJobError] = useState<string | null>(null);
  const [qaRuns, setQaRuns] = useState<QaRun[]>([]);
  const [qaRunsError, setQaRunsError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSlug || !jobId) {
      setError('Job not found');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setJob(null);
    setStages([]);

    fetch(`/api/jobs?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof data?.message === 'string' ? data.message : 'Failed to load job');
          return;
        }
        if (!data?.ok || !Array.isArray(data.jobs)) {
          setError('Invalid response');
          return;
        }
        const found = data.jobs.find((j: Job) => j.id === jobId);
        if (!found) {
          setError('Job not found');
          return;
        }
        setJob(found);
        setManualCcProjectTitle(found.cc_project_title_snapshot ?? '');
        setManualCcClientName(found.cc_client_name_snapshot ?? '');

        return fetch(`/api/stages?jobId=${encodeURIComponent(jobId)}`);
      })
      .then((stagesRes) => {
        if (cancelled || stagesRes === undefined) return undefined;
        return stagesRes.json().then((stagesData: { ok?: boolean; stages?: Stage[]; message?: string }) => ({ stagesRes, stagesData }));
      })
      .then((next) => {
        if (cancelled || next === undefined) return;
        const { stagesRes, stagesData } = next;
        if (!stagesRes.ok) {
          setError(typeof stagesData?.message === 'string' ? stagesData.message : 'Failed to load stages');
          return;
        }
        if (stagesData?.ok && Array.isArray(stagesData.stages)) {
          setStages(stagesData.stages);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load job');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug, jobId]);

  useEffect(() => {
    if (!orgSlug || !jobId) return;

    let cancelled = false;
    setQaRunsError(null);
    fetch(`/api/jobs/${jobId}/qa/runs?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok) {
          setQaRunsError(typeof data?.message === 'string' ? data.message : 'Failed to load QA runs');
          return;
        }
        setQaRuns(Array.isArray(data.runs) ? data.runs : []);
      })
      .catch((err) => {
        if (!cancelled) setQaRunsError(err instanceof Error ? err.message : 'Failed to load QA runs');
      });

    return () => {
      cancelled = true;
    };
  }, [orgSlug, jobId]);

  // Fetch pre-commencement photos when job is available
  useEffect(() => {
    if (!job || !orgSlug || !jobId) return;
    let cancelled = false;
    setPhotosLoading(true);
    setPhotosError(null);
    fetch(`/api/jobs/${jobId}/photos?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json())
      .then((data: { ok?: boolean; photos?: PreCommencementPhoto[]; message?: string }) => {
        if (cancelled) return;
        if (!data?.ok || !Array.isArray(data.photos)) {
          setPhotosError(typeof data?.message === 'string' ? data.message : 'Failed to load photos');
          return;
        }
        setPhotos(data.photos);
      })
      .catch((err) => {
        if (!cancelled) {
          setPhotosError(err instanceof Error ? err.message : 'Failed to load photos');
        }
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job, jobId, orgSlug]);

  // Fetch Client Connect projects when job is available
  useEffect(() => {
    if (!job || !orgSlug || !jobId) return;
    let cancelled = false;
    setCcProjectsLoading(true);
    setCcProjectsError(null);
    setCcMappingError(null);
    fetch('/api/cc/projects')
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }: { res: Response; data: { ok?: boolean; projects?: CcProject[]; error?: string } }) => {
        if (cancelled) return;
        if (!res.ok || !data?.ok || !Array.isArray(data.projects)) {
          setCcProjectsError(
            typeof data?.error === 'string'
              ? data.error
              : 'Failed to load Client Connect projects'
          );
          return;
        }
        setCcProjects(data.projects);
        const suggestion = findSuggestedCcProject(job, data.projects);
        if (suggestion) {
          setCcSelectedProjectId(suggestion.project_id);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCcProjectsError(err instanceof Error ? err.message : 'Failed to load Client Connect projects');
        }
      })
      .finally(() => {
        if (!cancelled) setCcProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job, jobId, orgSlug]);

  // Fetch job brief when job is available
  useEffect(() => {
    if (!job || !orgSlug || !jobId) return;
    let cancelled = false;
    setBriefLoading(true);
    setBriefError(null);
    fetch(`/api/jobs/${jobId}/brief?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json())
      .then((data: { ok?: boolean; brief?: JobBrief | null; message?: string }) => {
        if (cancelled) return;
        if (!data?.ok) {
          setBriefError(typeof data?.message === 'string' ? data.message : 'Failed to load job brief');
          return;
        }
        setBrief(data.brief ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setBriefError(err instanceof Error ? err.message : 'Failed to load job brief');
        }
      })
      .finally(() => {
        if (!cancelled) setBriefLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job, jobId, orgSlug]);

  // Fetch checklist templates for org (for stage template selector)
  useEffect(() => {
    if (!orgSlug || !job) return;
    let cancelled = false;
    setTemplatesLoading(true);
    setTemplatesError(null);
    fetch(`/api/checklist-templates?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (cancelled) return;
        if (!res.ok) {
          setTemplatesError(typeof data?.message === 'string' ? data.message : 'Failed to load templates');
          return;
        }
        if (data?.ok && Array.isArray(data.templates)) {
          setTemplates(data.templates.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
        } else {
          setTemplatesError('Failed to load templates');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTemplatesError(err instanceof Error ? err.message : 'Failed to load templates');
        }
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, job]);

  useEffect(() => {
    if (!job?.active_stage_id || !orgSlug || !jobId) {
      setActiveStageStatus(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/jobs/${jobId}/today?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }: { res: Response; data: { ok?: boolean; activeStage?: { daily_note?: string | null }; completions?: Record<string, string>; endOfDay?: { submitted?: boolean }; message?: string } }) => {
        if (cancelled) return;
        if (!res.ok || !data?.ok) {
          setActiveStageStatus(null);
          return;
        }
        setActiveStageStatus({
          completions: typeof data.completions === 'object' && data.completions != null ? data.completions : {},
          dailyNote: data.activeStage?.daily_note ?? null,
          endOfDaySubmitted: data.endOfDay?.submitted === true,
        });
      })
      .catch(() => {
        if (!cancelled) setActiveStageStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [job?.active_stage_id, jobId, orgSlug]);

  async function refetchPhotos() {
    if (!orgSlug || !jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/photos?orgSlug=${encodeURIComponent(orgSlug)}`);
      const data = await res.json();
      if (res.ok && data?.ok && Array.isArray(data.photos)) {
        setPhotos(data.photos);
        setPhotosError(null);
      }
    } catch {
      // Keep existing photos on refetch failure
    }
  }

  async function refetchStages() {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/stages?jobId=${encodeURIComponent(jobId)}`);
      const data = await res.json();
      if (res.ok && data?.ok && Array.isArray(data.stages)) {
        setStages(data.stages);
      }
    } catch {
      // Keep existing stages on refetch failure
    }
  }

  async function setActiveStage(stageId: string) {
    setActiveStageError(null);
    setStageIdSettingActive(stageId);
    try {
      const res = await fetch(
        `/api/jobs/${jobId}?orgSlug=${encodeURIComponent(orgSlug)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeStageId: stageId }),
        }
      );
      const data = await res.json();
      if (res.ok && data?.ok && data.job) {
        setJob(data.job);
      } else {
        setActiveStageError(typeof data?.message === 'string' ? data.message : 'Failed to set active stage');
      }
    } catch {
      setActiveStageError('Failed to set active stage');
    } finally {
      setStageIdSettingActive(null);
    }
  }

  async function setStageTemplate(stageId: string, checklistTemplateId: string | null) {
    setTemplateUpdateError(null);
    setStageIdUpdatingTemplate(stageId);
    try {
      const res = await fetch(
        `/api/stages/${stageId}?orgSlug=${encodeURIComponent(orgSlug)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checklistTemplateId }),
        }
      );
      const data = await res.json();
      if (res.ok && data?.ok && data?.stage) {
        setStages((prev) =>
          prev.map((s) => (s.id === stageId ? { ...s, ...data.stage } : s))
        );
      } else {
        setTemplateUpdateError(typeof data?.message === 'string' ? data.message : 'Failed to update template');
      }
    } catch {
      setTemplateUpdateError('Failed to update template');
    } finally {
      setStageIdUpdatingTemplate(null);
    }
  }

  async function handleAddStage(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = stageName.trim();
    if (!trimmed) {
      setStageError('Stage name is required');
      return;
    }
    setStageError(null);
    setIsSubmittingStage(true);
    try {
      const res = await fetch('/api/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, name: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        await refetchStages();
        setStageName('');
      } else {
        setStageError(typeof data?.message === 'string' ? data.message : 'Failed to add stage');
      }
    } catch {
      setStageError('Failed to add stage');
    } finally {
      setIsSubmittingStage(false);
    }
  }

  async function saveCcMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!job || !orgSlug || !jobId || ccMappingSaving) return;
    setCcMappingError(null);
    setCcMappingSaving(true);
    const selected = ccSelectedProjectId
      ? ccProjects.find((p) => p.project_id === ccSelectedProjectId)
      : undefined;
    const manualTitle = manualCcProjectTitle.trim();
    const manualClient = manualCcClientName.trim();
    const body =
      selected == null && !ccProjectsError
        ? {
            cc_project_id: null,
            cc_client_id: null,
            cc_project_title_snapshot: null,
            cc_client_name_snapshot: null,
          }
        : selected != null
          ? {
            cc_project_id: selected.project_id,
            cc_client_id: selected.client_id,
            cc_project_title_snapshot: selected.project_title,
            cc_client_name_snapshot: selected.client_name,
          }
          : {
            cc_project_id: null,
            cc_client_id: null,
            cc_project_title_snapshot: manualTitle || null,
            cc_client_name_snapshot: manualClient || null,
          };
    if (ccProjectsError && !manualTitle) {
      setCcMappingSaving(false);
      setCcMappingError('Project title is required while the Client Connect picker is unavailable.');
      return;
    }
    try {
      const res = await fetch(
        `/api/jobs/${jobId}/cc-mapping?orgSlug=${encodeURIComponent(orgSlug)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (res.ok && data?.ok && data.job) {
        const nextJob = data.job as Job;
        setJob(nextJob);
        setManualCcProjectTitle(nextJob.cc_project_title_snapshot ?? '');
        setManualCcClientName(nextJob.cc_client_name_snapshot ?? '');
      } else {
        setCcMappingError(
          typeof data?.message === 'string'
            ? data.message
            : 'Failed to update Client Connect mapping'
        );
      }
    } catch (err) {
      setCcMappingError(
        err instanceof Error ? err.message : 'Failed to update Client Connect mapping'
      );
    } finally {
      setCcMappingSaving(false);
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (photos.length >= MAX_PHOTOS) {
      setPhotosError(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }
    const toUpload = files.slice(0, MAX_PHOTOS - photos.length);
    if (toUpload.length === 0) {
      setPhotosError(`Maximum ${MAX_PHOTOS} photos allowed`);
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }
    setPhotosError(null);
    setIsUploading(true);
    (async () => {
      let lastError: string | null = null;
      for (const file of toUpload) {
        if (!(file instanceof File) || file.size === 0) continue;
        const formData = new FormData();
        try {
          const uploadFile = await compressImageForUpload(file);
          formData.append('file', uploadFile);
          const res = await fetch(`/api/jobs/${jobId}/photos?orgSlug=${encodeURIComponent(orgSlug)}`, {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (res.ok && data?.ok) {
            await refetchPhotos();
          } else {
            lastError = typeof data?.message === 'string' ? data.message : 'Upload failed';
          }
        } catch {
          lastError = 'Upload failed';
        }
      }
      if (lastError) setPhotosError(lastError);
      setIsUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    })();
  }

  async function handleRemovePhoto(photo: PreCommencementPhoto) {
    if (!window.confirm('Remove this photo?')) return;
    setPhotosError(null);
    setPhotoIdRemoving(photo.id);
    try {
      const res = await fetch(
        `/api/jobs/${jobId}/photos?photoId=${encodeURIComponent(photo.id)}&orgSlug=${encodeURIComponent(orgSlug)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (res.ok && data?.ok) {
        await refetchPhotos();
      } else {
        setPhotosError(typeof data?.message === 'string' ? data.message : 'Failed to remove photo');
      }
    } catch {
      setPhotosError('Failed to remove photo');
    } finally {
      setPhotoIdRemoving(null);
    }
  }

  async function hideJobFromQaList() {
    if (!job || hideConfirmText !== 'DELETE') return;

    setHideJobSaving(true);
    setHideJobError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hideFromQaList: true, confirmation: hideConfirmText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setHideJobError(typeof data?.message === 'string' ? data.message : 'Failed to hide job from QA list');
        return;
      }
      router.push(`/t/${orgSlug}/jobs`);
    } catch (err) {
      setHideJobError(err instanceof Error ? err.message : 'Failed to hide job from QA list');
    } finally {
      setHideJobSaving(false);
    }
  }

  function startEditingBrief() {
    setEditContent(brief?.content ?? '');
    setBriefError(null);
    setIsEditingBrief(true);
  }

  function cancelEditingBrief() {
    setIsEditingBrief(false);
  }

  async function saveBrief() {
    setBriefError(null);
    setIsSavingBrief(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/brief?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      const data = await res.json();
      if (res.ok && data?.ok && data.brief) {
        setBrief(data.brief);
        setIsEditingBrief(false);
      } else {
        setBriefError(typeof data?.message === 'string' ? data.message : 'Failed to save job brief');
      }
    } catch {
      setBriefError('Failed to save job brief');
    } finally {
      setIsSavingBrief(false);
    }
  }

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { dateStyle: 'short' });
    } catch {
      return '';
    }
  }

  const selectedCcProjectId = ccSelectedProjectId || job?.cc_project_id || '';
  const selectedCcProject = selectedCcProjectId
    ? ccProjects.find((project) => project.project_id === selectedCcProjectId) ?? null
    : null;
  const connectedProjectTitle =
    selectedCcProject?.project_title ?? job?.cc_project_title_snapshot ?? '';
  const connectedClientName =
    selectedCcProject?.client_name ?? job?.cc_client_name_snapshot ?? '';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-gray-600">Loading…</p>
        )}

        {!loading && !error && job && (
          <>
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
                  {job.created_at && (
                    <p className="mt-1 text-sm text-gray-500">{formatDate(job.created_at)}</p>
                  )}
                </div>
                <Link
                  href={`/t/${orgSlug}/jobs`}
                  className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-[#698F00] hover:text-[#698F00]"
                >
                  Home
                </Link>
              </div>
              <Link
                href={`/t/${orgSlug}/jobs/${jobId}/today`}
                className="mt-2 inline-block text-sm font-medium text-[#698F00] hover:underline"
              >
                Today&apos;s Work
              </Link>
              <Link
                href={`/t/${orgSlug}/jobs/${jobId}/qa`}
                className="mt-2 ml-4 inline-block text-sm font-medium text-[#698F00] hover:underline"
              >
                QA checks
              </Link>
            </div>

            <section className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Client Connect project</h2>
              <ClientConnectJobSummary
                job={job}
                className="mb-3"
                emptyText="No Client Connect project linked yet."
              />
              {ccProjectsLoading && (
                <p className="text-sm text-gray-600">Loading Client Connect projects…</p>
              )}
              {!ccProjectsLoading && ccProjectsError && (
                <div className="mb-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
                  Client Connect picker unavailable on this environment: {ccProjectsError}
                  {job.cc_project_id && (
                    <span className="block mt-1">
                      The saved job link above is still stored on the job.
                    </span>
                  )}
                </div>
              )}
              <form onSubmit={saveCcMapping} className="space-y-2">
                {!ccProjectsError ? (
                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Linked project
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:bg-gray-100"
                    value={ccSelectedProjectId || job.cc_project_id || ''}
                    onChange={(e) => {
                      const nextProjectId = e.target.value;
                      setCcSelectedProjectId(nextProjectId);
                      const nextProject = ccProjects.find((project) => project.project_id === nextProjectId);
                      setManualCcProjectTitle(nextProject?.project_title ?? '');
                      setManualCcClientName(nextProject?.client_name ?? '');
                    }}
                    disabled={ccProjectsLoading || ccMappingSaving || !!ccProjectsError}
                  >
                    <option value="">Not linked</option>
                    {ccProjects.map((project) => (
                      <option key={project.project_id} value={project.project_id}>
                        {project.project_title} — {project.client_name}
                        {project.site_address ? ` — ${project.site_address}` : ''} ({project.status})
                      </option>
                    ))}
                  </select>
                  {!ccProjectsError && job.cc_project_title_snapshot && (
                    <p className="mt-1 text-xs text-gray-500">
                      Select a different project to replace the saved link.
                    </p>
                  )}
                  {(connectedProjectTitle || connectedClientName) && (
                    <div className="mt-3 grid gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Project name
                        </label>
                        <input
                          value={connectedProjectTitle}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Client name
                        </label>
                        <input
                          value={connectedClientName}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50"
                        />
                      </div>
                    </div>
                  )}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pending Client Connect project
                      </label>
                      <input
                        value={manualCcProjectTitle}
                        onChange={(e) => setManualCcProjectTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        placeholder="Project title"
                        disabled={ccMappingSaving}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Client name
                      </label>
                      <input
                        value={manualCcClientName}
                        onChange={(e) => setManualCcClientName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        placeholder="Optional client name"
                        disabled={ccMappingSaving}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Use this only when the picker cannot reach Client Connect. It stores the typed project and client names on this job as a pending link, so QA and end-of-day screens show the intended Client Connect project until the live API link can be saved.
                      </p>
                    </div>
                  </div>
                )}
                {ccMappingError && (
                  <div className="mb-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    {ccMappingError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={ccProjectsLoading || ccMappingSaving}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#698F00] text-white text-sm font-medium hover:bg-[#5a7d00] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {ccMappingSaving
                    ? 'Saving…'
                    : ccProjectsError
                      ? 'Save pending mapping'
                      : 'Save mapping'}
                </button>
              </form>
              {selectedCcProject && (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Project QA trades</p>
                    {selectedCcProject.trades.length === 0 ? (
                      <p className="mt-1 text-sm text-gray-500">No trades are set on this Client Connect project.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedCcProject.trades.map((trade) => (
                          <span
                            key={trade}
                            className="inline-flex rounded-full border border-[#698F00]/30 bg-[#698F00]/5 px-2 py-1 text-xs font-medium text-[#5a7d00]"
                          >
                            {trade.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ClientConnectVariationsSummary variations={selectedCcProject.variations} />
                </div>
              )}
            </section>

            {job.active_stage_id && activeStageStatus && (() => {
              const activeStage = stages.find((s) => s.id === job.active_stage_id);
              const checklistItems = activeStage?.checklist_templates?.checklist_template_items ?? [];
              const checklistTotal = checklistItems.length;
              const checklistCompleted = checklistItems.filter((item) => activeStageStatus.completions[item.id]).length;
              const hasSavedNote = (activeStageStatus.dailyNote ?? '').trim() !== '';
              const eodSubmitted = activeStageStatus.endOfDaySubmitted;
              return (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 px-3 mb-4 bg-white/80 border border-gray-200 rounded-lg text-sm text-gray-600">
                  <span>
                    Checklist {checklistCompleted} / {checklistTotal}
                  </span>
                  <span>{hasSavedNote ? <span className="text-[#698F00]">Note</span> : 'No note'}</span>
                  <span>{eodSubmitted ? <span className="text-[#698F00]">Done for today</span> : 'Not done'}</span>
                </div>
              );
            })()}

            <h2 className="text-lg font-semibold text-gray-900 mb-3">Job brief</h2>
            {briefLoading && (
              <p className="text-gray-600">Loading job brief…</p>
            )}
            {!briefLoading && !isEditingBrief && briefError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {briefError}
              </div>
            )}
            {!briefLoading && !isEditingBrief && (
              <>
                <div className="mb-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                  {brief && brief.content !== null && brief.content !== '' ? (
                    <pre className="whitespace-pre-wrap font-sans text-gray-900 text-sm break-words">
                      {brief.content}
                    </pre>
                  ) : (
                    <p className="text-gray-500 text-sm">No job brief yet.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={startEditingBrief}
                  className="text-sm text-[#698F00] hover:underline font-medium"
                >
                  Edit
                </button>
              </>
            )}
            {!briefLoading && isEditingBrief && (
              <>
                {briefError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                    {briefError}
                  </div>
                )}
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent text-gray-900"
                  placeholder="Enter job brief (plain text)..."
                  disabled={isSavingBrief}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={saveBrief}
                    disabled={isSavingBrief}
                    className="bg-[#698F00] text-white py-2 px-4 rounded-lg font-medium hover:bg-[#5a7d00] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSavingBrief ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditingBrief}
                    disabled={isSavingBrief}
                    className="bg-white text-gray-700 py-2 px-4 rounded-lg border border-gray-300 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            <h2 className="text-lg font-semibold text-gray-900 mb-3 mt-8">Stages</h2>
            {stageError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {stageError}
              </div>
            )}
            <form onSubmit={handleAddStage} className="mb-4 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Stage name"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent text-gray-900"
                disabled={isSubmittingStage}
              />
              <button
                type="submit"
                disabled={isSubmittingStage}
                className="bg-[#698F00] text-white py-2 px-4 rounded-lg font-medium hover:bg-[#5a7d00] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {isSubmittingStage ? 'Adding…' : 'Add stage'}
              </button>
            </form>
            {activeStageError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {activeStageError}
              </div>
            )}
            {(templateUpdateError || templatesError) && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {templateUpdateError ?? templatesError}
              </div>
            )}
            {stages.length === 0 ? (
              <p className="text-gray-600">No stages yet.</p>
            ) : (
              <ul className="space-y-3">
                {stages.map((stage) => {
                  const isActive = job?.active_stage_id === stage.id;
                  const isSetting = stageIdSettingActive === stage.id;
                  const isUpdatingTemplate = stageIdUpdatingTemplate === stage.id;
                  const selectorDisabled = templatesLoading || !!templatesError || isUpdatingTemplate;
                  const supportedQaType = supportedQaTypeForStage(stage);
                  const activeQaRun = supportedQaType
                    ? qaRuns.find((run) => {
                        const runQaType = run.qa_type ?? 'paving';
                        return run.status === 'active' && runQaType === supportedQaType && (run.stage_id === stage.id || run.stage_id == null);
                      }) ?? null
                    : null;
                  const qaLabel = supportedQaType ? qaTypeLabel(supportedQaType) : null;
                  const qaHref = supportedQaType
                    ? activeQaRun
                      ? `/t/${orgSlug}/jobs/${jobId}/qa/${supportedQaType}/${activeQaRun.id}`
                      : `/t/${orgSlug}/jobs/${jobId}/qa/${supportedQaType}/new?stageId=${encodeURIComponent(stage.id)}`
                    : '';
                  return (
                    <li
                      key={stage.id}
                      className={`p-4 rounded-lg shadow-sm border ${
                        isActive
                          ? 'bg-[#698F00]/10 border-[#698F00]'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{stage.name}</span>
                        {stage.created_at && (
                          <span className="text-sm text-gray-500">
                            {formatDate(stage.created_at)}
                          </span>
                        )}
                        {isActive && (
                          <span className="text-xs font-medium text-[#698F00] bg-[#698F00]/20 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                        {stage.cc_section_id && (
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            Client Connect section
                            {stage.cc_section_trade ? ` · ${stage.cc_section_trade.replace('_', ' ')}` : ''}
                          </span>
                        )}
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => setActiveStage(stage.id)}
                            disabled={!!stageIdSettingActive}
                            className="text-sm text-[#698F00] hover:underline font-medium disabled:opacity-50"
                          >
                            {isSetting ? 'Setting…' : 'Set as active'}
                          </button>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-600">Template:</span>
                        <select
                          value={stage.checklist_template_id ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStageTemplate(stage.id, val ? val : null);
                          }}
                          disabled={selectorDisabled}
                          className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#698F00] focus:border-transparent bg-white text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed min-w-0 max-w-full"
                          aria-label={`Template for ${stage.name}`}
                        >
                          <option value="">None</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        {isUpdatingTemplate && (
                          <span className="text-xs text-gray-500">Saving…</span>
                        )}
                      </div>
                      {supportedQaType && qaLabel && (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <Link
                            href={qaHref}
                            className="inline-flex items-center rounded-lg bg-[#698F00] px-3 py-2 text-sm font-medium text-white hover:bg-[#5a7d00]"
                          >
                            {activeQaRun ? `Open active ${qaLabel} QA` : `Start ${qaLabel} QA`}
                          </Link>
                          {qaRunsError && (
                            <span className="text-xs text-amber-700">
                              QA run status unavailable; starting may show an active-run warning.
                            </span>
                          )}
                        </div>
                      )}
                      {stage.checklist_templates?.checklist_template_items &&
                        stage.checklist_templates.checklist_template_items.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            {(() => {
                              const items = [...stage.checklist_templates.checklist_template_items].sort(
                                (a, b) => a.sort_order - b.sort_order
                              );
                              const byType = {
                                tools: items.filter((i) => i.item_type === 'tools'),
                                materials: items.filter((i) => i.item_type === 'materials'),
                                qc: items.filter((i) => i.item_type === 'qc'),
                              };
                              const groups = [
                                { key: 'tools' as const, label: 'Tools', list: byType.tools },
                                { key: 'materials' as const, label: 'Materials', list: byType.materials },
                                { key: 'qc' as const, label: 'QC', list: byType.qc },
                              ];
                              return (
                                <div className="space-y-2 text-sm">
                                  {groups.map(
                                    (g) =>
                                      g.list.length > 0 && (
                                        <div key={g.key}>
                                          <span className="font-medium text-gray-700">{g.label}:</span>
                                          <ul className="mt-0.5 ml-3 list-disc text-gray-600">
                                            {g.list.map((item, idx) => (
                                              <li key={idx}>{item.label}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                    </li>
                  );
                })}
              </ul>
            )}

            <h2 className="text-lg font-semibold text-gray-900 mb-3 mt-8">
              Pre-commencement photos ({photos.length}/{MAX_PHOTOS})
            </h2>
            {photosLoading && (
              <p className="text-gray-600">Loading photos…</p>
            )}
            {!photosLoading && photosError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {photosError}
              </div>
            )}
            {!photosLoading && photos.length > 0 && (
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.url}
                      alt="Pre-commencement photo"
                      className="w-full aspect-square object-cover rounded-lg border border-gray-200 bg-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo)}
                      disabled={photoIdRemoving === photo.id}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-100"
                      aria-label="Remove photo"
                    >
                      {photoIdRemoving === photo.id ? (
                        <span className="text-xs">…</span>
                      ) : (
                        '×'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!photosLoading && photos.length < MAX_PHOTOS && (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  disabled={isUploading}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:text-gray-700 hover:file:bg-gray-50 focus:ring-2 focus:ring-[#698F00] focus:border-transparent disabled:opacity-50"
                />
                <p className="mt-1 text-sm text-gray-500">
                  {isUploading ? 'Uploading…' : 'Add photos (max 10).'}
                </p>
              </>
            )}
            {!photosLoading && photos.length >= MAX_PHOTOS && (
              <p className="text-gray-500 text-sm">Maximum photos reached.</p>
            )}

            <section className="mt-12 border-t border-gray-200 pt-6">
              <h2 className="text-lg font-semibold text-gray-900">Remove from QA list</h2>
              <p className="mt-2 text-sm text-gray-600">
                This only hides the job from the QA jobs list. Saved job data, stages, photos and QA records remain stored.
              </p>
              {hideJobError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {hideJobError}
                </div>
              )}
              {!showHideConfirm ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowHideConfirm(true);
                    setHideJobError(null);
                  }}
                  className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-gray-700" htmlFor="hide-job-confirm">
                    Type DELETE to confirm
                  </label>
                  <input
                    id="hide-job-confirm"
                    type="text"
                    value={hideConfirmText}
                    onChange={(e) => setHideConfirmText(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-[#698F00]"
                    disabled={hideJobSaving}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={hideJobFromQaList}
                      disabled={hideConfirmText !== 'DELETE' || hideJobSaving}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {hideJobSaving ? 'Deleting…' : 'Delete from QA list'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowHideConfirm(false);
                        setHideConfirmText('');
                        setHideJobError(null);
                      }}
                      disabled={hideJobSaving}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
