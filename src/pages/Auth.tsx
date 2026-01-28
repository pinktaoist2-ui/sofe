import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Cake, Lock, Mail, ArrowLeft } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type AuthStep = "credentials" | "otp";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<AuthStep>("credentials");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [lockoutTime, setLockoutTime] = useState(0);
  const [activeTab, setActiveTab] = useState("signin");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => {
        setLockoutTime((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  const formatLockoutTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const checkLockout = async (email: string): Promise<boolean> => {
    const { data: isLocked } = await supabase.rpc("is_locked_out", { p_email: email });
    
    if (isLocked) {
      const { data: remaining } = await supabase.rpc("get_lockout_remaining", { p_email: email });
      setLockoutTime(remaining || 900);
      return true;
    }
    return false;
  };

  const recordFailedAttempt = async (email: string) => {
    await supabase.rpc("record_login_attempt", { p_email: email, p_success: false });
  };

  const sendOTP = async (email: string, userId: string) => {
    const response = await supabase.functions.invoke("send-otp", {
      body: { email, userId, action: "send" },
    });

    if (response.error) {
      throw new Error(response.error.message || "Failed to send OTP");
    }

    return response.data;
  };

  const verifyOTP = async (email: string, code: string) => {
    const response = await supabase.functions.invoke("send-otp", {
      body: { email, userId: pendingUserId, action: "verify", code },
    });

    if (response.error) {
      throw new Error(response.error.message || "Failed to verify OTP");
    }

    return response.data;
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("signup-email") as string;
    const password = formData.get("signup-password") as string;
    const fullName = formData.get("full-name") as string;

    try {
      // Check for lockout
      if (await checkLockout(email)) {
        toast({
          variant: "destructive",
          title: "Account locked",
          description: `Too many failed attempts. Please try again in ${formatLockoutTime(lockoutTime)}.`,
        });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        await recordFailedAttempt(email);
        throw error;
      }

      if (data.user) {
        setPendingEmail(email);
        setPendingUserId(data.user.id);
        
        // Send OTP
        await sendOTP(email, data.user.id);
        
        setStep("otp");
        toast({
          title: "Verification code sent!",
          description: "Please check your email for the OTP.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("signin-email") as string;
    const password = formData.get("signin-password") as string;

    try {
      // Check for lockout
      if (await checkLockout(email)) {
        toast({
          variant: "destructive",
          title: "Account locked",
          description: `Too many failed attempts. Please try again in ${formatLockoutTime(lockoutTime)}.`,
        });
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await recordFailedAttempt(email);
        
        // Check if now locked out
        if (await checkLockout(email)) {
          toast({
            variant: "destructive",
            title: "Account locked",
            description: `Too many failed attempts. Please try again in 15 minutes.`,
          });
        } else {
          throw error;
        }
        return;
      }

      if (data.user) {
        // Sign out temporarily, will sign back in after OTP
        await supabase.auth.signOut();
        
        setPendingEmail(email);
        setPendingUserId(data.user.id);
        
        // Send OTP
        await sendOTP(email, data.user.id);
        
        setStep("otp");
        toast({
          title: "Verification code sent!",
          description: "Please check your email for the OTP.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerification = async () => {
    if (otpCode.length !== 6) return;
    
    setIsLoading(true);

    try {
      const result = await verifyOTP(pendingEmail, otpCode);

      if (!result.valid) {
        await recordFailedAttempt(pendingEmail);
        
        if (await checkLockout(pendingEmail)) {
          setStep("credentials");
          setOtpCode("");
          toast({
            variant: "destructive",
            title: "Account locked",
            description: `Too many failed attempts. Please try again in 15 minutes.`,
          });
          return;
        }
        
        throw new Error("Invalid verification code");
      }

      // OTP verified, now complete the sign in
      // For sign up, user is already created, just redirect
      // For sign in, we need to sign in again
      if (activeTab === "signin") {
        // Re-authenticate - user needs to enter password again or we use a different method
        // Since we validated OTP, we'll use a special flow
        toast({
          title: "Verified!",
          description: "Please sign in again to complete.",
        });
        setStep("credentials");
        setOtpCode("");
      } else {
        toast({
          title: "Account verified!",
          description: "Welcome to Tiffany's Delight! Please sign in.",
        });
        setStep("credentials");
        setActiveTab("signin");
        setOtpCode("");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    try {
      await sendOTP(pendingEmail, pendingUserId);
      toast({
        title: "Code resent!",
        description: "Please check your email for the new code.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to resend",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-accent/20 p-4">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader className="text-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute left-4 top-4"
              onClick={() => {
                setStep("credentials");
                setOtpCode("");
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-primary to-accent p-3 rounded-full">
                <Mail className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Enter Verification Code</CardTitle>
            <CardDescription>
              We've sent a 6-digit code to<br />
              <span className="font-medium text-foreground">{pendingEmail}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otpCode}
                onChange={setOtpCode}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button 
              className="w-full" 
              onClick={handleOTPVerification}
              disabled={otpCode.length !== 6 || isLoading}
            >
              {isLoading ? "Verifying..." : "Verify Code"}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Didn't receive the code?
              </p>
              <Button 
                variant="link" 
                onClick={handleResendOTP}
                disabled={isLoading}
              >
                Resend Code
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-primary to-accent p-3 rounded-full">
              <Cake className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Tiffany's Delight
          </CardTitle>
          <CardDescription>Handcrafted pastries made with love</CardDescription>
        </CardHeader>
        <CardContent>
          {lockoutTime > 0 && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
              <Lock className="h-6 w-6 text-destructive mx-auto mb-2" />
              <p className="text-sm text-destructive font-medium">
                Account temporarily locked
              </p>
              <p className="text-2xl font-bold text-destructive">
                {formatLockoutTime(lockoutTime)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Please wait before trying again
              </p>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    required
                    disabled={lockoutTime > 0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    name="signin-password"
                    type="password"
                    required
                    disabled={lockoutTime > 0}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || lockoutTime > 0}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input
                    id="full-name"
                    name="full-name"
                    type="text"
                    placeholder="Your name"
                    required
                    disabled={lockoutTime > 0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    required
                    disabled={lockoutTime > 0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="signup-password"
                    type="password"
                    minLength={6}
                    required
                    disabled={lockoutTime > 0}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || lockoutTime > 0}
                >
                  {isLoading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
