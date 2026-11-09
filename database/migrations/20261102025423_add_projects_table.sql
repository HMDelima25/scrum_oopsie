-- migrate:up

-- 1. Create the projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Users can ONLY see projects in their own team
CREATE POLICY "Users can view team projects"
ON projects FOR SELECT
TO authenticated
USING (team_id = public.current_user_team_id());

-- 4. Policy: Users can ONLY insert projects into their own team
CREATE POLICY "Users can insert team projects"
ON projects FOR INSERT
TO authenticated
WITH CHECK (team_id = public.current_user_team_id());

-- 5. Policy: Users can update/delete projects in their team
CREATE POLICY "Users can update team projects"
ON projects FOR UPDATE
TO authenticated
USING (team_id = public.current_user_team_id());

CREATE POLICY "Users can delete team projects"
ON projects FOR DELETE
TO authenticated
USING (team_id = public.current_user_team_id());

-- migrate:down
DROP TABLE projects;