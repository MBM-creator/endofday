import type { SignoffQaSetupV1 } from './signoff-qa-v1-types';

export type SignoffSectionCode = 'supervisor_signoff';

export type SignoffCatalogueItem = {
  key: string;
  label: string;
  allowNa: boolean;
  requirePhoto: boolean;
  requireMarkedImage: boolean;
  criticalOnFail: boolean;
  requireSupervisorOnFail: boolean;
  noteRequiredWhen?: ('pass' | 'fail' | 'not_required')[];
  notePrompt?: string;
  staffNote?: string;
};

export type SignoffCatalogueSection = {
  code: SignoffSectionCode;
  title: string;
  description: string;
  purpose: string;
  requiredEvidence: string[];
  criticalFails: string[];
  items: SignoffCatalogueItem[];
};

function item(key: string, label: string, opts: Partial<SignoffCatalogueItem> = {}): SignoffCatalogueItem {
  return {
    key,
    label,
    allowNa: opts.allowNa ?? false,
    requirePhoto: opts.requirePhoto ?? false,
    requireMarkedImage: opts.requireMarkedImage ?? false,
    criticalOnFail: opts.criticalOnFail ?? false,
    requireSupervisorOnFail: opts.requireSupervisorOnFail ?? false,
    noteRequiredWhen: opts.noteRequiredWhen,
    notePrompt: opts.notePrompt,
    staffNote: opts.staffNote,
  };
}

const ALL_SECTIONS: SignoffCatalogueSection[] = [
  {
    code: 'supervisor_signoff',
    title: 'Supervisor sign-off',
    description:
      'Record completion evidence and supervisor review when no trade-specific QA checklist applies.',
    purpose: 'Confirm work is complete, site condition is acceptable, and scope is signed off.',
    requiredEvidence: ['Completed work photos', 'Clean/safe site photos', 'Completion notes'],
    criticalFails: ['Work incomplete', 'Site not acceptable', 'Unresolved defects'],
    items: [
      item('work_complete', 'Work is complete and meets standards', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Briefly describe what was completed.',
      }),
      item('site_condition', 'Site is clean, safe and waste removed', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('scope_complete', 'Scope is complete with no unresolved defects', {
        criticalOnFail: true,
        noteRequiredWhen: ['fail'],
      }),
    ],
  },
];

const SECTION_BY_CODE = new Map<SignoffSectionCode, SignoffCatalogueSection>(
  ALL_SECTIONS.map((section) => [section.code, section])
);

export function getApplicableSignoffSectionCodes(_setup: SignoffQaSetupV1): SignoffSectionCode[] {
  return ['supervisor_signoff'];
}

export function getSignoffSectionDefinition(code: SignoffSectionCode): SignoffCatalogueSection | undefined {
  return SECTION_BY_CODE.get(code);
}

export function getSignoffSectionsForSetup(setup: SignoffQaSetupV1): SignoffCatalogueSection[] {
  return getApplicableSignoffSectionCodes(setup)
    .map((code) => SECTION_BY_CODE.get(code))
    .filter((section): section is SignoffCatalogueSection => Boolean(section));
}

export function isSignoffSectionCode(value: string): value is SignoffSectionCode {
  return SECTION_BY_CODE.has(value as SignoffSectionCode);
}

export function allSignoffSectionCodes(): SignoffSectionCode[] {
  return ALL_SECTIONS.map((section) => section.code);
}
