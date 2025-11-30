import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import gcashQR from "@/assets/gcash-qr.png";

interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
  };
}

const Checkout = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [showGCashQR, setShowGCashQR] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const [cartResponse, profileResponse] = await Promise.all([
        supabase.from("cart_items").select(`
          id,
          quantity,
          product:products (id, name, price)
        `).eq("user_id", session.user.id),
        supabase.from("profiles").select("*").eq("id", session.user.id).single()
      ]);

      if (cartResponse.error) throw cartResponse.error;
      if (profileResponse.error) throw profileResponse.error;

      setCartItems(cartResponse.data || []);
      setProfile(profileResponse.data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const formData = new FormData(e.currentTarget);
      const paymentMethod = formData.get("payment_method") as string;
      const deliveryMethod = formData.get("delivery_method") as string;
      const deliveryAddress = deliveryMethod === "delivery" 
        ? (formData.get("address") as string)
        : "Pick-up at store";
      
      const totalAmount = cartItems.reduce(
        (sum, item) => sum + (item.product?.price || 0) * item.quantity,
        0
      );

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: session.user.id,
          total_amount: totalAmount,
          delivery_address: deliveryAddress,
          phone: formData.get("phone") as string,
          notes: formData.get("notes") as string,
          payment_method: paymentMethod,
          delivery_method: deliveryMethod,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", session.user.id);

      if (paymentMethod === "gcash") {
        setOrderTotal(totalAmount);
        setShowGCashQR(true);
      } else {
        toast({
          title: "Order placed successfully!",
          description: "Thank you for your order. We'll start preparing it right away!",
        });
        navigate("/");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error placing order",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <Dialog open={showGCashQR} onOpenChange={setShowGCashQR}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>GCash Payment</DialogTitle>
            <DialogDescription>
              Scan the QR code below to complete your payment of ₱{orderTotal.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 p-4">
            <img
              src={gcashQR}
              alt="GCash QR Code"
              className="w-64 h-64 object-contain"
            />
            <p className="text-sm text-muted-foreground text-center">
              After payment, your order will be processed automatically.
            </p>
            <Button
              onClick={() => {
                setShowGCashQR(false);
                toast({
                  title: "Order placed successfully!",
                  description: "Thank you for your order. We'll start preparing it right away!",
                });
                navigate("/");
              }}
              className="w-full"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-foreground">Checkout</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.product?.name} x {item.quantity}
                  </span>
                  <span className="font-medium">
                    ₱{((item.product?.price || 0) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">
                  ₱{totalAmount.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <input type="radio" name="payment_method" value="gcash" required className="w-4 h-4 text-primary" />
                <span className="font-medium">GCash</span>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <input type="radio" name="payment_method" value="cash" required className="w-4 h-4 text-primary" />
                <span className="font-medium">Cash</span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <input 
                  type="radio" 
                  name="delivery_method" 
                  value="pickup" 
                  required 
                  className="w-4 h-4 text-primary"
                  checked={deliveryMethod === "pickup"}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                />
                <span className="font-medium">Pick-up at store</span>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <input 
                  type="radio" 
                  name="delivery_method" 
                  value="delivery" 
                  required 
                  className="w-4 h-4 text-primary"
                  checked={deliveryMethod === "delivery"}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                />
                <span className="font-medium">Delivery</span>
              </label>
            </CardContent>
          </Card>

          {deliveryMethod === "delivery" && (
            <Card>
              <CardHeader>
                <CardTitle>Delivery Address</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="address"
                  name="address"
                  placeholder="Enter your complete delivery address"
                  defaultValue={profile?.address || ""}
                  required={deliveryMethod === "delivery"}
                  rows={3}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="09XX XXX XXXX"
                  defaultValue={profile?.phone || ""}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Order Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Any special instructions?"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Placing Order..." : "Place Order"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default Checkout;
