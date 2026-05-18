import type { ItemResult, PavingQaSetup, PavingSectionCode } from './paving-qa-v1-types';
import { getSectionItemsForSetup } from './paving-qa-v1-catalog';

export function validateCrewSectionPayload(
  setup: PavingQaSetup,
  section: PavingSectionCode,
  answers: Record<string, { result?: string; note?: string }>,
  photoCountByItem: Record<string, number>
): { ok: true } | { ok: false; errors: string[] } {
  const items = getSectionItemsForSetup(section, setup);
  const errors: string[] = [];

  for (const item of items) {
    const a = answers[item.key];
    const result = (a?.result ?? '').trim() as ItemResult | '';
    const allowed: ItemResult[] = item.allowNa ? ['pass', 'fail', 'na'] : ['pass', 'fail'];
    if (!allowed.includes(result as ItemResult)) {
      errors.push(`Item "${item.label}": result required`);
      continue;
    }
    if (result === 'fail') {
      const note = (a?.note ?? '').trim();
      if (!note) {
        errors.push(`Item "${item.label}": note required when failed`);
      }
    }
    const n = photoCountByItem[item.key] ?? 0;
    if (item.requirePhoto && n < 1) {
      errors.push(`Item "${item.label}": at least one photo required`);
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}
