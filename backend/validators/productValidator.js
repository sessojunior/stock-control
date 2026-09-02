const { normalizeBarcode } = require("../utils/normalize");

const categories = ["Eletrônicos", "Alimentos", "Vestuário", "Limpeza", "Higiene", "Papelaria", "Outro"];

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateProduct(payload = {}) {
  const errors = {};
  if (typeof payload.name !== "string" || !payload.name.trim()) errors.name = "O nome do produto é obrigatório.";
  if (typeof payload.description !== "string" || !payload.description.trim()) {
    errors.description = "A descrição é obrigatória.";
  }
  if (typeof payload.category !== "string" || !payload.category.trim()) {
    errors.category = "A categoria é obrigatória.";
  } else if (payload.category === "Outros") {
    payload.category = "Outro";
  } else if (!categories.includes(payload.category)) {
    errors.category = "Selecione uma categoria válida.";
  }

  const stockValue = payload.stockQuantity;
  if (stockValue !== undefined && stockValue !== null && stockValue !== "") {
    const parsed = Number(stockValue);
    if (!Number.isInteger(parsed) || parsed < 0) errors.stockQuantity = "Informe uma quantidade inteira igual ou maior que zero.";
  }

  const barcode = normalizeBarcode(payload.barcode);
  if (barcode && !/^\d+$/.test(barcode)) errors.barcode = "O código de barras deve conter apenas números.";

  if (payload.customCategory !== undefined && payload.customCategory !== null && typeof payload.customCategory !== "string") {
    errors.customCategory = "Informe uma categoria personalizada válida.";
  }
  if (payload.category === "Outro" && (typeof payload.customCategory !== "string" || !payload.customCategory.trim())) {
    if (!errors.customCategory) errors.customCategory = "Especifique a categoria.";
  }

  if (payload.expirationDate && !isValidDate(payload.expirationDate)) {
    errors.expirationDate = "Informe uma data de validade válida.";
  }

  if (payload.image !== undefined && payload.image !== null && payload.image !== "") {
    errors.image = "Envie a imagem como arquivo, não como texto.";
  }

  return errors;
}

module.exports = { categories, validateProduct };
