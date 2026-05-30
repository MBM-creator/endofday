export type QaSectionCardTone = 'signed_off' | 'activated' | 'active' | 'default';

const QA_SECTION_CARD_TONE_CLASS: Record<QaSectionCardTone, string> = {
  signed_off: 'bg-[#698F00]/10 border-[#698F00]',
  activated: 'bg-red-100 border-red-400',
  active: 'bg-yellow-100 border-yellow-400',
  default: 'bg-white border-gray-200',
};

export function getQaSectionCardClass(tone: QaSectionCardTone): string {
  return QA_SECTION_CARD_TONE_CLASS[tone];
}

export function resolveQaSectionCardTone(input: {
  cleared: boolean;
  activated: boolean;
  isActiveStep: boolean;
}): QaSectionCardTone {
  if (input.cleared) return 'signed_off';
  // Current step stays yellow until signed off; red is for earlier steps still in progress.
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
