import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertTriangle, Package, TrendingDown, RefreshCw, Upload, X,
  ImageIcon, Plus, Pencil, Trash2, TrendingUp, ShoppingBag, Users, BarChart2,
  Tag, ToggleLeft, ToggleRight, Copy, Star, MessageSquare, CheckCircle, EyeOff, ArrowUpDown,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ─── Main Admin Page ─────────────────────────────────────────────────────────
const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { checkAdminAccess(); }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", session.user.id).eq("role", "admin").single();
      if (!data) {
        toast({ variant: "destructive", title: "Access Denied", description: "You don't have admin privileges" });
        navigate("/"); return;
      }
      setIsAdmin(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      navigate("/");
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-background"><Navbar />
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/10 to-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Admin Dashboard
        </h1>
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto h-auto flex-nowrap justify-start gap-1 pb-1">
            <TabsTrigger value="analytics" className="whitespace-nowrap">Analytics</TabsTrigger>
            <TabsTrigger value="products" className="whitespace-nowrap">Products</TabsTrigger>
            <TabsTrigger value="inventory" className="whitespace-nowrap">Inventory</TabsTrigger>
            <TabsTrigger value="orders" className="whitespace-nowrap">Orders</TabsTrigger>
            <TabsTrigger value="promos" className="whitespace-nowrap">Promos</TabsTrigger>
            <TabsTrigger value="categories" className="whitespace-nowrap">Categories</TabsTrigger>
            <TabsTrigger value="reviews" className="whitespace-nowrap">Reviews</TabsTrigger>
          </TabsList>
          <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
          <TabsContent value="products"><ProductsTab /></TabsContent>
          <TabsContent value="inventory"><InventoryTab /></TabsContent>
          <TabsContent value="orders"><OrdersTab /></TabsContent>
          <TabsContent value="promos"><PromosTab /></TabsContent>
          <TabsContent value="categories"><CategoriesTab /></TabsContent>
          <TabsContent value="reviews"><ReviewsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// ─── Analytics Tab ────────────────────────────────────────────────────────────
const TIME_FILTERS = ["Today", "This Week", "This Month", "This Year"] as const;
type TimeFilter = typeof TIME_FILTERS[number];
const PIE_COLORS = ["#f472b6", "#fb923c", "#facc15", "#34d399", "#60a5fa", "#a78bfa"];

const getDateRange = (filter: TimeFilter): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  if (filter === "Today") { start.setHours(0, 0, 0, 0); }
  else if (filter === "This Week") { start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0); }
  else if (filter === "This Month") { start.setDate(1); start.setHours(0, 0, 0, 0); }
  else { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
  return { start, end };
};

const AnalyticsTab = () => {
  const [filter, setFilter] = useState<TimeFilter>("This Month");
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { fetchData(); }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(filter);

      // Fetch orders in range
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, created_at, status, total_amount, user_id")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true });

      // Fetch order items with product + category info
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("quantity, price, product_id, products(name, category_id, categories(name))")
        .in("order_id", (ordersData || []).map(o => o.id));

      // Total customers
      const { count } = await supabase
        .from("profiles").select("id", { count: "exact", head: true });

      setOrders(ordersData || []);
      setOrderItems(itemsData || []);
      setCustomers(count || 0);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error loading analytics", description: err.message });
    } finally { setLoading(false); }
  };

  // ── Computed stats ──
  const totalRevenue = useMemo(() =>
    orders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + (o.total_amount || 0), 0), [orders]);

  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // ── Revenue over time ──
  const revenueOverTime = useMemo(() => {
    const grouped: Record<string, number> = {};
    orders.filter(o => o.status !== "cancelled").forEach(o => {
      const date = new Date(o.created_at);
      let key = "";
      if (filter === "Today") key = `${date.getHours()}:00`;
      else if (filter === "This Week") key = date.toLocaleDateString("en-US", { weekday: "short" });
      else if (filter === "This Month") key = `${date.getDate()}`;
      else key = date.toLocaleDateString("en-US", { month: "short" });
      grouped[key] = (grouped[key] || 0) + (o.total_amount || 0);
    });
    return Object.entries(grouped).map(([label, revenue]) => ({ label, revenue: parseFloat(revenue.toFixed(2)) }));
  }, [orders, filter]);

  // ── Best-selling products ──
  const bestSelling = useMemo(() => {
    const grouped: Record<string, number> = {};
    orderItems.forEach(item => {
      const name = item.products?.name || "Unknown";
      grouped[name] = (grouped[name] || 0) + item.quantity;
    });
    return Object.entries(grouped)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [orderItems]);

  // ── Orders by status ──
  const ordersByStatus = useMemo(() => {
    const grouped: Record<string, number> = {};
    orders.forEach(o => { grouped[o.status] = (grouped[o.status] || 0) + 1; });
    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // ── Sales by category ──
  const salesByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};
    orderItems.forEach(item => {
      const cat = item.products?.categories?.name || "Uncategorized";
      grouped[cat] = (grouped[cat] || 0) + (item.quantity * item.price);
    });
    return Object.entries(grouped).map(([name, sales]) => ({ name, sales: parseFloat(sales.toFixed(2)) }));
  }, [orderItems]);

  return (
    <div className="space-y-6">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">Sales & Analytics</h2>
        <div className="flex gap-2 flex-wrap">
          {TIME_FILTERS.map(f => (
            <Button
              key={f} size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-pink-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <TrendingUp className="h-4 w-4 text-pink-400" />
                </div>
                <p className="text-2xl font-bold text-pink-500">₱{totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">{filter}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <ShoppingBag className="h-4 w-4 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-blue-500">{totalOrders}</p>
                <p className="text-xs text-muted-foreground mt-1">{filter}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-muted-foreground">Avg. Order Value</p>
                  <BarChart2 className="h-4 w-4 text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-purple-500">₱{avgOrderValue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">{filter}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                  <Users className="h-4 w-4 text-green-400" />
                </div>
                <p className="text-2xl font-bold text-green-500">{customers}</p>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Revenue Over Time ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">📈 Revenue Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueOverTime.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No revenue data for {filter}.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={revenueOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₱${v}`} />
                    <Tooltip formatter={(v: any) => [`₱${v}`, "Revenue"]} />
                    <Line type="monotone" dataKey="revenue" stroke="#f472b6" strokeWidth={2.5} dot={{ fill: "#f472b6", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── Best Selling + Sales by Category ── */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">🏆 Best-Selling Products</CardTitle>
              </CardHeader>
              <CardContent>
                {bestSelling.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">No sales data for {filter}.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={bestSelling} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => [v, "Units sold"]} />
                      <Bar dataKey="qty" fill="#f472b6" radius={[0, 6, 6, 0]}>
                        {bestSelling.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">🗂️ Sales by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {salesByCategory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">No category data for {filter}.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={salesByCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                      <Tooltip formatter={(v: any) => [`₱${v}`, "Sales"]} />
                      <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                        {salesByCategory.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Orders by Status ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">🍩 Orders by Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-center gap-6">
              {ordersByStatus.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 w-full">No orders for {filter}.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={ordersByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {ordersByStatus.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {ordersByStatus.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="capitalize text-muted-foreground">{entry.name}</span>
                        <span className="font-semibold ml-auto">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

// ─── ProductsTab Component ────────────────────────────────────────────────────
const emptyForm = { name: "", description: "", price: "", image_url: "", stock_quantity: "", expire_at: "" };

const ProductsTab = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const { toast } = useToast();

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setProducts(data || []);
  };

  const openAddDialog = () => { setFormData(emptyForm); setImageFile(null); setImagePreview(""); setEditingId(null); setDialogOpen(true); };
  const openEditDialog = (product: any) => {
    setFormData({ name: product.name, description: product.description, price: product.price.toString(), image_url: product.image_url, stock_quantity: product.stock_quantity.toString(), expire_at: product.expire_at || "" });
    setImageFile(null); setImagePreview(product.image_url || ""); setEditingId(product.id); setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setFormData(emptyForm); setImageFile(null); setImagePreview(""); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ variant: "destructive", title: "Invalid file", description: "Please select an image file." }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ variant: "destructive", title: "File too large", description: "Image must be under 5MB." }); return; }
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
    setFormData(prev => ({ ...prev, image_url: "" }));
  };

  const uploadImage = async (): Promise<string> => {
    if (!imageFile) return formData.image_url;
    setUploadingImage(true);
    try {
      const ext = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, imageFile, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
      return publicUrl;
    } finally { setUploadingImage(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile && !formData.image_url) { toast({ variant: "destructive", title: "Image required", description: "Please upload a product image." }); return; }
    let imageUrl = formData.image_url;
    if (imageFile) {
      try { imageUrl = await uploadImage(); }
      catch (err: any) { toast({ variant: "destructive", title: "Image upload failed", description: err.message }); return; }
    }
    const productData = { name: formData.name, description: formData.description, price: parseFloat(formData.price), image_url: imageUrl, stock_quantity: parseInt(formData.stock_quantity), expire_at: formData.expire_at };
    if (editingId) {
      const { error } = await supabase.from("products").update(productData).eq("id", editingId);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      toast({ title: "✅ Product updated!" });
    } else {
      const { error } = await supabase.from("products").insert([productData]);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      toast({ title: "🎉 Product added!" });
    }
    closeDialog(); fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "Product deleted" }); fetchProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Manage Products</h2>
        <Button onClick={openAddDialog} className="gap-2"><Plus className="h-4 w-4" /> Add Product</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {editingId ? "✏️ Edit Product" : "🎂 Add New Product"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Name</label>
              <Input placeholder="e.g. Strawberry Cake" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea placeholder="Describe the product..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required className="resize-none" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Price (₱)</label>
                <Input type="number" step="0.01" placeholder="0.00" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Stock Quantity</label>
                <Input type="number" placeholder="0" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expiration Date</label>
              <Input type="date" value={formData.expire_at} onChange={(e) => setFormData({ ...formData, expire_at: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Image</label>
              {imagePreview ? (
                <div className="relative w-full h-44 rounded-xl overflow-hidden border border-border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); setFormData(prev => ({ ...prev, image_url: "" })); }} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all">
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="h-10 w-10 text-primary/40" />
                    <p className="text-sm font-medium text-primary">Click to upload image</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" className="gap-2" disabled={uploadingImage}>
                {uploadingImage ? <><RefreshCw className="h-4 w-4 animate-spin" /> Uploading...</> : editingId ? <><Pencil className="h-4 w-4" /> Update Product</> : <><Upload className="h-4 w-4" /> Add Product</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {products.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 text-primary/30" />
            <p>No products yet. Click "Add Product" to get started!</p>
          </CardContent></Card>
        )}
        {products.map((product) => (
          <Card key={product.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex gap-4 items-center">
                <img src={product.image_url} alt={product.name} className="w-20 h-20 object-cover rounded-xl border border-border flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{product.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <span className="font-bold text-primary">₱{product.price.toFixed(2)}</span>
                    <span className="text-muted-foreground">Stock: <strong>{product.stock_quantity}</strong></span>
                    <span className="text-muted-foreground">Expires: {product.expire_at ? new Date(product.expire_at).toLocaleDateString() : "—"}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(product)} className="gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(product.id)} className="gap-1"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── InventoryTab ─────────────────────────────────────────────────────────────
const InventoryTab = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ stock_quantity: "", low_stock_threshold: "", expire_at: "" });
  const { toast } = useToast();

  useEffect(() => { fetchInventory(); }, []);

  const fetchInventory = async () => {
    const { data, error } = await supabase.from("products").select("id, name, image_url, stock_quantity, low_stock_threshold, expire_at, price").order("stock_quantity", { ascending: true });
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setProducts(data || []);
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setEditValues({ stock_quantity: product.stock_quantity?.toString() || "0", low_stock_threshold: product.low_stock_threshold?.toString() || "5", expire_at: product.expire_at || "" });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase.from("products").update({ stock_quantity: parseInt(editValues.stock_quantity), low_stock_threshold: parseInt(editValues.low_stock_threshold), expire_at: editValues.expire_at }).eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "✅ Inventory updated!" }); setEditingId(null); fetchInventory();
  };

  const getStockStatus = (p: any) => {
    if (p.stock_quantity === 0) return { label: "Out of Stock", color: "bg-red-500" };
    if (p.stock_quantity <= (p.low_stock_threshold || 5)) return { label: "Low Stock", color: "bg-yellow-500" };
    return { label: "In Stock", color: "bg-green-500" };
  };
  const isExpiringSoon = (d: string) => { if (!d) return false; const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); return days <= 7 && days >= 0; };
  const isExpired = (d: string) => { if (!d) return false; return new Date(d) < new Date(); };

  const outOfStock = products.filter(p => p.stock_quantity === 0).length;
  const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 5)).length;
  const expiringSoon = products.filter(p => isExpiringSoon(p.expire_at)).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Inventory Management</h2>
        <Button variant="outline" onClick={fetchInventory} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-400"><CardContent className="p-4 flex items-center gap-3"><Package className="h-8 w-8 text-blue-400" /><div><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-bold">{products.length}</p></div></CardContent></Card>
        <Card className="border-l-4 border-l-yellow-400"><CardContent className="p-4 flex items-center gap-3"><TrendingDown className="h-8 w-8 text-yellow-400" /><div><p className="text-sm text-muted-foreground">Low / Out of Stock</p><p className="text-2xl font-bold">{lowStock + outOfStock}</p></div></CardContent></Card>
        <Card className="border-l-4 border-l-red-400"><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-red-400" /><div><p className="text-sm text-muted-foreground">Expiring Soon</p><p className="text-2xl font-bold">{expiringSoon}</p></div></CardContent></Card>
      </div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40">
          <th className="text-left p-4 font-semibold">Product</th>
          <th className="text-left p-4 font-semibold">Status</th>
          <th className="text-left p-4 font-semibold">Stock</th>
          <th className="text-left p-4 font-semibold">Low Stock Alert</th>
          <th className="text-left p-4 font-semibold">Expiry Date</th>
          <th className="text-left p-4 font-semibold">Actions</th>
        </tr></thead>
        <tbody>
          {products.map((product) => {
            const status = getStockStatus(product);
            const expired = isExpired(product.expire_at);
            const expiring = isExpiringSoon(product.expire_at);
            const isEditing = editingId === product.id;
            return (
              <tr key={product.id} className={`border-b hover:bg-muted/20 transition-colors ${expired ? "bg-red-50/30" : ""}`}>
                <td className="p-4"><div className="flex items-center gap-3"><img src={product.image_url} alt={product.name} className="w-10 h-10 rounded object-cover" /><div><p className="font-medium">{product.name}</p><p className="text-xs text-muted-foreground">₱{product.price?.toFixed(2)}</p></div></div></td>
                <td className="p-4">
                  <Badge className={`${status.color} text-white text-xs`}>{status.label}</Badge>
                  {expired && <Badge className="bg-red-700 text-white text-xs ml-1">Expired</Badge>}
                  {expiring && !expired && <Badge className="bg-orange-400 text-white text-xs ml-1">Expiring Soon</Badge>}
                </td>
                <td className="p-4">{isEditing ? <Input type="number" value={editValues.stock_quantity} onChange={(e) => setEditValues({ ...editValues, stock_quantity: e.target.value })} className="w-24 h-8 text-sm" min="0" /> : <span className={`font-semibold ${product.stock_quantity === 0 ? "text-red-500" : product.stock_quantity <= (product.low_stock_threshold || 5) ? "text-yellow-500" : "text-green-600"}`}>{product.stock_quantity}</span>}</td>
                <td className="p-4">{isEditing ? <Input type="number" value={editValues.low_stock_threshold} onChange={(e) => setEditValues({ ...editValues, low_stock_threshold: e.target.value })} className="w-24 h-8 text-sm" min="1" /> : <span className="text-muted-foreground">{product.low_stock_threshold || 5} units</span>}</td>
                <td className="p-4">{isEditing ? <Input type="date" value={editValues.expire_at} onChange={(e) => setEditValues({ ...editValues, expire_at: e.target.value })} className="w-36 h-8 text-sm" /> : <span className={expired ? "text-red-500 font-medium" : expiring ? "text-orange-500 font-medium" : ""}>{product.expire_at ? new Date(product.expire_at).toLocaleDateString() : "—"}</span>}</td>
                <td className="p-4">{isEditing ? <div className="flex gap-2"><Button size="sm" onClick={() => handleSave(product.id)}>Save</Button><Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button></div> : <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>Update Stock</Button>}</td>
              </tr>
            );
          })}
          {products.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No products found. Add products in the Products tab first.</td></tr>}
        </tbody>
      </table></div></CardContent></Card>
    </div>
  );
};

// ─── OrdersTab ────────────────────────────────────────────────────────────────
interface Order {
  id: string; created_at: string;
  status: "pending" | "processing" | "completed" | "cancelled";
  total_amount: number; delivery_address: string; phone: string; notes: string | null;
  profiles: { full_name: string; email: string; };
  order_items: Array<{ quantity: number; price: number; products: { name: string; }; }>;
}

const OrdersTab = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const { toast } = useToast();

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase.from("orders").select(`*, order_items (quantity, price, products (name))`).order("created_at", { ascending: false });
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    const withProfiles = await Promise.all((data || []).map(async (order) => {
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", order.user_id).single();
      return { ...order, profiles: profile || { full_name: "", email: "" } };
    }));
    setOrders(withProfiles as any);
  };

  const updateOrderStatus = async (orderId: string, newStatus: "pending" | "processing" | "completed" | "cancelled") => {
    try {
      const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
      if (error) throw error;
      toast({ title: "Order status updated" }); fetchOrders();
    } catch (error: any) { toast({ variant: "destructive", title: "Error", description: error.message }); }
  };

  const getStatusColor = (s: string) => ({ pending: "bg-yellow-500", processing: "bg-blue-500", completed: "bg-green-500", cancelled: "bg-red-500" }[s] || "bg-gray-500");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Manage Orders</h2>
      <div className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader><CardTitle className="flex items-center justify-between"><span>Order #{order.id.slice(0, 8)}</span><Badge className={getStatusColor(order.status)}>{order.status}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Customer</p><p className="font-semibold">{order.profiles?.full_name}</p><p className="text-sm">{order.profiles?.email}</p></div>
                <div><p className="text-sm text-muted-foreground">Date</p><p className="font-semibold">{new Date(order.created_at).toLocaleString()}</p></div>
              </div>
              <div><p className="text-sm text-muted-foreground">Delivery Address</p><p className="font-semibold">{order.delivery_address}</p><p className="text-sm">Phone: {order.phone}</p></div>
              {order.notes && <div><p className="text-sm text-muted-foreground">Notes</p><p>{order.notes}</p></div>}
              <div><p className="text-sm text-muted-foreground mb-2">Items</p><div className="space-y-1">{order.order_items.map((item, idx) => (<p key={idx} className="text-sm">{item.products.name} x {item.quantity} - ₱{(item.price * item.quantity).toFixed(2)}</p>))}</div></div>
              <div className="flex items-center justify-between pt-4 border-t">
                <div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold text-primary">₱{order.total_amount.toFixed(2)}</p></div>
                <div className="w-48">
                  <Select value={order.status} onValueChange={(v) => updateOrderStatus(order.id, v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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

// ─── PromosTab ────────────────────────────────────────────────────────────────
const emptyPromo = {
  code: "", description: "", discount_type: "percentage", discount_value: "",
  buy_quantity: "", get_quantity: "", applies_to: "entire_order",
  minimum_order: "", one_time_per_customer: true, expires_at: "", is_active: true,
};

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percentage: "Percentage (% off)",
  fixed: "Fixed Amount (₱ off)",
  free_delivery: "Free Delivery",
  buy_x_get_y: "Buy X Get Y Free",
};

const APPLIES_TO_LABELS: Record<string, string> = {
  entire_order: "Entire Order",
  specific_products: "Specific Products",
  specific_categories: "Specific Categories",
};

const PromosTab = () => {
  const [promos, setPromos] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(emptyPromo);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => { fetchPromos(); }, []);

  const fetchPromos = async () => {
    const { data, error } = await supabase
      .from("promo_codes").select("*").order("created_at", { ascending: false });
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setPromos(data || []);

    // fetch usage counts
    if (data && data.length > 0) {
      const counts: Record<string, number> = {};
      await Promise.all(data.map(async (p) => {
        const { count } = await supabase
          .from("promo_code_uses").select("id", { count: "exact", head: true })
          .eq("promo_code_id", p.id);
        counts[p.id] = count || 0;
      }));
      setUsageCounts(counts);
    }
  };

  const openAdd = () => { setFormData(emptyPromo); setEditingId(null); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setFormData({
      code: p.code, description: p.description || "", discount_type: p.discount_type,
      discount_value: p.discount_value?.toString() || "", buy_quantity: p.buy_quantity?.toString() || "",
      get_quantity: p.get_quantity?.toString() || "", applies_to: p.applies_to,
      minimum_order: p.minimum_order?.toString() || "0",
      one_time_per_customer: p.one_time_per_customer, expires_at: p.expires_at ? p.expires_at.slice(0, 10) : "",
      is_active: p.is_active,
    });
    setEditingId(p.id); setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setFormData(emptyPromo); };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setFormData((prev: any) => ({ ...prev, code }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      code: formData.code.toUpperCase().trim(),
      description: formData.description,
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value) || 0,
      applies_to: formData.applies_to,
      minimum_order: parseFloat(formData.minimum_order) || 0,
      one_time_per_customer: formData.one_time_per_customer,
      expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
      is_active: formData.is_active,
    };
    if (formData.discount_type === "buy_x_get_y") {
      payload.buy_quantity = parseInt(formData.buy_quantity) || 1;
      payload.get_quantity = parseInt(formData.get_quantity) || 1;
    }

    if (editingId) {
      const { error } = await supabase.from("promo_codes").update(payload).eq("id", editingId);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      toast({ title: "✅ Promo updated!" });
    } else {
      const { error } = await supabase.from("promo_codes").insert([payload]);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      toast({ title: "🎉 Promo code created!" });
    }
    closeDialog(); fetchPromos();
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("promo_codes").update({ is_active: !current }).eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: current ? "Promo deactivated" : "✅ Promo activated!" });
    fetchPromos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this promo code?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "Promo deleted" }); fetchPromos();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "📋 Code copied!", description: code });
  };

  const isExpired = (expires_at: string | null) => expires_at ? new Date(expires_at) < new Date() : false;

  const getDiscountLabel = (p: any) => {
    if (p.discount_type === "percentage") return `${p.discount_value}% off`;
    if (p.discount_type === "fixed") return `₱${p.discount_value} off`;
    if (p.discount_type === "free_delivery") return "Free Delivery";
    if (p.discount_type === "buy_x_get_y") return `Buy ${p.buy_quantity} Get ${p.get_quantity} Free`;
    return "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Promotions & Discounts</h2>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Create Promo</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-pink-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Promos</p><p className="text-2xl font-bold">{promos.length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-green-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-500">{promos.filter(p => p.is_active && !isExpired(p.expires_at)).length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-red-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Expired</p><p className="text-2xl font-bold text-red-500">{promos.filter(p => isExpired(p.expires_at)).length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-purple-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Uses</p><p className="text-2xl font-bold text-purple-500">{Object.values(usageCounts).reduce((a, b) => a + b, 0)}</p></CardContent></Card>
      </div>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {editingId ? "✏️ Edit Promo Code" : "🎟️ Create Promo Code"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">

            {/* Code */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Promo Code</label>
              <div className="flex gap-2">
                <Input placeholder="e.g. SWEET10" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} required className="font-mono tracking-widest" />
                <Button type="button" variant="outline" size="sm" onClick={generateCode} className="whitespace-nowrap">Auto Generate</Button>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span></label>
              <Input placeholder="e.g. 10% off for new customers" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>

            {/* Discount Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Discount Type</label>
              <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DISCOUNT_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Discount Value */}
            {formData.discount_type !== "free_delivery" && formData.discount_type !== "buy_x_get_y" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{formData.discount_type === "percentage" ? "Discount (%)" : "Discount Amount (₱)"}</label>
                <Input type="number" step="0.01" min="0" placeholder={formData.discount_type === "percentage" ? "e.g. 10" : "e.g. 50"} value={formData.discount_value} onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })} required />
              </div>
            )}

            {/* Buy X Get Y */}
            {formData.discount_type === "buy_x_get_y" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buy Quantity</label>
                  <Input type="number" min="1" placeholder="e.g. 2" value={formData.buy_quantity} onChange={(e) => setFormData({ ...formData, buy_quantity: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Get Quantity Free</label>
                  <Input type="number" min="1" placeholder="e.g. 1" value={formData.get_quantity} onChange={(e) => setFormData({ ...formData, get_quantity: e.target.value })} required />
                </div>
              </div>
            )}

            {/* Applies To */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Applies To</label>
              <Select value={formData.applies_to} onValueChange={(v) => setFormData({ ...formData, applies_to: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APPLIES_TO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Minimum Order */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Minimum Order Amount (₱) <span className="text-muted-foreground">— 0 means no minimum</span></label>
              <Input type="number" step="0.01" min="0" placeholder="e.g. 500" value={formData.minimum_order} onChange={(e) => setFormData({ ...formData, minimum_order: e.target.value })} />
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Expiry Date <span className="text-muted-foreground">— leave blank for no expiry</span></label>
              <Input type="date" value={formData.expires_at} onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })} />
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-3 pt-1">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium">One-time use per customer</span>
                <button type="button" onClick={() => setFormData({ ...formData, one_time_per_customer: !formData.one_time_per_customer })}>
                  {formData.one_time_per_customer
                    ? <ToggleRight className="h-7 w-7 text-primary" />
                    : <ToggleLeft className="h-7 w-7 text-muted-foreground" />}
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium">Active</span>
                <button type="button" onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}>
                  {formData.is_active
                    ? <ToggleRight className="h-7 w-7 text-green-500" />
                    : <ToggleLeft className="h-7 w-7 text-muted-foreground" />}
                </button>
              </label>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" className="gap-2"><Tag className="h-4 w-4" />{editingId ? "Update Promo" : "Create Promo"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Promos List ── */}
      <div className="grid gap-4">
        {promos.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-3 text-primary/30" />
            <p>No promo codes yet. Click "Create Promo" to get started!</p>
          </CardContent></Card>
        )}
        {promos.map((promo) => {
          const expired = isExpired(promo.expires_at);
          const active = promo.is_active && !expired;
          return (
            <Card key={promo.id} className={`hover:shadow-md transition-shadow ${expired ? "opacity-60" : ""}`}>
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Code badge */}
                      <span className="font-mono font-bold text-lg tracking-widest bg-primary/10 text-primary px-3 py-1 rounded-lg">
                        {promo.code}
                      </span>
                      <button onClick={() => copyCode(promo.code)} className="text-muted-foreground hover:text-primary transition-colors">
                        <Copy className="h-4 w-4" />
                      </button>
                      <Badge className={active ? "bg-green-500 text-white" : "bg-gray-400 text-white"}>
                        {expired ? "Expired" : active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{DISCOUNT_TYPE_LABELS[promo.discount_type]}</Badge>
                    </div>

                    {promo.description && <p className="text-sm text-muted-foreground">{promo.description}</p>}

                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="font-semibold text-primary">{getDiscountLabel(promo)}</span>
                      <span className="text-muted-foreground">Applies to: {APPLIES_TO_LABELS[promo.applies_to]}</span>
                      {promo.minimum_order > 0 && <span className="text-muted-foreground">Min. order: ₱{promo.minimum_order}</span>}
                      {promo.one_time_per_customer && <span className="text-muted-foreground">One-time use</span>}
                      {promo.expires_at && <span className={expired ? "text-red-500 font-medium" : "text-muted-foreground"}>Expires: {new Date(promo.expires_at).toLocaleDateString()}</span>}
                      <span className="text-muted-foreground">Used: <strong>{usageCounts[promo.id] || 0}x</strong></span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => toggleActive(promo.id, promo.is_active)} className="gap-1">
                      {promo.is_active ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
                      {promo.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(promo)} className="gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(promo.id)} className="gap-1"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// ─── CategoriesTab ────────────────────────────────────────────────────────────
const emptyCat = { name: "", description: "", image_url: "", display_order: "0" };

const CategoriesTab = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState(emptyCat);
  const { toast } = useToast();

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    const { data, error } = await (supabase as any)
      .from("categories").select("*").order("display_order", { ascending: true });
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setCategories(data || []);
  };

  const openAdd = () => { setFormData(emptyCat); setImageFile(null); setImagePreview(""); setEditingId(null); setDialogOpen(true); };
  const openEdit = (cat: any) => {
    setFormData({ name: cat.name, description: cat.description || "", image_url: cat.image_url || "", display_order: cat.display_order?.toString() || "0" });
    setImageFile(null); setImagePreview(cat.image_url || ""); setEditingId(cat.id); setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setFormData(emptyCat); setImageFile(null); setImagePreview(""); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ variant: "destructive", title: "Invalid file", description: "Please select an image." }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ variant: "destructive", title: "Too large", description: "Max 5MB." }); return; }
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
    setFormData(prev => ({ ...prev, image_url: "" }));
  };

  const uploadImage = async (): Promise<string> => {
    if (!imageFile) return formData.image_url;
    setUploadingImage(true);
    try {
      const ext = imageFile.name.split(".").pop();
      const fileName = `cat-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, imageFile, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
      return publicUrl;
    } finally { setUploadingImage(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let imageUrl = formData.image_url;
    if (imageFile) {
      try { imageUrl = await uploadImage(); }
      catch (err: any) { toast({ variant: "destructive", title: "Upload failed", description: err.message }); return; }
    }
    const payload = { name: formData.name, description: formData.description, image_url: imageUrl, display_order: parseInt(formData.display_order) || 0 };
    if (editingId) {
      const { error } = await (supabase as any).from("categories").update(payload).eq("id", editingId);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      toast({ title: "✅ Category updated!" });
    } else {
      const { error } = await (supabase as any).from("categories").insert([payload]);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      toast({ title: "🎉 Category created!" });
    }
    closeDialog(); fetchCategories();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? Products in this category will be unaffected.")) return;
    const { error } = await (supabase as any).from("categories").delete().eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "Category deleted" }); fetchCategories();
  };

  const moveOrder = async (cat: any, direction: "up" | "down") => {
    const newOrder = direction === "up" ? cat.display_order - 1 : cat.display_order + 1;
    await (supabase as any).from("categories").update({ display_order: newOrder }).eq("id", cat.id);
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Manage Categories</h2>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Category</Button>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {editingId ? "✏️ Edit Category" : "🗂️ Add Category"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Name</label>
              <Input placeholder="e.g. Cakes, Pastries, Drinks" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Order <span className="text-muted-foreground">(lower = first)</span></label>
              <Input type="number" min="0" placeholder="0" value={formData.display_order} onChange={(e) => setFormData({ ...formData, display_order: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Image <span className="text-muted-foreground">(optional)</span></label>
              {imagePreview ? (
                <div className="relative w-full h-36 rounded-xl overflow-hidden border border-border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); setFormData(prev => ({ ...prev, image_url: "" })); }} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all">
                  <ImageIcon className="h-8 w-8 text-primary/40 mb-1" />
                  <p className="text-sm font-medium text-primary">Click to upload</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={uploadingImage} className="gap-2">
                {uploadingImage ? <><RefreshCw className="h-4 w-4 animate-spin" /> Uploading...</> : editingId ? "Update" : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Categories Grid */}
      {categories.length === 0 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 text-primary/30" />
          <p>No categories yet. Add one to organize your products!</p>
        </CardContent></Card>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat, idx) => (
          <Card key={cat.id} className="hover:shadow-md transition-shadow overflow-hidden">
            {cat.image_url && <img src={cat.image_url} alt={cat.name} className="w-full h-32 object-cover" />}
            {!cat.image_url && <div className="w-full h-32 bg-gradient-to-br from-primary/10 to-accent/20 flex items-center justify-center"><Package className="h-10 w-10 text-primary/30" /></div>}
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-base">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Order: {cat.display_order ?? 0}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => moveOrder(cat, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors"><ArrowUpDown className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(cat)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                <Button variant="destructive" size="sm" className="flex-1 gap-1" onClick={() => handleDelete(cat.id)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── ReviewsTab ───────────────────────────────────────────────────────────────

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} className={`h-4 w-4 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
    ))}
  </div>
);

const ReviewsTab = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "hidden">("pending");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const { toast } = useToast();

  useEffect(() => { fetchReviews(); }, [filter]);

  const fetchReviews = async () => {
    let query = (supabase as any)
      .from("reviews")
      .select(`*, products(name, image_url), profiles(full_name, email)`)
      .order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setReviews(data || []);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("reviews").update({ status }).eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: status === "approved" ? "✅ Review approved!" : status === "hidden" ? "🚫 Review hidden" : "Review updated" });
    fetchReviews();
  };

  const submitReply = async (id: string) => {
    if (!replyText.trim()) return;
    const { error } = await (supabase as any).from("reviews").update({ admin_reply: replyText.trim() }).eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "💬 Reply posted!" });
    setReplyingId(null); setReplyText(""); fetchReviews();
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return;
    const { error } = await (supabase as any).from("reviews").delete().eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "Review deleted" }); fetchReviews();
  };

  const pending = reviews.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold">Reviews & Ratings</h2>
          {pending > 0 && <Badge className="bg-yellow-500 text-white">{pending} pending</Badge>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["pending", "approved", "hidden", "all"] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-yellow-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending</p><p className="text-2xl font-bold text-yellow-500">{reviews.filter(r => r.status === "pending").length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-green-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Approved</p><p className="text-2xl font-bold text-green-500">{reviews.filter(r => r.status === "approved").length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-red-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Hidden</p><p className="text-2xl font-bold text-red-400">{reviews.filter(r => r.status === "hidden").length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-pink-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Avg Rating</p><p className="text-2xl font-bold text-pink-500">{reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—"} ⭐</p></CardContent></Card>
      </div>

      {/* Reviews List */}
      <div className="grid gap-4">
        {reviews.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-3 text-primary/30" />
            <p>No {filter === "all" ? "" : filter} reviews yet.</p>
          </CardContent></Card>
        )}
        {reviews.map((review) => (
          <Card key={review.id} className={`hover:shadow-md transition-shadow ${review.status === "hidden" ? "opacity-60" : ""}`}>
            <CardContent className="p-5 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-accent/30 flex items-center justify-center text-sm font-bold text-primary">
                    {review.profiles?.full_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{review.profiles?.full_name || "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground">{review.profiles?.email}</p>
                  </div>
                </div>
                <Badge className={review.status === "approved" ? "bg-green-500 text-white" : review.status === "hidden" ? "bg-gray-400 text-white" : "bg-yellow-500 text-white"}>
                  {review.status}
                </Badge>
              </div>

              {/* Product + Rating */}
              <div className="flex items-center gap-3">
                {review.products?.image_url && <img src={review.products.image_url} alt={review.products.name} className="w-10 h-10 rounded-lg object-cover border border-border" />}
                <div>
                  <p className="text-sm font-medium">{review.products?.name}</p>
                  <StarRating rating={review.rating} />
                </div>
                <p className="text-xs text-muted-foreground ml-auto">{new Date(review.created_at).toLocaleDateString()}</p>
              </div>

              {/* Review Text */}
              {review.review_text && <p className="text-sm bg-muted/30 rounded-lg p-3 italic">"{review.review_text}"</p>}

              {/* Admin Reply */}
              {review.admin_reply && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-primary mb-1">🎀 Admin Reply</p>
                  <p className="text-sm">{review.admin_reply}</p>
                </div>
              )}

              {/* Reply Box */}
              {replyingId === review.id && (
                <div className="space-y-2">
                  <Textarea placeholder="Write a reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} className="resize-none text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => submitReply(review.id)} className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Post Reply</Button>
                    <Button size="sm" variant="outline" onClick={() => { setReplyingId(null); setReplyText(""); }}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap pt-1 border-t">
                {review.status !== "approved" && (
                  <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-200 hover:bg-green-50" onClick={() => updateStatus(review.id, "approved")}>
                    <CheckCircle className="h-3.5 w-3.5" /> Approve
                  </Button>
                )}
                {review.status !== "hidden" && (
                  <Button size="sm" variant="outline" className="gap-1 text-gray-500" onClick={() => updateStatus(review.id, "hidden")}>
                    <EyeOff className="h-3.5 w-3.5" /> Hide
                  </Button>
                )}
                {review.status === "hidden" && (
                  <Button size="sm" variant="outline" className="gap-1 text-blue-500" onClick={() => updateStatus(review.id, "approved")}>
                    <CheckCircle className="h-3.5 w-3.5" /> Restore
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1" onClick={() => { setReplyingId(replyingId === review.id ? null : review.id); setReplyText(review.admin_reply || ""); }}>
                  <MessageSquare className="h-3.5 w-3.5" /> {review.admin_reply ? "Edit Reply" : "Reply"}
                </Button>
                <Button size="sm" variant="destructive" className="gap-1 ml-auto" onClick={() => deleteReview(review.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Admin;