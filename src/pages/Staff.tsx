import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Bell, Package, AlertTriangle, TrendingUp, ShoppingBag, RefreshCw,
  Plus, Pencil, Trash2, Upload, X, ImageIcon, ToggleLeft, ToggleRight,
  CheckCircle, Clock,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const PIE_COLORS = ["#f472b6", "#fb923c", "#facc15", "#34d399", "#60a5fa", "#a78bfa"];

// ─── Bell Icon Component (export for use in Navbar) ───────────────────────────
export const AlertBell = () => {
  const [count, setCount] = useState(0);
  const [isStaff, setIsStaff] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { checkAndCount(); }, []);

  const checkAndCount = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: staffRole } = await (supabase as any)
      .from("user_roles").select("role")
      .eq("user_id", session.user.id).eq("role", "staff").single();
    if (!staffRole) return;

    setIsStaff(true);
    let alertCount = 0;

    // Count low/out of stock + expiring
    const { data: products } = await (supabase as any)
      .from("products").select("stock_quantity, low_stock_threshold, expire_at");
    (products || []).forEach((p: any) => {
      if (p.stock_quantity <= (p.low_stock_threshold || 5)) alertCount++;
      if (p.expire_at) {
        const days = Math.ceil((new Date(p.expire_at).getTime() - Date.now()) / 86400000);
        if (days <= 7 && days >= 0) alertCount++;
      }
    });

    // Count new orders (last 24h)
    const since = new Date(); since.setHours(since.getHours() - 24);
    const { count: orderCount } = await supabase
      .from("orders").select("id", { count: "exact", head: true })
      .gte("created_at", since.toISOString());
    alertCount += orderCount || 0;

    setCount(alertCount);
  };

  if (!isStaff) return null;

  return (
    <button
      onClick={() => navigate("/staff?tab=alerts")}
      className="relative p-2 rounded-full hover:bg-muted transition-colors"
    >
      <Bell className="h-5 w-5 text-muted-foreground" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center leading-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
};

// ─── Staff Page ───────────────────────────────────────────────────────────────
const Staff = () => {
  const [loading, setLoading]         = useState(true);
  const [staffName, setStaffName]     = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { toast } = useToast();

  // Read ?tab= from URL so bell icon can deep-link to alerts
  const defaultTab = new URLSearchParams(location.search).get("tab") || "inventory";

  useEffect(() => { checkStaffAccess(); }, []);

  const checkStaffAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      const { data: adminRole } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", session.user.id).eq("role", "admin" as any).single();
      if (adminRole) { navigate("/admin"); return; }

      const { data: staffRole } = await (supabase as any)
        .from("user_roles").select("role, permissions")
        .eq("user_id", session.user.id).eq("role", "staff").single();

      if (!staffRole) {
        toast({ variant: "destructive", title: "Access Denied", description: "You don't have staff privileges." });
        navigate("/"); return;
      }

      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", session.user.id).single();
      setStaffName((profile as any)?.full_name || "Staff");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/10 to-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Staff Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Welcome back, {staffName} 👋</p>
          </div>
        </div>

        {/* defaultValue reads ?tab= from URL — bell icon links directly to alerts */}
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto h-auto flex-nowrap justify-start gap-1 pb-1">
            <TabsTrigger value="inventory" className="whitespace-nowrap">📦 Inventory</TabsTrigger>
            <TabsTrigger value="products"  className="whitespace-nowrap">🧁 Products</TabsTrigger>
            <TabsTrigger value="sales"     className="whitespace-nowrap">📈 Sales Report</TabsTrigger>
            <TabsTrigger value="alerts"    className="whitespace-nowrap flex items-center gap-1">
              🔔 Alerts
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0 h-5 min-w-5 rounded-full">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="inventory"><StaffInventoryTab /></TabsContent>
          <TabsContent value="products"><StaffProductsTab /></TabsContent>
          <TabsContent value="sales"><StaffSalesTab /></TabsContent>
          <TabsContent value="alerts"><StaffAlertsTab onUnreadChange={setUnreadCount} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// ─── Staff Inventory Tab ──────────────────────────────────────────────────────
const StaffInventoryTab = () => {
  const [products, setProducts]     = useState<any[]>([]);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ stock_quantity: "", low_stock_threshold: "", expire_at: "" });
  const [addOpen, setAddOpen]       = useState(false);
  const [addForm, setAddForm]       = useState({ name: "", stock_quantity: "", low_stock_threshold: "5", expire_at: "", price: "" });
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading]   = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchInventory(); }, []);

  const fetchInventory = async () => {
    const { data, error } = await (supabase as any)
      .from("products").select("id, name, image_url, stock_quantity, low_stock_threshold, expire_at, price, is_active")
      .order("stock_quantity", { ascending: true });
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setProducts(data || []);
  };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setEditValues({ stock_quantity: p.stock_quantity?.toString() || "0", low_stock_threshold: p.low_stock_threshold?.toString() || "5", expire_at: p.expire_at || "" });
  };

  const handleSave = async (id: string) => {
    const { error } = await (supabase as any).from("products").update({
      stock_quantity: parseInt(editValues.stock_quantity),
      low_stock_threshold: parseInt(editValues.low_stock_threshold),
      expire_at: editValues.expire_at,
    }).eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "✅ Inventory updated!" }); setEditingId(null); fetchInventory();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" permanently?`)) return;
    const { error } = await (supabase as any).from("products").delete().eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "Product deleted" }); fetchInventory();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string> => {
    if (!imageFile) return "";
    setUploading(true);
    try {
      const ext = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, imageFile, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
      return publicUrl;
    } finally { setUploading(false); }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    let imageUrl = "";
    if (imageFile) {
      try { imageUrl = await uploadImage(); }
      catch (err: any) { toast({ variant: "destructive", title: "Upload failed", description: err.message }); return; }
    }
    const { error } = await (supabase as any).from("products").insert([{
      name: addForm.name, price: parseFloat(addForm.price),
      stock_quantity: parseInt(addForm.stock_quantity),
      low_stock_threshold: parseInt(addForm.low_stock_threshold),
      expire_at: addForm.expire_at, image_url: imageUrl,
      description: "", is_active: true,
    }]);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "🎉 Item added!" });
    setAddOpen(false);
    setAddForm({ name: "", stock_quantity: "", low_stock_threshold: "5", expire_at: "", price: "" });
    setImageFile(null); setImagePreview(""); fetchInventory();
  };

  const getStockStatus = (p: any) => {
    if (p.stock_quantity === 0) return { label: "Out of Stock", color: "bg-red-500" };
    if (p.stock_quantity <= (p.low_stock_threshold || 5)) return { label: "Low Stock", color: "bg-yellow-500" };
    return { label: "In Stock", color: "bg-green-500" };
  };
  const isExpired     = (d: string) => d ? new Date(d) < new Date() : false;
  const isExpiringSoon = (d: string) => { if (!d) return false; const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); return days <= 7 && days >= 0; };

  const lowStockCount  = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 5)).length;
  const outOfStockCount = products.filter(p => p.stock_quantity === 0).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Inventory Management</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchInventory} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Add Item</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-400"><CardContent className="p-4 flex items-center gap-3"><Package className="h-8 w-8 text-blue-400" /><div><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-bold">{products.length}</p></div></CardContent></Card>
        <Card className="border-l-4 border-l-yellow-400"><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-yellow-400" /><div><p className="text-sm text-muted-foreground">Low / Out of Stock</p><p className="text-2xl font-bold">{lowStockCount + outOfStockCount}</p></div></CardContent></Card>
        <Card className="border-l-4 border-l-red-400"><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-red-400" /><div><p className="text-sm text-muted-foreground">Out of Stock</p><p className="text-2xl font-bold">{outOfStockCount}</p></div></CardContent></Card>
      </div>

      {/* Low Stock Alert Banner */}
      {(lowStockCount + outOfStockCount) > 0 && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-800 font-medium">
            ⚠️ {lowStockCount + outOfStockCount} product(s) need restocking — check items marked Low Stock or Out of Stock below.
          </p>
        </div>
      )}

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>📦 Add New Item</DialogTitle></DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Name</label>
              <Input placeholder="e.g. Croissant" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Price (₱)</label>
                <Input type="number" step="0.01" min="0" value={addForm.price} onChange={e => setAddForm({ ...addForm, price: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Stock Quantity</label>
                <Input type="number" min="0" value={addForm.stock_quantity} onChange={e => setAddForm({ ...addForm, stock_quantity: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Low Stock Alert At</label>
                <Input type="number" min="1" value={addForm.low_stock_threshold} onChange={e => setAddForm({ ...addForm, low_stock_threshold: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Expiry Date</label>
                <Input type="date" value={addForm.expire_at} onChange={e => setAddForm({ ...addForm, expire_at: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Image</label>
              {imagePreview ? (
                <div className="relative w-full h-36 rounded-xl overflow-hidden border">
                  <img src={imagePreview} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:border-primary/60 transition-all">
                  <ImageIcon className="h-8 w-8 text-primary/40 mb-1" />
                  <p className="text-sm text-primary">Click to upload</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={uploading} className="gap-2">
                {uploading ? <><RefreshCw className="h-4 w-4 animate-spin" /> Uploading...</> : <><Plus className="h-4 w-4" /> Add Item</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inventory Table */}
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40">
          <th className="text-left p-4 font-semibold">Product</th>
          <th className="text-left p-4 font-semibold">Status</th>
          <th className="text-left p-4 font-semibold">Stock</th>
          <th className="text-left p-4 font-semibold">Low Stock Alert</th>
          <th className="text-left p-4 font-semibold">Expiry</th>
          <th className="text-left p-4 font-semibold">Actions</th>
        </tr></thead>
        <tbody>
          {products.map(p => {
            const status    = getStockStatus(p);
            const expired   = isExpired(p.expire_at);
            const expiring  = isExpiringSoon(p.expire_at);
            const isEditing = editingId === p.id;
            return (
              <tr key={p.id} className={`border-b hover:bg-muted/20 transition-colors ${expired ? "bg-red-50/30" : ""}`}>
                <td className="p-4"><div className="flex items-center gap-3">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>}
                  <div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">₱{p.price?.toFixed(2)}</p></div>
                </div></td>
                <td className="p-4">
                  <Badge className={`${status.color} text-white text-xs`}>{status.label}</Badge>
                  {expired  && <Badge className="bg-red-700 text-white text-xs ml-1">Expired</Badge>}
                  {expiring && !expired && <Badge className="bg-orange-400 text-white text-xs ml-1">Expiring Soon</Badge>}
                </td>
                <td className="p-4">{isEditing ? <Input type="number" value={editValues.stock_quantity} onChange={e => setEditValues({ ...editValues, stock_quantity: e.target.value })} className="w-24 h-8 text-sm" min="0" /> : <span className={`font-semibold ${p.stock_quantity === 0 ? "text-red-500" : p.stock_quantity <= (p.low_stock_threshold || 5) ? "text-yellow-500" : "text-green-600"}`}>{p.stock_quantity}</span>}</td>
                <td className="p-4">{isEditing ? <Input type="number" value={editValues.low_stock_threshold} onChange={e => setEditValues({ ...editValues, low_stock_threshold: e.target.value })} className="w-24 h-8 text-sm" min="1" /> : <span className="text-muted-foreground">{p.low_stock_threshold || 5} units</span>}</td>
                <td className="p-4">{isEditing ? <Input type="date" value={editValues.expire_at} onChange={e => setEditValues({ ...editValues, expire_at: e.target.value })} className="w-36 h-8 text-sm" /> : <span className={expired ? "text-red-500 font-medium" : expiring ? "text-orange-500 font-medium" : ""}>{p.expire_at ? new Date(p.expire_at).toLocaleDateString() : "—"}</span>}</td>
                <td className="p-4">{isEditing
                  ? <div className="flex gap-2"><Button size="sm" onClick={() => handleSave(p.id)}>Save</Button><Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button></div>
                  : <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(p)} className="gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(p.id, p.name)} className="gap-1"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                    </div>
                }</td>
              </tr>
            );
          })}
          {products.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No products found.</td></tr>}
        </tbody>
      </table></div></CardContent></Card>
    </div>
  );
};

// ─── Staff Products Tab ───────────────────────────────────────────────────────
const emptyProductForm = { name: "", description: "", price: "", image_url: "", stock_quantity: "", expire_at: "" };

const StaffProductsTab = () => {
  const [products, setProducts]     = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading]   = useState(false);
  const [formData, setFormData]     = useState(emptyProductForm);
  const { toast } = useToast();

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const { data, error } = await (supabase as any)
      .from("products").select("*").order("created_at", { ascending: false });
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    setProducts(data || []);
  };

  const openAdd = () => { setFormData(emptyProductForm); setImageFile(null); setImagePreview(""); setEditingId(null); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setFormData({ name: p.name, description: p.description || "", price: p.price.toString(), image_url: p.image_url || "", stock_quantity: p.stock_quantity.toString(), expire_at: p.expire_at || "" });
    setImageFile(null); setImagePreview(p.image_url || ""); setEditingId(p.id); setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setFormData(emptyProductForm); setImageFile(null); setImagePreview(""); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ variant: "destructive", title: "Too large", description: "Max 5MB." }); return; }
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
    setFormData(prev => ({ ...prev, image_url: "" }));
  };

  const uploadImage = async (): Promise<string> => {
    if (!imageFile) return formData.image_url;
    setUploading(true);
    try {
      const ext = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, imageFile, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
      return publicUrl;
    } finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let imageUrl = formData.image_url;
    if (imageFile) {
      try { imageUrl = await uploadImage(); }
      catch (err: any) { toast({ variant: "destructive", title: "Upload failed", description: err.message }); return; }
    }
    const payload = { name: formData.name, description: formData.description, price: parseFloat(formData.price), image_url: imageUrl, stock_quantity: parseInt(formData.stock_quantity), expire_at: formData.expire_at };
    if (editingId) {
      const { error } = await (supabase as any).from("products").update(payload).eq("id", editingId);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      toast({ title: "✅ Product updated!" });
    } else {
      const { error } = await (supabase as any).from("products").insert([{ ...payload, is_active: true }]);
      if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
      toast({ title: "🎉 Product added!" });
    }
    closeDialog(); fetchProducts();
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await (supabase as any).from("products").update({ is_active: !current }).eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: current ? "Product disabled — hidden from shop" : "✅ Product enabled!" });
    fetchProducts();
  };

  // ── Delete product permanently ──
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    const { error } = await (supabase as any).from("products").delete().eq("id", id);
    if (error) { toast({ variant: "destructive", title: "Error", description: error.message }); return; }
    toast({ title: "Product deleted" }); fetchProducts();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Product Management</h2>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Pastry</Button>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {editingId ? "✏️ Edit Product" : "🧁 Add New Pastry"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Name</label>
              <Input placeholder="e.g. Strawberry Cake" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea placeholder="Describe the product..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Price (₱)</label>
                <Input type="number" step="0.01" placeholder="0.00" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Stock Quantity</label>
                <Input type="number" placeholder="0" value={formData.stock_quantity} onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expiration Date</label>
              <Input type="date" value={formData.expire_at} onChange={e => setFormData({ ...formData, expire_at: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Image</label>
              {imagePreview ? (
                <div className="relative w-full h-44 rounded-xl overflow-hidden border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); setFormData(prev => ({ ...prev, image_url: "" })); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all">
                  <ImageIcon className="h-10 w-10 text-primary/40" />
                  <p className="text-sm font-medium text-primary mt-2">Click to upload image</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={uploading} className="gap-2">
                {uploading ? <><RefreshCw className="h-4 w-4 animate-spin" /> Uploading...</> : editingId ? <><Pencil className="h-4 w-4" /> Update</> : <><Upload className="h-4 w-4" /> Add Product</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Products List */}
      <div className="grid gap-4">
        {products.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 text-primary/30" />
            <p>No products yet.</p>
          </CardContent></Card>
        )}
        {products.map(p => (
          <Card key={p.id} className={`hover:shadow-md transition-shadow ${!p.is_active ? "opacity-60" : ""}`}>
            <CardContent className="p-5">
              <div className="flex gap-4 items-center">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} className="w-20 h-20 object-cover rounded-xl border flex-shrink-0" />
                  : <div className="w-20 h-20 rounded-xl border bg-muted flex items-center justify-center flex-shrink-0"><Package className="h-8 w-8 text-muted-foreground" /></div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg truncate">{p.name}</h3>
                    <Badge className={p.is_active ? "bg-green-500 text-white" : "bg-gray-400 text-white"}>
                      {p.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{p.description}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <span className="font-bold text-primary">₱{p.price?.toFixed(2)}</span>
                    <span className="text-muted-foreground">Stock: <strong>{p.stock_quantity}</strong></span>
                    <span className="text-muted-foreground">Expires: {p.expire_at ? new Date(p.expire_at).toLocaleDateString() : "—"}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="gap-1">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(p.id, p.is_active)} className="gap-1">
                    {p.is_active
                      ? <><ToggleRight className="h-4 w-4 text-green-500" /> Disable</>
                      : <><ToggleLeft className="h-4 w-4" /> Enable</>}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id, p.name)} className="gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── Staff Sales Tab ──────────────────────────────────────────────────────────
const StaffSalesTab = () => {
  const [orders, setOrders]         = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const { toast } = useToast();

  useEffect(() => { fetchSales(); }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const { data: ordersData } = await supabase
        .from("orders").select("id, created_at, status, total_amount")
        .neq("status", "cancelled").order("created_at", { ascending: true });

      const { data: itemsData } = await supabase
        .from("order_items").select("quantity, price, product_id, products(name)")
        .in("order_id", (ordersData || []).map((o: any) => o.id));

      setOrders(ordersData || []);
      setOrderItems(itemsData || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally { setLoading(false); }
  };

  const dailySales = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days[d.toLocaleDateString("en-US", { month: "short", day: "numeric" })] = 0;
    }
    orders.forEach(o => {
      const key = new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (key in days) days[key] = (days[key] || 0) + (o.total_amount || 0);
    });
    return Object.entries(days).map(([label, revenue]) => ({ label, revenue: parseFloat(revenue.toFixed(2)) }));
  }, [orders]);

  const weeklySales = useMemo(() => {
    const weeks: Record<string, number> = {};
    for (let i = 3; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i * 7);
      const label = `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      weeks[label] = 0;
    }
    orders.forEach(o => {
      const date = new Date(o.created_at);
      for (let i = 3; i >= 0; i--) {
        const start = new Date(); start.setDate(start.getDate() - (i + 1) * 7);
        const end   = new Date(); end.setDate(end.getDate() - i * 7);
        if (date >= start && date < end) {
          const label = `Week of ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          if (label in weeks) weeks[label] = (weeks[label] || 0) + (o.total_amount || 0);
        }
      }
    });
    return Object.entries(weeks).map(([label, revenue]) => ({ label, revenue: parseFloat(revenue.toFixed(2)) }));
  }, [orders]);

  const bestSelling = useMemo(() => {
    const grouped: Record<string, number> = {};
    orderItems.forEach(item => {
      const name = (item.products as any)?.name || "Unknown";
      grouped[name] = (grouped[name] || 0) + item.quantity;
    });
    return Object.entries(grouped).map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [orderItems]);

  const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalOrders  = orders.length;
  const todayRevenue = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((s, o) => s + (o.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Sales Report</h2>
      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="h-8 w-8 animate-spin text-primary/50" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-pink-400"><CardContent className="p-4"><div className="flex items-center justify-between mb-1"><p className="text-sm text-muted-foreground">Today's Revenue</p><TrendingUp className="h-4 w-4 text-pink-400" /></div><p className="text-2xl font-bold text-pink-500">₱{todayRevenue.toFixed(2)}</p></CardContent></Card>
            <Card className="border-l-4 border-l-blue-400"><CardContent className="p-4"><div className="flex items-center justify-between mb-1"><p className="text-sm text-muted-foreground">Total Orders</p><ShoppingBag className="h-4 w-4 text-blue-400" /></div><p className="text-2xl font-bold text-blue-500">{totalOrders}</p></CardContent></Card>
            <Card className="border-l-4 border-l-purple-400"><CardContent className="p-4"><div className="flex items-center justify-between mb-1"><p className="text-sm text-muted-foreground">All-Time Revenue</p><TrendingUp className="h-4 w-4 text-purple-400" /></div><p className="text-2xl font-bold text-purple-500">₱{totalRevenue.toFixed(2)}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">📅 Daily Sales (Last 7 Days)</CardTitle></CardHeader>
            <CardContent>
              {dailySales.every(d => d.revenue === 0)
                ? <p className="text-center text-muted-foreground py-8">No sales in the last 7 days.</p>
                : <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={dailySales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                      <Tooltip formatter={(v: any) => [`₱${v}`, "Revenue"]} />
                      <Line type="monotone" dataKey="revenue" stroke="#f472b6" strokeWidth={2.5} dot={{ fill: "#f472b6", r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">📆 Weekly Sales (Last 4 Weeks)</CardTitle></CardHeader>
            <CardContent>
              {weeklySales.every(d => d.revenue === 0)
                ? <p className="text-center text-muted-foreground py-8">No weekly sales data yet.</p>
                : <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklySales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                      <Tooltip formatter={(v: any) => [`₱${v}`, "Revenue"]} />
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                        {weeklySales.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">🏆 Best-Selling Pastries</CardTitle></CardHeader>
            <CardContent>
              {bestSelling.length === 0
                ? <p className="text-center text-muted-foreground py-8">No sales data yet.</p>
                : <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={bestSelling} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => [v, "Units sold"]} />
                      <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                        {bestSelling.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

// ─── Staff Alerts Tab ─────────────────────────────────────────────────────────
type Alert = {
  id: string;
  type: "low_stock" | "new_order" | "expiring" | "out_of_stock";
  title: string;
  message: string;
  time: Date;
  read: boolean;
};

const StaffAlertsTab = ({ onUnreadChange }: { onUnreadChange: (n: number) => void }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { generateAlerts(); }, []);
  useEffect(() => { onUnreadChange(alerts.filter(a => !a.read).length); }, [alerts]);

  const generateAlerts = async () => {
    setLoading(true);
    const generated: Alert[] = [];
    try {
      const { data: products } = await (supabase as any)
        .from("products").select("id, name, stock_quantity, low_stock_threshold, expire_at");

      (products || []).forEach((p: any) => {
        if (p.stock_quantity === 0) {
          generated.push({ id: `out-${p.id}`, type: "out_of_stock", title: "Out of Stock", message: `"${p.name}" is completely out of stock and unavailable to customers.`, time: new Date(), read: false });
        } else if (p.stock_quantity <= (p.low_stock_threshold || 5)) {
          generated.push({ id: `low-${p.id}`, type: "low_stock", title: "Low Stock Alert", message: `"${p.name}" is running low — only ${p.stock_quantity} unit(s) left (threshold: ${p.low_stock_threshold || 5}).`, time: new Date(), read: false });
        }
        if (p.expire_at) {
          const days = Math.ceil((new Date(p.expire_at).getTime() - Date.now()) / 86400000);
          if (days <= 7 && days >= 0) {
            generated.push({ id: `exp-${p.id}`, type: "expiring", title: "Expiring Soon", message: `"${p.name}" expires in ${days} day(s) on ${new Date(p.expire_at).toLocaleDateString()}.`, time: new Date(), read: false });
          }
        }
      });

      const since = new Date(); since.setHours(since.getHours() - 24);
      const { data: recentOrders } = await supabase
        .from("orders").select("id, created_at, total_amount, status")
        .gte("created_at", since.toISOString()).order("created_at", { ascending: false });

      (recentOrders || []).forEach((o: any) => {
        generated.push({ id: `order-${o.id}`, type: "new_order", title: "New Order Received", message: `Order #${o.id.slice(0, 8)} was placed for ₱${o.total_amount?.toFixed(2)} — status: ${o.status}.`, time: new Date(o.created_at), read: false });
      });

      generated.sort((a, b) => b.time.getTime() - a.time.getTime());
      setAlerts(generated);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error loading alerts", description: err.message });
    } finally { setLoading(false); }
  };

  const markRead   = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  const dismiss    = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));

  const iconFor = (type: Alert["type"]) => {
    if (type === "low_stock")    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    if (type === "out_of_stock") return <AlertTriangle className="h-5 w-5 text-red-500" />;
    if (type === "new_order")    return <ShoppingBag className="h-5 w-5 text-blue-500" />;
    if (type === "expiring")     return <Clock className="h-5 w-5 text-orange-500" />;
  };

  const colorFor = (type: Alert["type"]) => {
    if (type === "low_stock")    return "border-l-yellow-400 bg-yellow-50/30";
    if (type === "out_of_stock") return "border-l-red-400 bg-red-50/30";
    if (type === "new_order")    return "border-l-blue-400 bg-blue-50/30";
    if (type === "expiring")     return "border-l-orange-400 bg-orange-50/30";
    return "";
  };

  const unread = alerts.filter(a => !a.read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold">Alerts & Notifications</h2>
          {unread > 0 && <Badge className="bg-red-500 text-white">{unread} new</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={generateAlerts} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
          {unread > 0 && <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2"><CheckCircle className="h-4 w-4" /> Mark All Read</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-red-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Out of Stock</p><p className="text-2xl font-bold text-red-500">{alerts.filter(a => a.type === "out_of_stock").length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-yellow-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-2xl font-bold text-yellow-500">{alerts.filter(a => a.type === "low_stock").length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-blue-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">New Orders (24h)</p><p className="text-2xl font-bold text-blue-500">{alerts.filter(a => a.type === "new_order").length}</p></CardContent></Card>
        <Card className="border-l-4 border-l-orange-400"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Expiring Soon</p><p className="text-2xl font-bold text-orange-500">{alerts.filter(a => a.type === "expiring").length}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="h-8 w-8 animate-spin text-primary/50" /></div>
      ) : alerts.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-3 text-primary/30" />
          <p className="text-lg font-medium">All clear!</p>
          <p className="text-sm mt-1">No alerts right now. Everything looks good 🎉</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {alerts.map(alert => (
            <Card key={alert.id} className={`border-l-4 transition-all hover:shadow-md ${colorFor(alert.type)} ${alert.read ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">{iconFor(alert.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{alert.title}</p>
                      {!alert.read && <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">New</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.time.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!alert.read && (
                      <Button size="sm" variant="ghost" onClick={() => markRead(alert.id)} className="h-7 px-2 text-xs gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> Read
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => dismiss(alert.id)} className="h-7 px-2 text-xs">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Staff;