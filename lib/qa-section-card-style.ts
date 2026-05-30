import type { CSSProperties } from 'react';

export type QaSectionCardTone = 'signed_off' | 'activated' | 'active' | 'default';

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

export const JOB_STAGE_ACTIVE_STYLE: CSSProperties = {
  backgroundColor: 'rgba(105, 143, 0, 0.12)',
  borderColor: '#698F00',
};

export const JOB_STAGE_INACTIVE_STYLE: CSSProperties = {
  backgroundColor: '#f3f4f6',
  borderColor: '#d1d5db',
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

export function resolveJobStageCardTone(input: {
  stageId: string;
  activeStageId: string | null;
  qaRuns: { stage_id?: string | null; status: string; qa_type?: string | null }[];
  stageQaType?: 'paving' | 'irrigation' | 'fencing' | 'sign_off' | null;
}): QaSectionCardTone {
  const stageRuns = input.qaRuns.filter((run) => {
    if (run.stage_id === input.stageId) return true;
    if (run.stage_id != null || !input.stageQaType) return false;
    const runType =
      run.qa_type === 'irrigation'
        ? 'irrigation'
        : run.qa_type === 'fencing'
          ? 'fencing'
          : run.qa_type === 'sign_off'
            ? 'sign_off'
            : 'paving';
    return runType === input.stageQaType;
  });

  if (stageRuns.some((run) => run.status === 'completed')) {
    return 'signed_off';
  }

  if (input.activeStageId === input.stageId) {
    return 'active';
  }

  if (stageRuns.some((run) => run.status === 'active')) {
    return 'activated';
  }

  return 'default';
}
