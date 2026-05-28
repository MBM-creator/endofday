import {
  FENCING_FENCE_TYPES,
  type FencingFenceType,
  type FencingQaSetupV1,
} from './fencing-qa-v1-types';

export type FencingSetupValidationError = { field: string; message: string };

export type FencingSetupValidationResult =
  | { ok: true; setup: FencingQaSetupV1 }
  | { ok: false; errors: FencingSetupValidationError[] };

function bool(value: unknown): boolean {
  return value === true;
}

export function validateFencingSetupV1(raw: unknown): FencingSetupValidationResult {
  const errors: FencingSetupValidationError[] = [];

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: [{ field: 'setup', message: 'Setup must be an object' }] };
  }

  const o = raw as Record<string, unknown>;
  const fenceType = o.fence_type;

  if (!fenceType) {
    errors.push({ field: 'fence_type', message: 'Fence type is required' });
  } else if (!FENCING_FENCE_TYPES.includes(fenceType as FencingFenceType)) {
    errors.push({
      field: 'fence_type',
      message: `Fence type must be one of: ${FENCING_FENCE_TYPES.join(', ')}`,
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const setup: FencingQaSetupV1 = {
    setup_version: 1,
    fence_type: fenceType as FencingFenceType,
    existing_fence_removal: bool(o.existing_fence_removal),
    gate: bool(o.gate),
    plinth: bool(o.plinth),
    capping: bool(o.capping),
    finish_coating: bool(o.finish_coating),
  };

  const supervisorNotes = typeof o.supervisor_notes === 'string' ? o.supervisor_notes.trim() : '';
  if (supervisorNotes) setup.supervisor_notes = supervisorNotes;

  return { ok: true, setup };
}
