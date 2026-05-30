import type { SignoffQaSetupV1 } from './signoff-qa-v1-types';

export type SignoffSetupValidationError = { field: string; message: string };

export type SignoffSetupValidationResult =
  | { ok: true; setup: SignoffQaSetupV1 }
  | { ok: false; errors: SignoffSetupValidationError[] };

export function validateSignoffSetupV1(raw: unknown): SignoffSetupValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: [{ field: 'setup', message: 'Setup must be an object' }] };
  }

  const o = raw as Record<string, unknown>;
  const setup: SignoffQaSetupV1 = { setup_version: 1 };

  const scopeDescription = typeof o.scope_description === 'string' ? o.scope_description.trim() : '';
  if (scopeDescription) setup.scope_description = scopeDescription;

  const supervisorNotes = typeof o.supervisor_notes === 'string' ? o.supervisor_notes.trim() : '';
  if (supervisorNotes) setup.supervisor_notes = supervisorNotes;

  return { ok: true, setup };
}
