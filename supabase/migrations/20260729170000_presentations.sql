-- Create map_presentations table
CREATE TABLE IF NOT EXISTS public.map_presentations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID NOT NULL REFERENCES public.mind_maps(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slides JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_map_presentations_map_id ON public.map_presentations(map_id);

-- Updated_at trigger
CREATE TRIGGER update_map_presentations_updated_at 
BEFORE UPDATE ON public.map_presentations 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.map_presentations ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view presentations of accessible maps" ON public.map_presentations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.mind_maps 
    WHERE mind_maps.id = map_presentations.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      mind_maps.is_public = true OR 
      EXISTS (SELECT 1 FROM public.map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email'))
    )
  )
);

CREATE POLICY "Users can insert presentations to editable maps" ON public.map_presentations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.mind_maps 
    WHERE mind_maps.id = map_presentations.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM public.map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email') AND map_collaborators.role = 'editor')
    )
  )
);

CREATE POLICY "Users can update presentations of editable maps" ON public.map_presentations FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.mind_maps 
    WHERE mind_maps.id = map_presentations.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM public.map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email') AND map_collaborators.role = 'editor')
    )
  )
);

CREATE POLICY "Users can delete presentations of editable maps" ON public.map_presentations FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.mind_maps 
    WHERE mind_maps.id = map_presentations.map_id AND (
      mind_maps.user_id = auth.uid() OR 
      EXISTS (SELECT 1 FROM public.map_collaborators WHERE map_collaborators.map_id = mind_maps.id AND map_collaborators.email = (auth.jwt() ->> 'email') AND map_collaborators.role = 'editor')
    )
  )
);
