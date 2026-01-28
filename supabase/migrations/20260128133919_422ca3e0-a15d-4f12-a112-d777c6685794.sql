-- Create table for tracking login attempts
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

-- Create index for efficient querying
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts(email, attempted_at DESC);

-- Create table for OTP codes
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for OTP lookup
CREATE INDEX idx_otp_codes_email_code ON public.otp_codes(email, code);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- RLS policies for login_attempts (service role only - no public access)
-- We'll handle this via edge function with service role

-- RLS policies for otp_codes (service role only)
-- Edge function will use service role to manage OTPs

-- Function to check if user is locked out
CREATE OR REPLACE FUNCTION public.is_locked_out(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) >= 3
  FROM public.login_attempts
  WHERE email = p_email
    AND success = false
    AND attempted_at > (now() - interval '15 minutes')
$$;

-- Function to get lockout remaining time in seconds
CREATE OR REPLACE FUNCTION public.get_lockout_remaining(p_email TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0, EXTRACT(EPOCH FROM (
    (SELECT MAX(attempted_at) FROM public.login_attempts 
     WHERE email = p_email AND success = false AND attempted_at > (now() - interval '15 minutes'))
    + interval '15 minutes' - now()
  ))::INTEGER)
$$;

-- Function to record login attempt (callable from edge function)
CREATE OR REPLACE FUNCTION public.record_login_attempt(p_email TEXT, p_success BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, success)
  VALUES (p_email, p_success);
  
  -- If successful, clear previous failed attempts
  IF p_success THEN
    DELETE FROM public.login_attempts 
    WHERE email = p_email AND success = false;
  END IF;
END;
$$;

-- Function to create OTP
CREATE OR REPLACE FUNCTION public.create_otp(p_user_id UUID, p_email TEXT, p_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Invalidate any existing OTPs for this user
  UPDATE public.otp_codes SET used = true WHERE email = p_email AND used = false;
  
  -- Create new OTP (expires in 10 minutes)
  INSERT INTO public.otp_codes (user_id, email, code, expires_at)
  VALUES (p_user_id, p_email, p_code, now() + interval '10 minutes');
END;
$$;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION public.verify_otp(p_email TEXT, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.otp_codes
    WHERE email = p_email
      AND code = p_code
      AND used = false
      AND expires_at > now()
  ) INTO v_valid;
  
  IF v_valid THEN
    UPDATE public.otp_codes SET used = true 
    WHERE email = p_email AND code = p_code;
  END IF;
  
  RETURN v_valid;
END;
$$;