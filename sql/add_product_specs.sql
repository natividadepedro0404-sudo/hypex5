-- Migração: Adicionar campos de especificações aos produtos
-- Execute este script se você já tem produtos cadastrados

-- Adicionar coluna sizes (array de tamanhos)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sizes text[] DEFAULT array[]::text[];

-- Adicionar coluna color (cor do produto)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS color text;

-- Adicionar coluna type (tipo do produto)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS type text;

-- Adicionar coluna brand (marca do produto)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS brand text;

-- Comentários para documentação
COMMENT ON COLUMN public.products.sizes IS 'Array de tamanhos disponíveis: PP, P, M, G, GG, XG';
COMMENT ON COLUMN public.products.color IS 'Cor do produto';
COMMENT ON COLUMN public.products.type IS 'Tipo do produto: camisa, moleton, vestido, sapato, calça, short, camiseta, calca-normal, calca-jogador, bermuda-jeans, bermuda-jogador, bermuda-tectel, bermuda-elastano, blusa-times, conjunto, kit, bone, acessorio';
COMMENT ON COLUMN public.products.brand IS 'Marca do produto';

