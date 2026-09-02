function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeCnpj(value) {
  return onlyDigits(value);
}

function normalizePhone(value) {
  return onlyDigits(value);
}

function normalizeBarcode(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function formatCnpj(value) {
  const digits = normalizeCnpj(value);
  if (digits.length !== 14) return value || "";
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatPhone(value) {
  const digits = normalizePhone(value);
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return value || "";
}

function formatCnpjForResponse(supplier) {
  return { ...supplier, cnpj: formatCnpj(supplier.cnpj), phone: formatPhone(supplier.phone) };
}

module.exports = {
  formatCnpj,
  formatCnpjForResponse,
  formatPhone,
  normalizeBarcode,
  normalizeCnpj,
  normalizePhone,
  onlyDigits,
};
