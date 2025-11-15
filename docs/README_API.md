# Hypex — API Documentation (resumo)

Base URL: /api

Autenticação: JWT no cabeçalho Authorization: Bearer <token>

Endpoints principais:

- POST /api/auth/register { email, password, name?, address? } -> cria usuário e retorna token
- POST /api/auth/login { email, password } -> token

- GET /api/products -> lista produtos públicos
- POST /api/products (admin) -> criar produto (form-data: name, description, price, stock, images[])
- PUT /api/products/:id (admin) -> atualizar
- DELETE /api/products/:id (admin)

- POST /api/orders/checkout (auth) { items: [{product_id, qty, checked}], address? } -> cria pedido e inicia pagamento PIX
- GET /api/orders (admin) -> lista pedidos
- PUT /api/orders/:id/status (admin) { status, delivery_estimate } -> atualiza status

- POST /api/webhook/efibank -> webhook para Efí Bank (payment.succeeded esperado) - protege com EFIBANK_WEBHOOK_SECRET

Notas:
- Integração Efí Bank exemplificativa: configure EFIBANK_API_URL e EFIBANK_API_KEY no .env
- Upload de imagens usa Supabase Storage bucket `product_images`. Crie o bucket e ajuste políticas.
- Bancos e tabelas: ver `sql/supabase_schema.sql`

Validações principais:
- email e password obrigatórios em registro/login
- Durante checkout, apenas itens com checked=true são cobrados
- Produtos suportam até 5 imagens (frontend/admin)

Recomendações de segurança e produção:
- Use SUPABASE service role key apenas em backend (server-side). Para operações de usuário, prefira policies RLS.
- Proteja endpoints admin por roles e tokens válidos.