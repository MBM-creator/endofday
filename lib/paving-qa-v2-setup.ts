import {
  PAVING_INSTALL_METHODS_V2,
  PAVING_MATERIAL_TYPES_V2,
  PAVING_AREA_USES,
  type PavingInstallMethodV2,
  type PavingMaterialTypeV2,
  type PavingAreaUse,
  type PavingQaSetupV2,
} from './paving-qa-v2-types';

export type SetupV2ValidationError = { field: string; message: string };

export type SetupV2ValidationResult =
  | { ok: true; setup: PavingQaSetupV2 }
  | { ok: false; errors: SetupV2ValidationError[] };

/**
 * Validate and parse a raw unknown value as a PavingQaSetupV2.
 * Returns all field-level errors so the UI can display them at once.
 */
export function validateSetupV2(raw: unknown): SetupV2ValidationResult {
  const errors: SetupV2ValidationError[] = [];

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: [{ field: 'setup', message: 'Setup must be an object' }] };
  }

  const o = raw as Record<string, unknown>;

  // install_method
  const install = o.install_method;
  if (!install) {
    errors.push({ field: 'install_method', message: 'Install method is required' });
  } else if (!PAVING_INSTALL_METHODS_V2.includes(install as PavingInstallMethodV2)) {
    errors.push({
      field: 'install_method',
      message: `install_method must be one of: ${PAVING_INSTALL_METHODS_V2.join(', ')}`,
    });
  }

  // material_type
  const material = o.material_type;
  if (!material) {
    errors.push({ field: 'material_type', message: 'Material type is required' });
  } else if (!PAVING_MATERIAL_TYPES_V2.includes(material as PavingMaterialTypeV2)) {
    errors.push({
      field: 'material_type',
      message: `material_type must be one of: ${PAVING_MATERIAL_TYPES_V2.join(', ')}`,
    });
  }

  // area_uses — must be a non-empty array of valid values
  const rawAreaUses = o.area_uses;
  if (!Array.isArray(rawAreaUses) || rawAreaUses.length === 0) {
    errors.push({ field: 'area_uses', message: 'At least one area use is required' });
  } else {
    const invalid = rawAreaUses.filter((u) => !PAVING_AREA_USES.includes(u as PavingAreaUse));
    if (invalid.length > 0) {
      errors.push({
        field: 'area_uses',
        message: `Unknown area_uses: ${invalid.join(', ')}`,
      });
    }
  }

  // other_install_method_note required when install_method === 'other_mixed'
  if (install === 'other_mixed') {
    const note = typeof o.other_install_method_note === 'string' ? o.other_install_method_note.trim() : '';
    if (!note) {
      errors.push({
        field: 'other_install_method_note',
        message: 'other_install_method_note is required when install method is Other / mixed',
      });
    }
  }

  // other_area_use_note required when area_uses includes 'other'
  const areaUses = Array.isArray(rawAreaUses) ? (rawAreaUses as string[]) : [];
  if (areaUses.includes('other')) {
    const note = typeof o.other_area_use_note === 'string' ? o.other_area_use_note.trim() : '';
    if (!note) {
      errors.push({
        field: 'other_area_use_note',
        message: 'other_area_use_note is required when area uses includes Other',
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const setup: PavingQaSetupV2 = {
    setup_version: 2,
    install_method: install as PavingInstallMethodV2,
    material_type: material as PavingMaterialTypeV2,
    area_uses: areaUses as PavingAreaUse[],
  };

  const otherInstallNote = typeof o.other_install_method_note === 'string'
    ? o.other_install_method_note.trim()
    : undefined;
  if (otherInstallNote) setup.other_install_method_note = otherInstallNote;

  const otherAreaNote = typeof o.other_area_use_note === 'string'
    ? o.other_area_use_note.trim()
    : undefined;
  if (otherAreaNote) setup.other_area_use_note = otherAreaNote;

  const supervisorNotes = typeof o.supervisor_notes === 'string'
    ? o.supervisor_notes.trim()
    : undefined;
  if (supervisorNotes) setup.supervisor_notes = supervisorNotes;

  return { ok: true, setup };
}
