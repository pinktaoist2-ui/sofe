import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import bakeryImg from "../assets/login_image.jpg";
import bakeryImg2 from "../assets/login_image2.jpg";
import bakeryImg3 from "../assets/login_image3.jpg";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  const images = [bakeryImg, bakeryImg2, bakeryImg3];
  const [currentImg, setCurrentImg] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImg((prev) => (prev + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ── Shared: check role and redirect accordingly ──
  const redirectByRole = async (userId: string) => {
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin" as any)
      .single();
    if (adminRole) { navigate("/admin"); return; }

    const { data: staffRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "staff" as any)
      .single();
    if (staffRole) { navigate("/staff"); return; }

    navigate("/");
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: "Welcome!", description: "Signed in successfully." });
      await redirectByRole(data.user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Sign in failed", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: undefined,
        },
      });
      if (error) throw error;
      setOtpSent(true);
      toast({ title: "Code sent!", description: "Check your inbox for a 6-digit code." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Sign up failed", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "signup",
      });
      if (error) throw error;
      toast({ title: "Account verified!", description: "Welcome to Tiffany's Delight!" });
      await redirectByRole(data.user!.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Verification failed", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pink-50 p-4">
      <div className="flex w-full max-w-3xl h-[600px] bg-white rounded-2xl shadow-lg overflow-hidden border border-pink-100">
        {/* Left: Form */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-center">
          <div className="mb-8">
            <span className="inline-block mb-2 text-pink-400 font-bold text-lg">
              🍰 Tiffany's Delight
            </span>
            {mode === "login" ? (
              <>
                <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                  Hi,<br />Welcome Back
                </h1>
                <p className="text-gray-500">Hey, welcome back to your special place</p>
              </>
            ) : otpSent ? (
              <>
                <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                  Check your<br />inbox!
                </h1>
                <p className="text-gray-500">We sent a 6-digit code to your email</p>
              </>
            ) : (
              <>
                <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                  Join the<br />Sweetness!
                </h1>
                <p className="text-gray-500">Create your account and treat yourself</p>
              </>
            )}
          </div>

          {otpSent ? (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <Label htmlFor="otp" className="text-gray-700 font-medium">
                  Enter the 6-digit code sent to your email
                </Label>
                <Input
                  id="otp" type="text" placeholder="123456"
                  value={otp} onChange={(e) => setOtp(e.target.value)}
                  required className="mt-2 h-11 rounded-lg border-gray-300" maxLength={6}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-pink-400 hover:bg-pink-500 text-white font-bold rounded-lg"
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? "Verifying..." : "Verify & Sign Up"}
              </Button>
            </form>
          ) : mode === "login" ? (
            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <Label htmlFor="email" className="text-gray-700 font-medium">Email</Label>
                <Input
                  id="email" type="email" placeholder="you@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required className="mt-2 h-11 rounded-lg border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
                <Input
                  id="password" type="password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required className="mt-2 h-11 rounded-lg border-gray-300"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="accent-pink-400"
                  />
                  Remember me
                </label>
                <button type="button" className="text-pink-400 hover:underline">
                  Forgot Password?
                </button>
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-pink-400 hover:bg-pink-500 text-white font-bold rounded-lg"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <Label htmlFor="name" className="text-gray-700 font-medium">Full Name</Label>
                <Input
                  id="name" type="text" placeholder="Your name"
                  value={name} onChange={(e) => setName(e.target.value)}
                  required className="mt-2 h-11 rounded-lg border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-gray-700 font-medium">Email</Label>
                <Input
                  id="email" type="email" placeholder="you@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required className="mt-2 h-11 rounded-lg border-gray-300"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
                <Input
                  id="password" type="password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required className="mt-2 h-11 rounded-lg border-gray-300"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-pink-400 hover:bg-pink-500 text-white font-bold rounded-lg"
                disabled={isLoading}
              >
                {isLoading ? "Signing up..." : "Sign Up"}
              </Button>
            </form>
          )}

          <div className="mt-8 text-center text-sm text-gray-500">
            {otpSent ? (
              <button
                type="button" onClick={() => setOtpSent(false)}
                className="flex items-center gap-1 mx-auto text-pink-400 hover:text-pink-500 transition-colors group"
              >
                <span className="text-lg group-hover:-translate-x-1 transition-transform duration-200">←</span>
                <span className="font-medium">Back to Sign Up</span>
              </button>
            ) : mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  type="button" className="text-pink-400 font-bold hover:underline"
                  onClick={() => { setMode("signup"); setEmail(""); setPassword(""); setName(""); }}
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button" className="text-pink-400 font-bold hover:underline"
                  onClick={() => { setMode("login"); setEmail(""); setPassword(""); setName(""); }}
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: Slideshow */}
        <div className="hidden md:block w-1/2 bg-pink-100 relative overflow-hidden">
          {images.map((img, index) => (
            <img
              key={index} src={img} alt={`Bakery ${index + 1}`}
              className="absolute inset-0 object-cover w-full h-full transition-opacity duration-1000"
              style={{ opacity: index === currentImg ? 1 : 0 }}
            />
          ))}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {images.map((_, index) => (
              <button
                key={index} onClick={() => setCurrentImg(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentImg ? "bg-white w-4" : "bg-white/50 w-2"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;