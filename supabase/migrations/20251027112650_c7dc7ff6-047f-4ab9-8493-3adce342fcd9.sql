-- Add payment and delivery method to orders table
ALTER TABLE public.orders 
ADD COLUMN payment_method text,
ADD COLUMN delivery_method text;

-- Add check constraints for valid values
ALTER TABLE public.orders 
ADD CONSTRAINT payment_method_check 
CHECK (payment_method IN ('gcash', 'cash'));

ALTER TABLE public.orders 
ADD CONSTRAINT delivery_method_check 
CHECK (delivery_method IN ('delivery', 'pickup'));