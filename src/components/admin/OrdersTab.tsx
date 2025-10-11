import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: string;
  created_at: string;
  status: "pending" | "processing" | "completed" | "cancelled";
  total_amount: number;
  delivery_address: string;
  phone: string;
  notes: string | null;
  profiles: {
    full_name: string;
    email: string;
  };
  order_items: Array<{
    quantity: number;
    price: number;
    products: {
      name: string;
    };
  }>;
}

const OrdersTab = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (
          quantity,
          price,
          products (name)
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      return;
    }

    const ordersWithProfiles = await Promise.all(
      (data || []).map(async (order) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", order.user_id)
          .single();
        return { ...order, profiles: profile || { full_name: "", email: "" } };
      })
    );

    setOrders(ordersWithProfiles as any);
  };

  const updateOrderStatus = async (orderId: string, newStatus: "pending" | "processing" | "completed" | "cancelled") => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;
      toast({ title: "Order status updated" });
      fetchOrders();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "processing":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Manage Orders</h2>

      <div className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Order #{order.id.slice(0, 8)}</span>
                <Badge className={getStatusColor(order.status)}>
                  {order.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-semibold">{order.profiles?.full_name}</p>
                  <p className="text-sm">{order.profiles?.email}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-semibold">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Delivery Address</p>
                <p className="font-semibold">{order.delivery_address}</p>
                <p className="text-sm">Phone: {order.phone}</p>
              </div>

              {order.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p>{order.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Items</p>
                <div className="space-y-1">
                  {order.order_items.map((item, idx) => (
                    <p key={idx} className="text-sm">
                      {item.products.name} x {item.quantity} - $
                      {(item.price * item.quantity).toFixed(2)}
                    </p>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-primary">
                    ${order.total_amount.toFixed(2)}
                  </p>
                </div>

                <div className="w-48">
                  <Select
                    value={order.status}
                    onValueChange={(value) => updateOrderStatus(order.id, value as "pending" | "processing" | "completed" | "cancelled")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default OrdersTab;
