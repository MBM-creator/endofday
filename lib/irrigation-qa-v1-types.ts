export type IrrigationQaType =
  | 'new_install'
  | 'extension'
  | 'repair'
  | 'controller_upgrade'
  | 'maintenance';

export type IrrigationWaterSource =
  | 'potable_mains'
  | 'recycled_water'
  | 'rainwater_tank'
  | 'pump'
  | 'existing_irrigation_system'
  | 'other';

export type IrrigationSystemType =
  | 'garden_bed_dripline'
  | 'lawn_sprays_rotors'
  | 'pots'
  | 'trees'
  | 'mixed_system'
  | 'controller_only';

export type IrrigationQaSetupV1 = {
  setup_version: 1;
  irrigation_type: IrrigationQaType;
  water_sources: IrrigationWaterSource[];
  system_types: IrrigationSystemType[];
  supervisor_notes?: string;
};

export const IRRIGATION_QA_TYPES: IrrigationQaType[] = [
  'new_install',
  'extension',
  'repair',
  'controller_upgrade',
  'maintenance',
];

export const IRRIGATION_WATER_SOURCES: IrrigationWaterSource[] = [
  'potable_mains',
  'recycled_water',
  'rainwater_tank',
  'pump',
  'existing_irrigation_system',
  'other',
];

export const IRRIGATION_SYSTEM_TYPES: IrrigationSystemType[] = [
  'garden_bed_dripline',
  'lawn_sprays_rotors',
  'pots',
  'trees',
  'mixed_system',
  'controller_only',
];

export const IRRIGATION_QA_TYPE_LABELS: Record<IrrigationQaType, string> = {
  new_install: 'New install',
  extension: 'Extension',
  repair: 'Repair',
  controller_upgrade: 'Controller upgrade',
  maintenance: 'Maintenance',
};

export const IRRIGATION_WATER_SOURCE_LABELS: Record<IrrigationWaterSource, string> = {
  potable_mains: 'Potable mains',
  recycled_water: 'Recycled water',
  rainwater_tank: 'Rainwater tank',
  pump: 'Pump',
  existing_irrigation_system: 'Existing irrigation system',
  other: 'Other',
};

export const IRRIGATION_SYSTEM_TYPE_LABELS: Record<IrrigationSystemType, string> = {
  garden_bed_dripline: 'Garden bed dripline',
  lawn_sprays_rotors: 'Lawn sprays/rotors',
  pots: 'Pots',
  trees: 'Trees',
  mixed_system: 'Mixed system',
  controller_only: 'Controller-only',
};
