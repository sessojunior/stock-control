const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  formatCnpj,
  formatCnpjForResponse,
  formatPhone,
  normalizeBarcode,
  normalizeCnpj,
  normalizePhone,
  onlyDigits,
} = require("../utils/normalize");
const { validateProduct } = require("../validators/productValidator");
const { isValidCnpj, validateSupplier } = require("../validators/supplierValidator");

test("unit: supplier validator checks every required field", () => {
  const valid = {
    companyName: "Empresa",
    cnpj: "12.345.678/0001-90",
    address: "Rua 1",
    phone: "(62) 3333-4444",
    email: "ok@empresa.com",
    primaryContact: "Ana",
  };
  for (const field of Object.keys(valid)) {
    const errors = validateSupplier({ ...valid, [field]: "" });
    assert.ok(errors[field], `Required field without error: ${field}`);
  }
});

test("unit: product validator checks required fields and custom category", () => {
  const valid = { name: "Item", description: "Descricao", category: "Alimentos" };
  for (const field of ["name", "description", "category"]) {
    const errors = validateProduct({ ...valid, [field]: "" });
    assert.ok(errors[field], `Required field without error: ${field}`);
  }

  const customCategory = { name: "Item", description: "Descricao", category: "Outros", customCategory: "Utilidades" };
  assert.deepEqual(validateProduct(customCategory), {});
  assert.equal(customCategory.category, "Outro");
  assert.ok(validateProduct({ ...valid, category: "Outro", customCategory: 12 }).customCategory);
});

test("unitário: normalização e formatação preservam identificadores", () => {
  assert.equal(onlyDigits("(62) 3333-4444"), "6233334444");
  assert.equal(normalizeCnpj("12.345.678/0001-90"), "12345678000190");
  assert.equal(normalizePhone("(62) 3333-4444"), "6233334444");
  assert.equal(normalizeBarcode(" 0012345678901 "), "0012345678901");
  assert.equal(normalizeBarcode(""), null);
  assert.equal(formatCnpj("12345678000190"), "12.345.678/0001-90");
  assert.equal(formatPhone("62999998888"), "(62) 99999-8888");
  assert.equal(formatPhone("6233334444"), "(62) 3333-4444");
  assert.equal(formatCnpjForResponse({ cnpj: "12345678000190", phone: "6233334444" }).phone, "(62) 3333-4444");
});

test("unitário: validador de CNPJ aceita formato do projeto e rejeita incompletos/repetidos", () => {
  assert.equal(isValidCnpj("12.345.678/0001-90"), true);
  assert.equal(isValidCnpj("12345678000190"), true);
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
  assert.equal(isValidCnpj("123"), false);
});

test("unitário: validador de fornecedor retorna erros por campo", () => {
  const errors = validateSupplier({ companyName: "", cnpj: "", address: "", phone: "", email: "teste@", primaryContact: "" });
  assert.deepEqual(Object.keys(errors).sort(), ["address", "cnpj", "companyName", "email", "phone", "primaryContact"]);
  assert.equal(validateSupplier({ companyName: "Empresa", cnpj: "12.345.678/0001-90", address: "Rua 1", phone: "(62) 3333-4444", email: "ok@empresa.com", primaryContact: "Ana" }).companyName, undefined);
});

test("unitário: validador de produto cobre obrigatórios, estoque, categoria e opcionais", () => {
  const required = validateProduct({});
  assert.deepEqual(Object.keys(required).sort(), ["category", "description", "name"]);
  assert.equal(validateProduct({ name: "Item", description: "Descrição", category: "Alimentos", stockQuantity: 0 }).stockQuantity, undefined);
  assert.equal(validateProduct({ name: "Item", description: "Descrição", category: "Alimentos", stockQuantity: -1 }).stockQuantity, "Informe uma quantidade inteira igual ou maior que zero.");
  assert.equal(validateProduct({ name: "Item", description: "Descrição", category: "Alimentos", barcode: "abc" }).barcode, "O código de barras deve conter apenas números.");
  assert.equal(validateProduct({ name: "Item", description: "Descrição", category: "Outro", customCategory: "" }).customCategory, "Especifique a categoria.");
  assert.equal(validateProduct({ name: "Item", description: "Descrição", category: "Alimentos", expirationDate: "2027-02-31", image: 12 }).expirationDate, "Informe uma data de validade válida.");
  assert.equal(validateProduct({ name: "Item", description: "Descrição", category: "Alimentos", expirationDate: "2027-06-30", image: null }).image, undefined);
  assert.equal(validateProduct({ name: "Item", description: "Descrição", category: "Alimentos", expirationDate: "2027-06-30", image: "data:image/png;base64,AA==" }).image, "Envie a imagem como arquivo, não como texto.");
});
