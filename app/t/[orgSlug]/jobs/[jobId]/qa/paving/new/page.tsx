'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  PAVING_INSTALL_METHOD_LABELS_V2,
  PAVING_MATERIAL_TYPE_LABELS_V2,
  PAVING_AREA_USE_LABELS,
  PAVING_INSTALL_METHODS_V2,
  PAVING_MATERIAL_TYPES_V2,
  PAVING_AREA_USES,
  type PavingInstallMethodV2,
  type PavingMaterialTypeV2,
  type PavingAreaUse,
} from '@/lib/paving-qa-v2-types';
import { validateSetupV2 } from '@/lib/paving-qa-v2-setup';

type FieldErrors = Partial<Record<
  'install_method' | 'material_type' | 'area_uses' | 'other_install_method_note' | 'other_area_use_note',
  string
>>;

const WET_BED_METHODS: PavingInstallMethodV2[] = ['crushed_rock_wet_bed', 'concrete_base_wet_bed'];

export default function NewPavingQaRunPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const jobId = (params?.jobId as string) ?? '';
  const stageId = searchParams.get('stageId')?.trim() || null;

  // Role check — purely informational; API enforces the real guard
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    if (!orgSlug) return;
    fetch(`/api/auth/me?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && typeof d.staff?.role === 'string') setRole(d.staff.role);
      })
      .catch(() => {});
  }, [orgSlug]);

  const [areaUses, setAreaUses] = useState<PavingAreaUse[]>([]);
  const [otherAreaNote, setOtherAreaNote] = useState('');
  const [materialType, setMaterialType] = useState<PavingMaterialTypeV2 | ''>('');
  const [installMethod, setInstallMethod] = useState<PavingInstallMethodV2 | ''>('');
  const [otherInstallNote, setOtherInstallNote] = useState('');
  const [supervisorNotes, setSupervisorNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------------------
  // Derive filtered option lists based on area use selections
  // -------------------------------------------------------------------------

  const isDriveway = areaUses.includes('driveway_vehicle_traffic');
  const isPool = areaUses.includes('pool_surround');

  // Driveway and pool surrounds are unsuitable for wet-bed laying methods
  const filteredInstallMethods = PAVING_INSTALL_METHODS_V2.filter((m) => {
    if ((isDriveway || isPool) && WET_BED_METHODS.includes(m)) return false;
    return true;
  });

  // Steppers are unsuitable for driveways
  const filteredMaterialTypes = PAVING_MATERIAL_TYPES_V2.filter((m) => {
    if (isDriveway && m === 'steppers') return false;
    return true;
  });

  // Auto-clear selections that are no longer in the filtered list
  useEffect(() => {
    if (installMethod && !filteredInstallMethods.includes(installMethod as PavingInstallMethodV2)) {
      setInstallMethod('');
    }
    if (materialType && !filteredMaterialTypes.includes(materialType as PavingMaterialTypeV2)) {
      setMaterialType('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaUses]);

  function toggleAreaUse(use: PavingAreaUse) {
    setAreaUses((prev) =>
      prev.includes(use) ? prev.filter((u) => u !== use) : [...prev, use]
    );
  }

  function buildSetupPayload() {
    return {
      install_method: installMethod || undefined,
      material_type: materialType || undefined,
      area_uses: areaUses,
      other_install_method_note: otherInstallNote.trim() || undefined,
      other_area_use_note: otherAreaNote.trim() || undefined,
      supervisor_notes: supervisorNotes.trim() || undefined,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);

    // Client-side validation first
    const validation = validateSetupV2(buildSetupPayload());
    if (!validation.ok) {
      const errs: FieldErrors = {};
      for (const err of validation.errors) {
        errs[err.field as keyof FieldErrors] = err.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/qa/runs?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setup: validation.setup, stageId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setApiError(typeof data?.message === 'string' ? data.message : 'Could not start run');
        return;
      }
      router.push(`/t/${orgSlug}/jobs/${jobId}/qa/paving/${data.run.id}`);
    } catch {
      setApiError('Could not start run. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const isSupervisorOrAdmin = role === 'supervisor' || role === 'admin';
  const roleLoaded = role !== null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Link href={`/t/${orgSlug}/jobs/${jobId}/qa`} className="text-sm text-[#698F00] hover:underline">
          ← Paving QA
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">New paving QA run</h1>
        <p className="mt-1 text-sm text-gray-600">
          This setup controls which paving QA checks, tolerances, photo evidence and sign-off gates apply to the job.
        </p>
        <p className="mt-1 text-sm text-amber-700">
          Once the run is created, the setup should be treated as locked. If the method or site condition changes, start a new QA run or seek supervisor/admin direction.
        </p>

        {roleLoaded && !isSupervisorOrAdmin && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
            Paving QA setup is restricted to supervisors and admins. Contact your site supervisor to start a new QA run.
          </div>
        )}

        {apiError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{apiError}</div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>

          {/* 1. Area use — first, because it immediately narrows material and method options */}
          <fieldset className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
            <legend className="text-sm font-semibold text-gray-900 px-1">
              What is this paved area being used for?
              <span className="ml-1 text-xs font-normal text-gray-500">(select all that apply)</span>
            </legend>
            <div className="space-y-2">
              {PAVING_AREA_USES.map((use) => (
                <label
                  key={use}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    areaUses.includes(use)
                      ? 'border-[#698F00] bg-[#698F00]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={areaUses.includes(use)}
                    onChange={() => toggleAreaUse(use)}
                    className="mt-0.5 accent-[#698F00]"
                  />
                  <span className="text-sm text-gray-900">
                    {PAVING_AREA_USE_LABELS[use]}
                  </span>
                </label>
              ))}
            </div>
            {fieldErrors.area_uses && (
              <p className="text-xs text-red-700 mt-1">{fieldErrors.area_uses}</p>
            )}

            {areaUses.includes('other') && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe the other area use
                  <span className="text-red-600 ml-1">*</span>
                </label>
                <textarea
                  rows={2}
                  className={`w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#698F00]/40 ${
                    fieldErrors.other_area_use_note ? 'border-red-400' : 'border-gray-300'
                  }`}
                  value={otherAreaNote}
                  onChange={(e) => setOtherAreaNote(e.target.value)}
                  placeholder="e.g. Courtyard used as a commercial loading area"
                />
                {fieldErrors.other_area_use_note && (
                  <p className="text-xs text-red-700 mt-1">{fieldErrors.other_area_use_note}</p>
                )}
              </div>
            )}
          </fieldset>

          {/* 2. Material type */}
          <fieldset className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
            <legend className="text-sm font-semibold text-gray-900 px-1">
              What type of paving material is being installed?
            </legend>
            {isDriveway && (
              <p className="text-xs text-gray-500 -mt-1">
                Steppers are not suitable for driveways and have been removed.
              </p>
            )}
            <div className="space-y-2">
              {filteredMaterialTypes.map((mat) => (
                <label
                  key={mat}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    materialType === mat
                      ? 'border-[#698F00] bg-[#698F00]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="material_type"
                    value={mat}
                    checked={materialType === mat}
                    onChange={() => setMaterialType(mat)}
                    className="mt-0.5 accent-[#698F00]"
                  />
                  <span className="text-sm text-gray-900">
                    {PAVING_MATERIAL_TYPE_LABELS_V2[mat]}
                  </span>
                </label>
              ))}
            </div>
            {fieldErrors.material_type && (
              <p className="text-xs text-red-700 mt-1">{fieldErrors.material_type}</p>
            )}
          </fieldset>

          {/* 3. Install method — last, because area use and material narrow the options */}
          <fieldset className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
            <legend className="text-sm font-semibold text-gray-900 px-1">
              How is this paving being installed?
            </legend>
            {(isDriveway || isPool) && (
              <p className="text-xs text-gray-500 -mt-1">
                Wet bed methods are not suitable for{' '}
                {isDriveway && isPool
                  ? 'driveways or pool surrounds'
                  : isDriveway
                    ? 'driveways'
                    : 'pool surrounds'}{' '}
                and have been removed.
              </p>
            )}
            <div className="space-y-2">
              {filteredInstallMethods.map((method) => (
                <label
                  key={method}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    installMethod === method
                      ? 'border-[#698F00] bg-[#698F00]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="install_method"
                    value={method}
                    checked={installMethod === method}
                    onChange={() => setInstallMethod(method)}
                    className="mt-0.5 accent-[#698F00]"
                  />
                  <span className="text-sm text-gray-900">
                    {PAVING_INSTALL_METHOD_LABELS_V2[method]}
                  </span>
                </label>
              ))}
            </div>
            {fieldErrors.install_method && (
              <p className="text-xs text-red-700 mt-1">{fieldErrors.install_method}</p>
            )}

            {installMethod === 'other_mixed' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe the paving build-up or mixed method being used
                  <span className="text-red-600 ml-1">*</span>
                </label>
                <textarea
                  rows={3}
                  className={`w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#698F00]/40 ${
                    fieldErrors.other_install_method_note ? 'border-red-400' : 'border-gray-300'
                  }`}
                  value={otherInstallNote}
                  onChange={(e) => setOtherInstallNote(e.target.value)}
                  placeholder="e.g. 50mm crushed rock compacted base with 30mm wet mortar bed, adhesive tile sections at threshold"
                />
                {fieldErrors.other_install_method_note && (
                  <p className="text-xs text-red-700 mt-1">{fieldErrors.other_install_method_note}</p>
                )}
              </div>
            )}
          </fieldset>

          {/* 4. Supervisor notes */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Supervisor notes
              <span className="ml-1 text-xs font-normal text-gray-500">(optional)</span>
            </label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#698F00]/40"
              value={supervisorNotes}
              onChange={(e) => setSupervisorNotes(e.target.value)}
              placeholder="Any setup notes, assumptions, risks or special site conditions?"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#698F00] text-white py-3 rounded-lg font-medium text-sm hover:bg-[#5a7d00] disabled:bg-gray-400 transition-colors"
          >
            {saving ? 'Starting run…' : 'Start paving QA run'}
          </button>
        </form>
      </div>
    </div>
  );
}
