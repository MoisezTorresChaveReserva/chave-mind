-- Add is_public to mind_maps
ALTER TABLE mind_maps ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Create map_collaborators table
CREATE TABLE map_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID REFERENCES mind_maps(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('reader', 'editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(map_id, email)
);

CREATE INDEX idx_map_collaborators_map_id ON map_collaborators(map_id);
CREATE INDEX idx_map_collaborators_email ON map_collaborators(email);

ALTER TABLE map_collaborators ENABLE ROW LEVEL SECURITY;

-- Collaborators RLS
CREATE POLICY "Map owners can manage collaborators" ON map_collaborators FOR ALL USING (
  EXISTS (SELECT 1 FROM mind_maps WHERE mind_maps.id = map_collaborators.map_id AND mind_maps.user_id = auth.uid())
);
CREATE POLICY "Collaborators can view themselves" ON map_collaborators FOR SELECT USING (
  email = (auth.jwt() ->> 'email')
);

-- Update RLS for mind_maps
DROP POLICY IF EXISTS "Users can manage their own mind maps" ON mind_maps;

CREATE POLICY "Users can view maps they own, are collaborators on, or are public" ON mind_maps FOR SELECT USING (
  auth.uid() = user_id OR
  is_public = true OR
  EXISTS (
    SELECT 1 FROM map_collaborators 
    WHERE map_collaborators.map_id = mind_maps.id 
    AND map_collaborators.email = (auth.jwt() ->> 'email')
  )
);

CREATE POLICY "Users can update maps they own or are editors on" ON mind_maps FOR UPDATE USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM map_collaborators 
    WHERE map_collaborators.map_id = mind_maps.id 
    AND map_collaborators.email = (auth.jwt() ->> 'email')
    AND map_collaborators.role = 'editor'
  )
);

CREATE POLICY "Users can insert maps" ON mind_maps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own maps" ON mind_maps FOR DELETE USING (auth.uid() = user_id);

-- Update RLS for nodes
DROP POLICY IF EXISTS "Users can manage nodes of their mind maps" ON nodes;

CREATE POLICY "Users can view nodes of accessible maps" ON nodes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM mind_maps 
    WHERE mind_maps.id = nodes.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      mind_maps.is_public = true OR 
      EXISTS (SELECT 1 FROM map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email'))
    )
  )
);

CREATE POLICY "Users can insert nodes to editable maps" ON nodes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM mind_maps 
    WHERE mind_maps.id = nodes.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email') AND map_collaborators.role = 'editor')
    )
  )
);

CREATE POLICY "Users can update nodes of editable maps" ON nodes FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM mind_maps 
    WHERE mind_maps.id = nodes.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email') AND map_collaborators.role = 'editor')
    )
  )
);

CREATE POLICY "Users can delete nodes of editable maps" ON nodes FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM mind_maps 
    WHERE mind_maps.id = nodes.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email') AND map_collaborators.role = 'editor')
    )
  )
);

-- Update RLS for edges
DROP POLICY IF EXISTS "Users can manage edges of their mind maps" ON edges;

CREATE POLICY "Users can view edges of accessible maps" ON edges FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM mind_maps 
    WHERE mind_maps.id = edges.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      mind_maps.is_public = true OR 
      EXISTS (SELECT 1 FROM map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email'))
    )
  )
);

CREATE POLICY "Users can insert edges to editable maps" ON edges FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM mind_maps 
    WHERE mind_maps.id = edges.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email') AND map_collaborators.role = 'editor')
    )
  )
);

CREATE POLICY "Users can update edges of editable maps" ON edges FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM mind_maps 
    WHERE mind_maps.id = edges.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email') AND map_collaborators.role = 'editor')
    )
  )
);

CREATE POLICY "Users can delete edges of editable maps" ON edges FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM mind_maps 
    WHERE mind_maps.id = edges.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email') AND map_collaborators.role = 'editor')
    )
  )
);
