import {
  applicableSectionCodes,
  getSectionItemsForSetup,
  materialSectionCode,
  layingCompleteSectionCode,
} from './paving-qa-v1-catalog';
import type { IssueStatus, ItemResult, PavingQaSetup, PavingSectionCode, SubmissionStatus } from './paving-qa-v1-types';

export const BLOCKING_ISSUE_STATUSES: IssueStatus[] = [
  'open',
  'rectification_required',
  'evidence_requested',
];

export const TERMINAL_ISSUE_STATUSES: IssueStatus[] = ['resolved_approved', 'proceed_approved'];

export type AnswerPayload = { result?: string; note?: string };

export type SubmissionSnapshot = {
  section_code: string;
  submission_status: SubmissionStatus | string;
  answers: Record<string, AnswerPayload>;
  submitted_at?: string | null;
};

export type IssueSnapshot = {
  id?: string;
  section_code: string;
  item_key: string;
  severity: string;
  status: IssueStatus | string;
  title?: string | null;
};

/** Count photos per `${section_code}:${item_key}` */
export type PhotoCounts = Map<string, number>;

function photoKey(section: string, itemKey: string): string {
  return `${section}:${itemKey}`;
}

export function predecessors(section: PavingSectionCode, setup: PavingQaSetup): PavingSectionCode[] {
  const applicable = new Set(applicableSectionCodes(setup));
  const pred: PavingSectionCode[] = [];

  const need = (s: PavingSectionCode) => {
    if (applicable.has(s)) pred.push(s);
  };

  switch (section) {
    case 'setup_protection':
      return [];
    case 'setout_drainage':
      return ['setup_protection'];
    case 'crushed_rock_base':
      need('setout_drainage');
      return pred;
    case 'wet_bed':
      need('crushed_rock_base');
      return pred;
    case 'concrete_slab_prep':
      need('setout_drainage');
      return pred;
    case 'adhesive_fixing':
      need('concrete_slab_prep');
      return pred;
    case 'material_consistent':
    case 'material_variable': {
      need(layingCompleteSectionCode(setup));
      return pred;
    }
    case 'driveway_addon': {
      need(materialSectionCode(setup));
      return pred;
    }
    case 'final_qa': {
      need(materialSectionCode(setup));
      if (setup.is_driveway) need('driveway_addon');
      return pred;
    }
    default:
      return [];
  }
}

function submissionFor(
  section: PavingSectionCode,
  bySection: Map<string, SubmissionSnapshot>
): SubmissionSnapshot | undefined {
  return bySection.get(section);
}

function issuesInSection(section: PavingSectionCode, issues: IssueSnapshot[]): IssueSnapshot[] {
  return issues.filter((i) => i.section_code === section);
}

function hasBlockingIssueInSection(section: PavingSectionCode, issues: IssueSnapshot[]): boolean {
  return issuesInSection(section, issues).some((i) =>
    BLOCKING_ISSUE_STATUSES.includes(i.status as IssueStatus)
  );
}

function resultForItem(answers: Record<string, AnswerPayload>, key: string): ItemResult | '' {
  return (answers[key]?.result ?? '') as ItemResult | '';
}

/**
 * Section is "cleared" (construction-safe) iff catalogue requirements met,
 * no blocking issues remain in-section, and submission not in returned state.
 */
export function isSectionCleared(
  section: PavingSectionCode,
  setup: PavingQaSetup,
  submission: SubmissionSnapshot | undefined,
  photoCounts: PhotoCounts,
  issues: IssueSnapshot[]
): { cleared: false; reasons: string[] } | { cleared: true } {
  const reasons: string[] = [];
  if (!applicableSectionCodes(setup).includes(section)) {
    return { cleared: true };
  }

  if (!submission || submission.submission_status === 'draft') {
    reasons.push('No crew submission');
    return { cleared: false, reasons };
  }

  if (submission.submission_status === 'returned') {
    reasons.push('Supervisor returned this section for more evidence');
    return { cleared: false, reasons };
  }

  if (submission.submission_status !== 'submitted') {
    reasons.push('Submission not in submitted state');
    return { cleared: false, reasons };
  }

  const items = getSectionItemsForSetup(section, setup);
  const answers = submission.answers ?? {};

  for (const item of items) {
    const a = answers[item.key];
    const result = (a?.result ?? '') as ItemResult | '';
    const allowed: ItemResult[] = item.allowNa ? ['pass', 'fail', 'na'] : ['pass', 'fail'];
    if (!allowed.includes(result as ItemResult)) {
      reasons.push(`Item ${item.label}: answer required`);
      continue;
    }
    if (result === 'fail') {
      const note = (a?.note ?? '').trim();
      if (!note) {
        reasons.push(`Item ${item.label}: note required when failed`);
      }
    }
    const needPhotos = item.requirePhoto ? photoCounts.get(photoKey(section, item.key)) ?? 0 : 0;
    if (item.requirePhoto && needPhotos < 1) {
      reasons.push(`Item ${item.label}: required photo missing`);
    }
  }

  const sectionIssues = issuesInSection(section, issues);
  for (const item of items) {
    const itemIssues = sectionIssues.filter((i) => i.item_key === item.key);
    const result = resultForItem(answers, item.key);
    if (result === 'fail' && item.criticalOnFail) {
      const crit = itemIssues.filter((i) => i.severity === 'critical');
      if (
        crit.length === 0 ||
        !crit.every((i) => TERMINAL_ISSUE_STATUSES.includes(i.status as IssueStatus))
      ) {
        reasons.push(`Item ${item.label}: critical failure must be resolved by supervisor`);
      }
    }
    if (result === 'fail' && item.requireSupervisorOnFail) {
      const rel = itemIssues.filter((i) => i.severity === 'non_critical');
      if (
        rel.length === 0 ||
        !rel.every((i) => TERMINAL_ISSUE_STATUSES.includes(i.status as IssueStatus))
      ) {
        reasons.push(`Item ${item.label}: supervisor review required for this failure`);
      }
    }
  }

  if (hasBlockingIssueInSection(section, issues)) {
    reasons.push('Open or unresolved issues remain in this section');
  }

  if (reasons.length > 0) return { cleared: false, reasons };
  return { cleared: true };
}

export function buildPhotoCounts(
  rows: { section_code: string; item_key: string }[]
): PhotoCounts {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = photoKey(r.section_code, r.item_key);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function buildSubmissionMap(rows: SubmissionSnapshot[]): Map<string, SubmissionSnapshot> {
  const m = new Map<string, SubmissionSnapshot>();
  for (const r of rows) {
    m.set(r.section_code, r);
  }
  return m;
}

function mergeBlocked(
  preds: PavingSectionCode[],
  setup: PavingQaSetup,
  bySection: Map<string, SubmissionSnapshot>,
  photoCounts: PhotoCounts,
  issues: IssueSnapshot[]
): { section: PavingSectionCode; reason: string }[] {
  const out: { section: PavingSectionCode; reason: string }[] = [];
  const seen = new Set<string>();

  for (const p of preds) {
    const sub = submissionFor(p, bySection);
    const cleared = isSectionCleared(p, setup, sub, photoCounts, issues);
    if (!cleared.cleared) {
      const key = `${p}:not_cleared`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ section: p, reason: cleared.reasons[0] ?? 'Upstream section not cleared' });
      }
    }
    if (hasBlockingIssueInSection(p, issues)) {
      const key = `${p}:blocking_issue`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ section: p, reason: 'Blocked by unresolved issue' });
      }
    }
  }
  return out;
}

export function canSubmitSection(
  section: PavingSectionCode,
  setup: PavingQaSetup,
  bySection: Map<string, SubmissionSnapshot>,
  photoCounts: PhotoCounts,
  issues: IssueSnapshot[]
):
  | { ok: true }
  | {
      ok: false;
      code: 'NOT_APPLICABLE' | 'UPSTREAM_NOT_CLEARED' | 'UPSTREAM_BLOCKING_ISSUE';
      message: string;
      blockedBy?: { section: PavingSectionCode; reason: string }[];
    } {
  if (!applicableSectionCodes(setup).includes(section)) {
    return { ok: false, code: 'NOT_APPLICABLE', message: 'Section is not part of this run' };
  }

  const preds = predecessors(section, setup);
  const blockedBy = mergeBlocked(preds, setup, bySection, photoCounts, issues);

  if (blockedBy.length > 0) {
    const upstreamIssue = blockedBy.some((b) => b.reason === 'Blocked by unresolved issue');
    return {
      ok: false,
      code: upstreamIssue ? 'UPSTREAM_BLOCKING_ISSUE' : 'UPSTREAM_NOT_CLEARED',
      message: upstreamIssue
        ? 'Blocked by unresolved issue in an upstream section'
        : 'Complete and clear upstream sections first',
      blockedBy,
    };
  }

  return { ok: true };
}

export type SectionUiState = {
  section: PavingSectionCode;
  applicable: boolean;
  crewSubmittedAt: string | null;
  submissionStatus: SubmissionStatus | string | null;
  cleared: boolean;
  clearReasons: string[];
  canSubmit: boolean;
  blockedBy: { section: PavingSectionCode; reason: string }[] | null;
};

export function computeSectionUiStates(
  setup: PavingQaSetup,
  submissions: SubmissionSnapshot[],
  photoRows: { section_code: string; item_key: string }[],
  issues: IssueSnapshot[]
): SectionUiState[] {
  const applicable = applicableSectionCodes(setup);
  const bySection = buildSubmissionMap(submissions);
  const photoCounts = buildPhotoCounts(photoRows);

  return applicable.map((section) => {
    const sub = submissionFor(section, bySection);
    const clearedResult = isSectionCleared(section, setup, sub, photoCounts, issues);
    const can = canSubmitSection(section, setup, bySection, photoCounts, issues);
    return {
      section,
      applicable: true,
      crewSubmittedAt:
        sub?.submission_status === 'submitted' && sub.submitted_at ? String(sub.submitted_at) : null,
      submissionStatus: sub?.submission_status ?? null,
      cleared: clearedResult.cleared,
      clearReasons: clearedResult.cleared ? [] : clearedResult.reasons,
      canSubmit: can.ok,
      blockedBy: can.ok ? null : can.blockedBy ?? null,
    };
  });
}

/** Active run has incomplete required evidence if any applicable section is not cleared. */
export function activeRunHasIncompleteEvidence(
  setup: PavingQaSetup,
  submissions: SubmissionSnapshot[],
  photoRows: { section_code: string; item_key: string }[],
  issues: IssueSnapshot[]
): boolean {
  const applicable = applicableSectionCodes(setup);
  const bySection = buildSubmissionMap(submissions);
  const photoCounts = buildPhotoCounts(photoRows);
  for (const section of applicable) {
    const sub = submissionFor(section, bySection);
    const r = isSectionCleared(section, setup, sub, photoCounts, issues);
    if (!r.cleared) return true;
  }
  return false;
}

export function isPavingSectionCode(s: string): s is PavingSectionCode {
  return (
    [
      'setup_protection',
      'setout_drainage',
      'crushed_rock_base',
      'wet_bed',
      'concrete_slab_prep',
      'adhesive_fixing',
      'material_consistent',
      'material_variable',
      'driveway_addon',
      'final_qa',
    ] as const
  ).includes(s as PavingSectionCode);
}
