# Configuração do Arquivo .env

## Variáveis Obrigatórias para Pagamento PIX

Para que o sistema de pagamento PIX funcione, você precisa preencher as seguintes variáveis no arquivo `.env`:

### 1. Credenciais do Efí Bank

```env
EFIBANK_CLIENT_ID=seu_client_id_aqui
EFIBANK_CLIENT_SECRET=seu_client_secret_aqui
EFIBANK_PIX_KEY=sua_chave_pix_aqui
```

### 2. Como Obter as Credenciais

#### Passo 1: Acesse o Painel do Efí Bank
- Acesse: https://app.efipay.com.br/ (ou https://app.gerencianet.com.br/)
- Faça login na sua conta

#### Passo 2: Obter Client ID e Client Secret
1. Vá em **"Integrações"** > **"API"** ou **"Aplicações"**
2. Crie uma nova aplicação ou use uma existente
3. Copie o **Client ID** e **Client Secret**
4. Cole no arquivo `.env`:
   ```
   EFIBANK_CLIENT_ID=Client_xxxxxxxxxxxxx
   EFIBANK_CLIENT_SECRET=Client_Secret_xxxxxxxxxxxxx
   ```

#### Passo 3: Configurar Chave PIX
1. No painel do Efí Bank, vá em **"Chaves PIX"** ou **"Minhas Chaves"**
2. Selecione ou crie uma chave PIX (CPF, Email, Telefone ou Chave Aleatória)
3. Copie a chave PIX
4. Cole no arquivo `.env`:
   ```
   EFIBANK_PIX_KEY=seu_cpf@email.com.br
   ```
   ou
   ```
   EFIBANK_PIX_KEY=+5511999999999
   ```
   ou
   ```
   EFIBANK_PIX_KEY=12345678900
   ```

### 3. Ambiente de Testes (Sandbox)

Se estiver testando, use a URL do ambiente de testes:
```env
EFIBANK_API_URL=https://pix-h.api.efipay.com.br
```

Para produção, use:
```env
EFIBANK_API_URL=https://api-pix.gerencianet.com.br
```

### 4. Webhook (Opcional)

Para receber notificações de pagamento confirmado:
```env
EFIBANK_WEBHOOK_SECRET=seu_secret_aqui
```

Configure a URL do webhook no painel do Efí Bank:
- URL: `https://seudominio.com/api/webhook/efibank`
- Para testes locais, use ngrok: `ngrok http 3000` e configure a URL do ngrok

## Exemplo Completo

```env
# Efí Bank / Gerencianet
EFIBANK_API_URL=https://pix-h.api.efipay.com.br
EFIBANK_CLIENT_ID=Client_abc123xyz
EFIBANK_CLIENT_SECRET=Client_Secret_def456uvw
EFIBANK_PIX_KEY=12345678900
EFIBANK_WEBHOOK_SECRET=meu_secret_seguro_123
```

## Verificação

Após preencher as variáveis:

1. **Reinicie o servidor** (se estiver rodando):
   ```bash
   # Pare o servidor (Ctrl+C) e inicie novamente
   npm start
   ```

2. **Teste criando um pagamento** - o erro deve desaparecer se as credenciais estiverem corretas.

## Problemas Comuns

### "Chave PIX não configurada"
- Verifique se `EFIBANK_PIX_KEY` está preenchida no arquivo `.env`
- Certifique-se de que não há espaços extras antes ou depois do valor

### "Credenciais inválidas"
- Verifique se `EFIBANK_CLIENT_ID` e `EFIBANK_CLIENT_SECRET` estão corretos
- Certifique-se de que está usando as credenciais do ambiente correto (sandbox vs produção)

### "Erro na autenticação"
- Verifique se a URL da API está correta (`EFIBANK_API_URL`)
- Certifique-se de que as credenciais correspondem ao ambiente (sandbox usa URL diferente)

