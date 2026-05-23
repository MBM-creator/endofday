import {
  IRRIGATION_QA_TYPES,
  IRRIGATION_SYSTEM_TYPES,
  IRRIGATION_WATER_SOURCES,
  type IrrigationQaSetupV1,
  type IrrigationQaType,
  type IrrigationSystemType,
  type IrrigationWaterSource,
} from './irrigation-qa-v1-types';

export type IrrigationSetupValidationError = { field: string; message: string };

export type IrrigationSetupValidationResult =
  | { ok: true; setup: IrrigationQaSetupV1 }
  | { ok: false; errors: IrrigationSetupValidationError[] };

function uniqueStrings<T extends string>(values: unknown[], allowed: readonly T[]): T[] {
  const out: T[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    if (!allowed.includes(value as T)) continue;
    if (!out.includes(value as T)) out.push(value as T);
  }
  return out;
}

export function validateIrrigationSetupV1(raw: unknown): IrrigationSetupValidationResult {
  const errors: IrrigationSetupValidationError[] = [];

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: [{ field: 'setup', message: 'Setup must be an object' }] };
  }

  const o = raw as Record<string, unknown>;
  const irrigationType = o.irrigation_type;
  if (!irrigationType) {
    errors.push({ field: 'irrigation_type', message: 'Irrigation type is required' });
  } else if (!IRRIGATION_QA_TYPES.includes(irrigationType as IrrigationQaType)) {
    errors.push({
      field: 'irrigation_type',
      message: `Irrigation type must be one of: ${IRRIGATION_QA_TYPES.join(', ')}`,
    });
  }

  const waterSources = Array.isArray(o.water_sources)
    ? uniqueStrings(o.water_sources, IRRIGATION_WATER_SOURCES)
    : [];
  if (waterSources.length === 0) {
    errors.push({ field: 'water_sources', message: 'At least one water source is required' });
  }

  const systemTypes = Array.isArray(o.system_types)
    ? uniqueStrings(o.system_types, IRRIGATION_SYSTEM_TYPES)
    : [];
  if (systemTypes.length === 0) {
    errors.push({ field: 'system_types', message: 'At least one system type is required' });
  }

  if (errors.length > 0) return { ok: false, errors };

  const setup: IrrigationQaSetupV1 = {
    setup_version: 1,
    irrigation_type: irrigationType as IrrigationQaType,
    water_sources: waterSources as IrrigationWaterSource[],
    system_types: systemTypes as IrrigationSystemType[],
  };

  const supervisorNotes = typeof o.supervisor_notes === 'string' ? o.supervisor_notes.trim() : '';
  if (supervisorNotes) setup.supervisor_notes = supervisorNotes;

  return { ok: true, setup };
}
