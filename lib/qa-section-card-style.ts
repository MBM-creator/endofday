export type QaSectionCardTone = 'signed_off' | 'activated' | 'active' | 'default';

export function getQaSectionCardClass(tone: QaSectionCardTone): string {
  switch (tone) {
    case 'signed_off':
      return 'bg-[#698F00]/10 border-[#698F00]';
    case 'activated':
      return 'bg-red-50 border-red-200';
    case 'active':
      return 'bg-yellow-50 border-yellow-200';
    default:
      return 'bg-white border-gray-200';
  }
}

export function resolveQaSectionCardTone(input: {
  cleared: boolean;
  activated: boolean;
  isActiveStep: boolean;
}): QaSectionCardTone {
  if (input.cleared) return 'signed_off';
  if (input.activated) return 'activated';
  if (input.isActiveStep) return 'active';
  return 'default';
}

export function findActiveQaSectionCode<T extends { cleared: boolean }>(
  sections: T[],
  getCode: (section: T) => string
): string | null {
  const first = sections.find((section) => !section.cleared);
  return first ? getCode(first) : null;
}
