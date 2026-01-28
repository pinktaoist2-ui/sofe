import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  email: string;
  userId: string;
  action: "send" | "verify";
  code?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, userId, action, code }: OTPRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    if (action === "verify") {
      if (!code) {
        throw new Error("OTP code is required for verification");
      }

      const { data: isValid, error: verifyError } = await supabase.rpc("verify_otp", {
        p_email: email,
        p_code: code,
      });

      if (verifyError) {
        throw verifyError;
      }

      if (isValid) {
        // Record successful login
        await supabase.rpc("record_login_attempt", {
          p_email: email,
          p_success: true,
        });
      }

      return new Response(
        JSON.stringify({ valid: isValid }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database
    const { error: otpError } = await supabase.rpc("create_otp", {
      p_user_id: userId,
      p_email: email,
      p_code: otpCode,
    });

    if (otpError) {
      throw otpError;
    }

    // Send OTP via email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Tiffany's Pastries <onboarding@resend.dev>",
        to: [email],
        subject: "Your Login Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #e11d48; text-align: center;">Tiffany's Pastries</h1>
            <h2 style="text-align: center;">Your Verification Code</h2>
            <div style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 20px 0;">
              <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #be185d; margin: 0;">
                ${otpCode}
              </p>
            </div>
            <p style="color: #6b7280; text-align: center;">
              This code will expire in 10 minutes.
            </p>
            <p style="color: #9ca3af; text-align: center; font-size: 12px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      throw new Error("Failed to send OTP email");
    }

    console.log("OTP email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
