-- Create users table (implicitly handled by Supabase Auth, but we use it for foreign keys)

-- mind_maps table
CREATE TABLE mind_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Map',
  favorite BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  thumbnail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- nodes table
CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID REFERENCES mind_maps(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  color TEXT,
  collapsed BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- edges table
CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID REFERENCES mind_maps(id) ON DELETE CASCADE NOT NULL,
  source UUID REFERENCES nodes(id) ON DELETE CASCADE NOT NULL,
  target UUID REFERENCES nodes(id) ON DELETE CASCADE NOT NULL,
  color TEXT,
  animated BOOLEAN NOT NULL DEFAULT false,
  label TEXT
);

-- Indexes for performance
CREATE INDEX idx_mind_maps_user_id ON mind_maps(user_id);
CREATE INDEX idx_nodes_map_id ON nodes(map_id);
CREATE INDEX idx_edges_map_id ON edges(map_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_mind_maps_updated_at BEFORE UPDATE ON mind_maps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nodes_updated_at BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE mind_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can manage their own mind maps" ON mind_maps FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage nodes of their mind maps" ON nodes FOR ALL USING (
  EXISTS (SELECT 1 FROM mind_maps WHERE mind_maps.id = nodes.map_id AND mind_maps.user_id = auth.uid())
);
CREATE POLICY "Users can manage edges of their mind maps" ON edges FOR ALL USING (
  EXISTS (SELECT 1 FROM mind_maps WHERE mind_maps.id = edges.map_id AND mind_maps.user_id = auth.uid())
);
