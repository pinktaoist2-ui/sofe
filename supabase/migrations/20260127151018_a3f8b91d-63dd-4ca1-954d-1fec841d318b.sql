-- Allow customers to create order_items for their own orders
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Users can insert order items for orders they own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_items'
      AND policyname = 'Users can insert own order items'
  ) THEN
    CREATE POLICY "Users can insert own order items"
    ON public.order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.orders
        WHERE orders.id = order_items.order_id
          AND orders.user_id = auth.uid()
      )
    );
  END IF;

  -- Admins can insert order items (for admin tooling / overrides)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_items'
      AND policyname = 'Admins can insert order items'
  ) THEN
    CREATE POLICY "Admins can insert order items"
    ON public.order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;