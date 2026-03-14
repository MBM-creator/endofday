-- Atomic replace of checklist_template_items for a template (delete + insert in one transaction).
CREATE OR REPLACE FUNCTION replace_checklist_template_items(
  p_template_id UUID,
  p_items JSONB
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM checklist_template_items WHERE template_id = p_template_id;
  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO checklist_template_items (template_id, item_type, label, sort_order)
    SELECT
      p_template_id,
      (elem->>'type'),
      (elem->>'label'),
      (ord - 1)::integer
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(elem, ord);
  END IF;
END;
$$;
