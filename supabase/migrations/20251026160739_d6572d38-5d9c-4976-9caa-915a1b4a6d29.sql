-- Create plugin_data table for flexible data storage
CREATE TABLE IF NOT EXISTS public.plugin_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  module TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plugin_data ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff and admins can view all plugin data"
  ON public.plugin_data
  FOR SELECT
  USING (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff and admins can insert plugin data"
  ON public.plugin_data
  FOR INSERT
  WITH CHECK (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff and admins can update plugin data"
  ON public.plugin_data
  FOR UPDATE
  USING (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff and admins can delete plugin data"
  ON public.plugin_data
  FOR DELETE
  USING (is_staff_or_admin(auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_plugin_data_org_module ON public.plugin_data(organization_id, module);
CREATE INDEX idx_plugin_data_data ON public.plugin_data USING GIN (data);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plugin_data_updated_at
  BEFORE UPDATE ON public.plugin_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();