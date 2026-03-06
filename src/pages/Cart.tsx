import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag } from "lucide-react";
import Navbar from "@/components/Navbar";

interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string;
    stock_quantity: number;
  };
}

const Cart = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coupon, setCoupon] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { fetchCartItems(); }, []);

  const fetchCartItems = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      const { data, error } = await supabase
        .from("cart_items")
        .select(`id, quantity, product:products (id, name, price, image_url, stock_quantity)`)
        .eq("user_id", session.user.id);

      if (error) throw error;
      setCartItems(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error loading cart", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      const { error } = await supabase.from("cart_items").update({ quantity: newQuantity }).eq("id", itemId);
      if (error) throw error;
      fetchCartItems();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
      if (error) throw error;
      fetchCartItems();
      toast({ title: "Item removed", description: "Item has been removed from cart" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const clearCart = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase.from("cart_items").delete().eq("user_id", session.user.id);
      if (error) throw error;
      fetchCartItems();
      toast({ title: "Cart cleared" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const applyCoupon = () => {
    if (coupon.trim().toUpperCase() === "SAVE10") {
      setCouponDiscount(10);
      toast({ title: "Coupon applied!", description: "₱10.00 discount added." });
    } else {
      toast({ variant: "destructive", title: "Invalid coupon", description: "That code doesn't exist." });
    }
  };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
  const shipping = 0;
  const taxes = 0;
  const total = subtotal + shipping + taxes - couponDiscount;
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <p className="text-muted-foreground">Loading cart…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar cartItemCount={cartItems.length} />

      <main className="w-full max-w-[1400px] mx-auto px-8 xl:px-16 py-12">

        {/* Title + breadcrumb */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-foreground mb-2">Shop</h1>
          <p className="text-base text-muted-foreground">
            Home / <span className="text-foreground font-semibold">Shopping cart</span>
          </p>
        </div>

        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <ShoppingBag className="w-20 h-20 text-muted-foreground/30" />
            <p className="text-xl font-medium text-muted-foreground">Your cart is empty</p>
            <button
              onClick={() => navigate("/shop")}
              className="px-8 py-3.5 rounded-2xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary/90 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="flex gap-10 xl:gap-14 items-start">

            {/* ══════ LEFT — product table ══════ */}
            <div className="flex-1 min-w-0">

              {/* Header row */}
              <div className="grid grid-cols-[3fr_1fr_1.8fr_1fr] bg-primary text-primary-foreground rounded-2xl px-6 py-4 text-base font-semibold mb-0.5">
                <span>Product</span>
                <span className="text-center">Price</span>
                <span className="text-center">Quantity</span>
                <span className="text-right">Subtotal</span>
              </div>

              {/* Item rows */}
              <div className="divide-y divide-border">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[3fr_1fr_1.8fr_1fr] items-center px-6 py-5 gap-4"
                  >
                    {/* Product */}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => removeItem(item.id)}
                        aria-label="Remove"
                        className="w-7 h-7 flex items-center justify-center rounded-full text-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0 leading-none"
                      >
                        ×
                      </button>
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-accent/40 border border-border flex-shrink-0 flex items-center justify-center">
                        {item.product?.image_url ? (
                          <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl">🧁</span>
                        )}
                      </div>
                      <p className="text-base font-semibold text-foreground truncate">{item.product?.name}</p>
                    </div>

                    {/* Price */}
                    <p className="text-base text-foreground text-center">
                      ₱{(item.product?.price || 0).toFixed(2)}
                    </p>

                    {/* Stepper */}
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-lg text-foreground hover:bg-accent/50 disabled:opacity-30 transition-colors leading-none"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-base font-semibold text-foreground select-none">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= (item.product?.stock_quantity || 99)}
                        className="w-9 h-9 flex items-center justify-center border border-border rounded-lg text-lg text-foreground hover:bg-accent/50 disabled:opacity-30 transition-colors leading-none"
                      >
                        +
                      </button>
                    </div>

                    {/* Subtotal */}
                    <p className="text-base font-semibold text-foreground text-right">
                      ₱{((item.product?.price || 0) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Coupon + clear */}
              <div className="flex items-center gap-4 mt-8">
                <input
                  type="text"
                  placeholder="Coupon Code"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  className="px-5 py-3 border border-border rounded-xl text-base bg-background text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground w-52"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  className="px-7 py-3 rounded-xl bg-muted text-foreground text-base font-semibold hover:bg-muted/70 transition-colors"
                >
                  Apply Coupon
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  className="ml-auto text-base text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Clear Shopping Cart
                </button>
              </div>
            </div>

            {/* ══════ RIGHT — Order Summary ══════ */}
            <div className="w-[300px] xl:w-[340px] flex-shrink-0 sticky top-6">
              <div className="border border-border rounded-2xl p-7 bg-card">
                <h2 className="text-lg font-bold text-foreground mb-5">Order Summary</h2>

                <div className="space-y-3.5 text-base mb-5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items</span>
                    <span className="font-semibold text-foreground">{totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sub Total</span>
                    <span className="font-semibold text-foreground">₱{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-semibold text-foreground">₱{shipping.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxes</span>
                    <span className="font-semibold text-foreground">₱{taxes.toFixed(2)}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coupon Discount</span>
                      <span className="font-semibold text-destructive">− ₱{couponDiscount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4 mb-5 flex justify-between items-center">
                  <span className="text-base text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold text-foreground">₱{total.toFixed(2)}</span>
                </div>

                <button
                  onClick={() => navigate("/checkout")}
                  className="w-full py-4 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all"
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default Cart;