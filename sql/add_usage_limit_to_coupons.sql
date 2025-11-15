-- Migração: Adicionar coluna usage_limit à tabela coupons
-- Execute este script para adicionar suporte a limite de uso de cupons

-- Adicionar coluna usage_limit (limite de uso do cupom)
ALTER TABLE public.coupons 
ADD COLUMN IF NOT EXISTS usage_limit integer;

-- Comentário para documentação
COMMENT ON COLUMN public.coupons.usage_limit IS 'Limite de uso do cupom. NULL ou 0 significa ilimitado. Deve ser >= 0.';

-- Verificar se a coluna foi criada (opcional - para confirmar)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'coupons' 
  AND column_name = 'usage_limit';

