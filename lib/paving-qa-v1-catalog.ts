import type {
  PavingMaterialType,
  PavingQaSetup,
  PavingSectionCode,
  PavingInstallMethod,
} from './paving-qa-v1-types';

export type BaseCatalogueItem = {
  key: string;
  label: string;
  /** If false, item must be pass or fail only */
  allowNa: boolean;
  requirePhoto: boolean;
  /** Failed pass creates critical issue until resolved */
  criticalOnFail: boolean;
  /** Failed pass creates non-critical issue until supervisor clears */
  requireSupervisorOnFail: boolean;
};

export type BaseCatalogueSection<SectionCode extends string> = {
  code: SectionCode;
  title: string;
  items: BaseCatalogueItem[];
};

export type CatalogueItem = BaseCatalogueItem;

export type CatalogueSection = BaseCatalogueSection<PavingSectionCode>;

export type QaChecklistCatalog<SectionCode extends string, Setup, Trade extends string = string> = {
  id: string;
  name: string;
  version: 1;
  trade: Trade;
  sections: Array<BaseCatalogueSection<SectionCode>>;
  allSectionCodes: () => SectionCode[];
  applicableSectionCodes: (setup: Setup) => SectionCode[];
};

const SETUP_ITEMS: CatalogueItem[] = [
  {
    key: 'site_protected',
    label: 'Site and surrounds protected',
    allowNa: false,
    requirePhoto: true,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
  {
    key: 'hazards_controlled',
    label: 'Hazards identified and controlled',
    allowNa: true,
    requirePhoto: false,
    criticalOnFail: false,
    requireSupervisorOnFail: true,
  },
];

const SETOUT_ITEMS: CatalogueItem[] = [
  {
    key: 'levels_strings',
    label: 'Set-out levels and string lines verified',
    allowNa: false,
    requirePhoto: true,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
  {
    key: 'drainage_falls',
    label: 'Drainage falls to specification',
    allowNa: false,
    requirePhoto: false,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
];

const CRUSHED_ITEMS: CatalogueItem[] = [
  {
    key: 'compaction_layers',
    label: 'Compaction and layer thickness',
    allowNa: false,
    requirePhoto: true,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
  {
    key: 'geotextile',
    label: 'Geotextile / separation as specified',
    allowNa: true,
    requirePhoto: false,
    criticalOnFail: false,
    requireSupervisorOnFail: true,
  },
];

const WET_BED_ITEMS: CatalogueItem[] = [
  {
    key: 'bed_thickness',
    label: 'Wet bed thickness and consistency',
    allowNa: false,
    requirePhoto: true,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
];

const SLAB_PREP_ITEMS: CatalogueItem[] = [
  {
    key: 'slab_condition',
    label: 'Slab surface clean, sound, and primed as required',
    allowNa: false,
    requirePhoto: true,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
];

const ADHESIVE_ITEMS: CatalogueItem[] = [
  {
    key: 'adhesive_mix',
    label: 'Adhesive mix and coverage to specification',
    allowNa: false,
    requirePhoto: true,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
];

const MATERIAL_CONSISTENT_ITEMS: CatalogueItem[] = [
  {
    key: 'bedding_course',
    label: 'Bedding course uniform for consistent thickness units',
    allowNa: false,
    requirePhoto: true,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
  {
    key: 'joints_alignment',
    label: 'Joints and alignment within tolerance',
    allowNa: false,
    requirePhoto: false,
    criticalOnFail: false,
    requireSupervisorOnFail: true,
  },
];

const MATERIAL_VARIABLE_ITEMS: CatalogueItem[] = [
  {
    key: 'stone_support',
    label: 'Variable stone fully supported / no rocking',
    allowNa: false,
    requirePhoto: true,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
];

const DRIVEWAY_ITEMS: CatalogueItem[] = [
  {
    key: 'edge_restraint',
    label: 'Edge restraint and transitions (driveway)',
    allowNa: false,
    requirePhoto: true,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
];

const FINAL_ITEMS: CatalogueItem[] = [
  {
    key: 'overall_finish',
    label: 'Overall finish and compliance walk-down',
    allowNa: false,
    requirePhoto: true,
    criticalOnFail: true,
    requireSupervisorOnFail: false,
  },
  {
    key: 'client_snags',
    label: 'Snags / punch items closed or recorded',
    allowNa: true,
    requirePhoto: false,
    criticalOnFail: false,
    requireSupervisorOnFail: true,
  },
];

const SECTIONS: CatalogueSection[] = [
  { code: 'setup_protection', title: 'Setup & Property Protection', items: SETUP_ITEMS },
  { code: 'setout_drainage', title: 'Set-out & Drainage', items: SETOUT_ITEMS },
  { code: 'crushed_rock_base', title: 'Crushed Rock Base', items: CRUSHED_ITEMS },
  { code: 'wet_bed', title: 'Wet Bed', items: WET_BED_ITEMS },
  { code: 'concrete_slab_prep', title: 'Concrete Slab Prep', items: SLAB_PREP_ITEMS },
  { code: 'adhesive_fixing', title: 'Adhesive Fixing', items: ADHESIVE_ITEMS },
  { code: 'material_consistent', title: 'Consistent-Thickness Pavers / Stone / Bricks', items: MATERIAL_CONSISTENT_ITEMS },
  { code: 'material_variable', title: 'Variable-Thickness Natural Stone', items: MATERIAL_VARIABLE_ITEMS },
  { code: 'driveway_addon', title: 'Driveway Add-on', items: DRIVEWAY_ITEMS },
  { code: 'final_qa', title: 'Final QA', items: FINAL_ITEMS },
];

const SECTION_BY_CODE = new Map<PavingSectionCode, CatalogueSection>(
  SECTIONS.map((s) => [s.code, s])
);

export function getSectionDef(code: PavingSectionCode): CatalogueSection | undefined {
  return SECTION_BY_CODE.get(code);
}

export function allSectionCodes(): PavingSectionCode[] {
  return SECTIONS.map((s) => s.code);
}

/** Pool / steps / crossover: extra checks inside setup (catalogue flags on setup only) */
const POOL_SETUP_ITEM: CatalogueItem = {
  key: 'pool_area_protection',
  label: 'Pool area protection and drainage considerations',
  allowNa: false,
  requirePhoto: true,
  criticalOnFail: true,
  requireSupervisorOnFail: false,
};

const STEPS_SETUP_ITEM: CatalogueItem = {
  key: 'steps_safe_access',
  label: 'Steps / changes in level — safe access and support',
  allowNa: false,
  requirePhoto: true,
  criticalOnFail: true,
  requireSupervisorOnFail: false,
};

const CROSSOVER_SETUP_ITEM: CatalogueItem = {
  key: 'crossover_compliance',
  label: 'Crossover / authority requirements met',
  allowNa: false,
  requirePhoto: true,
  criticalOnFail: true,
  requireSupervisorOnFail: false,
};

export function getSectionItemsForSetup(
  code: PavingSectionCode,
  setup: PavingQaSetup
): CatalogueItem[] {
  const base = getSectionDef(code)?.items ?? [];
  if (code !== 'setup_protection') return base;
  const extra: CatalogueItem[] = [];
  if (setup.is_pool_area) extra.push(POOL_SETUP_ITEM);
  if (setup.has_steps) extra.push(STEPS_SETUP_ITEM);
  if (setup.is_crossover) extra.push(CROSSOVER_SETUP_ITEM);
  return [...base, ...extra];
}

export function applicableSectionCodes(setup: PavingQaSetup): PavingSectionCode[] {
  const codes: PavingSectionCode[] = ['setup_protection', 'setout_drainage'];

  if (setup.install_method === 'crushed_rock_wet_bed') {
    codes.push('crushed_rock_base', 'wet_bed');
  } else {
    codes.push('concrete_slab_prep', 'adhesive_fixing');
  }

  if (setup.material_type === 'consistent_thickness') {
    codes.push('material_consistent');
  } else {
    codes.push('material_variable');
  }

  if (setup.is_driveway) {
    codes.push('driveway_addon');
  }

  codes.push('final_qa');
  return codes;
}

export function materialSectionCode(setup: PavingQaSetup): PavingSectionCode {
  return setup.material_type === 'consistent_thickness' ? 'material_consistent' : 'material_variable';
}

export function layingCompleteSectionCode(setup: PavingQaSetup): PavingSectionCode {
  return setup.install_method === 'crushed_rock_wet_bed' ? 'wet_bed' : 'adhesive_fixing';
}

export function validateSetup(raw: unknown): { ok: true; setup: PavingQaSetup } | { ok: false; message: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'setup must be an object' };
  }
  const o = raw as Record<string, unknown>;

  const install = o.install_method;
  if (install !== 'crushed_rock_wet_bed' && install !== 'concrete_adhesive') {
    return { ok: false, message: 'install_method must be crushed_rock_wet_bed or concrete_adhesive' };
  }

  const material = o.material_type;
  if (material !== 'consistent_thickness' && material !== 'variable_thickness_natural_stone') {
    return { ok: false, message: 'material_type must be consistent_thickness or variable_thickness_natural_stone' };
  }

  const bool = (k: string): boolean | null => {
    const v = o[k];
    if (typeof v === 'boolean') return v;
    return null;
  };

  const is_driveway = bool('is_driveway');
  const is_pool_area = bool('is_pool_area');
  const has_steps = bool('has_steps');
  const is_crossover = bool('is_crossover');
  if (is_driveway === null || is_pool_area === null || has_steps === null || is_crossover === null) {
    return { ok: false, message: 'is_driveway, is_pool_area, has_steps, is_crossover must be booleans' };
  }

  return {
    ok: true,
    setup: {
      install_method: install as PavingInstallMethod,
      material_type: material as PavingMaterialType,
      is_driveway,
      is_pool_area,
      has_steps,
      is_crossover,
    },
  };
}

export function parseRunSetup(raw: unknown): PavingQaSetup | null {
  const v = validateSetup(raw);
  return v.ok ? v.setup : null;
}

export const PAVING_QA_V1_CATALOG: QaChecklistCatalog<PavingSectionCode, PavingQaSetup, 'paving'> = {
  id: 'paving-qa-v1',
  name: 'Paving QA',
  version: 1,
  trade: 'paving',
  sections: SECTIONS,
  allSectionCodes,
  applicableSectionCodes,
};
