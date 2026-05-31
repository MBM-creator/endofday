import type { FencingQaSetupV1 } from './fencing-qa-v1-types';

export type FencingSectionCode =
  | 'setup_protection'
  | 'setout_boundary_height'
  | 'existing_fence_removal'
  | 'post_holes_before_concrete'
  | 'posts_installed_concreted'
  | 'rails_frame_plinth'
  | 'paling_installation'
  | 'picket_layout_first_section'
  | 'picket_installation'
  | 'gate_installation'
  | 'capping_finish'
  | 'final_completion';

export type FencingCatalogueItem = {
  key: string;
  label: string;
  allowNa: boolean;
  requirePhoto: boolean;
  requireMarkedImage: boolean;
  photoOnly?: boolean;
  criticalOnFail: boolean;
  requireSupervisorOnFail: boolean;
  noteRequiredWhen?: ('pass' | 'fail' | 'not_required')[];
  notePrompt?: string;
  staffNote?: string;
};

export type FencingCatalogueSection = {
  code: FencingSectionCode;
  title: string;
  description: string;
  purpose: string;
  requiredEvidence: string[];
  criticalFails: string[];
  items: FencingCatalogueItem[];
};

function item(key: string, label: string, opts: Partial<FencingCatalogueItem> = {}): FencingCatalogueItem {
  return {
    key,
    label,
    allowNa: opts.allowNa ?? false,
    requirePhoto: opts.requirePhoto ?? false,
    requireMarkedImage: opts.requireMarkedImage ?? false,
    photoOnly: opts.photoOnly ?? false,
    criticalOnFail: opts.criticalOnFail ?? false,
    requireSupervisorOnFail: opts.requireSupervisorOnFail ?? false,
    noteRequiredWhen: opts.noteRequiredWhen,
    notePrompt: opts.notePrompt,
    staffNote: opts.staffNote,
  };
}

const ALL_SECTIONS: FencingCatalogueSection[] = [
  {
    code: 'setup_protection',
    title: 'Pre-start / property protection',
    description: 'Record site condition and protect client and neighbouring property before fencing work starts.',
    purpose: 'Confirm protection, access, boundary and service risks before demolition, set-out or digging.',
    requiredEvidence: ['Existing site/fence condition', 'Client property protection', 'Neighbouring property protection where relevant'],
    criticalFails: ['Existing damage not recorded', 'Protection missing', 'Service or boundary risk unresolved'],
    items: [
      item('existing_site_condition', 'Existing site/fence condition photographed', { requirePhoto: true, photoOnly: true }),
      item('client_property_protection', 'Client property protection installed before demolition or digging', { allowNa: true, requirePhoto: true, criticalOnFail: true }),
      item('neighbour_property_protection', 'Neighbouring property protection installed where relevant', { allowNa: true, requirePhoto: true, criticalOnFail: true }),
      item('services_risks_noted', 'Known services, irrigation, lighting and drainage risks noted', { criticalOnFail: true, noteRequiredWhen: ['pass', 'fail'] }),
      item('no_unresolved_prestart_issue', 'No unresolved access, boundary, service or property damage issue', { criticalOnFail: true, noteRequiredWhen: ['fail'] }),
    ],
  },
  {
    code: 'setout_boundary_height',
    title: 'Set-out / boundary / finished height',
    description: 'Confirm the fence line, boundary position, finished height, post spacing and gate opening where relevant.',
    purpose: 'Lock in the line and height before post holes are dug.',
    requiredEvidence: ['Start, end, corners and returns', 'Boundary position', 'Finished height', 'Post spacing', 'Gate opening if relevant'],
    criticalFails: ['Set-out not confirmed', 'Boundary not confirmed', 'Finished height unclear', 'Gate opening wrong'],
    items: [
      item('start_end_corners_returns', 'Start, end, corners and returns confirmed', { criticalOnFail: true }),
      item('boundary_confirmed', 'Boundary position confirmed or supervisor-approved', {
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'How was the boundary line confirmed?',
      }),
      item('finished_height_confirmed', 'Finished height confirmed', {
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'What is the planned finished height?',
      }),
      item('post_spacing_setout', 'Post spacing set out', {
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'Distance between posts (max 2.7m allowed)',
      }),
      item('gate_opening_confirmed', 'Gate opening confirmed where relevant', { requirePhoto: true, criticalOnFail: true }),
    ],
  },
  {
    code: 'existing_fence_removal',
    title: 'Existing fence removal / site clearance',
    description: 'Confirm the existing fence has been removed cleanly and the site is ready for post holes.',
    purpose: 'Prevent hidden damage or waste issues before new fencing work proceeds.',
    requiredEvidence: ['Fence removed', 'Waste removed', 'Ground line exposed', 'Unexpected issues photographed'],
    criticalFails: ['Waste uncontrolled', 'Neighbouring property damaged', 'Ground line not exposed', 'Site not ready for post holes'],
    items: [
      item('fence_removed', 'Existing fence removed cleanly', { criticalOnFail: true }),
      item('waste_controlled', 'Waste removed', { criticalOnFail: true }),
      item('ground_line_exposed', 'Ground line exposed and ready for post holes', { criticalOnFail: true }),
      item('neighbour_property_not_damaged', 'Neighbouring property not damaged', { criticalOnFail: true, noteRequiredWhen: ['fail'] }),
      item('unexpected_issues_photographed', 'Unexpected issues photographed and noted', { allowNa: true, requirePhoto: true, requireSupervisorOnFail: true, noteRequiredWhen: ['pass', 'fail'] }),
    ],
  },
  {
    code: 'post_holes_before_concrete',
    title: 'Post holes before concrete',
    description: 'Verify hole locations, size, ground conditions and service/root obstructions before posts are set.',
    purpose: 'Confirm the post holes suit the approved set-out and fence type before concrete is placed.',
    requiredEvidence: ['Hole locations along stringline', 'Representative hole depth/diameter', 'End/corner/gate post holes'],
    criticalFails: ['Holes off line', 'Depth/diameter unsuitable', 'Gate/end/corner allowance missing'],
    items: [
      item('holes_along_stringline', 'Hole locations align with approved stringline', { requirePhoto: true, criticalOnFail: true }),
      item('representative_depth_diameter', 'Representative hole depth/diameter photographed', { requirePhoto: true, criticalOnFail: true, noteRequiredWhen: ['pass', 'fail'] }),
      item('spacing_suits_fence_type', 'Hole spacing suits fence type', { criticalOnFail: true }),
      item('end_corner_gate_holes', 'End/corner/gate post holes allowed for where relevant', { allowNa: true, requirePhoto: true, criticalOnFail: true }),
    ],
  },
  {
    code: 'posts_installed_concreted',
    title: 'Posts installed / concreted',
    description: 'Confirm posts are aligned, plumb and concreted before rails or framing proceed.',
    purpose: 'Make sure the frame has a straight and secure post base.',
    requiredEvidence: ['Stringline alignment', 'Level/plumb check', 'Concrete around posts', 'Gate posts where relevant'],
    criticalFails: ['Posts out of plumb', 'Posts off line', 'Gate posts misplaced', 'Posts not secure and stable'],
    items: [
      item('stringline_alignment', 'Posts aligned to stringline', { requirePhoto: true, criticalOnFail: true }),
      item('plumb_level_check', 'Level/plumb check completed', { requirePhoto: true, criticalOnFail: true }),
      item('concrete_around_posts', 'Concrete placed around posts', { requirePhoto: true, criticalOnFail: true }),
      item('gate_posts_correct', 'Gate posts correctly located where relevant', { requirePhoto: true, criticalOnFail: true }),
      item('posts_secure_to_continue', 'Post secure and stable', { criticalOnFail: true }),
    ],
  },
  {
    code: 'rails_frame_plinth',
    title: 'Rails / frame / plinth',
    description: 'Check rails, frame, fixings and plinth where selected before cladding starts.',
    purpose: 'Confirm the frame is straight, secure and ready for palings or pickets.',
    requiredEvidence: ['Rail heights', 'Rail fixings', 'Plinth board if selected', 'Gate frame structure if relevant'],
    criticalFails: ['Rails not straight', 'Rail heights unsuitable', 'Fixings insecure', 'Plinth missing where selected'],
    items: [
      item('rail_heights', 'Rail heights suit paling or picket layout', { requirePhoto: true, criticalOnFail: true }),
      item('rails_straight_level_raked', 'Rails straight and consistently level/raked', { criticalOnFail: true }),
      item('rail_fixings_secure', 'Rails securely fixed', { criticalOnFail: true }),
      item('plinth_installed', 'Plinth installed where selected', { allowNa: true, requirePhoto: true, criticalOnFail: true }),
      item('gate_frame_structure', 'Gate frame structure ready where relevant', { requirePhoto: true, criticalOnFail: true }),
    ],
  },
  {
    code: 'paling_installation',
    title: 'Paling installation',
    description: 'Check paling side, overlap/layout, fixing pattern, lines and representative finished section.',
    purpose: 'Confirm the paling face is installed consistently before capping or final review.',
    requiredEvidence: ['Paling overlap/spacing detail', 'Corners/ends/returns'],
    criticalFails: ['Wrong facing side', 'Inconsistent overlap/layout or height', 'Damaged palings installed'],
    items: [
      item('correct_side_facing', 'Palings installed to correct side/facing', { criticalOnFail: true }),
      item('overlap_spacing_detail', 'Paling overlap/layout is correct and height is consistent', { requirePhoto: true, criticalOnFail: true }),
      item('corners_ends_returns', 'Corners, ends and returns finished correctly', { requirePhoto: true, criticalOnFail: true }),
      item('no_damaged_palings', 'No damaged or unsuitable palings installed', { criticalOnFail: true }),
    ],
  },
  {
    code: 'picket_layout_first_section',
    title: 'Picket layout / first section',
    description: 'Confirm spacing, height, top profile, bottom clearance and visual end spacing before full install.',
    purpose: 'Lock in picket layout before repetition across the run.',
    requiredEvidence: ['First section set out', 'Picket spacing sample', 'Height reference', 'Top profile/line', 'Bottom clearance'],
    criticalFails: ['Spacing not confirmed', 'Height wrong', 'Top profile wrong', 'Bottom clearance unacceptable', 'End spacing poor'],
    items: [
      item('first_section_setout', 'First section set out and photographed', { requirePhoto: true, criticalOnFail: true }),
      item('spacing_sample', 'Picket spacing sample confirmed', { requirePhoto: true, criticalOnFail: true }),
      item('height_reference', 'Height reference confirmed', { requirePhoto: true, criticalOnFail: true }),
      item('top_profile_line', 'Top profile/line matches scope', { requirePhoto: true, criticalOnFail: true }),
      item('bottom_clearance', 'Bottom clearance acceptable', { requirePhoto: true, criticalOnFail: true }),
      item('end_spacing', 'End spacing visually acceptable', { criticalOnFail: true }),
    ],
  },
  {
    code: 'picket_installation',
    title: 'Picket installation',
    description: 'Check full picket installation for plumb, spacing, top line, fixings and finished elevation.',
    purpose: 'Confirm the completed picket face is consistent before final review.',
    requiredEvidence: ['Progress photos along fence', 'Spacing consistency', 'Fixing detail', 'Ends/corners/returns', 'Completed finished elevation'],
    criticalFails: ['Pickets not plumb', 'Spacing inconsistent', 'Top line inconsistent', 'Fixings poor', 'Damaged pickets installed'],
    items: [
      item('progress_along_fence', 'Progress photos captured along fence', { requirePhoto: true, criticalOnFail: true }),
      item('pickets_plumb', 'Pickets plumb', { criticalOnFail: true }),
      item('spacing_consistent', 'Spacing consistent', { requirePhoto: true, criticalOnFail: true }),
      item('top_line_profile', 'Top line/profile consistent', { requirePhoto: true, criticalOnFail: true }),
      item('fixing_detail', 'Fixings neat and consistent', { requirePhoto: true, criticalOnFail: true }),
      item('ends_corners_returns', 'Ends, corners and returns completed neatly', { requirePhoto: true, criticalOnFail: true }),
      item('finished_elevation', 'Completed finished elevation photographed', { requirePhoto: true, criticalOnFail: true }),
      item('no_damaged_pickets', 'No damaged pickets installed', { criticalOnFail: true }),
    ],
  },
  {
    code: 'gate_installation',
    title: 'Gate posts / gate / hardware',
    description: 'Confirm gate posts, hardware, clearances, swing and alignment.',
    purpose: 'Make sure gate operation is correct before final supervisor review.',
    requiredEvidence: ['Gate opening', 'Gate posts', 'Hinges', 'Latch', 'Clearances', 'Gate open and closed'],
    criticalFails: ['Gate posts not solid', 'Swing direction wrong', 'Hardware fixed incorrectly', 'Gate binds', 'Clearances unacceptable'],
    items: [
      item('gate_opening', 'Gate opening photographed', { requirePhoto: true, criticalOnFail: true }),
      item('gate_posts', 'Gate posts plumb and solid', { requirePhoto: true, criticalOnFail: true }),
      item('hinges', 'Hinges fixed correctly', { requirePhoto: true, criticalOnFail: true }),
      item('latch', 'Latch fixed correctly', { requirePhoto: true, criticalOnFail: true }),
      item('clearances', 'Gate clearances acceptable', { requirePhoto: true, criticalOnFail: true }),
      item('open_closed', 'Gate photographed open and closed', { requirePhoto: true, criticalOnFail: true }),
      item('swing_no_binding', 'Gate opens and closes without binding', { criticalOnFail: true }),
      item('aligns_with_fence', 'Gate aligns with fence', { criticalOnFail: true }),
    ],
  },
  {
    code: 'capping_finish',
    title: 'Finish',
    description: 'Confirm capping and finish/coating details where selected.',
    purpose: 'Verify finishing works before final supervisor review.',
    requiredEvidence: ['Capping installed if selected', 'Paint/stain if selected', 'Finished surfaces', 'Adjacent surfaces protected'],
    criticalFails: ['Capping not straight or secure', 'Product mismatch', 'Coating uneven', 'Adjacent damage'],
    items: [
      item('capping_installed', 'Capping installed where selected', { requirePhoto: true, criticalOnFail: true }),
      item('product_used', 'Paint / Stain matches scope where coating/finish', {
        requirePhoto: true,
        criticalOnFail: true,
        noteRequiredWhen: ['pass', 'fail'],
        notePrompt: 'What paint/stain colour or finish is being used?',
      }),
      item('adjacent_surfaces_protected', 'Adjacent surfaces protected', { requirePhoto: true, criticalOnFail: true }),
      item('finished_surfaces', 'Finished surfaces acceptable', { requirePhoto: true, criticalOnFail: true }),
      item('no_misses_drips_damage', 'No obvious misses, drips or damage', { criticalOnFail: true }),
    ],
  },
  {
    code: 'final_completion',
    title: 'Final supervisor review',
    description: 'Confirm the finished fence, gates, cleanliness, waste removal and scope completion.',
    purpose: 'Final approval is blocked until every applicable section is cleared and no defects remain unresolved.',
    requiredEvidence: ['Full fence from both ends', 'Front/back faces where accessible', 'Corners/returns', 'Gates open/closed where relevant', 'Cleaned work area', 'Waste removed'],
    criticalFails: ['Fence line not acceptable', 'Finished height inconsistent', 'Posts/rails/cladding insecure', 'Gate fault unresolved', 'Site not clean', 'Scope incomplete'],
    items: [
      item('full_fence_both_ends', 'Full fence photographed from both ends', { requirePhoto: true, criticalOnFail: true }),
      item('front_back_faces', 'Front/back faces photographed where accessible', { allowNa: true, requirePhoto: true, criticalOnFail: true }),
      item('corners_returns', 'Corners and returns photographed', { requirePhoto: true, criticalOnFail: true }),
      item('gates_open_closed', 'Gates photographed open and closed where relevant', { requirePhoto: true, criticalOnFail: true }),
      item('cleaned_work_area', 'Work area clean and all waste removed', { requirePhoto: true, criticalOnFail: true }),
      item('waste_removed', 'Waste removed', { requirePhoto: true, criticalOnFail: true }),
      item('fence_line_height_acceptable', 'Fence line straight and finished height consistent', { criticalOnFail: true }),
      item('posts_rails_cladding_secure', 'Posts, rails and cladding secure', { criticalOnFail: true }),
      item('gates_operate', 'Gates operate correctly where relevant', { criticalOnFail: true }),
      item('scope_complete_no_defects', 'Scope complete with no unresolved defects', { criticalOnFail: true, noteRequiredWhen: ['fail'] }),
    ],
  },
];

const SECTION_BY_CODE = new Map<FencingSectionCode, FencingCatalogueSection>(
  ALL_SECTIONS.map((section) => [section.code, section])
);

export function getApplicableFencingSectionCodes(setup: FencingQaSetupV1): FencingSectionCode[] {
  const codes: FencingSectionCode[] = ['setup_protection', 'setout_boundary_height'];

  if (setup.existing_fence_removal) codes.push('existing_fence_removal');

  codes.push('post_holes_before_concrete', 'posts_installed_concreted', 'rails_frame_plinth');

  if (setup.fence_type === 'paling') {
    codes.push('paling_installation');
  } else {
    codes.push('picket_layout_first_section', 'picket_installation');
  }

  if (setup.gate) codes.push('gate_installation');
  if (setup.capping || setup.finish_coating) codes.push('capping_finish');

  codes.push('final_completion');
  return codes;
}

export function getFencingSectionDefinition(code: FencingSectionCode): FencingCatalogueSection | undefined {
  return SECTION_BY_CODE.get(code);
}

const GATE_GATED_ITEM_KEYS = new Set([
  'gate_opening_confirmed',
  'gate_posts_correct',
  'gate_frame_structure',
  'gates_open_closed',
  'gates_operate',
]);

export function getFencingSectionItemsForSetup(
  code: FencingSectionCode,
  setup: FencingQaSetupV1
): FencingCatalogueItem[] {
  const base = getFencingSectionDefinition(code)?.items ?? [];
  return base.filter((item) => {
    if (GATE_GATED_ITEM_KEYS.has(item.key)) return setup.gate;
    if (item.key === 'capping_installed') return setup.capping;
    if (item.key === 'product_used') return setup.finish_coating;
    return true;
  });
}

export function getFencingSectionsForSetup(setup: FencingQaSetupV1): FencingCatalogueSection[] {
  return getApplicableFencingSectionCodes(setup)
    .map((code) => SECTION_BY_CODE.get(code))
    .filter((section): section is FencingCatalogueSection => Boolean(section));
}

export function isFencingSectionCode(value: string): value is FencingSectionCode {
  return SECTION_BY_CODE.has(value as FencingSectionCode);
}

export function allFencingSectionCodes(): FencingSectionCode[] {
  return ALL_SECTIONS.map((section) => section.code);
}
