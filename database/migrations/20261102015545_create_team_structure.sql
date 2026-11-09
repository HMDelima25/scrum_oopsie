-- migrate:up

-- 1. Create the Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create the Team Members table (Links Supabase Auth to Teams)
CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);

-- 3. Create an index for faster lookups by user
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- 4. Enable Row Level Security (Crucial for Supabase)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Policy: Users can only view teams they belong to
CREATE POLICY "Users can view their own teams"
ON teams FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
);

-- Policy: Users can view their own team memberships
CREATE POLICY "Users can view their own team memberships"
ON team_members FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

-- Policy: Team admins/owners can insert new members
CREATE POLICY "Team admins can add members"
ON team_members FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_id = team_members.team_id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
);


-- migrate:down

DROP POLICY "Team admins can add members" ON team_members;
DROP POLICY "Users can view their own team memberships" ON team_members;
DROP POLICY "Users can view their own teams" ON teams;

DROP TABLE team_members;
DROP TABLE teams;