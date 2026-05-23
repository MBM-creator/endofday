import type { IrrigationQaSetupV1 } from './irrigation-qa-v1-types';

export type IrrigationSectionCode =
  | 'setup_scope_protection'
  | 'water_source_backflow_pressure_flow'
  | 'layout_hydrozones_materials'
  | 'sleeving_before_hardscape_cover'
  | 'trenching_pipework_before_backfill'
  | 'valve_box_solenoids_manifold'
  | 'dripline_installation'
  | 'spray_rotor_installation'
  | 'controller_wiring_sensors'
  | 'flush_leak_pressure_test'
  | 'reinstatement'
  | 'as_built_client_handover'
  | 'supervisor_final_approval';

export type IrrigationCatalogueItem = {
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

export type IrrigationCatalogueSection = {
  code: IrrigationSectionCode;
  title: string;
  description: string;
  purpose: string;
  beforeCover?: boolean;
  requiredEvidence: string[];
  criticalFails: string[];
  items: IrrigationCatalogueItem[];
};

function item(
  key: string,
  label: string,
  opts: Partial<IrrigationCatalogueItem> = {}
): IrrigationCatalogueItem {
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

const ALL_SECTIONS: IrrigationCatalogueSection[] = [
  {
    code: 'setup_scope_protection',
    title: 'Setup, Scope & Property Protection',
    description: 'Confirm the job context before anyone starts digging, cutting, trenching or connecting anything.',
    purpose: 'Confirm the job context before anyone starts digging, cutting, trenching or connecting anything.',
    requiredEvidence: ['Site protection photos', 'Water source photo', 'Controller/valve location photo if existing', 'Marked-up plan or notes'],
    criticalFails: ['No property protection', 'Unclear water source', 'Unknown services in trenching area', 'Stage/template mismatch'],
    items: [
      item('site_condition_photos', 'Photos taken of site condition before disturbance', { requirePhoto: true, criticalOnFail: true }),
      item('irrigation_type_confirmed', 'Confirm irrigation type: new install, extension, repair, controller upgrade or maintenance', { noteRequiredWhen: ['pass', 'fail'] }),
      item('water_source_confirmed', 'Confirm water source: potable mains, recycled water, rainwater tank, pump, existing irrigation system or other', { requirePhoto: true, noteRequiredWhen: ['pass', 'fail'] }),
      item('system_type_confirmed', 'Confirm system type: garden bed dripline, lawn sprays/rotors, pots, trees, mixed system or controller-only', { noteRequiredWhen: ['pass', 'fail'] }),
      item('property_protection', 'Client property protection installed before works begin', { allowNa: true, requirePhoto: true, criticalOnFail: true }),
      item('byda_services_checked', 'BYDA and household services checked before trenching', { criticalOnFail: true, noteRequiredWhen: ['pass', 'fail'] }),
      item('marked_plan_or_notes', 'Marked-up plan or notes captured before work starts', { requireMarkedImage: true, requirePhoto: true, criticalOnFail: true }),
    ],
  },
  {
    code: 'water_source_backflow_pressure_flow',
    title: 'Water Source, Backflow & Pressure/Flow',
    description: 'Make sure the system has a safe and suitable water source before downstream work starts.',
    purpose: 'Make sure the system has a safe and suitable water source before downstream work starts.',
    requiredEvidence: ['Pressure reading', 'Flow test result', 'Water source photo', 'Backflow/isolation arrangement photo', 'Notes if plumber involvement is required'],
    criticalFails: ['Backflow unknown', 'Pressure/flow inadequate', 'Suspected cross-connection', 'Recycled water not clearly identified'],
    items: [
      item('water_source_photo', 'Water source confirmed and photographed', { requirePhoto: true, criticalOnFail: true }),
      item('backflow_identified', 'Existing backflow prevention device identified where applicable', { allowNa: true, requirePhoto: true, criticalOnFail: true }),
      item('connection_backflow_complete', 'Any new point-of-connection or backflow work confirmed as completed', { requirePhoto: true, criticalOnFail: true }),
      item('no_cross_connection', 'No unapproved cross-connection between potable and recycled/rain/tank water', { criticalOnFail: true }),
      item('baseline_pressure_test', 'Baseline pressure test completed', { requirePhoto: true, criticalOnFail: true, noteRequiredWhen: ['pass', 'fail'], notePrompt: 'Record pressure reading.' }),
      item('flow_rate_test', 'Flow rate test completed at intended supply point', { requirePhoto: true, criticalOnFail: true, noteRequiredWhen: ['pass', 'fail'], notePrompt: 'Record flow test result.' }),
      item('pressure_flow_suitable', 'Pressure/flow suitable for proposed number of zones', { criticalOnFail: true, noteRequiredWhen: ['pass', 'fail'] }),
      item('isolation_accessible', 'Isolation valve location confirmed and accessible', { requirePhoto: true, criticalOnFail: true }),
      item('recycled_identified', 'If recycled water is used, purple pipe/tap/signage requirements are identified and no potable cross-connection is present', { allowNa: true, requirePhoto: true, criticalOnFail: true }),
    ],
  },
  {
    code: 'layout_hydrozones_materials',
    title: 'Layout, Hydrozones & Materials',
    description: 'Confirm the system has been split logically before installation.',
    purpose: 'Confirm the system has been split logically before installation.',
    requiredEvidence: ['Marked-up zone plan', 'Materials photo', 'Zone list'],
    criticalFails: ['Wrong materials', 'Poor zoning', 'Insufficient controller capacity', 'Mixed application types without approval'],
    items: [
      item('zones_match_needs', 'Zones match plant/water needs, not just convenience', { criticalOnFail: true }),
      item('dripline_sprays_not_mixed', 'Dripline and sprays/rotors are not mixed on the same zone unless specifically designed and supervisor-approved', { criticalOnFail: true }),
      item('areas_zoned_separately', 'Lawn, garden beds, pots and trees are zoned separately where practical', { allowNa: true, requireSupervisorOnFail: true }),
      item('materials_match_system', 'Pipe sizes, fittings, solenoids, filters, pressure regulators and controller capacity match the system', { requirePhoto: true, criticalOnFail: true }),
      item('dripline_spacing_suitable', 'Dripline spacing and flow rate are suitable for planting type and soil', { allowNa: true, requireSupervisorOnFail: true }),
      item('sprinkler_layout_suitable', 'Sprinkler/rotor layout allows head-to-head or acceptable coverage where possible', { allowNa: true, requireSupervisorOnFail: true }),
      item('future_access_practical', 'Future access for filters, flush points, solenoids and controller is practical', { requirePhoto: true, requireSupervisorOnFail: true }),
      item('controller_capacity', 'Controller has enough stations for current and likely future needs', { criticalOnFail: true }),
      item('zone_plan_marked', 'Marked-up zone plan completed', { requireMarkedImage: true, requirePhoto: true, criticalOnFail: true }),
    ],
  },
  {
    code: 'sleeving_before_hardscape_cover',
    title: 'Sleeving Before Hardscape Cover',
    description: 'Capture buried sleeves before they disappear.',
    purpose: 'Capture buried sleeves before they disappear.',
    beforeCover: true,
    requiredEvidence: ['Wide photo showing sleeve route', 'Close-up of each sleeve end', 'Depth/reference photo'],
    criticalFails: ['Missing sleeve under hardscape', 'Inaccessible sleeve end', 'Sleeve crushed/blocked', 'No before-cover evidence'],
    items: [
      item('sleeves_before_cover', 'Sleeves installed before paving/concrete/base works proceed', { requirePhoto: true, criticalOnFail: true }),
      item('sleeve_size', 'Sleeve size is adequate for pipework and future replacement where practical', { requirePhoto: true, criticalOnFail: true }),
      item('sleeve_ends_accessible', 'Sleeve ends extend beyond hardscape edge and are accessible', { requirePhoto: true, criticalOnFail: true }),
      item('sleeves_capped', 'Sleeves capped or taped to prevent blockage', { requirePhoto: true, criticalOnFail: true }),
      item('draw_wire', 'Draw wire installed where useful', { allowNa: true, requirePhoto: true }),
      item('sleeve_route_photo', 'Sleeve route photographed before cover', { requirePhoto: true, criticalOnFail: true }),
      item('sleeve_location_recorded', 'Sleeve location recorded on plan/as-built notes', { requireMarkedImage: true, requirePhoto: true, criticalOnFail: true }),
      item('sleeves_protected', 'Sleeves protected from crushing during base preparation or concrete pour', { requirePhoto: true, criticalOnFail: true }),
    ],
  },
  {
    code: 'trenching_pipework_before_backfill',
    title: 'Trenching & Pipework Before Backfill',
    description: 'Verify buried pipework before it is covered.',
    purpose: 'Verify buried pipework before it is covered.',
    beforeCover: true,
    requiredEvidence: ['Trench overview photos', 'Close-ups of fittings', 'Leak test result', 'Route/as-built notes'],
    criticalFails: ['Pipework covered before photo', 'Visible leak', 'Kinked pipe', 'Unsupported or stressed fittings'],
    items: [
      item('trenches_clean', 'Trenches are clean and free of sharp debris', { requirePhoto: true, criticalOnFail: true }),
      item('routes_avoid_damage', 'Pipe routes avoid obvious future damage from edging, posts, stakes, footings and heavy traffic', { criticalOnFail: true }),
      item('pipework_no_kinks', 'Pipework laid without kinks, twisting or tension', { requirePhoto: true, criticalOnFail: true }),
      item('fittings_secured', 'Fittings are fully seated and correctly clamped/secured', { requirePhoto: true, criticalOnFail: true }),
      item('pipework_route_installed', 'Mainline/submain/lateral pipework installed to intended route', { requirePhoto: true, criticalOnFail: true }),
      item('penetrations_clean', 'Pipes pass through walls, paving edges or sleeves cleanly without rubbing or pinching', { requirePhoto: true, criticalOnFail: true }),
      item('flush_points_allowed', 'Flush points allowed for where needed', { allowNa: true, requireSupervisorOnFail: true }),
      item('pre_backfill_test', 'Pipework pressure/leak test completed before backfill', { requirePhoto: true, criticalOnFail: true, noteRequiredWhen: ['pass', 'fail'] }),
    ],
  },
  {
    code: 'valve_box_solenoids_manifold',
    title: 'Valve Box, Solenoids & Manifold',
    description: 'Make the control points serviceable, labelled and protected.',
    purpose: 'Make the control points serviceable, labelled and protected.',
    requiredEvidence: ['Open valve box photo', 'Labelled zone photo', 'Wiring close-up', 'Final valve box location photo'],
    criticalFails: ['Inaccessible valve box', 'Unlabelled zones', 'Non-waterproof wire joins', 'Leak at manifold'],
    items: [
      item('valve_box_accessible', 'Valve box location matches plan and remains accessible at a sensible finished height after landscaping', { requirePhoto: true, criticalOnFail: true }),
      item('valve_box_base', 'Drainage gravel or suitable base installed below valve box', { requirePhoto: true, criticalOnFail: true }),
      item('solenoid_flow_direction', 'Solenoids installed in correct flow direction', { requirePhoto: true, criticalOnFail: true }),
      item('isolation_valve_accessible', 'Isolation valve accessible', { criticalOnFail: true }),
      item('filters_installed', 'Filters installed where required', { criticalOnFail: true, staffNote: 'All recycled/tank systems must have a filter.' }),
      item('waterproof_connectors', 'Waterproof wire connectors used', { requirePhoto: true, criticalOnFail: true }),
      item('wire_slack', 'Spare wire/slack provided for future servicing', { requireSupervisorOnFail: true }),
      item('solenoids_labelled', 'Each solenoid is labelled clearly', { requirePhoto: true, criticalOnFail: true }),
      item('valve_box_photos', 'Valve box photographed open before backfill and after final placement', { requirePhoto: true, criticalOnFail: true }),
    ],
  },
  {
    code: 'dripline_installation',
    title: 'Dripline Installation',
    description: 'Confirm dripline is installed, flushed, tested and photographed before mulch or cover.',
    purpose: 'Confirm dripline is installed, flushed, tested and photographed before mulch or cover.',
    beforeCover: true,
    requiredEvidence: ['Wide bed photo before mulch', 'Close-up of dripline spacing', 'Flush point photo', 'Test photo/video'],
    criticalFails: ['No filter/pressure regulation where required', 'No flush ability', 'Dry areas obvious', 'Dripline covered before evidence'],
    items: [
      item('dripline_type_spacing', 'Dripline type and spacing match design/planting', { criticalOnFail: true }),
      item('root_zone_placement', 'Dripline is placed to suit root zones, not just hidden wherever convenient', { criticalOnFail: true }),
      item('pinned_no_kinks', 'Lines are pinned/secured and not kinked', { requirePhoto: true, criticalOnFail: true }),
      item('looped_where_practical', 'Dripline is looped where practical to improve consistency', { allowNa: true }),
      item('flush_points', 'Flush points installed at ends/low points', { requirePhoto: true, criticalOnFail: true }),
      item('air_release', 'Air release used for high points/larger areas', { allowNa: true, requirePhoto: true }),
      item('filter_pressure_regulation', 'Filter and pressure regulation installed before dripline zones', { requirePhoto: true, criticalOnFail: true, staffNote: 'All dripline must have a pressure reducer installed after the solenoid. All recycled/tank systems must have a filter.' }),
      item('dripline_flushed', 'Dripline flushed', { requirePhoto: true, criticalOnFail: true }),
      item('dripline_tested_before_mulch', 'Dripline tested before mulch', { requirePhoto: true, criticalOnFail: true }),
      item('photos_before_cover', 'Photos taken before mulch/cover', { requirePhoto: true, criticalOnFail: true }),
    ],
  },
  {
    code: 'spray_rotor_installation',
    title: 'Spray/Rotor Installation',
    description: 'Confirm sprays/rotors are installed, flushed, adjusted and tested.',
    purpose: 'Confirm sprays/rotors are installed, flushed, adjusted and tested.',
    requiredEvidence: ['Head layout photos', 'Operating coverage video/photo', 'Adjustment notes'],
    criticalFails: ['Overspray onto buildings/windows', 'Dry zones', 'Excessive misting', 'Heads set too low/high', 'Coverage not tested'],
    items: [
      item('heads_vertical_level', 'Heads installed vertical and at correct finished level', { requirePhoto: true, criticalOnFail: true }),
      item('heads_flushed', 'All heads flushed', { requirePhoto: true, criticalOnFail: true }),
      item('arcs_adjusted', 'Arcs adjusted to avoid buildings, windows, fences, paths and roads', { requirePhoto: true, criticalOnFail: true }),
      item('no_hard_surface_spray', 'Heads are not spraying directly onto hard surfaces', { requirePhoto: true, criticalOnFail: true }),
      item('swing_joints', 'Swing joints/flexible risers used where needed to reduce breakage risk', { requirePhoto: true, requireSupervisorOnFail: true }),
      item('coverage_acceptable', 'Head-to-head or acceptable coverage achieved where practical', { criticalOnFail: true }),
      item('operating_pressure', 'Pressure is suitable under operating conditions', { criticalOnFail: true, noteRequiredWhen: ['pass', 'fail'] }),
      item('no_misting', 'No obvious misting from excessive pressure', { criticalOnFail: true }),
      item('heads_retract', 'All heads retract correctly', { criticalOnFail: true }),
      item('coverage_test', 'Coverage test completed zone by zone', { requirePhoto: true, criticalOnFail: true, noteRequiredWhen: ['pass', 'fail'] }),
    ],
  },
  {
    code: 'controller_wiring_sensors',
    title: 'Controller, Wiring & Sensors',
    description: 'Make sure the system is controllable, labelled and understandable.',
    purpose: 'Make sure the system is controllable, labelled and understandable.',
    requiredEvidence: ['Controller photo', 'Station wiring photo', 'Zone label photo', 'Screenshot/photo of program if applicable'],
    criticalFails: ['Unsafe electrical arrangement', 'Unlabelled controller', 'Zones do not match labels', 'Controller not tested'],
    items: [
      item('controller_location', 'Controller location is accessible and protected', { noteRequiredWhen: ['pass', 'fail'], criticalOnFail: true, notePrompt: 'Record controller location.' }),
      item('station_wires', 'Station wires connected neatly', { requirePhoto: true, criticalOnFail: true }),
      item('common_wire', 'Common wire clearly identified', { criticalOnFail: true }),
      item('sensor_installed', 'Rain sensor, soil sensor or smart controller installed if included', { allowNa: true, requirePhoto: true }),
      item('wifi_app_tested', 'Wi-Fi/app connection tested if included', { allowNa: true, requirePhoto: true }),
      item('watering_rules_program', 'Controller program set to comply with local watering rules: 6pm-10am', { requirePhoto: true, criticalOnFail: true, staffNote: 'Local watering rules: 6pm-10am.' }),
      item('seasonal_adjustment', 'Seasonal adjustment set appropriately', { allowNa: true, noteRequiredWhen: ['pass'] }),
      item('client_zone_labels', 'Client-facing zone labels are understandable', { requirePhoto: true, criticalOnFail: true }),
    ],
  },
  {
    code: 'flush_leak_pressure_test',
    title: 'Flush, Leak & Pressure Test',
    description: 'Prove the system is clean, sealed and operational before final cover.',
    purpose: 'Prove the system is clean, sealed and operational before final cover.',
    requiredEvidence: ['Flush photo/video', 'Leak test note', 'Pressure/flow notes', 'Valve box running photo'],
    criticalFails: ['Any leak', 'Blocked line', 'Dirty filter after final test', 'Failure to retest after repair'],
    items: [
      item('valve_box_leaks', 'Valve box checked for leaks', { requirePhoto: true, criticalOnFail: true }),
      item('main_connection_leaks', 'Main connection point checked for leaks', { requirePhoto: true, criticalOnFail: true }),
      item('meter_checked', 'Water meter checked where possible to identify unwanted flow when system is off', { allowNa: true, requireSupervisorOnFail: true }),
      item('defects_fixed_retested', 'Defects fixed and retested', { allowNa: true, requirePhoto: true, criticalOnFail: true, noteRequiredWhen: ['pass', 'fail', 'not_required'] }),
    ],
  },
  {
    code: 'reinstatement',
    title: 'Reinstatement',
    description: 'Make sure the system is covered without damaging it.',
    purpose: 'Make sure the system is covered without damaging it.',
    requiredEvidence: ['Before-and-after photos', 'Final access point photos'],
    criticalFails: ['Backfill before clearance', 'Buried valve/flush point', 'Damage hidden or not escalated'],
    items: [
      item('surfaces_cleaned', 'Existing surfaces cleaned', { requirePhoto: true, requireSupervisorOnFail: true }),
      item('plants_lawn_tidy', 'Existing plants, lawn and garden areas left tidy', { requirePhoto: true, requireSupervisorOnFail: true }),
      item('damage_recorded', 'Any damage recorded and escalated', { allowNa: true, requirePhoto: true, criticalOnFail: true, noteRequiredWhen: ['pass', 'fail', 'not_required'] }),
    ],
  },
  {
    code: 'as_built_client_handover',
    title: 'As-Built Record & Client Handover',
    description: 'Leave a usable record, not just a working system.',
    purpose: 'Leave a usable record, not just a working system.',
    requiredEvidence: ['As-built image/plan', 'Controller label photo', 'Handover notes'],
    criticalFails: ['No zone map', 'No controller labels', 'Client cannot reasonably operate system'],
    items: [
      item('as_built_zone_map', 'As-built zone map completed', { requireMarkedImage: true, requirePhoto: true, criticalOnFail: true }),
      item('valve_box_locations', 'Valve box location/s recorded', { requireMarkedImage: true, requirePhoto: true, criticalOnFail: true }),
      item('sleeve_locations', 'Sleeve locations recorded', { requireMarkedImage: true, requirePhoto: true, criticalOnFail: true }),
      item('isolation_location', 'Isolation valve location recorded', { requireMarkedImage: true, requirePhoto: true, criticalOnFail: true }),
      item('controller_program_recorded', 'Controller program recorded', { noteRequiredWhen: ['pass', 'fail'], criticalOnFail: true }),
      item('zone_names_match', 'Zone names match controller labels', { requirePhoto: true, criticalOnFail: true }),
      item('client_shown_system', 'Client shown how to run system', { criticalOnFail: true, noteRequiredWhen: ['pass', 'fail'] }),
      item('client_watch_items', 'Client told what to watch for: leaks, dry patches, overspray, blocked emitters, flat batteries if applicable', { noteRequiredWhen: ['pass', 'fail'], requireSupervisorOnFail: true }),
    ],
  },
  {
    code: 'supervisor_final_approval',
    title: 'Supervisor Final Approval',
    description: 'Final supervisor sign-off only after all applicable irrigation QA evidence is complete.',
    purpose: 'Final supervisor sign-off only after all applicable irrigation QA evidence is complete.',
    requiredEvidence: ['All sections cleared', 'All required photos, notes and marked-up images complete', 'Controller, zones, labels and handover records complete'],
    criticalFails: ['Required evidence incomplete', 'Open upstream issue', 'Before-cover evidence missing', 'Controller/handover records incomplete'],
    items: [
      item('all_sections_reviewed', 'Every applicable section is cleared', { criticalOnFail: true }),
      item('required_evidence_complete', 'Every required photo, note and marked-up image is complete', { criticalOnFail: true }),
      item('issues_closed_or_approved', 'All issues are resolved, rectified and approved, or explicitly supervisor-approved to proceed', { criticalOnFail: true }),
      item('before_cover_evidence', 'All before-cover evidence was captured before cover', { criticalOnFail: true }),
      item('handover_complete', 'Controller, zones, labels and handover records are complete', { criticalOnFail: true }),
    ],
  },
];

const SECTION_BY_CODE = new Map<IrrigationSectionCode, IrrigationCatalogueSection>(
  ALL_SECTIONS.map((section) => [section.code, section])
);

export function getApplicableIrrigationSectionCodes(setup: IrrigationQaSetupV1): IrrigationSectionCode[] {
  const systemTypes = setup.system_types;
  const hasOnlyController =
    systemTypes.includes('controller_only') &&
    systemTypes.every((type) => type === 'controller_only');
  const includeDripline = !hasOnlyController && (
    systemTypes.includes('garden_bed_dripline') ||
    systemTypes.includes('pots') ||
    systemTypes.includes('trees') ||
    systemTypes.includes('mixed_system')
  );
  const includeSpray = !hasOnlyController && (
    systemTypes.includes('lawn_sprays_rotors') ||
    systemTypes.includes('mixed_system')
  );

  const codes: IrrigationSectionCode[] = [
    'setup_scope_protection',
    'water_source_backflow_pressure_flow',
    'layout_hydrozones_materials',
  ];

  if (!hasOnlyController) {
    codes.push(
      'sleeving_before_hardscape_cover',
      'trenching_pipework_before_backfill',
      'valve_box_solenoids_manifold'
    );
    if (includeDripline) codes.push('dripline_installation');
    if (includeSpray) codes.push('spray_rotor_installation');
  }

  codes.push(
    'controller_wiring_sensors',
    'flush_leak_pressure_test',
    'reinstatement',
    'as_built_client_handover',
    'supervisor_final_approval'
  );

  return codes;
}

export function getIrrigationSectionDefinition(code: IrrigationSectionCode): IrrigationCatalogueSection | undefined {
  return SECTION_BY_CODE.get(code);
}

export function getIrrigationSectionsForSetup(setup: IrrigationQaSetupV1): IrrigationCatalogueSection[] {
  return getApplicableIrrigationSectionCodes(setup)
    .map((code) => SECTION_BY_CODE.get(code))
    .filter((section): section is IrrigationCatalogueSection => Boolean(section));
}

export function isIrrigationSectionCode(value: string): value is IrrigationSectionCode {
  return SECTION_BY_CODE.has(value as IrrigationSectionCode);
}

export function allIrrigationSectionCodes(): IrrigationSectionCode[] {
  return ALL_SECTIONS.map((section) => section.code);
}
