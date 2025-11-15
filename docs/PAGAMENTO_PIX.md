# Configuração de Pagamento PIX com Efí Bank (Gerencianet)

## Pré-requisitos

1. Conta no Efí Bank (Gerencianet)
2. Chave PIX cadastrada
3. Credenciais da API (Client ID e Client Secret)

## Variáveis de Ambiente

Adicione as seguintes variáveis no seu arquivo `.env`:

```env
# Efí Bank / Gerencianet
EFIBANK_API_URL=https://api-pix.gerencianet.com.br
EFIBANK_CLIENT_ID=seu_client_id
EFIBANK_CLIENT_SECRET=seu_client_secret
EFIBANK_PIX_KEY=sua_chave_pix
EFIBANK_WEBHOOK_SECRET=seu_secret_para_validar_webhooks
```

## Configuração no Efí Bank

1. Acesse o painel do Efí Bank
2. Vá em "Integrações" > "API"
3. Crie uma aplicação e obtenha:
   - Client ID
   - Client Secret
4. Configure a chave PIX que receberá os pagamentos
5. Configure o webhook URL: `https://seudominio.com/api/webhook/efibank`

## Banco de Dados

Execute o script SQL para criar a tabela de pedidos pendentes:

```sql
-- Execute: sql/add_pending_orders_table.sql
```

## Fluxo de Pagamento

1. **Cliente clica em "Finalizar Compra"**
   - Sistema valida estoque (mas não diminui)
   - Sistema cria pagamento PIX no Efí Bank
   - Sistema cria `pending_order` (não cria `order` ainda)
   - Retorna QR Code para o cliente

2. **Cliente vê QR Code e paga**
   - Página mostra QR Code e código PIX
   - Sistema faz polling para verificar status

3. **Pagamento confirmado (via webhook)**
   - Efí Bank envia webhook para `/api/webhook/efibank`
   - Sistema cria `order` real
   - Sistema diminui estoque dos produtos
   - Sistema envia email para admin

## Testando

### Ambiente de Testes (Sandbox)

Para testes, use:
```env
EFIBANK_API_URL=https://pix-h.api.efipay.com.br
```

### Webhook Local

Para testar webhooks localmente, use uma ferramenta como:
- ngrok: `ngrok http 3000`
- Configure a URL do ngrok no painel do Efí Bank

## Certificado Digital (Produção)

⚠️ **IMPORTANTE**: A API do Efí Bank em **produção** requer certificado digital (.p12).

### Ambiente de Testes (Sandbox)
- Certificado **NÃO é necessário**
- Use: `EFIBANK_API_URL=https://pix-h.api.efipay.com.br`

### Ambiente de Produção
- Certificado **É OBRIGATÓRIO**
- Configure no `.env`:
  ```env
  EFIBANK_CERTIFICATE_PATH=/caminho/para/certificado.p12
  EFIBANK_CERTIFICATE_PASSWORD=senha_do_certificado  # Opcional - deixe vazio se o certificado não tiver senha
  ```
  
  **Nota**: Se o certificado não tiver senha, deixe `EFIBANK_CERTIFICATE_PASSWORD` vazio ou não configure essa variável.

### Como Obter o Certificado
1. Acesse o painel do Efí Bank
2. Vá em "Integrações" > "API" > "Certificados"
3. Baixe o certificado digital (.p12)
4. Configure o caminho no `.env`

**Importante sobre o caminho do certificado:**
- Você pode usar caminho absoluto: `C:\caminho\completo\certificado.p12`
- Ou caminho relativo ao projeto: `certificado\producao.p12`
- O sistema resolve automaticamente caminhos relativos

## Troubleshooting

- **Erro ECONNRESET**: 
  - Em produção: Certificado digital não configurado ou inválido
  - Verifique se `EFIBANK_CERTIFICATE_PATH` está correto
  - Para testes, use o ambiente sandbox (não requer certificado)
  
- **Erro de autenticação**: Verifique Client ID e Secret
- **QR Code não aparece**: Verifique se a chave PIX está configurada
- **Webhook não funciona**: Verifique a URL e o secret configurado

