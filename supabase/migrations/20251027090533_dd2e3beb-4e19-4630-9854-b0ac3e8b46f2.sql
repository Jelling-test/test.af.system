-- Create schemas for barrier control system
CREATE SCHEMA IF NOT EXISTS manual;
CREATE SCHEMA IF NOT EXISTS access;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA manual TO authenticated;
GRANT USAGE ON SCHEMA access TO authenticated;

-- Table: manual.customers (manual whitelist)
CREATE TABLE manual.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_norm TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: access.barrier_logs (audit log)
CREATE TABLE access.barrier_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  plate_raw TEXT,
  plate_norm TEXT,
  allowed BOOLEAN NOT NULL,
  reason TEXT,
  camera_serial TEXT,
  direction TEXT,
  booking_id UUID,
  manual_id UUID,
  actor_uid UUID,
  meta JSONB DEFAULT '{}'::jsonb
);

-- Table: access.control_requests (manual control)
CREATE TABLE access.control_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_by UUID REFERENCES auth.users(id),
  source TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('open')),
  camera_serial TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'expired')),
  executed_at TIMESTAMPTZ,
  error TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  rl_bucket TEXT
);

-- Indexes for performance
CREATE INDEX idx_barrier_logs_ts ON access.barrier_logs(ts DESC);
CREATE INDEX idx_barrier_logs_plate_norm ON access.barrier_logs(plate_norm);
CREATE INDEX idx_barrier_logs_camera_serial ON access.barrier_logs(camera_serial);
CREATE INDEX idx_barrier_logs_meta ON access.barrier_logs USING GIN(meta);
CREATE INDEX idx_control_requests_status_requested_at ON access.control_requests(status, requested_at);
CREATE INDEX idx_control_requests_rl_bucket ON access.control_requests(rl_bucket);

-- Enable RLS
ALTER TABLE manual.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE access.barrier_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access.control_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manual.customers
CREATE POLICY "Staff and admins can view customers"
  ON manual.customers FOR SELECT
  USING (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff and admins can insert customers"
  ON manual.customers FOR INSERT
  WITH CHECK (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff and admins can update customers"
  ON manual.customers FOR UPDATE
  USING (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff and admins can delete customers"
  ON manual.customers FOR DELETE
  USING (is_staff_or_admin(auth.uid()));

-- RLS Policies for access.barrier_logs
CREATE POLICY "Staff and admins can view barrier logs"
  ON access.barrier_logs FOR SELECT
  USING (is_staff_or_admin(auth.uid()));

-- RLS Policies for access.control_requests
CREATE POLICY "Staff and admins can view control requests"
  ON access.control_requests FOR SELECT
  USING (is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff and admins can insert control requests"
  ON access.control_requests FOR INSERT
  WITH CHECK (is_staff_or_admin(auth.uid()));

-- Note: UPDATE on control_requests should only be done via service role for status changes