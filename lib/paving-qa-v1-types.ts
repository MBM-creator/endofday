export type PavingInstallMethod = 'crushed_rock_wet_bed' | 'concrete_adhesive';

export type PavingMaterialType = 'consistent_thickness' | 'variable_thickness_natural_stone';

export type PavingQaSetup = {
  install_method: PavingInstallMethod;
  material_type: PavingMaterialType;
  is_driveway: boolean;
  is_pool_area: boolean;
  has_steps: boolean;
  is_crossover: boolean;
};

export type PavingSectionCode =
  | 'setup_protection'
  | 'setout_drainage'
  | 'crushed_rock_base'
  | 'wet_bed'
  | 'concrete_slab_prep'
  | 'adhesive_fixing'
  | 'material_consistent'
  | 'material_variable'
  | 'driveway_addon'
  | 'final_qa';

export type ItemResult = 'pass' | 'fail' | 'na';

export type IssueStatus =
  | 'open'
  | 'rectification_required'
  | 'evidence_requested'
  | 'resolved_approved'
  | 'proceed_approved';

export type IssueSeverity = 'critical' | 'non_critical';

export type SubmissionStatus = 'draft' | 'submitted' | 'returned';

export type SupervisorAction =
  | 'request_evidence'
  | 'require_rectification'
  | 'approve_rectification'
  | 'approve_to_proceed'
  | 'final_approval';
