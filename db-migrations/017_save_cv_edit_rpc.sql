-- Server-side enforcement of subscription_tier for personal statement editing.
-- This function is the only write path for cv_documents edits.
-- It strips personalStatementOverride from form_data when the caller is not premium,
-- regardless of what the client sends.

CREATE OR REPLACE FUNCTION save_cv_edit(
  p_cv_id      uuid,
  p_title      text,
  p_form_data  jsonb,
  p_cv_content jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier         text;
  v_clean_data   jsonb;
BEGIN
  -- Verify ownership: the row must belong to the calling user
  IF NOT EXISTS (
    SELECT 1 FROM cv_documents
    WHERE id = p_cv_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not found';
  END IF;

  -- Look up the caller's subscription tier
  SELECT subscription_tier INTO v_tier
    FROM profiles
   WHERE id = auth.uid();

  -- Strip personalStatementOverride for non-premium users
  IF v_tier IS DISTINCT FROM 'premium' THEN
    v_clean_data := p_form_data - 'personalStatementOverride';
  ELSE
    v_clean_data := p_form_data;
  END IF;

  -- Perform the update
  UPDATE cv_documents
     SET title      = p_title,
         status     = 'draft',
         form_data  = v_clean_data,
         cv_content = p_cv_content
   WHERE id = p_cv_id
     AND user_id = auth.uid();

  -- Log the edit event
  INSERT INTO edit_events (user_id, cv_document_id)
  VALUES (auth.uid(), p_cv_id);
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION save_cv_edit(uuid, text, jsonb, jsonb) TO authenticated;
