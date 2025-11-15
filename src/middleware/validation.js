const { validationResult } = require('express-validator');

// Middleware to validate request data
const validate = validations => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Formatar erros de forma mais legível
    const errorMessages = errors.array().map(err => {
      const field = err.param || err.path || 'campo';
      const message = err.msg || err.message || 'valor inválido';
      return `${field}: ${message}`;
    });

    // Retornar primeiro erro como mensagem principal, ou mensagem genérica
    const mainError = errorMessages[0] || 'Erro de validação';

    res.status(400).json({
      error: mainError,
      details: errors.array(),
      messages: errorMessages
    });
  };
};

module.exports = { validate };