# Deploy no Vercel - Guia de Configuração

## Problemas Comuns no Vercel

O Vercel é uma plataforma serverless, o que significa que:
- Não há filesystem persistente
- Arquivos não podem ser carregados do disco
- Certificados .p12 precisam ser armazenados como variáveis de ambiente

## Configuração das Variáveis de Ambiente

### 1. Acesse o Painel do Vercel

1. Vá para https://vercel.com
2. Selecione seu projeto
3. Vá em **Settings** > **Environment Variables**

### 2. Configure as Variáveis Obrigatórias

#### Variáveis do Supabase
```
SUPABASE_URL=sua_url_do_supabase
SUPABASE_KEY=sua_chave_do_supabase
```

#### Variáveis do Efí Bank
```
EFIBANK_API_URL=https://api-pix.gerencianet.com.br
EFIBANK_CLIENT_ID=seu_client_id
EFIBANK_CLIENT_SECRET=seu_client_secret
EFIBANK_PIX_KEY=sua_chave_pix
EFIBANK_WEBHOOK_SECRET=seu_webhook_secret (opcional)
```

### 3. Configurar Certificado Digital (IMPORTANTE)

No Vercel, você **NÃO pode** usar `EFIBANK_CERTIFICATE_PATH` porque não há filesystem.

**Solução: Use `EFIBANK_CERTIFICATE_BASE64`**

#### Passo 1: Converter o certificado para Base64

**No Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("caminho\para\certificado.p12"))
```

**No Linux/Mac:**
```bash
base64 -i certificado.p12
```

#### Passo 2: Adicionar no Vercel

1. Copie o resultado do comando acima (será uma string muito longa)
2. No Vercel, adicione a variável:
   ```
   EFIBANK_CERTIFICATE_BASE64=<cole_a_string_base64_aqui>
   ```
3. Se o certificado tiver senha, adicione também:
   ```
   EFIBANK_CERTIFICATE_PASSWORD=senha_do_certificado
   ```

**⚠️ IMPORTANTE:**
- A variável `EFIBANK_CERTIFICATE_BASE64` tem prioridade sobre `EFIBANK_CERTIFICATE_PATH`
- Se você configurar ambas, a base64 será usada
- O certificado base64 pode ser muito grande (várias linhas), mas o Vercel suporta

### 4. Outras Variáveis (Opcionais)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha
ADMIN_EMAIL=admin@seudominio.com
NODE_ENV=production
```

## Configurar Webhook no Efí Bank

1. Acesse o painel do Efí Bank
2. Vá em **Integrações** > **API** > **Webhooks**
3. Configure a URL do webhook:
   ```
   https://seu-projeto.vercel.app/api/webhook/efibank
   ```
4. Copie o secret gerado e adicione no Vercel como `EFIBANK_WEBHOOK_SECRET`

## Ambiente de Testes (Sandbox)

Se quiser testar sem certificado, use o ambiente sandbox:

```
EFIBANK_API_URL=https://pix-h.api.efipay.com.br
```

**Nota:** O sandbox não requer certificado, mas também não processa pagamentos reais.

## Verificar se Está Funcionando

Após fazer o deploy:

1. Acesse seu site no Vercel
2. Tente criar um pedido
3. Verifique os logs no Vercel:
   - Vá em **Deployments** > Seu deployment > **Functions** > Clique na função
   - Procure por mensagens de erro relacionadas ao Efí Bank

## Troubleshooting

### Erro: "Certificado não encontrado"
- **Causa:** Tentando usar `EFIBANK_CERTIFICATE_PATH` no Vercel
- **Solução:** Use `EFIBANK_CERTIFICATE_BASE64` em vez disso

### Erro: "ECONNRESET" ou "Connection reset"
- **Causa:** Certificado não configurado ou inválido
- **Solução:** 
  1. Verifique se `EFIBANK_CERTIFICATE_BASE64` está configurado
  2. Verifique se o certificado foi convertido corretamente para base64
  3. Para testes, use o ambiente sandbox

### Erro: "Credenciais inválidas"
- **Causa:** Client ID ou Secret incorretos
- **Solução:** Verifique se as variáveis estão corretas no Vercel

### Webhook não funciona
- **Causa:** URL do webhook incorreta ou não configurada
- **Solução:** 
  1. Verifique a URL no painel do Efí Bank
  2. Certifique-se de que está usando `https://` (não `http://`)
  3. Verifique se o secret está configurado corretamente

## Estrutura do Projeto no Vercel

O arquivo `vercel.json` já está configurado para:
- Servir arquivos estáticos da pasta `public`
- Rotear `/api/*` para o servidor Node.js
- Configurar o ambiente de produção

## Limitações do Vercel

- **Timeout:** Funções serverless têm timeout de 10 segundos (Hobby) ou 60 segundos (Pro)
- **Tamanho:** Variáveis de ambiente têm limite de tamanho (mas certificados base64 geralmente cabem)
- **Cold Start:** Primeira requisição pode ser mais lenta

## Alternativas

Se tiver problemas com certificados no Vercel, considere:
1. Usar ambiente sandbox para testes (não requer certificado)
2. Usar outra plataforma (Railway, Render, etc.) que suporte filesystem
3. Armazenar certificado em serviço externo (AWS S3, etc.) e baixar em runtime

