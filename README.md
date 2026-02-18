# Daily Reports - Made By Mobbs

A mobile-first daily site report webapp for crews to submit reports on-site using their phones.

## Features

- Mobile-first PWA-like form interface
- Multi-tenant support via organisation slugs
- Site number-based identification (no login required)
- Compulsory photo uploads (3-10 photos)
- Client-side image compression
- Server-side validation and storage
- Deployable on Vercel

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Supabase** (PostgreSQL + Storage)
- **browser-image-compression** (client-side image optimization)
- **Tailwind CSS**

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Important:** Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. It's only used in server-side API routes.

### 3. Supabase Setup

#### Database Schema

Run the SQL schema in your Supabase SQL editor:

```bash
# See supabase/schema.sql
```

This creates:
- `organisations` table
- `sites` table
- `daily_reports` table
- `daily_report_photos` table
- Required indexes

#### Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named: `daily-reports`
3. Set it to **PRIVATE** (not public)
4. The API route uses the service role key to upload files

#### Seed Data

Run these SQL commands in Supabase SQL editor to create initial data:

```sql
-- Create organisation
INSERT INTO organisations (slug, name) 
VALUES ('madebymobbs', 'Made By Mobbs');

-- Create sites (example; site_number is alphanumeric; site_code_hash is generated from it)
INSERT INTO sites (organisation_id, site_number, site_code_hash, site_name, active)
SELECT 
  id,
  '024',
  encode(digest('024', 'sha256'), 'hex'),
  'Site 024',
  true
FROM organisations 
WHERE slug = 'madebymobbs';

-- Add more sites as needed (e.g. numeric or name like 'North Site')
INSERT INTO sites (organisation_id, site_number, site_code_hash, site_name, active)
SELECT 
  id,
  '025',
  encode(digest('025', 'sha256'), 'hex'),
  'Site 025',
  true
FROM organisations 
WHERE slug = 'madebymobbs';
```

### 4. Local Development

```bash
npm run dev
```

Visit `http://localhost:3000` or go directly to `http://localhost:3000/t/madebymobbs/daily`

## Deployment to Vercel

1. Push your code to a Git repository (GitHub, GitLab, etc.)

2. Import your project in Vercel:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your repository

3. Add Environment Variables in Vercel:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

4. Deploy

5. Configure Custom Domain (optional):
   - Add `daily.madebymobbs.com.au` in Vercel project settings
   - Update DNS records as instructed by Vercel

## URL Structure

- Landing page: `/`
- Report form: `/t/[orgSlug]/daily`
  - Example: `/t/madebymobbs/daily`

## Form Fields

1. **Site Number / Name** (required) - Text input; alphanumeric (e.g. "024", "North Site")
2. **Today's Summary** (required) - Textarea
3. **Did we finish everything planned today?** (required) - Yes/No buttons
4. **If No:**
   - What was not finished and why? (required)
   - Plan to make up the lost time (required)
5. **Site left clean / tools in site box / materials under cover** (required) - Textarea
6. **Photos** (required, 3-10 photos) - Multiple file upload

## API Endpoint

### POST `/api/daily-report`

Accepts `multipart/form-data` with:
- `orgSlug` (string, required)
- `siteNumber` (string, required – alphanumeric site number or name)
- `summary` (string, required)
- `finishedPlan` (string: "true" or "false", required)
- `notFinishedWhy` (string, required if finishedPlan=false)
- `catchupPlan` (string, required if finishedPlan=false)
- `siteLeftCleanNotes` (string, required)
- `photos` (File[], required, 3-10 files)

**Response:**
```json
{
  "ok": true,
  "reportId": "uuid"
}
```

or

```json
{
  "ok": false,
  "message": "Error message"
}
```

## Storage Structure

Photos are stored in Supabase Storage bucket `daily-reports` with the following path structure:

```
{orgSlug}/{site_id}/{report_id}/{uuid}.{ext}
```

Example:
```
madebymobbs/550e8400-e29b-41d4-a716-446655440000/660e8400-e29b-41d4-a716-446655440001/770e8400-e29b-41d4-a716-446655440002.jpg
```

## Database Schema

See `supabase/schema.sql` for the complete schema.

### Key Tables

- **organisations**: Organisation metadata
- **sites**: Site information linked to organisations
- **daily_reports**: Main report records
- **daily_report_photos**: Photo metadata with storage paths

## Notes

- No authentication required (public form)
- Site number is the only identifier/gate
- Photos are compressed client-side before upload (maxWidthOrHeight: 2200, quality: 0.82)
- Server timestamp is automatically captured via `submitted_at` default
- All validation is performed both client-side and server-side

## Future Integration

This app is designed to be minimal and clean so it can later be folded into Client Connect.
