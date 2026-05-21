import type {
  PavingQaSetupV2,
  PavingInstallMethodV2,
} from './paving-qa-v2-types';

// ---------------------------------------------------------------------------
// Section codes
// ---------------------------------------------------------------------------

export type PavingSectionCodeV2 =
  // Universal — always apply
  | 'setup_protection'
  | 'drainage_falls'
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
  | 'adhesive_surface_preparation'
  | 'adhesive_installation'
  // Laying / material / area
  | 'setout_first_section'
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
  };
}

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

const ALL_SECTIONS: V2CatalogueSection[] = [
  // ---- Universal ----
  {
    code: 'setup_protection',
    title: 'Setup & Property Protection',
    description: 'Client property documented and protected, access routes confirmed, and services identified before paving preparation begins.',
    items: [
      item('property_protection', 'Client property protection installed before works begin', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['fail'],
      }),
      item('existing_condition_photo', 'Existing site condition photographed before work starts', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('access_route_protected', 'Access route suitable and protected for materials, machinery or barrows', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('services_identified', 'Existing irrigation, lighting, drains and services identified and protected where visible or known', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('supervisor_pre_works_review', 'Supervisor has reviewed plan, levels, finished heights and work area before paving preparation proceeds', {
        requirePhoto: false,
        criticalOnFail: true,
        noteRequiredWhen: ['fail'],
      }),
    ],
  },
  {
    code: 'drainage_falls',
    title: 'Drainage Falls & Set-Out',
    description: 'Drainage decision recorded, falls confirmed away from buildings and thresholds, and method of fall check documented before base preparation.',
    items: [
      item('drainage_decision', 'Drainage decision recorded and acceptable for the site', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record whether a drain is required. If no drain is required, record where water will go and why this is acceptable.',
      }),
      item('fall_direction', 'Fall directs water away from buildings, thresholds and vulnerable structures', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('neighbour_water', 'Water is not directed toward neighbouring property unless specifically designed and approved', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['fail'],
      }),
      item('thresholds_checked', 'Critical thresholds, doors, weep holes, pool coping, retaining walls and fixed edges have been checked', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('fall_method_checked', 'Fall/discharge point has been checked using string line, laser, level or other reliable method', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass'],
        notePrompt: 'Record method used to check fall and the intended direction of fall.',
      }),
    ],
  },
  {
    code: 'excavation_preparation',
    title: 'Excavation & Sub-Base Preparation',
    description: 'Excavation depth confirmed for build-up and finished height, subgrade suitable, services protected, and finished height checked against all critical adjacent elements.',
    items: [
      item('excavation_depth', 'Excavation depth suits concrete build-up, paving thickness, adhesive/wet bed allowance and finished height', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record intended build-up depth and any critical height constraints.',
      }),
      item('soft_spots_removed', 'Soft spots, roots, organic material and loose material removed', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('subgrade_suitable', 'Subgrade is firm and suitable for the specified concrete base', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('services_protected', 'Services have been identified and protected', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
      item('finished_height_checked', 'Finished paving height has been checked against doors, thresholds, drains, steps, pool coping and adjacent surfaces', {
        requirePhoto: true,
        criticalOnFail: true,
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
    ],
  },
  {
    code: 'concrete_reinforcement',
    title: 'Concrete Reinforcement',
    description: 'Mesh type and need recorded; chairs correct; laps acceptable; no interference with drains or edges; driveway/high-load reinforcement requirements checked.',
    items: [
      item('mesh_installed', 'Reinforcement mesh installed where specified', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'not_required', 'fail'],
        notePrompt: 'Record mesh type if installed. If not required, record why.',
      }),
      item('mesh_chaired', 'Mesh is chaired correctly and not sitting on ground', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('mesh_laps', 'Mesh laps and edge clearances are acceptable', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('mesh_clearances', 'Reinforcement does not interfere with drains, falls, penetrations or edge details', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('driveway_reo', 'Driveway/high-load reinforcement requirements checked where applicable', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'not_required', 'fail'],
        notePrompt: 'If this is not a driveway or high-load area, record not required. If applicable, record reinforcement provision.',
      }),
    ],
  },
  {
    code: 'concrete_pre_pour',
    title: 'Pre-Pour Inspection',
    description: 'Final verification that protection, formwork, fall, reinforcement and heights are confirmed before concrete is poured. Supervisor sign-off recorded.',
    items: [
      item('pre_pour_protection', 'Site protection still in place before pour', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('pre_pour_checks_complete', 'Excavation, formwork, fall and reinforcement checks complete before pour', {
        requirePhoto: false,
        criticalOnFail: true,
      }),
      item('pre_pour_drainage', 'Drainage decision accepted before pour', {
        requirePhoto: false,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Confirm whether drainage is via drain, surface fall or another accepted method.',
      }),
      item('pre_pour_heights', 'Finished heights checked before pour', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('supervisor_pour_approval', 'Supervisor approves concrete base ready to pour', {
        requirePhoto: false,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record any conditions, risks or hold points before pour.',
      }),
    ],
  },
  {
    code: 'concrete_pour_finish',
    title: 'Concrete Pour & Finish',
    description: 'Depth and build-up recorded; surface consolidated and screeded; falls maintained after screeding; drains, edges and thresholds correct; curing in place.',
    items: [
      item('pour_depth', 'Concrete poured to specified depth and build-up', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record concrete depth/build-up checked.',
      }),
      item('pour_finish_quality', 'Concrete consolidated, screeded and finished suitable for next paving method', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('pour_falls', 'Falls maintained after screeding', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record fall direction and check method after screeding.',
      }),
      item('pour_details', 'Drains, penetrations, edges and thresholds remain correct after pour', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('pour_curing', 'Concrete protected and curing requirements in place', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
    ],
  },

  // ---- Crushed rock / wet bed ----
  {
    code: 'crushed_rock_base',
    title: 'Crushed Rock Base',
    description: 'Crushed rock material, depth, compaction and falls confirmed; edge containment considered; driveway/heavy-use requirements checked where applicable.',
    items: [
      item('rock_material', 'Crushed rock material matches the job specification', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record crushed rock type/material used.',
      }),
      item('rock_depth', 'Crushed rock depth matches the job specification', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record specified depth and checked depth.',
      }),
      item('rock_spread', 'Crushed rock spread evenly with no obvious soft, loose or unstable areas', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('rock_compaction', 'Crushed rock compacted properly with suitable equipment', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record compaction method/equipment used.',
      }),
      item('base_firmness', 'Base is firm after compaction with no pumping, rocking or obvious movement', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('base_falls', 'Falls have been shaped into the compacted base', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record fall direction and check method.',
      }),
      item('edge_restraint', 'Edge restraint or containment has been considered before wet bed starts', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'not_required', 'fail'],
        notePrompt: 'Record edge restraint/containment approach, or why not required.',
      }),
      item('driveway_base', 'Driveway/heavy-use base requirements checked where applicable', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'not_required', 'fail'],
        notePrompt: 'If driveway/heavy-use area applies, record base provision. If not applicable, record why.',
      }),
    ],
  },
  {
    code: 'wet_bed_preparation',
    title: 'Wet Bed Preparation',
    description: 'Wet bed mix, thickness and levelling method confirmed; slurry/bonding checked; base stability and quality verified; first area checked before proceeding.',
    items: [
      item('bed_mix', 'Wet bed material/mix matches the job specification', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record wet bed mix/material used.',
      }),
      item('bed_thickness', 'Wet bed thickness is suitable for paver/stone type and finished levels', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record intended/checked bed thickness.',
      }),
      item('bed_falls', 'Bedding method allows required finished falls and levels', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record fall direction and level control method.',
      }),
      item('bed_slurry', 'Slurry/bonding method is used where required', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'not_required', 'fail'],
        notePrompt: 'Record slurry/bonding method, or why not required.',
      }),
      item('bed_stability', 'Pavers/stone are not being laid onto dry, loose or unstable bedding', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('bed_quality', 'Wet bed is not being used to hide poor base preparation or incorrect levels', {
        requirePhoto: true,
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
        noteRequiredWhen: ['pass', 'not_required', 'fail'],
        notePrompt: 'Record known cracks/joints, or why this is not applicable.',
      }),
      item('water_management', 'Existing concrete does not trap water against house, wall, pool coping, fence, retaining wall or neighbouring property', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
    ],
  },
  {
    code: 'adhesive_surface_preparation',
    title: 'Adhesive Surface Preparation',
    description: 'Surface cleaned and prepared, preparation method confirmed, dryness checked, primer/compatibility reviewed, and joint/crack treatment planned before adhesive is installed.',
    items: [
      item('surface_clean', 'Surface cleaned of dust, dirt, oil, loose material, paint, sealer, laitance or contaminants', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('prep_method', 'Surface preparation method is suitable for the adhesive system', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record preparation method, such as grinding, cleaning, priming or other specified prep.',
      }),
      item('surface_dry', 'Surface is dry/suitable enough for adhesive according to product requirements and site conditions', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
      item('primer_compatibility', 'Primer/waterproofing/membrane compatibility has been checked where relevant', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'not_required', 'fail'],
        notePrompt: 'Record product/system compatibility, or why not required.',
      }),
      item('joint_treatment_planned', 'Movement joints, slab joints and cracks have a planned treatment before adhesive install', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'not_required', 'fail'],
        notePrompt: 'Record how joints/cracks will be treated or carried through.',
      }),
    ],
  },
  {
    code: 'adhesive_installation',
    title: 'Adhesive Installation',
    description: 'Adhesive product suitability confirmed; trowel, coverage and back-buttering correct; movement joints respected; substrate genuinely suitable before paving proceeds.',
    items: [
      item('adhesive_product', 'Adhesive is suitable for external paving and selected paver/stone material', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record adhesive product/system used.',
      }),
      item('adhesive_coverage', 'Correct trowel size, bed thickness and coverage method used', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
      item('coverage_adequate', 'Adequate adhesive coverage achieved, including edge/corner support', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('back_butter', 'Large-format, dense, natural stone or uneven pieces are back-buttered where required', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'not_required', 'fail'],
        notePrompt: 'Record whether back-buttering was used or why it was not required.',
      }),
      item('movement_joints_respected', 'Movement joints in the substrate are respected through the paving layer', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'not_required', 'fail'],
      }),
      item('substrate_genuine', 'Adhesive is not being used to hide poor levels, hollow areas or unsuitable substrate', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
    ],
  },

  // ---- Laying / material ----
  {
    code: 'setout_first_section',
    title: 'Set-Out & First Section Laying',
    description: 'Starting point, pattern direction and first section confirmed before broad laying continues.',
    items: [
      item('setout_plan', 'Set-out, pattern direction and starting point checked before broad laying begins', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record pattern direction, starting point and any visual alignment decisions.',
      }),
      item('borders_planned', 'Borders, cuts, edges and transitions have been planned before laying continues', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('first_section_check', 'First section laid to confirm level, fall, joint width and visual alignment', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record joint width target, level/fall check and any corrections made.',
      }),
      item('first_section_stable', 'Paving surface is stable with no rocking pieces in the first section', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('first_section_approved', 'Supervisor accepts the first section before the crew continues broadly', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record who checked the first section and any conditions before continuing.',
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
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record how thickness variation is being managed.',
      }),
      item('surface_variation_acceptable', 'Finished surface variation is acceptable for the intended use', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record expected natural variation and any practical limits.',
      }),
      item('no_rocking_pieces', 'No piece rocks under foot or creates an obvious trip point', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('joint_variation', 'Joint variation is intentional and visually acceptable before jointing', {
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
        noteRequiredWhen: ['pass', 'fail'],
      }),
      item('stepper_stable', 'Each stepper is stable and does not rock or move under foot', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('stepper_height', 'Finished height suits surrounding soil, gravel, lawn, mulch or planting', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('stepper_transitions', 'Transitions between steppers and surrounding surfaces do not create trip hazards', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('stepper_drainage', 'Drainage/fall around steppers will not undermine the bedding or surrounding surface', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
    ],
  },
  {
    code: 'driveway_preparation',
    title: 'Driveway Preparation',
    description: 'Build-up, edge restraint, transitions, drainage and material suitability confirmed for driveway vehicle traffic.',
    items: [
      item('driveway_buildup', 'Driveway paving build-up has been checked against vehicle loading and job specification', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record the specified driveway build-up, base/slab provision and any vehicle-loading assumptions.',
      }),
      item('driveway_edge', 'Edge restraint, haunching or containment is suitable for vehicle movement', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
      item('driveway_transitions', 'Finished levels and transitions at crossover, garage, path, gate or road interface are acceptable', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
      item('driveway_drainage', 'Drainage and fall are suitable for a driveway area', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record where driveway water will discharge and any risk points.',
      }),
      item('driveway_material', 'Paver/stone material and laying method are suitable for driveway use', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
      }),
    ],
  },
  {
    code: 'before_jointing',
    title: 'Before Jointing',
    description: 'Surface stability, falls, cuts, joints and surface preparation confirmed before jointing locks the surface in.',
    items: [
      item('surface_stable', 'Paving surface is stable and ready for jointing', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('falls_checked', 'Falls and drainage have been checked before jointing locks the surface in', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record fall direction, drainage point and check method.',
      }),
      item('cuts_acceptable', 'Cuts, borders, edges and transitions are acceptable before jointing', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('joints_open', 'Joints are clean, open and suitable for the selected jointing material', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('surface_clean', 'Surface has been cleaned/prepared enough for jointing without trapping obvious residue', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('jointing_approved', 'Supervisor accepts the laid surface before jointing begins', {
        requirePhoto: true,
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
      item('joints_complete', 'Joints are complete and suitable for the paving type and use case', {
        requirePhoto: true,
        criticalOnFail: true,
      }),
      item('drainage_final', 'Drainage/fall has been checked after completion', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record final drainage direction and discharge point.',
      }),
      item('no_hazards', 'No obvious ponding, trip hazards, loose pieces or unstable areas remain', {
        requirePhoto: true,
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
      item('waste_removed', 'Waste, excess material and protection have been removed or left in place intentionally', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record if any protection remains in place and why.',
      }),
      item('supervisor_signoff', 'Final supervisor completion review has been completed', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Record reviewer name and any completion notes.',
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
  add('setup_protection', 'drainage_falls', 'excavation_preparation');

  // --- Install method branches ---
  if (setup.install_method === 'concrete_base_wet_bed') {
    add('concrete_formwork', 'concrete_reinforcement', 'concrete_pre_pour', 'concrete_pour_finish');
    add('wet_bed_preparation');
  } else if (setup.install_method === 'glue_new_concrete') {
    add('concrete_formwork', 'concrete_reinforcement', 'concrete_pre_pour', 'concrete_pour_finish');
    add('adhesive_surface_preparation', 'adhesive_installation');
  } else if (setup.install_method === 'glue_existing_concrete') {
    add('existing_concrete_assessment', 'adhesive_surface_preparation', 'adhesive_installation');
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

    // setout_first_section: all non-other-mixed methods except pure steppers
    const pureSteppers = setup.material_type === 'steppers';
    if (!pureSteppers) {
      add('setout_first_section');
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
 * The final install-prep section code for a given setup — used by the graph
 * to determine what the laying sections depend on.
 */
export function lastInstallSectionCode(setup: PavingQaSetupV2): PavingSectionCodeV2 {
  switch (setup.install_method) {
    case 'crushed_rock_wet_bed':
    case 'concrete_base_wet_bed':
      return 'wet_bed_preparation';
    case 'glue_new_concrete':
    case 'glue_existing_concrete':
      return 'adhesive_installation';
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
