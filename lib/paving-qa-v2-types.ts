export type PavingInstallMethodV2 =
  | 'crushed_rock_wet_bed'
  | 'concrete_base_wet_bed'
  | 'glue_new_concrete'
  | 'glue_existing_concrete'
  | 'other_mixed';

export type PavingMaterialTypeV2 =
  | 'consistent_thickness'
  | 'variable_thickness_natural_stone'
  | 'steppers'
  | 'mixed_materials';

export type PavingAreaUse =
  | 'pedestrian_only'
  | 'entertaining_area'
  | 'pool_surround'
  | 'driveway_vehicle_traffic'
  | 'stepping_path'
  | 'other';

export type PavingQaSetupV2 = {
  setup_version: 2;
  install_method: PavingInstallMethodV2;
  material_type: PavingMaterialTypeV2;
  area_uses: PavingAreaUse[];
  /** Required when install_method === 'other_mixed' */
  other_install_method_note?: string;
  /** Required when area_uses includes 'other' */
  other_area_use_note?: string;
  /** Free-form notes from the supervising staff member */
  supervisor_notes?: string;
};

export const PAVING_INSTALL_METHODS_V2: PavingInstallMethodV2[] = [
  'crushed_rock_wet_bed',
  'concrete_base_wet_bed',
  'glue_new_concrete',
  'glue_existing_concrete',
  'other_mixed',
];

export const PAVING_MATERIAL_TYPES_V2: PavingMaterialTypeV2[] = [
  'consistent_thickness',
  'variable_thickness_natural_stone',
  'steppers',
  'mixed_materials',
];

export const PAVING_AREA_USES: PavingAreaUse[] = [
  'pedestrian_only',
  'entertaining_area',
  'pool_surround',
  'driveway_vehicle_traffic',
  'stepping_path',
  'other',
];

export const PAVING_INSTALL_METHOD_LABELS_V2: Record<PavingInstallMethodV2, string> = {
  crushed_rock_wet_bed: 'Crushed rock base + wet bed',
  concrete_base_wet_bed: 'Concrete base + wet bed',
  glue_new_concrete: 'Glue onto new concrete',
  glue_existing_concrete: 'Glue onto existing concrete',
  other_mixed: 'Other / mixed method',
};

export const PAVING_MATERIAL_TYPE_LABELS_V2: Record<PavingMaterialTypeV2, string> = {
  consistent_thickness: 'Consistent thickness pavers / stone / bricks',
  variable_thickness_natural_stone: 'Natural split stone / variable thickness stone',
  steppers: 'Steppers',
  mixed_materials: 'Mixed material types',
};

export const PAVING_AREA_USE_LABELS: Record<PavingAreaUse, string> = {
  pedestrian_only: 'Pedestrian only',
  entertaining_area: 'Entertaining area',
  pool_surround: 'Pool surround',
  driveway_vehicle_traffic: 'Driveway / vehicle traffic',
  stepping_path: 'Stepping path',
  other: 'Other',
};
