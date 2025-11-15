const fetch = require('node-fetch');

/**
 * Melhor Envio API Service
 * Docs: https://docs.melhorenvio.com.br/
 */

class MelhorEnvioService {
  constructor() {
    this.baseUrl = process.env.MELHOR_ENVIO_SANDBOX === 'true' 
      ? 'https://sandbox.melhorenvio.com.br/api/v2'
      : 'https://melhorenvio.com.br/api/v2';
    
    this.token = process.env.MELHOR_ENVIO_TOKEN;
    this.fromPostalCode = process.env.CEP_ORIGEM || '01001000';
  }

  /**
   * Calculate shipping for products
   * @param {Object} params - Shipping parameters
   * @param {string} params.toPostalCode - Destination CEP
   * @param {Array} params.products - Array of products with dimensions and weight
   * @param {number} params.insuranceValue - Insurance value (optional)
   * @returns {Promise<Array>} Array of shipping options
   */
  async calculateShipping(params) {
    const { toPostalCode, products = [], insuranceValue = 0 } = params;

    if (!this.token) {
      console.warn('MELHOR_ENVIO_TOKEN não configurado. Retornando opções padrão.');
      // Return default shipping options when token is not configured
      return this.getDefaultShippingOptions();
    }

    if (!toPostalCode || toPostalCode.replace(/\D/g, '').length !== 8) {
      throw new Error('CEP de destino inválido');
    }

    // Build products array for API
    const productsPayload = products.map(p => ({
      id: String(p.id || Math.random()),
      width: Number(p.width || 20), // cm
      height: Number(p.height || 6), // cm
      length: Number(p.length || 20), // cm
      weight: Number(p.weight || 0.3), // kg
      insurance_value: Number(p.insurance_value || insuranceValue || 0),
      quantity: Number(p.quantity || 1)
    }));

    // If no products provided, use defaults
    if (productsPayload.length === 0) {
      productsPayload.push({
        id: '1',
        width: 20,
        height: 6,
        length: 20,
        weight: 0.3,
        insurance_value: insuranceValue,
        quantity: 1
      });
    }

    const payload = {
      from: {
        postal_code: String(this.fromPostalCode).replace(/\D/g, '')
      },
      to: {
        postal_code: String(toPostalCode).replace(/\D/g, '')
      },
      products: productsPayload
    };

    try {
      const response = await fetch(`${this.baseUrl}/me/shipment/calculate`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'User-Agent': 'HypexStore/1.0'
        },
        body: JSON.stringify(payload),
        timeout: 15000
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Erro ao calcular frete';
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText.substring(0, 200);
        }

        throw new Error(`Melhor Envio API error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json();

      // Transform response to match our format
      return this.transformResponse(data);
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
        throw new Error('Tempo excedido ao consultar Melhor Envio');
      }
      throw error;
    }
  }

  /**
   * Transform Melhor Envio response to our standard format
   * @param {Array} services - Array of services from Melhor Envio
   * @returns {Array} Transformed services
   */
  transformResponse(services) {
    if (!Array.isArray(services)) {
      return [];
    }

    return services
      .filter(service => !service.error)
      .map(service => ({
        id: service.id,
        name: service.name,
        company: this.getCompanyInfo(service.company),
        price: Number(service.price || 0),
        custom_price: Number(service.custom_price || service.price || 0),
        discount: Number(service.discount || 0),
        currency: service.currency || 'BRL',
        delivery_time: Number(service.delivery_time || 0),
        delivery_range: service.delivery_range || {},
        packages: service.packages || [],
        error: service.error || null
      }))
      .sort((a, b) => a.price - b.price); // Sort by price
  }

  /**
   * Get company information
   * @param {Object} company - Company object from API
   * @returns {Object} Company info
   */
  getCompanyInfo(company) {
    if (!company) return { id: null, name: 'Transportadora', picture: null };
    
    return {
      id: company.id,
      name: company.name,
      picture: company.picture || null
    };
  }

  /**
   * Calculate shipping for simple cart items
   * @param {string} toPostalCode - Destination CEP
   * @param {number} qtdItens - Quantity of items
   * @param {number} weightPerItem - Weight per item in kg
   * @returns {Promise<Array>} Array of shipping options
   */
  async calculateSimpleShipping(toPostalCode, qtdItens = 1, weightPerItem = 0.3) {
    const totalWeight = Math.max(0.3, Number(qtdItens) * Number(weightPerItem));
    
    return this.calculateShipping({
      toPostalCode,
      products: [{
        id: '1',
        width: 20,
        height: 6,
        length: 20,
        weight: totalWeight,
        quantity: 1
      }]
    });
  }

  /**
   * Get default shipping options when API is not configured
   * @returns {Array} Default shipping options
   */
  getDefaultShippingOptions() {
    return [
      {
        id: 1,
        name: 'PAC',
        company: { id: 1, name: 'Correios', picture: null },
        price: 15.00,
        custom_price: 15.00,
        discount: 0,
        currency: 'BRL',
        delivery_time: 7,
        delivery_range: { min: 5, max: 10 },
        packages: [],
        error: null
      },
      {
        id: 2,
        name: 'SEDEX',
        company: { id: 1, name: 'Correios', picture: null },
        price: 25.00,
        custom_price: 25.00,
        discount: 0,
        currency: 'BRL',
        delivery_time: 3,
        delivery_range: { min: 2, max: 4 },
        packages: [],
        error: null
      }
    ];
  }
}

module.exports = new MelhorEnvioService();
