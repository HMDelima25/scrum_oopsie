-- migrate:up

-- Function to get the current user's primary team ID
CREATE OR REPLACE FUNCTION public.current_user_team_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER -- Runs with the privileges of the creator (postgres)
SET search_path = ''
AS $$
    SELECT team_id 
    FROM public.team_members 
    WHERE user_id = auth.uid() 
    LIMIT 1;
$$;

-- migrate:down

DROP FUNCTION IF EXISTS public.current_user_team_id();