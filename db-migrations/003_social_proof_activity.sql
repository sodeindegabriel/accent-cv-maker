-- Social proof: public RPC that returns anonymised recent CV completions
-- Run in Supabase SQL editor (Dashboard → SQL editor → New query)

CREATE OR REPLACE FUNCTION get_recent_cv_activity(limit_count int DEFAULT 10)
RETURNS TABLE (first_name text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    split_part(p.full_name, ' ', 1) AS first_name,
    cd.created_at
  FROM cv_documents cd
  JOIN profiles p ON p.id = cd.user_id
  WHERE
    cd.created_at > now() - interval '30 days'
    AND p.full_name IS NOT NULL
    AND p.full_name != ''
    AND length(split_part(p.full_name, ' ', 1)) >= 2
  ORDER BY cd.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Allow both anonymous visitors and authenticated users to call it
GRANT EXECUTE ON FUNCTION get_recent_cv_activity(int) TO anon, authenticated;
