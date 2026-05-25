export type FencingFenceType = 'paling' | 'picket';

export type FencingQaSetupV1 = {
  setup_version: 1;
  fence_type: FencingFenceType;
  existing_fence_removal: boolean;
  gate: boolean;
  plinth: boolean;
  capping: boolean;
  finish_coating: boolean;
  supervisor_notes?: string;
};

export const FENCING_FENCE_TYPES: FencingFenceType[] = ['paling', 'picket'];

export const FENCING_FENCE_TYPE_LABELS: Record<FencingFenceType, string> = {
  paling: 'Paling',
  picket: 'Picket',
};
