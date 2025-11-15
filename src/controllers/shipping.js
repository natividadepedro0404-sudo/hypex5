const express = require('express');
const fetch = require('node-fetch');
const melhorEnvioService = require('../services/melhorenvio');

const router = express.Router();

// POST /api/shipping/calculate
// Main shipping calculation endpoint using Melhor Envio
// body: { cepDestino: string, qtdItens?: number, pesoPorItemKg?: number, products?: Array }
router.post('/calculate', async (req, res) => {
  try {
    const { cepDestino, qtdItens = 1, pesoPorItemKg = 0.3, products } = req.body || {};
    
    if (!cepDestino) {
      return res.status(400).json({ error: 'cepDestino é obrigatório' });
    }

    let services;

    // If detailed products info is provided, use it
    if (products && Array.isArray(products) && products.length > 0) {
      services = await melhorEnvioService.calculateShipping({
        toPostalCode: cepDestino,
        products: products
      });
    } else {
      // Simple calculation based on quantity and weight
      services = await melhorEnvioService.calculateSimpleShipping(
        cepDestino,
        qtdItens,
        pesoPorItemKg
      );
    }

    // Transform to simplified format for frontend
    const mapped = services.map(s => ({
      id: s.id,
      code: String(s.id), // For compatibility with existing frontend code
      name: s.name,
      company: s.company.name,
      price: s.custom_price || s.price,
      prazo: s.delivery_time,
      error: s.error || null
    }));

    res.json({ services: mapped });
  } catch (err) {
    console.error('Erro ao calcular frete (Melhor Envio):', err);
    
    // If Melhor Envio is not configured, return default options
    if (err.message && err.message.includes('MELHOR_ENVIO_TOKEN')) {
      const defaultServices = [
        { id: 1, code: '1', name: 'PAC', company: 'Correios', price: 15.00, prazo: 7, error: null },
        { id: 2, code: '2', name: 'SEDEX', company: 'Correios', price: 25.00, prazo: 3, error: null }
      ];
      return res.json({ services: defaultServices });
    }
    
    res.status(500).json({ 
      error: err.message || 'Erro ao calcular frete',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// GET helper for testing: /api/shipping/calculate/:cepDestino?qtdItens=1
router.get('/calculate/:cepDestino', async (req, res) => {
  try {
    const cepDestino = req.params.cepDestino;
    const qtdItens = req.query.qtdItens ? Number(req.query.qtdItens) : 1;
    const pesoPorItemKg = req.query.weight ? Number(req.query.weight) : 0.3;

    if (!cepDestino) {
      return res.status(400).json({ error: 'cepDestino é obrigatório' });
    }

    const services = await melhorEnvioService.calculateSimpleShipping(
      cepDestino,
      qtdItens,
      pesoPorItemKg
    );

    const mapped = services.map(s => ({
      id: s.id,
      code: String(s.id),
      name: s.name,
      company: s.company.name,
      price: s.custom_price || s.price,
      prazo: s.delivery_time,
      error: s.error || null
    }));

    res.json({ services: mapped });
  } catch (err) {
    console.error('Erro ao calcular frete (Melhor Envio):', err);
    
    // If Melhor Envio is not configured, return default options
    if (err.message && err.message.includes('MELHOR_ENVIO_TOKEN')) {
      const defaultServices = [
        { id: 1, code: '1', name: 'PAC', company: 'Correios', price: 15.00, prazo: 7, error: null },
        { id: 2, code: '2', name: 'SEDEX', company: 'Correios', price: 25.00, prazo: 3, error: null }
      ];
      return res.json({ services: defaultServices });
    }
    
    res.status(500).json({ 
      error: err.message || 'Erro ao calcular frete',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Util: parse a minimal XML from Correios CalcPrecoPrazo into JSON
function parseCorreiosXml(xml) {
  const services = [];
  const serviceBlocks = xml.split('<cServico>').slice(1).map(s => s.split('</cServico>')[0]);
  for (const block of serviceBlocks) {
    const getTag = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
      return m ? m[1] : null;
    };
    const codigo = getTag('Codigo');
    if (!codigo) continue;
    const valor = getTag('Valor');
    const prazo = getTag('PrazoEntrega');
    const erro = getTag('Erro');
    const msgErro = getTag('MsgErro');
    services.push({
      code: codigo,
      price: valor ? valor.replace('.', '').replace(',', '.') : null,
      prazo: prazo ? Number(prazo) : null,
      error: erro && erro !== '0' ? msgErro || 'Erro ao calcular' : null
    });
  }
  return services;
}

// POST /api/shipping/correios
// body: { cepDestino: string, qtdItens?: number, cepOrigem?: string, pesoPorItemKg?: number }
router.post('/correios', async (req, res) => {
  try {
    const { cepDestino, qtdItens = 1, cepOrigem = process.env.CEP_ORIGEM || '01001000', pesoPorItemKg = 0.3 } = req.body || {};
    if (!cepDestino) {
      return res.status(400).json({ error: 'cepDestino é obrigatório' });
    }

    // Correios constraints and defaults
    const pesoTotal = Math.max(0.3, Number(qtdItens) * Number(pesoPorItemKg)); // mínimo 0.3kg
    const nVlPeso = Math.min(30, Number(pesoTotal.toFixed(2))); // limite 30kg
    const nCdFormato = 1; // caixa/pacote
    const nVlComprimento = 20; // cm
    const nVlAltura = 6; // cm
    const nVlLargura = 20; // cm
    const nVlDiametro = 0; // cm
    const nVlValorDeclarado = 0;
    // SEDEX (04014) e PAC (04510)
    const nCdServico = '04014,04510';

    // Usar endpoint HTTPS ASMX
    const qs = new URLSearchParams({
      nCdEmpresa: process.env.CORREIOS_N_CD_EMPRESA || '',
      sDsSenha: process.env.CORREIOS_S_DS_SENHA || '',
      nCdServico,
      sCepOrigem: String(cepOrigem).replace(/\D/g, ''),
      sCepDestino: String(cepDestino).replace(/\D/g, ''),
      nVlPeso: String(nVlPeso),
      nCdFormato: String(nCdFormato),
      nVlComprimento: String(nVlComprimento),
      nVlAltura: String(nVlAltura),
      nVlLargura: String(nVlLargura),
      nVlDiametro: String(nVlDiametro),
      sCdMaoPropria: 'N',
      nVlValorDeclarado: String(nVlValorDeclarado),
      sCdAvisoRecebimento: 'N',
      StrRetorno: 'xml'
    });

    const baseUrl = `https://ws.correios.com.br/calculador/CalcPrecoPrazo.asmx/CalcPrecoPrazo`;
    const baseUrlAspxHttps = `https://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx`;
    // Evitar fallback para HTTP (porta 80) por bloqueios comuns de rede
    const doRequestOnce = async (fullUrl) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000); // 25s timeout (backend)
      try {
        const r = await fetch(fullUrl, { headers: { 'User-Agent': 'HypexStore/1.0' }, signal: controller.signal });
        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Correios indisponível (${r.status}) ${text.slice(0, 200)}`);
        }
        return await r.text();
      } finally {
        clearTimeout(timer);
      }
    };
    const doRequest = async (params) => {
      const urls = [
        `${baseUrl}?${params.toString()}`,
        `${baseUrlAspxHttps}?${params.toString()}`
      ];
      let lastErr;
      for (const u of urls) {
        try {
          return await doRequestOnce(u);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    };

    // Retry wrapper
    const withRetries = async (fn, attempts = 3) => {
      let lastErr;
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn();
        } catch (err) {
          lastErr = err;
          await new Promise(r => setTimeout(r, (i + 1) * 500)); // backoff 0.5s, 1s
        }
      }
      throw lastErr;
    };

    let xml;
    try {
      xml = await withRetries(() => doRequest(qs));
    } catch (e) {
      // Fallback: tentar serviços individualmente
      const codes = ['04014', '04510'];
      const parts = [];
      for (const code of codes) {
        const q2 = new URLSearchParams(qs);
        q2.set('nCdServico', code);
        try {
          const x = await withRetries(() => doRequest(q2));
          parts.push(x);
        } catch (inner) {
          // continua; pode falhar um dos serviços
        }
      }
      if (!parts.length) {
        const isAbort = e && (e.name === 'AbortError' || String(e.message || '').includes('aborted'));
        const msg = isAbort ? 'Tempo excedido ao consultar os Correios. Tente novamente.' : (e.message || 'Correios indisponível');
        return res.status(504).json({ error: msg });
      }
      xml = parts.join('\n');
    }
    const services = parseCorreiosXml(xml);

    // Map to friendly names
    const mapped = services.map(s => ({
      code: s.code,
      name: s.code === '04014' ? 'SEDEX' : (s.code === '04510' ? 'PAC' : s.code),
      price: s.price ? Number(s.price) : null,
      prazo: s.prazo,
      error: s.error || null
    }));

    res.json({ services: mapped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET helper for testing: /api/shipping/correios/:cepDestino?qtdItens=1
router.get('/correios/:cepDestino', async (req, res) => {
  try {
    const cepDestino = req.params.cepDestino;
    const qtdItens = req.query.qtdItens ? Number(req.query.qtdItens) : 1;
    const cepOrigem = process.env.CEP_ORIGEM || '01001000';
    if (!cepDestino) return res.status(400).json({ error: 'cepDestino é obrigatório' });

    const pesoPorItemKg = 0.3;
    const pesoTotal = Math.max(0.3, Number(qtdItens) * Number(pesoPorItemKg));
    const nVlPeso = Math.min(30, Number(pesoTotal.toFixed(2)));
    const nCdFormato = 1;
    const qs = new URLSearchParams({
      nCdEmpresa: process.env.CORREIOS_N_CD_EMPRESA || '',
      sDsSenha: process.env.CORREIOS_S_DS_SENHA || '',
      nCdServico: '04014,04510',
      sCepOrigem: String(cepOrigem).replace(/\D/g, ''),
      sCepDestino: String(cepDestino).replace(/\D/g, ''),
      nVlPeso: String(nVlPeso),
      nCdFormato: String(nCdFormato),
      nVlComprimento: '20',
      nVlAltura: '6',
      nVlLargura: '20',
      nVlDiametro: '0',
      sCdMaoPropria: 'N',
      nVlValorDeclarado: '0',
      sCdAvisoRecebimento: 'N',
      StrRetorno: 'xml'
    });

    const baseUrl = `https://ws.correios.com.br/calculador/CalcPrecoPrazo.asmx/CalcPrecoPrazo`;
    const baseUrlAspxHttps = `https://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx`;
    const baseUrlAspxHttp = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx`;

    const doRequestOnce = async (fullUrl) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const r = await fetch(fullUrl, { headers: { 'User-Agent': 'HypexStore/1.0' }, signal: controller.signal });
        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Correios indisponível (${r.status}) ${text.slice(0, 200)}`);
        }
        return await r.text();
      } finally {
        clearTimeout(timer);
      }
    };
    const urls = [
      `${baseUrl}?${qs.toString()}`,
      `${baseUrlAspxHttps}?${qs.toString()}`,
      `${baseUrlAspxHttp}?${qs.toString()}`
    ];
    let xml = null;
    for (const u of urls) {
      try {
        xml = await doRequestOnce(u);
        break;
      } catch (e) {}
    }
    if (!xml) return res.status(504).json({ error: 'Tempo excedido ao consultar os Correios. Tente novamente.' });

    const services = parseCorreiosXml(xml).map(s => ({
      code: s.code,
      name: s.code === '04014' ? 'SEDEX' : (s.code === '04510' ? 'PAC' : s.code),
      price: s.price ? Number(s.price) : null,
      prazo: s.prazo,
      error: s.error || null
    }));

    res.json({ services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


