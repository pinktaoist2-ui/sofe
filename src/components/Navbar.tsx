import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, LogOut, User, LayoutDashboard, ChefHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertBell } from "@/pages/Staff";
import logo from "@/assets/tiffany.png";

interface NavbarProps {
  cartItemCount?: number;
}

const Navbar = ({ cartItemCount = 0 }: NavbarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) checkRoles(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkRoles(session.user.id);
      } else {
        setIsAdmin(false);
        setIsStaff(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkRoles = async (userId: string) => {
    // Check admin
    const { data: adminData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin" as any)
      .maybeSingle();
    setIsAdmin(!!adminData);

    // Check staff
    const { data: staffData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "staff" as any)
      .maybeSingle();
    setIsStaff(!!staffData);  // ← this line was missing!
  };  // ← this closing brace was missing!

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out", description: "Come back soon!" });
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={logo} alt="Tiffany's Delights" className="h-10 w-10 object-contain" />
          <span className="font-semibold text-xl text-foreground">Tiffany's Delights</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link to="/shop">
            <Button variant="ghost">Shop</Button>
          </Link>

          {user ? (
            <>
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="icon" title="Admin Dashboard">
                    <LayoutDashboard className="h-5 w-5" />
                  </Button>
                </Link>
              )}

              {isStaff && !isAdmin && (
                <Link to="/staff">
                  <Button variant="ghost" size="icon" title="Staff Dashboard">
                    <ChefHat className="h-5 w-5" />
                  </Button>
                </Link>
              )}

              {(isStaff || isAdmin) && <AlertBell />}

              <Link to="/cart" className="relative">
                <Button variant="ghost" size="icon">
                  <ShoppingCart className="h-5 w-5" />
                  {cartItemCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                      {cartItemCount}
                    </Badge>
                  )}
                </Button>
              </Link>

              <Link to="/profile">
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </Link>

              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button>Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;