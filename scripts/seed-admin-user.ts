/**
 * Idempotent admin user seed for local/staging setup.
 *
 * Usage (password via env only — never commit credentials):
 *   SEED_ADMIN_EMAIL=you@example.com \
 *   SEED_ADMIN_PASSWORD='your-temp-password' \
 *   SEED_ADMIN_ORG_SLUG=madebymobbs \
 *   SEED_ADMIN_FULL_NAME='Steve Test' \
 *   npm run seed-admin-user
 *
 * TODO: Rotate the temporary password after testing.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  const orgSlug = process.env.SEED_ADMIN_ORG_SLUG?.trim() || 'madebymobbs';
  const fullName = process.env.SEED_ADMIN_FULL_NAME?.trim() || 'Admin User';

  if (!email) {
    throw new Error('SEED_ADMIN_EMAIL is required');
  }
  if (!password || password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD is required and must be at least 8 characters');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('id, slug, name')
    .eq('slug', orgSlug)
    .single();

  if (orgError || !org) {
    throw new Error(`Organisation not found: ${orgSlug}`);
  }

  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list auth users: ${listError.message}`);
  }

  const existingUser = listData.users.find((u) => u.email?.toLowerCase() === email);
  let userId = existingUser?.id;

  if (!userId) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) {
      throw new Error(`Failed to create auth user: ${createError?.message ?? 'unknown error'}`);
    }
    userId = created.user.id;
    console.log(`Created auth user ${email} (${userId})`);
  } else {
    console.log(`Auth user already exists for ${email} (${userId})`);
  }

  const { data: existingProfile, error: profileLoadError } = await supabase
    .from('staff_profiles')
    .select('id, role, active, full_name')
    .eq('id', userId)
    .eq('org_id', org.id)
    .maybeSingle();

  if (profileLoadError) {
    throw new Error(`Failed to load staff profile: ${profileLoadError.message}`);
  }

  if (existingProfile) {
    const { error: updateError } = await supabase
      .from('staff_profiles')
      .update({
        full_name: fullName,
        email,
        role: 'admin',
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .eq('org_id', org.id);

    if (updateError) {
      throw new Error(`Failed to update staff profile: ${updateError.message}`);
    }
    console.log(`Updated staff profile for ${email} → admin on ${orgSlug}`);
  } else {
    const { error: insertError } = await supabase.from('staff_profiles').insert({
      id: userId,
      org_id: org.id,
      full_name: fullName,
      email,
      role: 'admin',
      active: true,
    });

    if (insertError) {
      throw new Error(`Failed to insert staff profile: ${insertError.message}`);
    }
    console.log(`Created staff profile for ${email} → admin on ${orgSlug}`);
  }

  console.log('');
  console.log('Done. Sign in at /login then open:');
  console.log(`  /t/${orgSlug}/admin`);
  console.log('');
  console.log('TODO: Rotate the temporary password after testing.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
