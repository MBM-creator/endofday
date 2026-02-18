import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

interface FormDataFields {
  orgSlug: string;
  siteNumber: string;
  summary: string;
  finishedPlan: string;
  notFinishedWhy?: string;
  catchupPlan?: string;
  siteLeftCleanNotes: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract form fields
    const orgSlug = formData.get('orgSlug') as string;
    const siteNumber = formData.get('siteNumber') as string;
    const summary = formData.get('summary') as string;
    const finishedPlan = formData.get('finishedPlan') as string;
    const notFinishedWhy = formData.get('notFinishedWhy') as string | null;
    const catchupPlan = formData.get('catchupPlan') as string | null;
    const siteLeftCleanNotes = formData.get('siteLeftCleanNotes') as string;
    
    // Extract photos
    const photos: File[] = [];
    const photoEntries = formData.getAll('photos') as File[];
    for (const entry of photoEntries) {
      if (entry instanceof File && entry.size > 0) {
        photos.push(entry);
      }
    }

    // Validation
    if (!orgSlug || !siteNumber || !summary || !finishedPlan || !siteLeftCleanNotes) {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const finishedPlanBool = finishedPlan === 'true';
    
    if (!finishedPlanBool) {
      if (!notFinishedWhy || !catchupPlan) {
        return NextResponse.json(
          { ok: false, message: 'notFinishedWhy and catchupPlan are required when finishedPlan is false' },
          { status: 400 }
        );
      }
    }

    if (photos.length < 3 || photos.length > 10) {
      return NextResponse.json(
        { ok: false, message: 'Must upload between 3 and 10 photos' },
        { status: 400 }
      );
    }

    // Validate organisation exists
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organisations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { ok: false, message: 'Invalid organisation' },
        { status: 404 }
      );
    }

    // Validate site exists and is active
    const { data: site, error: siteError } = await supabaseAdmin
      .from('sites')
      .select('id')
      .eq('organisation_id', org.id)
      .eq('site_number', siteNumber)
      .eq('active', true)
      .single();

    if (siteError || !site) {
      return NextResponse.json(
        { ok: false, message: 'Invalid or inactive site number' },
        { status: 404 }
      );
    }

    // Create daily report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('daily_reports')
      .insert({
        organisation_id: org.id,
        site_id: site.id,
        summary: summary.trim(),
        finished_plan: finishedPlanBool,
        not_finished_why: notFinishedWhy?.trim() || null,
        catchup_plan: catchupPlan?.trim() || null,
        site_left_clean_notes: siteLeftCleanNotes.trim(),
      })
      .select('id')
      .single();

    if (reportError || !report) {
      console.error('Error creating report:', reportError);
      return NextResponse.json(
        { ok: false, message: 'Failed to create report' },
        { status: 500 }
      );
    }

    // Upload photos to Supabase Storage
    const uploadedPaths: string[] = [];
    const bucketName = 'daily-reports';

    for (const photo of photos) {
      const fileExt = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${randomUUID()}.${fileExt}`;
      const storagePath = `${orgSlug}/${site.id}/${report.id}/${fileName}`;

      // Convert File to ArrayBuffer
      const arrayBuffer = await photo.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(storagePath, buffer, {
          contentType: photo.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading photo:', uploadError);
        // Continue with other photos, but log the error
        continue;
      }

      uploadedPaths.push(storagePath);
    }

    // If no photos were uploaded successfully, rollback the report
    if (uploadedPaths.length === 0) {
      await supabaseAdmin.from('daily_reports').delete().eq('id', report.id);
      return NextResponse.json(
        { ok: false, message: 'Failed to upload photos' },
        { status: 500 }
      );
    }

    // Create photo records
    const photoRecords = uploadedPaths.map(path => ({
      report_id: report.id,
      storage_path: path,
    }));

    const { error: photosError } = await supabaseAdmin
      .from('daily_report_photos')
      .insert(photoRecords);

    if (photosError) {
      console.error('Error creating photo records:', photosError);
      // Report is already created, but photos might not be linked
      // This is a partial failure, but we'll still return success
    }

    return NextResponse.json({
      ok: true,
      reportId: report.id,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
