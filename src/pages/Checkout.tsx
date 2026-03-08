import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 9; hour <= 18; hour++) {
    for (const min of [0, 30]) {
      if (hour === 18 && min === 30) break;
      const h = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? "AM" : "PM";
      const m = min === 0 ? "00" : "30";
      slots.push(`${h}:${m} ${ampm}`);
    }
  }
  return slots;
};

const generateAvailableDates = () => {
  const dates: { label: string; value: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label =
      i === 0
        ? "Today"
        : i === 1
        ? "Tomorrow"
        : d.toLocaleDateString("en-PH", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
    const value = d.toISOString().split("T")[0];
    dates.push({ label, value });
  }
  return dates;
};

/* ─────────────────────────────────────────────────────────────
   Schedule Modal (inline so it's self-contained in one file)
───────────────────────────────────────────────────────────── */
const ScheduleModal = ({
  open,
  onOpenChange,
  deliveryMethod,
  initialDate,
  initialTime,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deliveryMethod: string;
  initialDate: string;
  initialTime: string;
  onConfirm: (date: string, time: string) => void;
}) => {
  const availableDates = generateAvailableDates();
  const timeSlots = generateTimeSlots();
  const [localDate, setLocalDate] = useState(initialDate);
  const [localTime, setLocalTime] = useState(initialTime);

  // sync when modal reopens
  React.useEffect(() => {
    if (open) {
      setLocalDate(initialDate);
      setLocalTime(initialTime);
    }
  }, [open, initialDate, initialTime]);

  const isPickup = deliveryMethod === "pickup";

  const dateCls = (active: boolean) =>
    `px-2 py-2.5 rounded-2xl border text-xs font-medium transition-all cursor-pointer select-none text-center ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-background border-border text-foreground hover:bg-primary/5 hover:border-primary/30"
    }`;

  const timeCls = (active: boolean) =>
    `px-2 py-2.5 rounded-2xl border text-xs font-medium transition-all cursor-pointer select-none text-center ${
      active
        ? "bg-primary/20 text-primary border-primary/40"
        : "bg-background border-border text-foreground hover:bg-primary/5 hover:border-primary/30"
    }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6 gap-0">
        <DialogHeader className="mb-5">
          <DialogTitle className="text-base font-bold text-foreground">
            {isPickup ? "Pick-up Schedule" : "Delivery Schedule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Date chips */}
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-foreground">
              Preferred date <span className="text-destructive">*</span>
            </p>
            <div className="grid grid-cols-4 gap-2">
              {availableDates.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setLocalDate(d.value)}
                  className={dateCls(localDate === d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time chips */}
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-foreground">
              Preferred time <span className="text-destructive">*</span>
            </p>
            <div className="grid grid-cols-4 gap-2">
              {timeSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setLocalTime(slot)}
                  className={timeCls(localTime === slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
            {!localTime && (
              <p className="text-xs text-muted-foreground">Please select a time slot.</p>
            )}
          </div>

          {/* Hint */}
          <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/10 rounded-xl px-3.5 py-2.5 leading-relaxed">
            {isPickup
              ? "⏳ Fresh orders typically take 30–60 minutes to prepare. We'll have your order ready by your chosen time!"
              : "🚗 Delivery usually takes 45–90 minutes depending on your location. We'll aim to arrive within your chosen time window."}
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!localTime}
              onClick={() => {
                onConfirm(localDate, localTime);
                onOpenChange(false);
              }}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm Schedule
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ─────────────────────────────────────────────────────────────
   Main Checkout page
───────────────────────────────────────────────────────────── */
const Checkout = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [showGCashQR, setShowGCashQR] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);
  const [isGift, setIsGift] = useState(false);
  const [selectedDate, setSelectedDate] = useState(generateAvailableDates()[0].value);
  const [selectedTime, setSelectedTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const availableDates = generateAvailableDates();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      const [cartResponse, profileResponse] = await Promise.all([
        supabase.from("cart_items")
          .select(`id, quantity, product:products (id, name, price)`)
          .eq("user_id", session.user.id),
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      ]);

      if (cartResponse.error) throw cartResponse.error;
      if (profileResponse.error) throw profileResponse.error;

      setCartItems(cartResponse.data || []);
      setProfile(profileResponse.data);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;

    if (!selectedTime) {
      toast({
        variant: "destructive",
        title: "Please select a time slot",
        description: `Choose a preferred ${deliveryMethod === "pickup" ? "pick-up" : "delivery"} time to continue.`,
      });
      return;
    }

    const formData = new FormData(formRef.current);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const paymentMethodValue = formData.get("payment_method") as string;
      const deliveryAddress =
        deliveryMethod === "delivery"
          ? (formData.get("address") as string)
          : "Pick-up at store";
      const scheduledDateTime = `${selectedDate} ${selectedTime}`;
      const giftMessage = isGift ? (formData.get("gift_message") as string) : null;
      const recipientName = isGift ? (formData.get("recipient_name") as string) : null;
      const totalAmount = cartItems.reduce(
        (sum, item) => sum + (item.product?.price || 0) * item.quantity, 0
      );

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: session.user.id,
          total_amount: totalAmount,
          delivery_address: deliveryAddress,
          phone: formData.get("phone") as string,
          notes: formData.get("notes") as string,
          payment_method: paymentMethodValue,
          delivery_method: deliveryMethod,
          scheduled_time: scheduledDateTime,
          is_gift: isGift,
          gift_message: giftMessage,
          recipient_name: recipientName,
        })
        .select().single();

      if (orderError) throw orderError;

      const { error: itemsError } = await supabase.from("order_items").insert(
        cartItems.map((item) => ({
          order_id: order.id,
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
        }))
      );
      if (itemsError) throw itemsError;

      await supabase.from("cart_items").delete().eq("user_id", session.user.id);

      if (paymentMethodValue === "gcash") {
        setOrderTotal(totalAmount);
        setShowGCashQR(true);
      } else {
        toast({ title: "Order placed successfully!", description: "Thank you for your order. We'll start preparing it right away!" });
        navigate("/");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error placing order", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity, 0
  );

  const inputCls =
    "w-full px-3.5 py-2.5 border border-border rounded-lg text-sm bg-background text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground";

  const MethodToggle = ({
    id, value, label, icon, checked, onChange,
  }: {
    id: string; value: string; label: string; icon: React.ReactNode;
    checked: boolean; onChange: () => void;
  }) => (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex-1 ${
        checked
          ? "bg-primary/10 border-primary text-primary"
          : "bg-background border-border text-muted-foreground hover:bg-accent/30"
      }`}
    >
      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        checked ? "border-primary" : "border-muted-foreground/40"
      }`}>
        {checked && <span className="w-2 h-2 rounded-full bg-primary block" />}
      </span>
      {icon}
      {label}
    </button>
  );

  const scheduledLabel = selectedTime
    ? `${availableDates.find((d) => d.value === selectedDate)?.label} at ${selectedTime}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── GCash QR Dialog ── */}
      <Dialog open={showGCashQR} onOpenChange={setShowGCashQR}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>GCash Payment</DialogTitle>
            <DialogDescription>
              Scan the QR code below to complete your payment of ₱{orderTotal.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 p-4">
            <img src={gcashQR} alt="GCash QR Code" className="w-64 h-64 object-contain" />
            <p className="text-sm text-muted-foreground text-center">
              After payment, your order will be processed automatically.
            </p>
            <button
              onClick={() => {
                setShowGCashQR(false);
                toast({ title: "Order placed successfully!", description: "Thank you for your order. We'll start preparing it right away!" });
                navigate("/");
              }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Schedule Modal ── */}
      <ScheduleModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        deliveryMethod={deliveryMethod}
        initialDate={selectedDate}
        initialTime={selectedTime}
        onConfirm={(date, time) => {
          setSelectedDate(date);
          setSelectedTime(time);
        }}
      />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-[28px] font-bold text-foreground mb-8">Checkout</h1>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="flex gap-8 items-start">

            {/* ════ LEFT COLUMN ════ */}
            <div className="flex-1 min-w-0 space-y-8">

              {/* Shipping Information */}
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3">Shipping Information</h2>
                <div className="flex gap-3 mb-6">
                  <MethodToggle
                    id="pickup" value="pickup" label="Pick up" checked={deliveryMethod === "pickup"}
                    onChange={() => setDeliveryMethod("pickup")}
                    icon={
                      <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                    }
                  />
                  <MethodToggle
                    id="delivery" value="delivery" label="Delivery" checked={deliveryMethod === "delivery"}
                    onChange={() => setDeliveryMethod("delivery")}
                    icon={
                      <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                      </svg>
                    }
                  />
                </div>
                <input type="hidden" name="delivery_method" value={deliveryMethod} />

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Phone number <span className="text-destructive">*</span>
                    </label>
                    <input
                      name="phone" type="tel" required
                      placeholder="09XX XXX XXXX"
                      defaultValue={profile?.phone || ""}
                      className={inputCls}
                    />
                  </div>

                  {deliveryMethod === "delivery" && (
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        Delivery address <span className="text-destructive">*</span>
                      </label>
                      <textarea
                        name="address" required rows={3}
                        placeholder="Enter your complete delivery address"
                        defaultValue={profile?.address || ""}
                        className={inputCls}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Order notes <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <textarea
                      name="notes" rows={2}
                      placeholder="Any special instructions? (e.g. nut allergy, no sugar, extra packaging)"
                      className={inputCls}
                    />
                  </div>
                </div>
              </section>

              {/* Payment Method */}
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3">Payment Method</h2>
                <div className="space-y-2.5">
                  {[
                    { value: "gcash", label: "GCash" },
                    { value: "cash",  label: "Cash"  },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                        paymentMethod === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/30"
                      }`}
                    >
                      <input
                        type="radio" name="payment_method" value={opt.value} required
                        checked={paymentMethod === opt.value}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </section>

              {/* ── Schedule — trigger button instead of inline picker ── */}
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3">
                  {deliveryMethod === "pickup" ? "Pick-up Schedule" : "Delivery Schedule"}
                </h2>

                <button
                  type="button"
                  onClick={() => setShowScheduleModal(true)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                    scheduledLabel
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:bg-accent/30 text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {/* calendar icon */}
                    <svg className={`w-4 h-4 flex-shrink-0 ${scheduledLabel ? "text-primary" : "text-muted-foreground"}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {scheduledLabel ? (
                      <span className="font-medium">{scheduledLabel}</span>
                    ) : (
                      <span>Select a date &amp; time…</span>
                    )}
                  </span>
                  {/* chevron */}
                  <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>

                {/* change link shown once a time is selected */}
                {scheduledLabel && (
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="mt-1.5 text-xs text-primary hover:underline ml-1"
                  >
                    Change schedule
                  </button>
                )}
              </section>

              {/* Gift Options */}
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3">🎁 Gift Options</h2>
                <label className="flex items-center gap-3 cursor-pointer select-none mb-4">
                  <div
                    onClick={() => setIsGift(!isGift)}
                    className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${isGift ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isGift ? "translate-x-5" : "translate-x-1"}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground">This order is a gift</span>
                </label>

                {isGift && (
                  <div className="space-y-4 pl-1">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">Recipient's name</label>
                      <input name="recipient_name" type="text" required={isGift}
                        placeholder="Who is this for?" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        Gift message <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <textarea name="gift_message" rows={3}
                        placeholder="Write a sweet message to include with your order… 🎂"
                        className={inputCls} />
                      <p className="text-xs text-muted-foreground mt-1">
                        Your message will be printed on a card and included with the order.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Terms */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-xs text-muted-foreground">
                  I have read and agree to the{" "}
                  <span className="text-primary underline cursor-pointer">Terms and Conditions</span>.
                </span>
              </label>
            </div>

            {/* ════ RIGHT COLUMN — sticky cart ════ */}
            <div className="w-[340px] flex-shrink-0 sticky top-6 space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Review your cart</h2>

                <div className="space-y-4 mb-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-accent/60 border border-border flex-shrink-0 flex items-center justify-center overflow-hidden">
                        <svg className="w-7 h-7 text-muted-foreground/40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.product?.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.quantity}x</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          ₱{((item.product?.price || 0) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4 mb-4">
                  {/* Discount code */}
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg bg-background">
                      <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                      </svg>
                      <input
                        type="text" placeholder="Discount code"
                        className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <button type="button"
                      className="px-4 py-2.5 text-xs font-semibold text-primary border border-border rounded-lg hover:bg-accent/40 transition-colors"
                    >
                      Apply
                    </button>
                  </div>

                  {/* Totals */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium text-foreground">₱{totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="font-medium text-foreground">
                        {deliveryMethod === "pickup" ? "Free" : "₱50.00"}
                      </span>
                    </div>
                    {scheduledLabel && (
                      <div className="text-xs text-muted-foreground pt-1">
                        {deliveryMethod === "pickup" ? "Pick-up" : "Delivery"} on {scheduledLabel}
                      </div>
                    )}
                    {isGift && (
                      <div className="text-xs text-muted-foreground">🎁 Gift order</div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                    <span className="text-sm font-bold text-foreground">Total</span>
                    <span className="text-base font-bold text-foreground">
                      ₱{(totalAmount + (deliveryMethod === "delivery" ? 50 : 0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !agreedToTerms}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Placing Order…" : "Pay Now"}
                </button>
              </div>

              {/* Secure badge */}
              <div className="flex gap-3 items-start bg-card border border-border rounded-2xl px-4 py-3.5">
                <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <div>
                  <p className="text-xs font-semibold text-foreground">Secure Checkout – SSL Encrypted</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Ensuring your financial and personal details are secure during every transaction.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </form>
      </main>
    </div>
  );
};

export default Checkout;