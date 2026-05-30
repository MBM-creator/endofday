import type {
  PavingQaSetupV2,
  PavingInstallMethodV2,
  PavingMaterialTypeV2,
  PavingAreaUse,
} from './paving-qa-v2-types';

// ---------------------------------------------------------------------------
// Section codes
// ---------------------------------------------------------------------------

export type PavingSectionCodeV2 =
  // Universal — always apply
  | 'setup_protection'
  | 'excavation_preparation'
  // Concrete base (concrete_base_wet_bed + glue_new_concrete)
  | 'concrete_formwork'
  | 'concrete_reinforcement'
  | 'concrete_pre_pour'
  | 'concrete_pour_finish'
  // Crushed rock / wet bed (crushed_rock_wet_bed + concrete_base_wet_bed)
  | 'crushed_rock_base'
  | 'wet_bed_preparation'
  // Existing concrete / adhesive (glue_existing_concrete + glue_new_concrete)
  | 'existing_concrete_assessment'
  // Laying / material / area
  | 'paving_preparation_and_laying'
  | 'variable_thickness_stone_review'
  | 'stepper_installation'
  | 'driveway_preparation'
  | 'before_jointing'
  | 'final_completion';

// ---------------------------------------------------------------------------
// Item + section definition types
// ---------------------------------------------------------------------------

export type V2CatalogueItem = {
  key: string;
  label: string;
  allowNa: boolean;
  requirePhoto: boolean;
  criticalOnFail: boolean;
  requireSupervisorOnFail: boolean;
  /**
   * Results for which a non-empty note is mandatory.
   * 'fail' always requires a note (base behaviour).
   * Set this to include 'pass' or 'not_required' when a written decision
   * must be recorded even for passing or waived items.
   */
  noteRequiredWhen?: ('pass' | 'fail' | 'not_required')[];
  /** Placeholder / guidance text shown in the note field. Falls back to a generic message. */
  notePrompt?: string;
  /** Photo evidence only — crew uploads photos; pass/fail is not shown or required. */
  photoOnly?: boolean;
  /** When set, item only applies if the run setup includes at least one of these area uses. */
  whenAreaUses?: PavingAreaUse[];
  /** When set, item only applies if the run install method is one of these values. */
  whenInstallMethods?: PavingInstallMethodV2[];
  /** When set, item only applies if the run material type is one of these values. */
  whenMaterialTypes?: PavingMaterialTypeV2[];
};

export type V2CatalogueSection = {
  code: PavingSectionCodeV2;
  title: string;
  description: string;
  items: V2CatalogueItem[];
};

// ---------------------------------------------------------------------------
// Placeholder items — one or two per section.
// Full detailed items are built in Phase 3B.
// ---------------------------------------------------------------------------

function item(
  key: string,
  label: string,
  opts: Partial<V2CatalogueItem> = {}
): V2CatalogueItem {
  return {
    key,
    label,
    allowNa: opts.allowNa ?? false,
    requirePhoto: opts.requirePhoto ?? false,
    criticalOnFail: opts.criticalOnFail ?? false,
    requireSupervisorOnFail: opts.requireSupervisorOnFail ?? false,
    noteRequiredWhen: opts.noteRequiredWhen,
    notePrompt: opts.notePrompt,
    photoOnly: opts.photoOnly ?? false,
    whenAreaUses: opts.whenAreaUses,
    whenInstallMethods: opts.whenInstallMethods,
    whenMaterialTypes: opts.whenMaterialTypes,
  };
}

const GLUE_INSTALL_METHODS: PavingInstallMethodV2[] = ['glue_new_concrete', 'glue_existing_concrete'];
const NON_STEPPER_MATERIALS: PavingMaterialTypeV2[] = [
  'consistent_thickness',
  'variable_thickness_natural_stone',
  'mixed_materials',
];

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

const ALL_SECTIONS: V2CatalogueSection[] = [
  // ---- Universal ----
  {
    code: 'setup_protection',
    title: 'Property Protection, Setup & Falls',
    description: 'Client property documented and protected, access routes confirmed, and services identified before paving preparation begins.',
    items: [
      item('existing_condition_photo', 'Photograph existing site condition before work starts', {
        requirePhoto: true,
        photoOnly: true,
      }),
      item('property_protection', 'Client property protection installed before works begin', {
        requirePhoto: true,
        photoOnly: true,
      }),
      item('access_route_protected', 'Access route suitable and protected for materials, machinery or barrows', {
        requirePhoto: true,
        photoOnly: true,
      }),
      item('services_identified', 'Existing irrigation, lighting, drains and services identified and protected where visible or known', {
        requirePhoto: true,
        photoOnly: true,
      }),
    ],
  },
  {
    code: 'excavation_preparation',
    title: 'Excavation & Sub-Base Preparation',
    description: 'Photograph excavation depth, subgrade condition, crushed rock compaction, and service protection before base preparation continues.',
    items: [
      item('excavation_depth', 'Excavation depth suits finished height and has been checked against doors, steps, drains, other pavers, etc.', {
        requirePhoto: true,
        photoOnly: true,
      }),
      item('soft_spots_removed', 'Soft spots, roots, organic material and loose material removed', {
        requirePhoto: true,
        photoOnly: true,
      }),
      item('crushed_rock_compacted', 'Crushed rock is min 50mm and has been compacted', {
        requirePhoto: true,
        photoOnly: true,
      }),
      item('services_protected', 'Services have been identified and protected', {
        requirePhoto: true,
        photoOnly: true,
        allowNa: true,
      }),
    ],
  },

  // ---- Concrete base ----
  {
    code: 'concrete_formwork',
    title: 'Concrete Formwork',
    description: 'Formwork set to correct shape, line and height; secured and braced; transitions confirmed; isolation allowance considered; fall direction checked and recorded.',
    items: [
      item('formwork_shape', 'Formwork installed to correct shape, line and finished height', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('formwork_secure', 'Formwork is secure, braced and suitable for the pour', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('formwork_transitions', 'Curves, edges, corners and transitions match the intended set-out', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('isolation_allowance', 'Isolation or expansion allowance has been considered where concrete meets fixed structures', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record where isolation/expansion allowance is required or why it is not required.',
      }),
      item('formwork_fall', 'Formwork fall has been checked before reinforcement/pour', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record fall direction and check method.',
      }),
      item('fall_direction', 'Fall directs water away from buildings, thresholds and vulnerable structures', {
        criticalOnFail: true,
      }),
      item('neighbour_water', 'Water is not directed toward neighbouring property unless specifically designed and approved', {
        criticalOnFail: true,
      }),
      item('thresholds_checked', 'Critical thresholds, doors, weep holes, pool coping, retaining walls and fixed edges have been checked', {
        criticalOnFail: true,
      }),
    ],
  },
  {
    code: 'concrete_reinforcement',
    title: 'Concrete Reinforcement',
    description: 'Mesh chaired and lapped correctly; clearances checked; driveway/high-load reinforcement checked where applicable.',
    items: [
      item('mesh_chaired', 'Mesh is chaired correctly and not sitting on ground', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('mesh_laps', 'Mesh overlaps by at least 2 squares', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('mesh_clearances', 'Reinforcement does not interfere with drains, falls, penetrations or edge details', {
        requirePhoto: true,
        criticalOnFail: true,
        allowNa: true,
      }),
      item('starter_bars', 'Where required, starter bars have been installed', {
        requirePhoto: true,
        criticalOnFail: true,
        allowNa: true,
      }),
      item('driveway_reo', 'Driveway/high-load reinforcement requirements checked where applicable', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'If this is not a driveway or high-load area, record not required. If applicable, record reinforcement provision.',
        whenAreaUses: ['driveway_vehicle_traffic'],
      }),
    ],
  },
  {
    code: 'concrete_pre_pour',
    title: 'Pre-Pour Inspection',
    description: 'Final verification that protection and heights are confirmed before concrete is poured. Supervisor sign-off recorded.',
    items: [
      item('pre_pour_protection', 'Property protection in place before pour', {
        requirePhoto: true,
        criticalOnFail: true,
        allowNa: true,
      }),
      item('pre_pour_heights', 'Finished heights checked before pour', {
        criticalOnFail: true,
      }),
      item('supervisor_pour_approval', 'Supervisor approves concrete base ready to pour', {
        criticalOnFail: true,
        notePrompt: 'Record any conditions, risks or hold points before pour.',
      }),
    ],
  },
  {
    code: 'concrete_pour_finish',
    title: 'Concrete Pour & Finish',
    description: 'Surface consolidated and screeded; falls maintained after screeding; drains, edges and thresholds correct; curing in place.',
    items: [
      item('pour_finish_quality', 'Concrete screeded and finished suitable for paving', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('pour_falls', 'Falls maintained after screeding', {
        criticalOnFail: true,
      }),
      item('pour_details', 'Drains, penetrations, edges and thresholds remain correct after pour', {
        criticalOnFail: true,
      }),
      item('pour_curing', 'Concrete protected and curing requirements in place', {
        criticalOnFail: true,
        allowNa: true,
      }),
    ],
  },

  // ---- Crushed rock / wet bed ----
  {
    code: 'crushed_rock_base',
    title: 'Crushed Rock Base',
    description: 'Falls shaped into the compacted base; edge containment considered; driveway/heavy-use requirements checked where applicable.',
    items: [
      item('base_falls', 'Falls have been shaped into the compacted base', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record fall direction and check method.',
      }),
      item('edge_restraint', 'Edge restraint or containment has been considered before wet bed starts', {
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail', 'not_required'],
        notePrompt: 'Record edge restraint/containment approach, or why not required.',
      }),
      item('driveway_base', 'Driveway/heavy-use base requirements checked where applicable', {
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail', 'not_required'],
        notePrompt: 'If driveway/heavy-use area applies, record base provision. If not applicable, record why.',
      }),
    ],
  },
  {
    code: 'wet_bed_preparation',
    title: 'Wet Bed Preparation',
    description: 'Wet bed thickness and levelling method confirmed; slurry/bonding checked; base stability and quality verified; first area checked before proceeding.',
    items: [
      item('bed_thickness', 'Wet bed thickness is suitable for paver/stone type and finished levels', {
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record intended/checked bed thickness.',
      }),
      item('bed_falls', 'Bedding method allows required finished falls and levels', {
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record fall direction and level control method.',
      }),
      item('bed_slurry', '4:1 Sand & Cement with planicrete slurry buttered on back of stone', {
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail', 'not_required'],
        notePrompt: 'Record slurry/bonding method, or why not required.',
      }),
      item('bed_stability', 'Pavers/stone are not being laid onto dry, loose or unstable bedding', {
        criticalOnFail: true,
      }),
      item('bed_quality', 'Wet bed is not being used to hide poor base preparation or incorrect levels', {
        criticalOnFail: true,
      }),
      item('bed_first_check', 'First wet bed area checked before continuing broadly', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record who checked the first area and any corrections made.',
      }),
    ],
  },

  // ---- Existing concrete / adhesive ----
  {
    code: 'existing_concrete_assessment',
    title: 'Existing Concrete Assessment',
    description: 'Soundness, fall, height constraints, joint/crack identification and water management assessed before adhesive surface preparation begins.',
    items: [
      item('slab_sound', 'Existing concrete is structurally sound and suitable to receive paving', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record whether the slab is sound, cracked, hollow, drummy, contaminated or otherwise questionable.',
      }),
      item('slab_fall', 'Existing concrete has suitable fall and does not pond water', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record fall direction, ponding risk and where water will discharge.',
      }),
      item('height_allowance', 'Finished height allows for adhesive and paver thickness without creating threshold, trip or drainage issues', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
      item('joints_identified', 'Cracks, movement joints and existing slab joints have been identified', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail', 'not_required'],
        notePrompt: 'Record known cracks/joints, or why this is not applicable.',
      }),
      item('water_management', 'Existing concrete does not trap water against house, wall, pool coping, fence, retaining wall or neighbouring property', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
    ],
  },
  {
    code: 'paving_preparation_and_laying',
    title: 'Paving Preparation and Laying',
    description:
      'Surface prepared and adhesive installed where applicable; set-out, pattern direction and first section confirmed before broad laying continues.',
    items: [
      item('surface_clean', 'Surface cleaned of dust, dirt, oil, loose material, paint, sealer, laitance or contaminants', {
        requirePhoto: true,
        criticalOnFail: true,
        whenInstallMethods: GLUE_INSTALL_METHODS,
      }),
      item('surface_dry', 'Surface is dry/suitable enough for adhesive according to product requirements and site conditions', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        whenInstallMethods: GLUE_INSTALL_METHODS,
      }),
      item('primer_compatibility', 'Primer/waterproofing/membrane compatibility has been checked where relevant', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail', 'not_required'],
        notePrompt: 'Record product/system compatibility, or why not required.',
        whenInstallMethods: GLUE_INSTALL_METHODS,
      }),
      item('joint_treatment_planned', 'Control joints, slab joints and cracks have a planned treatment before adhesive install', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail', 'not_required'],
        notePrompt: 'Record how joints/cracks will be treated or carried through.',
        whenInstallMethods: GLUE_INSTALL_METHODS,
      }),
      item('adhesive_coverage', 'Correct trowel size, bed thickness and coverage method used', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        whenInstallMethods: GLUE_INSTALL_METHODS,
      }),
      item('back_butter', 'Large-format, dense, natural stone or uneven pieces are back-buttered where required', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail', 'not_required'],
        notePrompt: 'Record whether back-buttering was used or why it was not required.',
        whenInstallMethods: GLUE_INSTALL_METHODS,
      }),
      item('movement_joints_respected', 'Movement joints in the substrate are respected through the paving layer', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail', 'not_required'],
        whenInstallMethods: GLUE_INSTALL_METHODS,
      }),
      item('substrate_genuine', 'Adhesive is not being used to hide poor levels, hollow areas or unsuitable substrate', {
        requirePhoto: true,
        criticalOnFail: true,
        whenInstallMethods: GLUE_INSTALL_METHODS,
      }),
      item('setout_plan', 'Set-out, pattern direction and starting point checked before broad laying begins', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record pattern direction, starting point and any visual alignment decisions.',
        whenMaterialTypes: NON_STEPPER_MATERIALS,
      }),
      item('borders_planned', 'Borders, cuts, edges and transitions have been planned before laying continues', {
        criticalOnFail: true,
        whenMaterialTypes: NON_STEPPER_MATERIALS,
      }),
      item('first_section_check', 'First section laid to confirm level, fall, joint width and visual alignment (approximately 1 m²)', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record joint width target, level/fall check and any corrections made.',
        whenMaterialTypes: NON_STEPPER_MATERIALS,
      }),
      item('first_section_stable', 'Paving surface is stable with no rocking pieces in the first section', {
        criticalOnFail: true,
        whenMaterialTypes: NON_STEPPER_MATERIALS,
      }),
      item('first_section_approved', 'Supervisor accepts the first section before the crew continues broadly', {
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record who checked the first section and any conditions before continuing.',
        whenMaterialTypes: NON_STEPPER_MATERIALS,
      }),
    ],
  },
  {
    code: 'variable_thickness_stone_review',
    title: 'Variable Thickness / Natural Stone Review',
    description: 'Sorting, bedding approach, surface variation and joint treatment confirmed for variable thickness or natural stone.',
    items: [
      item('stone_sorted', 'Stone/pavers sorted for thickness, size, colour and visual variation before laying broadly', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('thickness_managed', 'Bedding/build-up approach manages variable thickness without creating trip hazards', {
        criticalOnFail: true,
      }),
      item('surface_variation_acceptable', 'Finished surface variation is acceptable for the intended use', {
        criticalOnFail: true,
      }),
      item('no_rocking_pieces', 'No obvious trip points', {
        criticalOnFail: true,
      }),
      item('joint_variation', 'Gap variation is intentional and visually acceptable before grouting/caulking', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
    ],
  },
  {
    code: 'stepper_installation',
    title: 'Stepper Installation',
    description: 'Stepper spacing, stability, finished height, transitions and drainage confirmed for stepping paths and stepper units.',
    items: [
      item('stepper_spacing', 'Stepper spacing and walking rhythm are comfortable and consistent', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('stepper_stable', 'Each stepper is stable, is approximately level and does not rock or move under foot', {
        criticalOnFail: true,
      }),
      item('stepper_height', 'Finished heights do not create a trip hazard and suits surrounding soil, gravel, lawn, mulch or planting', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('stepper_drainage', 'Drainage/fall around steppers will not undermine the bedding or surrounding surface', {
        criticalOnFail: true,
      }),
    ],
  },
  {
    code: 'driveway_preparation',
    title: 'Driveway Preparation',
    description: 'Build-up, edge restraint, transitions and drainage confirmed for driveway vehicle traffic.',
    items: [
      item('driveway_buildup', 'Driveway paving build-up has been checked against job specification', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record the specified driveway build-up, base/slab provision and any vehicle-loading assumptions.',
      }),
      item('driveway_edge', 'Edge restraint, haunching or containment are installed as per job specification', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
      item('driveway_transitions', 'Finished levels and transitions at crossover, garage, path, gate or road interface are within 1mm for set thickness stone and 3mm for variable thickness stone', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
      item('driveway_drainage', 'Drainage and fall does not leave water pooling or flooding drains', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record where driveway water will discharge and any risk points.',
      }),
    ],
  },
  {
    code: 'before_jointing',
    title: 'Before Jointing',
    description: 'Surface stability, falls, cuts, joints and surface preparation confirmed before jointing locks the surface in.',
    items: [
      item('surface_stable', 'Paving surface is stable. Fall and drainage have been checked', {
        requirePhoto: true,
        criticalOnFail: true,
        notePrompt: 'Show me with a level.',
      }),
      item('cuts_acceptable', 'Cuts, borders, edges and transitions are acceptable before grouting/caulking', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('surface_sealed', 'Joints and surface are clean and pavers/stone have been sealed (unless porcelain)', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('jointing_approved', 'Supervisor accepts the laid surface before jointing begins', {
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record who approved the surface and any required corrections.',
      }),
    ],
  },
  {
    code: 'final_completion',
    title: 'Final Completion',
    description: 'Final walk-down confirming surface, joints, drainage, hazards, site condition and supervisor sign-off.',
    items: [
      item('surface_complete', 'Finished paving surface is clean, stable and visually acceptable', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('joints_complete', 'Joints are complete and full', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('no_hazards', 'No obvious ponding, trip hazards, loose pieces or unstable areas remain', {
        criticalOnFail: true,
      }),
      item('edges_complete', 'Edges, cuts, thresholds, drains, pits, coping, steps and transitions are complete and acceptable', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('site_clean', 'Surrounding property, walls, windows, doors, garden beds, lawns and access routes are clean and undamaged', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('waste_removed', 'Waste, excess material and protection have been removed', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('supervisor_signoff', 'Final supervisor completion review has been completed', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
    ],
  },
];

const SECTION_BY_CODE = new Map<PavingSectionCodeV2, V2CatalogueSection>(
  ALL_SECTIONS.map((s) => [s.code, s])
);

// ---------------------------------------------------------------------------
// Install methods that use a concrete base
// ---------------------------------------------------------------------------

const CONCRETE_BASE_METHODS: PavingInstallMethodV2[] = ['concrete_base_wet_bed', 'glue_new_concrete'];

// ---------------------------------------------------------------------------
// Core branching logic
// ---------------------------------------------------------------------------

/**
 * Return the ordered list of applicable section codes for a given v2 setup.
 * The order reflects the expected construction sequence.
 */
export function getApplicableV2SectionCodes(setup: PavingQaSetupV2): PavingSectionCodeV2[] {
  const codes: PavingSectionCodeV2[] = [];

  const add = (...c: PavingSectionCodeV2[]) => codes.push(...c);

  // --- Universal ---
  add('setup_protection', 'excavation_preparation');

  // --- Install method branches ---
  if (setup.install_method === 'concrete_base_wet_bed') {
    add('concrete_formwork', 'concrete_reinforcement', 'concrete_pre_pour', 'concrete_pour_finish');
    add('wet_bed_preparation');
  } else if (setup.install_method === 'glue_new_concrete') {
    add('concrete_formwork', 'concrete_reinforcement', 'concrete_pre_pour', 'concrete_pour_finish');
  } else if (setup.install_method === 'glue_existing_concrete') {
    add('existing_concrete_assessment');
  } else if (setup.install_method === 'crushed_rock_wet_bed') {
    add('crushed_rock_base', 'wet_bed_preparation');
  }
  // other_mixed: universal sections only (supervisor review required)

  // --- Driveway preparation, laying, and material branches ---
  // other_mixed: universal sections + final_completion only.
  // All branching below is skipped until a supervisor/admin defines the method detail.
  if (setup.install_method !== 'other_mixed') {
    if (setup.area_uses.includes('driveway_vehicle_traffic')) {
      add('driveway_preparation');
    }

    const isGlue = GLUE_INSTALL_METHODS.includes(setup.install_method);
    const pureSteppers = setup.material_type === 'steppers';
    if (isGlue || !pureSteppers) {
      add('paving_preparation_and_laying');
    }

    // variable_thickness_stone_review: variable thickness or mixed materials
    if (
      setup.material_type === 'variable_thickness_natural_stone' ||
      setup.material_type === 'mixed_materials'
    ) {
      add('variable_thickness_stone_review');
    }

    // stepper_installation: steppers material or stepping_path area use
    if (
      setup.material_type === 'steppers' ||
      setup.area_uses.includes('stepping_path')
    ) {
      add('stepper_installation');
    }

    // before_jointing: all except pure steppers
    if (!pureSteppers) {
      add('before_jointing');
    }
  }

  // Always ends with final_completion
  add('final_completion');

  return codes;
}

// ---------------------------------------------------------------------------
// Exported helper functions
// ---------------------------------------------------------------------------

export function getV2SectionDefinition(code: PavingSectionCodeV2): V2CatalogueSection | undefined {
  return SECTION_BY_CODE.get(code);
}

export function getV2SectionItemsForSetup(
  code: PavingSectionCodeV2,
  setup: PavingQaSetupV2
): V2CatalogueItem[] {
  const def = getV2SectionDefinition(code);
  if (!def) return [];
  return def.items.filter((catalogItem) => {
    if (catalogItem.whenAreaUses?.length) {
      if (!catalogItem.whenAreaUses.some((use) => setup.area_uses.includes(use))) return false;
    }
    if (catalogItem.whenInstallMethods?.length) {
      if (!catalogItem.whenInstallMethods.includes(setup.install_method)) return false;
    }
    if (catalogItem.whenMaterialTypes?.length) {
      if (!catalogItem.whenMaterialTypes.includes(setup.material_type)) return false;
    }
    return true;
  });
}

export function getV2SectionsForSetup(setup: PavingQaSetupV2): V2CatalogueSection[] {
  return getApplicableV2SectionCodes(setup)
    .map((c) => SECTION_BY_CODE.get(c))
    .filter((s): s is V2CatalogueSection => s !== undefined);
}

export function isV2SectionCode(s: string): s is PavingSectionCodeV2 {
  return SECTION_BY_CODE.has(s as PavingSectionCodeV2);
}

export function allV2SectionCodes(): PavingSectionCodeV2[] {
  return ALL_SECTIONS.map((s) => s.code);
}

/**
 * True when the install method requires a poured concrete base before laying.
 */
export function hasConcreteBase(setup: PavingQaSetupV2): boolean {
  return CONCRETE_BASE_METHODS.includes(setup.install_method);
}

/**
 * The final substrate / install-prep section before laying work begins.
 * Used by the graph to determine what driveway and laying sections depend on.
 */
export function lastInstallSectionCode(setup: PavingQaSetupV2): PavingSectionCodeV2 {
  switch (setup.install_method) {
    case 'crushed_rock_wet_bed':
    case 'concrete_base_wet_bed':
      return 'wet_bed_preparation';
    case 'glue_new_concrete':
      return 'concrete_pour_finish';
    case 'glue_existing_concrete':
      return 'existing_concrete_assessment';
    case 'other_mixed':
    default:
      return 'excavation_preparation';
  }
}

/**
 * Whether the other_mixed install method note should be shown
 * (used by the overview to surface the supervisor review notice).
 */
export function isOtherMixedMethod(setup: PavingQaSetupV2): boolean {
  return setup.install_method === 'other_mixed';
}
