import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const BUCKET = 'daily-reports';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
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
    const siteLeftCleanNotes = String(formData.get('siteLeftCleanNotes') ?? '').trim();

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

    if (!siteLeftCleanNotes) return jsonError('Please provide notes about site cleanliness');

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
        site_left_clean_notes: siteLeftCleanNotes,
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

    return NextResponse.json({ ok: true, reportId: report.id });
  } catch (error) {
    console.error('Unexpected error:', error);
    return jsonError('Internal server error', 500);
  }
}
