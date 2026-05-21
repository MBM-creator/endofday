import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const orgSlug = process.argv[2] ?? 'madebymobbs';

const items = [
  { type: 'tools', label: 'laser, receiver and tripod' },
  { type: 'tools', label: 'string line, pegs and marking paint' },
  { type: 'tools', label: 'plate compactor and hand tools' },
  { type: 'materials', label: 'pavers, stone or bricks checked against specification' },
  { type: 'materials', label: 'crushed rock, bedding material, mortar or adhesive on site' },
  { type: 'materials', label: 'edge restraints, geotextile and drainage materials as required' },
  { type: 'qc', label: 'set-out, levels and drainage falls verified' },
  { type: 'qc', label: 'base preparation and compaction checked' },
  { type: 'qc', label: 'bedding depth, coverage and consistency checked' },
  { type: 'qc', label: 'alignment, joints, cuts and edge restraints checked' },
  { type: 'qc', label: 'final clean-down, defects and client-facing finish checked' },
];

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('id, slug')
    .eq('slug', orgSlug)
    .single();

  if (orgError || !org) {
    throw new Error(`Organisation not found: ${orgSlug}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from('checklist_templates')
    .select('id')
    .eq('organisation_id', org.id)
    .eq('name', 'Paving')
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  let templateId = existing?.id as string | undefined;

  if (!templateId) {
    const { data: created, error: createError } = await supabase
      .from('checklist_templates')
      .insert({
        organisation_id: org.id,
        name: 'Paving',
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (createError || !created) {
      throw createError ?? new Error('Failed to create Paving template');
    }
    templateId = created.id as string;
  }

  const { error: replaceError } = await supabase.rpc('replace_checklist_template_items', {
    p_template_id: templateId,
    p_items: items,
  });

  if (replaceError) {
    throw replaceError;
  }

  const { error: updateError } = await supabase
    .from('checklist_templates')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', templateId);

  if (updateError) {
    throw updateError;
  }

  console.log(`Ensured Paving checklist template for ${org.slug}: ${templateId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
