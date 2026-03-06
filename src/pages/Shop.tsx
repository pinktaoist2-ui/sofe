import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock_quantity: number;
  expire_at: string | null;
}

const Shop = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading products",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (product: Product) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Please sign in",
        description: "You need to be signed in to add items to cart",
      });
      return;
    }

    if (product.expire_at && new Date(product.expire_at).getTime() <= new Date().getTime()) {
      toast({
        variant: "destructive",
        title: "Product expired",
        description: "This product has expired and cannot be added to cart",
      });
      return;
    }

    try {
      const { data: existingItem } = await supabase
        .from("cart_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .single();

      if (existingItem) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existingItem.quantity + 1 })
          .eq("id", existingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: user.id, product_id: product.id, quantity: 1 });
        if (error) throw error;
      }

      // Flash "Added!" feedback
      setAddedItems((prev) => ({ ...prev, [product.id]: true }));
      setTimeout(() => setAddedItems((prev) => ({ ...prev, [product.id]: false })), 1500);

      toast({
        title: "Added to cart",
        description: `${product.name} has been added to your cart`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const isExpired = (expireAt: string | null) => {
    if (!expireAt) return false;
    return new Date(expireAt).getTime() <= new Date().getTime();
  };

  const isExpiringSoon = (expireAt: string | null) => {
    if (!expireAt) return false;
    const daysUntilExpire = Math.ceil(
      (new Date(expireAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpire <= 3 && daysUntilExpire > 0;
  };

  const formatExpireDate = (expireAt: string | null) => {
    if (!expireAt) return null;
    return new Date(expireAt).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <span className="text-5xl animate-bounce">🧁</span>
          <p className="text-muted-foreground text-sm tracking-wide">Loading fresh pastries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/10 to-background">
      <Navbar />

      <main className="container mx-auto px-4 py-10">

        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Our Delicious Pastries
          </h1>
          <p className="text-lg text-muted-foreground">
            Handcrafted with love, baked fresh daily
          </p>
        </div>

        {/* Grid */}
        {products.length === 0 ? (
          <div className="text-center py-24">
            <span className="text-6xl mb-4 block">🧺</span>
            <p className="text-muted-foreground">No products available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7">
            {products.map((product, i) => {
              const expired = isExpired(product.expire_at);
              const expiringSoon = isExpiringSoon(product.expire_at);
              const isAdded = addedItems[product.id];

              return (
                <div
                  key={product.id}
                  className="rounded-2xl overflow-hidden bg-white flex flex-col"
                  style={{
                    boxShadow: "0 2px 24px rgba(0,0,0,0.07)",
                    transition: "transform 0.3s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s ease",
                    animation: `fadeInUp 0.5s ease ${i * 0.07}s both`,
                    opacity: expired ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-8px) scale(1.01)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 40px rgba(0,0,0,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0) scale(1)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 24px rgba(0,0,0,0.07)";
                  }}
                >
                  {/* Image */}
                  <div
                    className="relative overflow-hidden"
                    style={{
                      height: "220px",
                      background: "linear-gradient(135deg, #fce7f3, #fef3c7)",
                    }}
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span style={{ fontSize: "72px", filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.1))" }}>🧁</span>
                      </div>
                    )}

                    {/* Stock badge */}
                    {product.stock_quantity === 0 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">Out of Stock</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-xl font-semibold mb-1 text-foreground">
                      {product.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed flex-1">
                      {product.description}
                    </p>

                    <div className="flex items-center justify-between mb-3">
                      <span
                      className="text-2xl font-bold text-primary"
                        style={{}}
                      >
                        ₱{product.price.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                        Stock: {product.stock_quantity}
                      </span>
                    </div>

                    {/* Expiry badge */}
                    {product.expire_at && (
                      <div className="mb-4">
                        {expired ? (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertCircle className="h-3 w-3" /> Expired
                          </Badge>
                        ) : expiringSoon ? (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertCircle className="h-3 w-3" /> Expires {formatExpireDate(product.expire_at)}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs text-muted-foreground">
                            Best before {formatExpireDate(product.expire_at)}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Add to Cart Button */}
                    <button
                      onClick={() => addToCart(product)}
                      disabled={product.stock_quantity === 0 || expired}
                      className="w-full py-3 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: isAdded
                          ? "linear-gradient(135deg, #22c55e, #16a34a)"
                          : product.stock_quantity === 0 || expired
                          ? "#d1d5db"
                          : "hsl(var(--primary))",
                        boxShadow: isAdded
                          ? "0 4px 14px rgba(34,197,94,0.35)"
                          : product.stock_quantity === 0 || expired
                          ? "none"
                          : "0 4px 14px hsl(var(--primary) / 0.35)",
                        transform: isAdded ? "scale(0.97)" : "scale(1)",
                      }}
                    >
                      {isAdded ? (
                        <>✓ Added!</>
                      ) : expired ? (
                        "Expired"
                      ) : product.stock_quantity === 0 ? (
                        "Out of Stock"
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4" />
                          Add to Cart
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Shop;