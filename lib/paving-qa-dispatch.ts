/**
 * Version dispatch for paving QA runs.
 *
 * A run is v2 when setup_version === 2.
 * A run with no setup_version (null / missing) is v1/legacy and should be
 * treated as read-only — no new v1 development.
 */
import type { PavingQaSetupV2 } from './paving-qa-v2-types';
import { validateSetupV2 } from './paving-qa-v2-setup';
import { parseRunSetup as parseRunSetupV1 } from './paving-qa-v1-catalog';
import type { PavingQaSetup as PavingQaSetupV1 } from './paving-qa-v1-types';

export type RunVersionInfo =
  | { version: 2; setup: PavingQaSetupV2 }
  | { version: 1; setup: PavingQaSetupV1 }
  | { version: 'unknown' };

/**
 * Detect the version of a paving QA run from its raw DB row.
 * @param rawSetup  - the `setup` JSONB value from the DB row
 * @param setupVersion - the `setup_version` column value (may be null for legacy rows)
 */
export function detectRunVersion(
  rawSetup: unknown,
  setupVersion: number | null | undefined
): RunVersionInfo {
  if (setupVersion === 2) {
    const parsed = validateSetupV2(rawSetup);
    if (parsed.ok) {
      return { version: 2, setup: parsed.setup };
    }
    return { version: 'unknown' };
  }

  // Null / missing = legacy v1
  const v1 = parseRunSetupV1(rawSetup);
  if (v1) {
    return { version: 1, setup: v1 };
  }

  return { version: 'unknown' };
}

export function isV2Run(info: RunVersionInfo): info is { version: 2; setup: PavingQaSetupV2 } {
  return info.version === 2;
}

export function isV1Run(info: RunVersionInfo): info is { version: 1; setup: PavingQaSetupV1 } {
  return info.version === 1;
}
