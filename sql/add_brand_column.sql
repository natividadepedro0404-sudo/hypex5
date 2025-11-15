
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS brand text;

-- Comentário para documentação
COMMENT ON COLUMN public.products.brand IS 'Marca do produto (ex: nike, adidas, gucci, etc.)';

-- Verificar se a coluna foi criada (opcional - para confirmar)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'products' 
  AND column_name = 'brand';
