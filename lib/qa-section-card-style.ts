import type { CSSProperties } from 'react';

export type QaSectionCardTone = 'signed_off' | 'activated' | 'active' | 'default';

export type JobStageCardTone = 'not_started' | 'in_progress' | 'finished';

const QA_SECTION_CARD_TONE_CLASS: Record<QaSectionCardTone, string> = {
  signed_off: 'bg-[#698F00]/10 border-[#698F00]',
  activated: 'bg-red-100 border-red-400',
  active: 'bg-yellow-100 border-yellow-400',
  default: 'bg-white border-gray-200',
};

const QA_SECTION_CARD_TONE_STYLE: Record<QaSectionCardTone, CSSProperties> = {
  signed_off: { backgroundColor: 'rgba(105, 143, 0, 0.12)', borderColor: '#698F00' },
  activated: { backgroundColor: '#fee2e2', borderColor: '#f87171' },
  active: { backgroundColor: '#fef9c3', borderColor: '#facc15' },
  default: { backgroundColor: '#ffffff', borderColor: '#e5e7eb' },
};

export function getQaSectionCardClass(tone: QaSectionCardTone): string {
  return QA_SECTION_CARD_TONE_CLASS[tone];
}

export function getQaSectionCardStyle(tone: QaSectionCardTone): CSSProperties {
  return QA_SECTION_CARD_TONE_STYLE[tone];
}

export function resolveQaSectionCardTone(input: {
  cleared: boolean;
  activated: boolean;
  isActiveStep: boolean;
}): QaSectionCardTone {
  if (input.cleared) return 'signed_off';
  if (input.isActiveStep) return 'active';
  if (input.activated) return 'activated';
  return 'default';
}

export function findActiveQaSectionCode<T extends { cleared: boolean }>(
  sections: T[],
  getCode: (section: T) => string
): string | null {
  const first = sections.find((section) => !section.cleared);
  return first ? getCode(first) : null;
}

/** Job stage progress by order relative to the active stage. */
export function resolveJobStageCardTone(input: {
  stageIndex: number;
  activeStageIndex: number;
}): JobStageCardTone {
  if (input.activeStageIndex < 0) {
    return 'not_started';
  }
  if (input.stageIndex < input.activeStageIndex) {
    return 'finished';
  }
  if (input.stageIndex === input.activeStageIndex) {
    return 'in_progress';
  }
  return 'not_started';
}
