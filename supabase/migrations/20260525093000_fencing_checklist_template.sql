-- Add a lightweight Fencing stage checklist template for the job stage dropdown.
-- The full photo-first Fencing QA run remains code-driven under qa_type = 'fencing'.
WITH inserted_templates AS (
  INSERT INTO public.checklist_templates (organisation_id, name, updated_at)
  SELECT o.id, 'Fencing', NOW()
  FROM public.organisations o
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.checklist_templates ct
    WHERE ct.organisation_id = o.id
      AND LOWER(ct.name) = 'fencing'
  )
  RETURNING id
),
existing_templates AS (
  SELECT ct.id
  FROM public.checklist_templates ct
  WHERE LOWER(ct.name) = 'fencing'
),
target_templates AS (
  SELECT id FROM inserted_templates
  UNION
  SELECT id FROM existing_templates
),
template_items AS (
  SELECT *
  FROM (VALUES
    ('tools', 'stringline, level, post hole tools and fencing fixings ready', 1),
    ('materials', 'posts, rails, palings/pickets, concrete and selected options checked', 2),
    ('qc', 'property protection, set-out and hold points checked through Fencing QA', 3)
  ) AS v(item_type, label, sort_order)
)
INSERT INTO public.checklist_template_items (template_id, item_type, label, sort_order)
SELECT tt.id, ti.item_type, ti.label, ti.sort_order
FROM target_templates tt
CROSS JOIN template_items ti
WHERE NOT EXISTS (
  SELECT 1
  FROM public.checklist_template_items cti
  WHERE cti.template_id = tt.id
    AND cti.label = ti.label
);
