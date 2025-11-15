-- Migration: Add product variations support
-- This script adds support for product variations (like different colors, sizes) with individual pricing and stock

-- Create product_variations table
CREATE TABLE IF NOT EXISTS public.product_variations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL, -- e.g., "Camisa Azul M", "Camisa Vermelha G"
  color text, -- e.g., "Azul", "Vermelho"
  size text, -- e.g., "P", "M", "G"
  price numeric(10,2) DEFAULT 0, -- Individual price for this variation (can be different from base product)
  stock int DEFAULT 0, -- Individual stock for this variation
  images text[] DEFAULT array[]::text[], -- Specific images for this variation (if any)
  is_active boolean DEFAULT true, -- Whether this variation is available for sale
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_variations_product_id ON public.product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_color ON public.product_variations(color);
CREATE INDEX IF NOT EXISTS idx_product_variations_size ON public.product_variations(size);
CREATE INDEX IF NOT EXISTS idx_product_variations_active ON public.product_variations(is_active);

-- Add a comment for documentation
COMMENT ON TABLE public.product_variations IS 'Product variations with individual pricing and stock (e.g., different colors or sizes of the same product)';
COMMENT ON COLUMN public.product_variations.name IS 'Descriptive name for this variation (e.g., "Camisa Azul M")';
COMMENT ON COLUMN public.product_variations.color IS 'Color of this variation';
COMMENT ON COLUMN public.product_variations.size IS 'Size of this variation';
COMMENT ON COLUMN public.product_variations.price IS 'Individual price for this variation (can be different from base product)';
COMMENT ON COLUMN public.product_variations.stock IS 'Individual stock for this variation';
COMMENT ON COLUMN public.product_variations.images IS 'Specific images for this variation (if any)';
COMMENT ON COLUMN public.product_variations.is_active IS 'Whether this variation is available for sale';

-- Optional: Add a function to get available variations for a product
CREATE OR REPLACE FUNCTION public.get_product_variations(p_product_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  color text,
  size text,
  price numeric,
  stock int,
  images text[],
  is_active boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.id,
    pv.name,
    pv.color,
    pv.size,
    pv.price,
    pv.stock,
    pv.images,
    pv.is_active
  FROM public.product_variations pv
  WHERE pv.product_id = p_product_id
    AND pv.is_active = true
    AND pv.stock > 0
  ORDER BY pv.color, pv.size;
END;
$$ LANGUAGE plpgsql;

-- Optional: Add a function to get the price for a product (uses variation price if available)
CREATE OR REPLACE FUNCTION public.get_product_price(p_product_id uuid, p_variation_id uuid DEFAULT NULL)
RETURNS numeric AS $$
DECLARE
  variation_price numeric;
  base_price numeric;
BEGIN
  -- If variation ID is provided, try to get variation price
  IF p_variation_id IS NOT NULL THEN
    SELECT price INTO variation_price
    FROM public.product_variations
    WHERE id = p_variation_id
      AND product_id = p_product_id
      AND is_active = true
      AND stock > 0;
    
    -- If variation price found, return it
    IF variation_price IS NOT NULL THEN
      RETURN variation_price;
    END IF;
  END IF;
  
  -- Otherwise, return base product price
  SELECT price INTO base_price
  FROM public.products
  WHERE id = p_product_id;
  
  RETURN COALESCE(base_price, 0);
END;
$$ LANGUAGE plpgsql;