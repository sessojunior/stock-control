const { normalizeCnpj, normalizePhone } = require("../utils/normalize");

function isValidCnpj(value) {
  const digits = normalizeCnpj(value);
  // The project examples use formatted, illustrative CNPJs. Structural
  // validation keeps those examples usable while still rejecting incomplete
  // and obviously invalid repeated values.
  return digits.length === 14 && !/^([0-9])\1+$/.test(digits);
}

function validateSupplier(payload = {}) {
  const errors = {};
  const requiredFields = [
    ["companyName", "O nome da empresa é obrigatório."],
    ["cnpj", "O CNPJ é obrigatório."],
    ["address", "O endereço é obrigatório."],
    ["phone", "O telefone é obrigatório."],
    ["email", "O e-mail é obrigatório."],
    ["primaryContact", "O contato principal é obrigatório."],
  ];

  for (const [field, message] of requiredFields) {
    if (typeof payload[field] !== "string" || !payload[field].trim()) errors[field] = message;
  }

  if (!errors.cnpj && !isValidCnpj(payload.cnpj)) {
    errors.cnpj = "Informe um CNPJ válido.";
  }

  if (!errors.phone) {
    const phoneDigits = normalizePhone(payload.phone);
    if (![10, 11].includes(phoneDigits.length)) errors.phone = "Informe um telefone válido.";
  }

  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
    errors.email = "Informe um e-mail válido.";
  }

  return errors;
}

module.exports = { isValidCnpj, validateSupplier };
