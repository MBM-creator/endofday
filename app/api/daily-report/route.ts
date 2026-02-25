import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const BUCKET = 'daily-reports';
const NOTIFY_EMAIL = 'steve@madebymobbs.com.au';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

console.log('API using SUPABASE_URL =', process.env.SUPABASE_URL);
console.log('orgSlug received =', String(formData.get('orgSlug')));

    // Fields
    const orgSlug = String(formData.get('orgSlug') ?? '').trim();
    const crewName = String(formData.get('crewName') ?? '').trim();
    const siteNumber = String(formData.get('siteNumber') ?? '').trim();
    const summary = String(formData.get('summary') ?? '').trim();
    const finishedPlanRaw = String(formData.get('finishedPlan') ?? '').trim();
    const notFinishedWhy = String(formData.get('notFinishedWhy') ?? '').trim();
    const catchupPlan = String(formData.get('catchupPlan') ?? '').trim();
    const siteLeftCleanRaw = String(formData.get('siteLeftClean') ?? '').trim();

    // Photos
    const photos = (formData.getAll('photos') as File[]).filter(
      (f) => f instanceof File && f.size > 0
    );

    // Validation
    if (!orgSlug) return jsonError('Organisation is required');
    if (!crewName) return jsonError('Crew name is required');
    if (!siteNumber) return jsonError('Site Number / Name is required');
    if (!summary) return jsonError("Today's summary is required");

    if (finishedPlanRaw !== 'true' && finishedPlanRaw !== 'false') {
      return jsonError('Please indicate if you finished everything planned today');
    }
    const finishedPlanBool = finishedPlanRaw === 'true';

    if (!finishedPlanBool) {
      if (!notFinishedWhy) return jsonError('Please explain what was not finished and why');
      if (!catchupPlan) return jsonError('Please provide a plan to make up the lost time');
    }

    if (siteLeftCleanRaw !== 'true' && siteLeftCleanRaw !== 'false') {
      return jsonError('Please indicate if the site was left clean / tools in site box / materials under cover');
    }
    const siteLeftCleanBool = siteLeftCleanRaw === 'true';


    if (photos.length < 3 || photos.length > 10) {
      return jsonError('Must upload between 3 and 10 photos');
    }

    // Validate organisation exists
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organisations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (orgError || !org) {
      console.error('Org lookup failed:', { orgSlug, orgError, org });
      return NextResponse.json(
        {
          ok: false,
          message: process.env.NODE_ENV === 'development' && orgError
            ? `Invalid organisation: ${orgError.message}`
            : 'Invalid organisation',
        },
        { status: 404 }
      );
    }

    // Site Number/Name is free text (no lookup); later can link to Client Connect / sites
    // Create daily report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('daily_reports')
      .insert({
        organisation_id: org.id,
        site_id: null,
        site_identifier: siteNumber,
        crew_name: crewName,
        summary,
        finished_plan: finishedPlanBool,
        not_finished_why: finishedPlanBool ? null : notFinishedWhy,
        catchup_plan: finishedPlanBool ? null : catchupPlan,
        site_left_clean_notes: siteLeftCleanBool ? 'Yes' : 'No',
      })
      .select('id')
      .single();

    if (reportError || !report) {
      console.error('Error creating report:', reportError);
      return jsonError('Failed to create report', 500);
    }

    // Upload photos (require ALL selected photos succeed)
    const uploadedPaths: string[] = [];

    for (const photo of photos) {
      const fileExt = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${randomUUID()}.${fileExt}`;
      const storagePath = `${orgSlug}/${report.id}/${fileName}`;

      const arrayBuffer = await photo.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: photo.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading photo:', uploadError);

        // Cleanup anything uploaded so far + rollback report
        for (const path of uploadedPaths) {
          await supabaseAdmin.storage.from(BUCKET).remove([path]);
        }
        await supabaseAdmin.from('daily_reports').delete().eq('id', report.id);

        return jsonError('Failed to upload all photos. Please try again.', 500);
      }

      uploadedPaths.push(storagePath);
    }

    // Create photo records
    const photoRecords = uploadedPaths.map((path) => ({
      report_id: report.id,
      storage_path: path,
    }));

    const { error: photosError } = await supabaseAdmin
      .from('daily_report_photos')
      .insert(photoRecords);

    if (photosError) {
      console.error('Error creating photo records:', photosError);

      // Cleanup storage + rollback report to avoid orphaned files
      await supabaseAdmin.storage.from(BUCKET).remove(uploadedPaths);
      await supabaseAdmin.from('daily_reports').delete().eq('id', report.id);

      return jsonError('Failed to save photo records. Please try again.', 500);
    }

    // Build photo links (signed URLs, valid 7 days, so they work for private buckets)
    const signedUrlExpiry = 60 * 60 * 24 * 7; // 7 days
    const photoLinks: string[] = [];
    for (const path of uploadedPaths) {
      const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, signedUrlExpiry);
      if (signed?.signedUrl) photoLinks.push(signed.signedUrl);
    }

    // Send notification email via Resend (non-blocking; report already saved)
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'Daily Reports <onboarding@resend.dev>';
    let emailSent = false;
    let emailError: string | null = null;

    if (!apiKey) {
      console.warn('[daily-report] RESEND_API_KEY not set; skipping notification email. Set it in Vercel (Production) → Settings → Environment Variables.');
    } else {
      const resend = new Resend(apiKey);
      const photoListHtml =
        photoLinks.length > 0
          ? '<p><strong>Photos (' +
            photoLinks.length +
            '):</strong></p><ul>' +
            photoLinks.map((url, i) => '<li><a href="' + escapeHtml(url) + '">Photo ' + (i + 1) + '</a></li>').join('') +
            '</ul><p><em>Links expire in 7 days.</em></p>'
          : '<p><em>Report ID: ' + report.id + ' – ' + photos.length + ' photo(s) in storage (links could not be generated).</em></p>';
      const html = [
        '<h2>New daily report submitted</h2>',
        '<p><strong>Organisation:</strong> ' + escapeHtml(orgSlug) + '</p>',
        '<p><strong>Crew:</strong> ' + escapeHtml(crewName) + '</p>',
        '<p><strong>Site:</strong> ' + escapeHtml(siteNumber) + '</p>',
        '<p><strong>Summary:</strong></p><p>' + escapeHtml(summary) + '</p>',
        '<p><strong>Finished everything planned?</strong> ' + (finishedPlanBool ? 'Yes' : 'No') + '</p>',
        ...(finishedPlanBool
          ? []
          : [
              '<p><strong>What was not finished and why:</strong></p><p>' + escapeHtml(notFinishedWhy) + '</p>',
              '<p><strong>Plan to make up time:</strong></p><p>' + escapeHtml(catchupPlan) + '</p>',
            ]),
        '<p><strong>Site left clean / tools in box / materials under cover?</strong> ' + (siteLeftCleanBool ? 'Yes' : 'No') + '</p>',
        photoListHtml,
        '<p><em>Report ID: ' + report.id + '</em></p>',
      ].join('');
      try {
        console.log('[daily-report] Sending Resend email to', NOTIFY_EMAIL, 'from', fromEmail);
        const result = await resend.emails.send({
          from: fromEmail,
          to: [NOTIFY_EMAIL],
          subject: `Daily report: ${siteNumber} – ${crewName}`,
          html,
        });
        if (result.error) {
          emailError = typeof result.error === 'object' && result.error !== null && 'message' in result.error ? String((result.error as { message: unknown }).message) : JSON.stringify(result.error);
          console.error('[daily-report] Resend email error:', result.error);
        } else {
          emailSent = true;
          console.log('[daily-report] Resend email sent successfully, id:', (result as { data?: { id?: string } }).data?.id);
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : String(err);
        console.error('[daily-report] Failed to send notification email:', err);
      }
    }

    return NextResponse.json({
      ok: true,
      reportId: report.id,
      emailSent,
      ...(emailError && { emailError }),
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return jsonError('Internal server error', 500);
  }
}
