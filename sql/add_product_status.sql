-- Migração: Adicionar campo de status aos produtos
-- Execute este script para adicionar o campo is_active aos produtos

-- Adicionar coluna is_active (boolean) com valor padrão true
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Comentários para documentação
COMMENT ON COLUMN public.products.is_active IS 'Status do produto: true = ativo (visível), false = inativo (oculto)';

-- Atualizar produtos existentes para garantir que todos tenham is_active = true
UPDATE public.products 
SET is_active = true 
WHERE is_active IS NULL;