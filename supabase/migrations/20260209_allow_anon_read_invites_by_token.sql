-- Allow anonymous users to read organization_invites by token
-- This is necessary for invite links to work for non-authenticated users

-- Add policy for anonymous users to read invites by token
-- This allows anyone with a valid token to check if an invite is valid
CREATE POLICY "organization_invites_select_by_token_anon"
ON public.organization_invites
FOR SELECT
TO anon
USING (
  -- Allow reading if:
  -- 1. The invite is not yet accepted
  accepted_at IS NULL
  -- 2. The invite is not revoked
  AND revoked_at IS NULL
  -- 3. The invite is not expired (created within last 7 days)
  AND created_at > (NOW() - INTERVAL '7 days')
);

-- Also allow authenticated users to read by token (in case they're not in the organization yet)
CREATE POLICY "organization_invites_select_by_token_authenticated"
ON public.organization_invites
FOR SELECT
TO authenticated
USING (
  -- Allow reading if:
  -- 1. The invite is not yet accepted
  accepted_at IS NULL
  -- 2. The invite is not revoked
  AND revoked_at IS NULL
  -- 3. The invite is not expired (created within last 7 days)
  AND created_at > (NOW() - INTERVAL '7 days')
  -- OR if they already have access via the existing policy
  OR email = (auth.jwt() ->> 'email')
  OR organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);
