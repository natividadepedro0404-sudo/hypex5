const fetch = require('node-fetch');
const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Serviço de integração com Efí Bank (Gerencianet)
 * Documentação: https://dev.gerencianet.com.br/
 * 
 * IMPORTANTE: A API do Efí Bank requer certificado digital (.p12) em produção.
 * Configure EFIBANK_CERTIFICATE_PATH e EFIBANK_CERTIFICATE_PASSWORD no .env
 */

class EfibankService {
  constructor() {
    // Por padrão, usar ambiente de testes (sandbox) que não requer certificado
    // Para produção, configure EFIBANK_API_URL=https://api-pix.gerencianet.com.br
    this.baseURL = process.env.EFIBANK_API_URL || 'https://pix-h.api.efipay.com.br';
    this.clientId = process.env.EFIBANK_CLIENT_ID;
    this.clientSecret = process.env.EFIBANK_CLIENT_SECRET;
    this.certificatePath = process.env.EFIBANK_CERTIFICATE_PATH; // Caminho para certificado .p12
    this.certificatePassword = process.env.EFIBANK_CERTIFICATE_PASSWORD || ''; // Senha do certificado (opcional)
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Cria um agente HTTPS com certificado (se disponível)
   * Para certificados .p12, precisamos usar o módulo https do Node.js
   * 
   * Suporta duas formas de carregar o certificado:
   * 1. Via caminho de arquivo (desenvolvimento/local)
   * 2. Via variável de ambiente base64 (Vercel/serverless)
   */
  getHttpsAgent() {
    let p12Buffer = null;

    // Tentar carregar certificado via variável de ambiente (base64) - para Vercel/serverless
    const certBase64 = process.env.EFIBANK_CERTIFICATE_BASE64;
    if (certBase64) {
      try {
        console.log('[Efí Bank] Carregando certificado via variável de ambiente (base64)');
        p12Buffer = Buffer.from(certBase64, 'base64');
        console.log(`[Efí Bank] ✓ Certificado carregado da variável de ambiente (${p12Buffer.length} bytes)`);
      } catch (error) {
        console.error('[Efí Bank] ERRO ao decodificar certificado base64:', error.message);
        return null;
      }
    }
    // Tentar carregar certificado via caminho de arquivo (desenvolvimento/local)
    else if (this.certificatePath) {
      try {
        // Normalizar caminho (resolver caminhos relativos)
        // Remover barra inicial se for caminho relativo do Windows
        let certPath = this.certificatePath.replace(/^\\/, ''); // Remove \ inicial
        
        if (!path.isAbsolute(certPath)) {
          certPath = path.resolve(process.cwd(), certPath);
        }
        
        console.log(`[Efí Bank] Tentando carregar certificado de: ${certPath}`);
        console.log(`[Efí Bank] Caminho original: ${this.certificatePath}`);
        console.log(`[Efí Bank] Diretório atual: ${process.cwd()}`);
        
        if (!fs.existsSync(certPath)) {
          console.error(`[Efí Bank] ERRO: Certificado não encontrado em: ${certPath}`);
          console.error(`[Efí Bank] Verifique se o caminho está correto no arquivo .env`);
          console.error(`[Efí Bank] Para Vercel/serverless, use EFIBANK_CERTIFICATE_BASE64 em vez de EFIBANK_CERTIFICATE_PATH`);
          return null;
        }

        // Verificar se é um arquivo válido
        const stats = fs.statSync(certPath);
        console.log(`[Efí Bank] Certificado encontrado! Tamanho: ${stats.size} bytes`);

        // Ler o certificado .p12
        p12Buffer = fs.readFileSync(certPath);
        console.log(`[Efí Bank] Certificado lido com sucesso (${p12Buffer.length} bytes)`);
      } catch (error) {
        console.error('[Efí Bank] ERRO ao carregar certificado:', error.message);
        console.error('[Efí Bank] Stack:', error.stack);
        console.error('[Efí Bank] Certifique-se de que:');
        console.error('  1. O caminho está correto no arquivo .env');
        console.error('  2. O arquivo é um certificado .p12 válido');
        console.error('  3. O certificado não está corrompido');
        console.error('  4. Para Vercel/serverless, use EFIBANK_CERTIFICATE_BASE64');
        return null;
      }
    } else {
      console.log('[Efí Bank] Certificado não configurado');
      console.log('[Efí Bank] Para produção, configure EFIBANK_CERTIFICATE_BASE64 (Vercel) ou EFIBANK_CERTIFICATE_PATH (local)');
      return null; // Sem certificado, usar fetch padrão
    }

    // Criar agente HTTPS com certificado
    try {
      const agentOptions = {
        pfx: p12Buffer,
        passphrase: this.certificatePassword || ''
      };

      const agent = new https.Agent(agentOptions);
      console.log(`[Efí Bank] ✓ Agente HTTPS criado com certificado`);
      return agent;
    } catch (error) {
      console.error('[Efí Bank] ERRO ao criar agente HTTPS:', error.message);
      return null;
    }
  }

  /**
   * Faz uma requisição HTTPS usando o módulo https diretamente (para certificados .p12)
   * @param {String} url - URL completa da requisição
   * @param {Object} options - Opções da requisição { method, headers, body, agent }
   * @returns {Promise<Object>} - Resposta parseada como JSON
   */
  makeHttpsRequest(url, options) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const httpsOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        agent: options.agent
      };

      const req = https.request(httpsOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.error(`[Efí Bank] Erro na resposta: ${res.statusCode} - ${data}`);
            let errorMessage = `Erro na requisição (${res.statusCode}): ${data}`;
            if (res.statusCode === 401) {
              errorMessage = 'Token de autenticação inválido ou expirado.';
            } else if (res.statusCode === 403) {
              errorMessage = 'Acesso negado. Verifique as permissões da conta Efí Bank.';
            }
            reject(new Error(errorMessage));
            return;
          }

          try {
            const jsonData = JSON.parse(data);
            resolve({ data: jsonData, status: res.statusCode });
          } catch (parseError) {
            reject(new Error(`Erro ao processar resposta: ${parseError.message}. Resposta: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('[Efí Bank] Erro na requisição HTTPS:', error);
        reject(error);
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  /**
   * Autentica usando módulo https diretamente (para certificados .p12)
   */
  authenticateWithHttps(authUrl, fetchOptions) {
    return this.makeHttpsRequest(authUrl, {
      method: 'POST',
      headers: fetchOptions.headers,
      body: fetchOptions.body,
      agent: fetchOptions.agent
    }).then((result) => {
      const jsonData = result.data;
      if (!jsonData.access_token) {
        throw new Error('Token de acesso não recebido da API do Efí Bank.');
      }

      this.accessToken = jsonData.access_token;
      this.tokenExpiresAt = Date.now() + (jsonData.expires_in - 300) * 1000;
      console.log('[Efí Bank] ✓ Autenticação bem-sucedida com certificado');
      return this.accessToken;
    });
  }

  /**
   * Autentica e obtém token de acesso
   */
  async authenticate() {
    try {
      // Validar credenciais
      if (!this.clientId || !this.clientSecret) {
        throw new Error('Credenciais do Efí Bank não configuradas. Verifique EFIBANK_CLIENT_ID e EFIBANK_CLIENT_SECRET.');
      }

      // Se já temos um token válido, retornar
      if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
        return this.accessToken;
      }

      // Autenticar usando OAuth2
      // A API do Gerencianet usa autenticação básica com grant_type
      // IMPORTANTE: Usa application/x-www-form-urlencoded, não JSON
      const authUrl = `${this.baseURL}/oauth/token`;
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      // Log para debug (não mostrar credenciais completas)
      console.log(`[Efí Bank] Tentando autenticar em: ${authUrl}`);
      console.log(`[Efí Bank] Client ID: ${this.clientId ? this.clientId.substring(0, 20) + '...' : 'NÃO CONFIGURADO'}`);

      // Preparar opções da requisição
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      };

      // NOTA: A API do Efí Bank requer certificado digital (.p12) em produção
      // Para ambiente de testes (sandbox), o certificado NÃO é necessário e deve ser ignorado
      const isProduction = this.baseURL.includes('api-pix.gerencianet.com.br') || 
                          this.baseURL.includes('api.efipay.com.br');
      const isSandbox = this.baseURL.includes('pix-h.api.efipay.com.br');
      
      // Apenas tentar usar certificado em produção
      if (isProduction && !isSandbox) {
        console.log('[Efí Bank] Ambiente de PRODUÇÃO detectado - certificado é obrigatório');
        const httpsAgent = this.getHttpsAgent();
        if (httpsAgent) {
          fetchOptions.agent = httpsAgent;
          console.log('[Efí Bank] Requisição será feita COM certificado');
        } else {
          console.error('[Efí Bank] ERRO: Certificado é obrigatório em produção mas não foi carregado!');
          throw new Error(
            'Certificado digital não foi carregado. ' +
            'Em produção, o certificado é obrigatório. ' +
            'Verifique se EFIBANK_CERTIFICATE_PATH está correto no arquivo .env'
          );
        }
      } else if (isSandbox && this.certificatePath) {
        console.log('[Efí Bank] Ambiente sandbox detectado - certificado será ignorado (não é necessário)');
      }

      // Se estiver em produção com certificado, usar https diretamente
      // node-fetch pode ter problemas com certificados .p12
      if (isProduction && !isSandbox && fetchOptions.agent) {
        console.log('[Efí Bank] Usando módulo https diretamente (com certificado)');
        return this.authenticateWithHttps(authUrl, fetchOptions);
      }

      // Para sandbox ou sem certificado, usar fetch normal
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos
      
      let response;
      try {
        response = await fetch(authUrl, {
          ...fetchOptions,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Efí Bank] Erro na resposta: ${response.status} - ${errorText}`);
          let errorMessage = `Erro na autenticação Efí Bank (${response.status}): ${errorText}`;
          if (response.status === 401) {
            errorMessage = 'Credenciais inválidas. Verifique EFIBANK_CLIENT_ID e EFIBANK_CLIENT_SECRET. ' +
                          'Certifique-se de que está usando credenciais do ambiente correto (sandbox vs produção).';
          }
          throw new Error(errorMessage);
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Timeout ao conectar com a API do Efí Bank. Verifique sua conexão com a internet.');
        }
        throw fetchError;
      }
      
      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('Token de acesso não recebido da API do Efí Bank.');
      }

      this.accessToken = data.access_token;
      // Token expira em menos 5 minutos para segurança
      this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('Erro ao autenticar no Efí Bank:', error);
      
      // Tratamento específico para erros de conexão
      if (error.code === 'ECONNRESET' || error.message.includes('ECONNRESET')) {
        const isSandbox = this.baseURL.includes('pix-h.api.efipay.com.br');
        let errorMsg = 'Erro de conexão com a API do Efí Bank. ';
        
        if (isSandbox) {
          errorMsg += 'Você está usando o ambiente sandbox. Possíveis causas: ';
          errorMsg += '1) Credenciais incorretas (certifique-se de usar credenciais do sandbox), ';
          errorMsg += '2) Problemas de rede/firewall, ';
          errorMsg += '3) URL da API incorreta. ';
          errorMsg += 'Verifique se EFIBANK_CLIENT_ID e EFIBANK_CLIENT_SECRET são do ambiente sandbox.';
        } else {
          errorMsg += 'Possíveis causas: ';
          errorMsg += '1) Certificado digital não configurado ou inválido (requerido em produção), ';
          errorMsg += '2) Problemas de rede/firewall, ';
          errorMsg += '3) URL da API incorreta. ';
          errorMsg += 'Verifique a documentação em docs/PAGAMENTO_PIX.md';
        }
        
        throw new Error(errorMsg);
      }
      
      if (error.code === 'ENOTFOUND' || error.message.includes('ENOTFOUND')) {
        throw new Error(
          'Não foi possível resolver o endereço da API do Efí Bank. ' +
          'Verifique se EFIBANK_API_URL está correto no arquivo .env'
        );
      }
      
      if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        throw new Error(
          'Timeout ao conectar com a API do Efí Bank. ' +
          'Verifique sua conexão com a internet e tente novamente.'
        );
      }
      
      throw error;
    }
  }

  /**
   * Cria uma cobrança PIX
   * @param {Object} params - { amount, description, metadata }
   * @returns {Object} - { txid, qrcode, qrcode_image, expires_at }
   */
  async createPixCharge({ amount, description, metadata = {} }) {
    try {
      // Validar valor
      if (!amount || amount <= 0) {
        throw new Error('Valor do pagamento deve ser maior que zero.');
      }

      // Validar chave PIX
      if (!process.env.EFIBANK_PIX_KEY) {
        throw new Error('Chave PIX não configurada. Verifique EFIBANK_PIX_KEY no arquivo .env');
      }

      const token = await this.authenticate();

      // Formatar valor (PIX requer valor em reais com 2 casas decimais)
      // Formato esperado: "10.50" (não "1050" ou "10.5")
      const amountFormatted = amount.toFixed(2);

      const payload = {
        calendario: {
          expiracao: 3600 // 1 hora em segundos
        },
        valor: {
          original: amountFormatted
        },
        chave: process.env.EFIBANK_PIX_KEY, // Chave PIX da conta
        solicitacaoPagador: description || 'Pagamento HYPEX',
        infoAdicionais: [
          {
            nome: 'Pedido',
            valor: metadata.order_id || 'N/A'
          }
        ]
      };

      const isProduction = this.baseURL.includes('api-pix.gerencianet.com.br') || 
                          this.baseURL.includes('api.efipay.com.br');
      const isSandbox = this.baseURL.includes('pix-h.api.efipay.com.br');
      const httpsAgent = isProduction && !isSandbox ? this.getHttpsAgent() : null;

      let data;
      
      // Se estiver em produção com certificado, usar https diretamente
      if (isProduction && !isSandbox && httpsAgent) {
        console.log('[Efí Bank] Criando cobrança PIX usando módulo https diretamente (com certificado)');
        const result = await this.makeHttpsRequest(`${this.baseURL}/v2/cob`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          agent: httpsAgent
        });
        data = result.data;
      } else {
        // Para sandbox ou sem certificado, usar fetch normal
        const response = await fetch(`${this.baseURL}/v2/cob`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Erro ao criar cobrança PIX (${response.status}): ${errorText}`;
          
          // Mensagens de erro mais específicas
          if (response.status === 400) {
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.violacoes && Array.isArray(errorData.violacoes)) {
                errorMessage = `Erro de validação: ${errorData.violacoes.map(v => v.razao).join(', ')}`;
              }
            } catch (e) {
              // Se não conseguir parsear, usar mensagem original
            }
          } else if (response.status === 401) {
            errorMessage = 'Token de autenticação inválido ou expirado.';
          } else if (response.status === 403) {
            errorMessage = 'Acesso negado. Verifique as permissões da conta Efí Bank.';
          }
          
          throw new Error(errorMessage);
        }

        data = await response.json();
      }

      // Validar campos obrigatórios na resposta
      if (!data.txid) {
        throw new Error('Resposta da API não contém txid. Resposta: ' + JSON.stringify(data));
      }

      // O código PIX pode vir em diferentes campos dependendo da API
      // A API do Efí Bank retorna em diferentes formatos
      let qrcode = data.pixCopiaECola || 
                   data.qrcode || 
                   data.pix?.copiaECola || 
                   data.pixCopiaECola || 
                   null;
      
      console.log('[Efí Bank] Campos disponíveis na resposta:', Object.keys(data));
      console.log('[Efí Bank] Tentando encontrar QR code...');
      
      // Se não veio o QR code mas temos location, buscar separadamente
      if (!qrcode && data.loc?.id) {
        console.log('[Efí Bank] QR code não veio na resposta inicial. Buscando usando location:', data.loc.id);
        try {
          qrcode = await this.getQRCodeByLocation(data.loc.id);
          console.log('[Efí Bank] QR code obtido via location:', qrcode ? 'Sim' : 'Não');
        } catch (locationError) {
          console.error('[Efí Bank] Erro ao buscar QR code por location:', locationError);
          // Continuar mesmo sem QR code, o frontend pode gerar depois
        }
      }
      
      if (!qrcode) {
        console.warn('[Efí Bank] Código PIX não encontrado na resposta. Campos disponíveis:', Object.keys(data));
        console.warn('[Efí Bank] Resposta completa:', JSON.stringify(data, null, 2));
      } else {
        console.log('[Efí Bank] ✓ QR code obtido com sucesso');
      }

      // Calcular data de expiração
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (data.calendario?.expiracao || 3600));

      // Gerar imagem do QR Code se não vier da API
      let qrcodeImage = data.imagemQrcode || null;
      if (!qrcodeImage && qrcode) {
        qrcodeImage = this.generateQRCodeImage(qrcode);
        console.log('[Efí Bank] Imagem do QR code gerada:', qrcodeImage);
      }

      return {
        txid: data.txid,
        qrcode: qrcode,
        qrcode_image: qrcodeImage,
        expires_at: expiresAt.toISOString(),
        location: data.loc?.id || null
      };
    } catch (error) {
      console.error('Erro ao criar cobrança PIX:', error);
      throw error;
    }
  }

  /**
   * Busca QR Code usando o location ID
   * @param {String} locationId - ID do location retornado na criação da cobrança
   * @returns {String} - Código PIX (pixCopiaECola)
   */
  async getQRCodeByLocation(locationId) {
    try {
      if (!locationId) {
        throw new Error('Location ID é obrigatório');
      }

      const token = await this.authenticate();

      const isProduction = this.baseURL.includes('api-pix.gerencianet.com.br') || 
                          this.baseURL.includes('api.efipay.com.br');
      const isSandbox = this.baseURL.includes('pix-h.api.efipay.com.br');
      const httpsAgent = isProduction && !isSandbox ? this.getHttpsAgent() : null;

      let data;
      
      // Se estiver em produção com certificado, usar https diretamente
      if (isProduction && !isSandbox && httpsAgent) {
        console.log('[Efí Bank] Buscando QR code por location usando módulo https diretamente (com certificado)');
        const result = await this.makeHttpsRequest(`${this.baseURL}/v2/loc/${locationId}/qrcode`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          agent: httpsAgent
        });
        data = result.data;
      } else {
        // Para sandbox ou sem certificado, usar fetch normal
        const response = await fetch(`${this.baseURL}/v2/loc/${locationId}/qrcode`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro ao buscar QR Code (${response.status}): ${errorText}`);
        }

        data = await response.json();
      }
      
      return data.qrcode || data.pixCopiaECola || null;
    } catch (error) {
      console.error('Erro ao buscar QR Code por location:', error);
      throw error;
    }
  }

  /**
   * Consulta status de uma cobrança PIX
   * @param {String} txid - ID da transação
   * @returns {Object} - { status, paid_at }
   */
  async getPixChargeStatus(txid) {
    try {
      const token = await this.authenticate();

      const isProduction = this.baseURL.includes('api-pix.gerencianet.com.br') || 
                          this.baseURL.includes('api.efipay.com.br');
      const isSandbox = this.baseURL.includes('pix-h.api.efipay.com.br');
      const httpsAgent = isProduction && !isSandbox ? this.getHttpsAgent() : null;

      let data;
      
      // Endpoint correto: /v2/cob/{txid} para consultar cobrança PIX
      // /v2/pix/{txid} é para consultar pagamentos recebidos, não cobranças
      const endpoint = `${this.baseURL}/v2/cob/${txid}`;
      
      // Se estiver em produção com certificado, usar https diretamente
      if (isProduction && !isSandbox && httpsAgent) {
        console.log('[Efí Bank] Consultando status do PIX usando módulo https diretamente (com certificado)');
        const result = await this.makeHttpsRequest(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          agent: httpsAgent
        });
        data = result.data;
      } else {
        // Para sandbox ou sem certificado, usar fetch normal
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 404) {
            return { status: 'not_found' };
          }
          const error = await response.text();
          throw new Error(`Erro ao consultar cobrança PIX: ${error}`);
        }

        data = await response.json();
      }

      // A resposta da API vem no formato:
      // { status: 'ATIVA' | 'CONCLUIDA' | 'REMOVIDA_POR_PAGADOR' | 'REMOVIDA_POR_USUARIO_RECEBEDOR', ... }
      // Se status for 'CONCLUIDA', o pagamento foi realizado
      const status = data.status || 'ATIVA';
      const isPaid = status === 'CONCLUIDA';
      
      // Se pago, buscar informações do pagamento
      let paidAt = null;
      if (isPaid && data.pix && Array.isArray(data.pix) && data.pix.length > 0) {
        paidAt = data.pix[0].horario || null;
      }
      
      return {
        status: isPaid ? 'paid' : (status === 'REMOVIDA_POR_PAGADOR' || status === 'REMOVIDA_POR_USUARIO_RECEBEDOR' ? 'cancelled' : 'pending'),
        paid_at: paidAt,
        amount: data.valor ? parseFloat(data.valor.original) : null
      };
    } catch (error) {
      console.error('Erro ao consultar status do PIX:', error);
      throw error;
    }
  }

  /**
   * Gera imagem do QR Code a partir do código PIX
   * Usa API externa para gerar QR Code visual
   */
  generateQRCodeImage(qrcode) {
    if (!qrcode) return null;
    // Usar API pública para gerar QR Code
    // Alternativa: usar biblioteca qrcode no servidor
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrcode)}`;
  }
}

module.exports = new EfibankService();

