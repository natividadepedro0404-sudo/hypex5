# Configuração de Favoritos

## Problema: Erro ao carregar favoritos

Se você está vendo o erro "Erro ao carregar favoritos", é provável que a tabela de favoritos não tenha sido criada no banco de dados Supabase.

## Solução

### 1. Execute o SQL no Supabase

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Vá para o seu projeto
3. Clique em **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Copie e cole o conteúdo do arquivo `sql/add_favorites_table.sql`:

```sql
-- Tabela de favoritos
create table if not exists public.favorites (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, product_id)
);

-- Índice para melhorar performance nas consultas
create index if not exists idx_favorites_user_id on public.favorites(user_id);
create index if not exists idx_favorites_product_id on public.favorites(product_id);
```

6. Clique em **Run** para executar o SQL
7. Verifique se a tabela foi criada corretamente (deve aparecer uma mensagem de sucesso)

### 2. Verificar se a tabela foi criada

1. No Supabase Dashboard, vá para **Table Editor**
2. Verifique se a tabela `favorites` aparece na lista
3. A tabela deve ter as colunas:
   - `id` (uuid, primary key)
   - `user_id` (uuid, foreign key para users)
   - `product_id` (uuid, foreign key para products)
   - `created_at` (timestamp)

### 3. Configurar Row Level Security (RLS) - Opcional mas Recomendado

Para garantir que os usuários só vejam seus próprios favoritos:

1. No Supabase Dashboard, vá para **Authentication** > **Policies**
2. Selecione a tabela `favorites`
3. Crie uma política para SELECT:

```sql
-- Permitir que usuários vejam apenas seus próprios favoritos
CREATE POLICY "Users can view their own favorites"
ON public.favorites
FOR SELECT
USING (auth.uid() = user_id);
```

4. Crie uma política para INSERT:

```sql
-- Permitir que usuários adicionem favoritos
CREATE POLICY "Users can insert their own favorites"
ON public.favorites
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

5. Crie uma política para DELETE:

```sql
-- Permitir que usuários removam seus próprios favoritos
CREATE POLICY "Users can delete their own favorites"
ON public.favorites
FOR DELETE
USING (auth.uid() = user_id);
```

**Nota**: Se você estiver usando autenticação customizada (não o Auth do Supabase), pode precisar ajustar essas políticas ou desabilitar RLS temporariamente.

### 4. Reiniciar o servidor

Após criar a tabela, reinicie o servidor Node.js:

```bash
# Pare o servidor (Ctrl+C) e inicie novamente
node server.js
```

### 5. Testar

1. Faça login no site
2. Vá para a página de favoritos
3. Tente adicionar um produto aos favoritos
4. Verifique se os favoritos são salvos corretamente

## Troubleshooting

### Erro: "relation 'favorites' does not exist"

- A tabela não foi criada. Execute o SQL novamente.

### Erro: "permission denied for table favorites"

- Verifique as políticas RLS no Supabase
- Ou desabilite RLS temporariamente na tabela para testar

### Erro: "foreign key constraint fails"

- Verifique se as tabelas `users` e `products` existem
- Verifique se os IDs estão no formato correto (UUID)

### Os favoritos não aparecem

- Verifique se você está logado
- Verifique se o token de autenticação está sendo enviado corretamente
- Verifique os logs do servidor para ver se há erros

## Verificação

Para verificar se tudo está funcionando:

1. Execute no SQL Editor do Supabase:

```sql
-- Verificar se a tabela existe
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'favorites';

-- Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'favorites';

-- Verificar se há dados (se já tiver adicionado favoritos)
SELECT COUNT(*) FROM public.favorites;
```

Se todas as queries retornarem resultados esperados, a configuração está correta!

