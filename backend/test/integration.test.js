const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, beforeEach, test } = require("node:test");
const supertest = require("supertest");

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "stock-control-integration-"));
process.env.STOCK_DB_PATH = path.join(testDirectory, "stock.sqlite");
process.env.STOCK_UPLOADS_DIR = path.join(testDirectory, "uploads");

const app = require("../app");
const { db } = require("../db/database");
const { migrateLegacyProductImages, productUploadsDir } = require("../utils/imageStorage");
const http = supertest(app);

const pngImage = Buffer.from("89504e470d0a1a0a00000000", "hex");
const webpImage = Buffer.from("524946460000000057454250", "hex");

const supplierPayload = (overrides = {}) => ({
  companyName: "Distribuidora Central Ltda",
  cnpj: "12.345.678/0001-90",
  address: "Rua das Flores, 100",
  phone: "(62) 3333-4444",
  email: "contato@distribuidoracentral.com.br",
  primaryContact: "Carlos Silva",
  ...overrides,
});

const productPayload = (overrides = {}) => ({
  name: "Café Torrado 500g",
  barcode: "0012345678901",
  description: "Café torrado e moído em embalagem de 500g.",
  stockQuantity: 50,
  category: "Alimentos",
  customCategory: null,
  expirationDate: "2027-06-30",
  image: null,
  ...overrides,
});

function multipartProduct(method, route, payload, image, filename = "produto.png", contentType = "image/png") {
  const request = http[method](route);
  for (const [key, value] of Object.entries(payload)) {
    if (key !== "image" && value !== null && value !== undefined) request.field(key, String(value));
  }
  if (image) request.attach("image", image, { filename, contentType });
  return request;
}

beforeEach(() => {
  db.exec("DELETE FROM product_suppliers; DELETE FROM products; DELETE FROM suppliers;");
});

after(() => {
  db.close();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test("integração: endpoint inicial e rotas inexistentes", async () => {
  const root = await http.get("/");
  assert.equal(root.status, 200);
  assert.equal(root.text, "Backend do controle de estoque");

  const missing = await http.get("/api/not-found");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.message, "Rota não encontrada.");
});

test("integração: fornecedor valida campos obrigatórios e dados inválidos", async () => {
  const required = await http.post("/api/suppliers").send({});
  assert.equal(required.status, 400);
  assert.deepEqual(Object.keys(required.body.errors).sort(), ["address", "cnpj", "companyName", "email", "phone", "primaryContact"]);

  const invalid = await http.post("/api/suppliers").send(supplierPayload({ cnpj: "11.111.111/1111-11", phone: "123", email: "teste@" }));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.errors.cnpj, "Informe um CNPJ válido.");
  assert.equal(invalid.body.errors.phone, "Informe um telefone válido.");
  assert.equal(invalid.body.errors.email, "Informe um e-mail válido.");
});

test("integração: fornecedor executa CRUD completo e bloqueia CNPJ normalizado duplicado", async () => {
  const created = await http.post("/api/suppliers").send(supplierPayload());
  assert.equal(created.status, 201);
  assert.equal(created.body.message, "Fornecedor cadastrado com sucesso!");
  const supplier = created.body.data;
  assert.equal(supplier.cnpj, "12.345.678/0001-90");

  const duplicate = await http.post("/api/suppliers").send(supplierPayload({ companyName: "Outra empresa", cnpj: "12345678000190" }));
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.message, "Fornecedor com esse CNPJ já está cadastrado!");

  const list = await http.get("/api/suppliers");
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);

  const detail = await http.get(`/api/suppliers/${supplier.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.companyName, supplierPayload().companyName);

  const updated = await http.put(`/api/suppliers/${supplier.id}`).send(supplierPayload({ companyName: "Distribuidora Atualizada", email: "novo@central.com" }));
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.companyName, "Distribuidora Atualizada");
  assert.equal(updated.body.data.email, "novo@central.com");

  const otherSupplier = (await http.post("/api/suppliers").send(supplierPayload({
    companyName: "Outra empresa",
    cnpj: "98.765.432/0001-10",
    email: "outra@empresa.com",
  }))).body.data;
  const duplicateUpdate = await http.put(`/api/suppliers/${supplier.id}`).send(supplierPayload({
    cnpj: "98765432000110",
  }));
  assert.equal(duplicateUpdate.status, 409);
  await http.delete(`/api/suppliers/${otherSupplier.id}`);

  const updateMissing = await http.put("/api/suppliers/9999").send(supplierPayload());
  assert.equal(updateMissing.status, 404);
  const removed = await http.delete(`/api/suppliers/${supplier.id}`);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.message, "Fornecedor excluído com sucesso!");
  assert.equal((await http.get(`/api/suppliers/${supplier.id}`)).status, 404);
  assert.equal((await http.delete(`/api/suppliers/${supplier.id}`)).status, 404);
});

test("integração: produto valida obrigatoriedade, estoque, código, categoria e data", async () => {
  const required = await http.post("/api/products").send({});
  assert.equal(required.status, 400);
  assert.deepEqual(Object.keys(required.body.errors).sort(), ["category", "description", "name"]);

  const invalid = await http.post("/api/products").send(productPayload({ barcode: "ABC", stockQuantity: -5, category: "Outro", customCategory: "", expirationDate: "2027-02-31" }));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.errors.barcode, "O código de barras deve conter apenas números.");
  assert.equal(invalid.body.errors.stockQuantity, "Informe uma quantidade inteira igual ou maior que zero.");
  assert.equal(invalid.body.errors.customCategory, "Especifique a categoria.");
  assert.equal(invalid.body.errors.expirationDate, "Informe uma data de validade válida.");

  const category = await http.post("/api/products").send(productPayload({ category: "Categoria inexistente" }));
  assert.equal(category.status, 400);
  assert.equal(category.body.errors.category, "Selecione uma categoria válida.");

  const base64 = await http.post("/api/products").send(productPayload({ barcode: "7890000000002", image: "data:image/png;base64,AA==" }));
  assert.equal(base64.status, 400);
  assert.equal(base64.body.errors.image, "Envie a imagem como arquivo, não como texto.");

  const invalidFile = await multipartProduct("post", "/api/products", productPayload({ barcode: "7890000000003" }), Buffer.from("not-an-image"));
  assert.equal(invalidFile.status, 400);
  assert.equal(invalidFile.body.errors.image, "O arquivo enviado não é uma imagem válida.");
});

test("integração: produto executa CRUD, preserva barcode textual e aceita opcionais", async () => {
  const created = await http.post("/api/products").send(productPayload({ stockQuantity: 0, expirationDate: null, image: null }));
  assert.equal(created.status, 201);
  assert.equal(created.body.message, "Produto cadastrado com sucesso!");
  const product = created.body.data;
  assert.equal(product.stockQuantity, 0);
  assert.equal(product.barcode, "0012345678901");
  assert.equal(product.expirationDate, null);
  assert.equal(product.image, null);

  const duplicate = await http.post("/api/products").send(productPayload({ name: "Produto duplicado" }));
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.message, "Produto com este código de barras já está cadastrado!");

  const custom = await multipartProduct("post", "/api/products", productPayload({ name: "Caixa organizadora", barcode: "7890000000001", stockQuantity: 12, category: "Outro", customCategory: "Utilidades" }), pngImage);
  assert.equal(custom.status, 201);
  assert.equal(custom.body.data.customCategory, "Utilidades");
  const originalImagePath = custom.body.data.image;
  assert.match(originalImagePath, /^\/uploads\/products\/[a-f0-9-]+\.png$/);
  assert.equal(originalImagePath.startsWith("data:"), false);
  assert.equal(db.prepare("SELECT image FROM products WHERE id = ?").get(custom.body.data.id).image, originalImagePath);
  assert.deepEqual(fs.readFileSync(path.join(productUploadsDir, path.basename(originalImagePath))), pngImage);
  const servedImage = await http.get(originalImagePath);
  assert.equal(servedImage.status, 200);
  assert.deepEqual(servedImage.body, pngImage);

  const list = await http.get("/api/products");
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 2);
  assert.equal((await http.get(`/api/products/${product.id}`)).body.data.name, productPayload().name);

  const updated = await http.put(`/api/products/${product.id}`).send(productPayload({ name: "Café Atualizado", stockQuantity: 150 }));
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.stockQuantity, 150);

  const updatedImage = await multipartProduct("put", `/api/products/${custom.body.data.id}`, productPayload({ name: "Caixa atualizada", barcode: custom.body.data.barcode, stockQuantity: 20, category: "Outro", customCategory: "Utilidades" }), webpImage, "produto.webp", "image/webp");
  assert.equal(updatedImage.status, 200);
  const replacementImagePath = updatedImage.body.data.image;
  assert.match(replacementImagePath, /^\/uploads\/products\/[a-f0-9-]+\.webp$/);
  assert.notEqual(replacementImagePath, originalImagePath);
  assert.equal(fs.existsSync(path.join(productUploadsDir, path.basename(originalImagePath))), false);
  assert.deepEqual(fs.readFileSync(path.join(productUploadsDir, path.basename(replacementImagePath))), webpImage);

  const duplicateUpdate = await http.put(`/api/products/${product.id}`).send(productPayload({ barcode: custom.body.data.barcode, name: "Conflito" }));
  assert.equal(duplicateUpdate.status, 409);
  const removedCustom = await http.delete(`/api/products/${custom.body.data.id}`);
  assert.equal(removedCustom.status, 200);
  assert.equal(fs.existsSync(path.join(productUploadsDir, path.basename(replacementImagePath))), false);

  const removed = await http.delete(`/api/products/${product.id}`);
  assert.equal(removed.status, 200);
  assert.equal((await http.get(`/api/products/${product.id}`)).status, 404);
  assert.equal((await http.delete(`/api/products/${product.id}`)).status, 404);
  assert.equal((await http.get("/api/products/9999")).status, 404);
});

test("integração: converte imagem legada em arquivo e remove Base64 do banco", async () => {
  const legacy = `data:image/png;base64,${pngImage.toString("base64")}`;
  const result = db.prepare(`
    INSERT INTO products (name, barcode, description, stock_quantity, category, image)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("Produto legado", "7890000000099", "Imagem legada", 1, "Alimentos", legacy);

  assert.equal(migrateLegacyProductImages(db), 1);
  const migrated = db.prepare("SELECT image FROM products WHERE id = ?").get(result.lastInsertRowid);
  assert.match(migrated.image, /^\/uploads\/products\/[a-f0-9-]+\.png$/);
  assert.equal(migrated.image.startsWith("data:"), false);
  assert.deepEqual(fs.readFileSync(path.join(productUploadsDir, path.basename(migrated.image))), pngImage);

  const removed = await http.delete(`/api/products/${result.lastInsertRowid}`);
  assert.equal(removed.status, 200);
  assert.equal(fs.existsSync(path.join(productUploadsDir, path.basename(migrated.image))), false);
});

test("integração: associação cobre existência, duplicidade, listagens, remoção e cascata", async () => {
  const supplier = (await http.post("/api/suppliers").send(supplierPayload())).body.data;
  const secondSupplier = (await http.post("/api/suppliers").send(supplierPayload({ companyName: "Atacadista Brasil", cnpj: "98.765.432/0001-10", email: "atacado@brasil.com" }))).body.data;
  const product = (await http.post("/api/products").send(productPayload())).body.data;

  assert.equal((await http.post(`/api/products/9999/suppliers/${supplier.id}`)).status, 404);
  assert.equal((await http.post(`/api/products/${product.id}/suppliers/9999`)).status, 404);
  assert.equal((await http.get("/api/products/9999/suppliers")).status, 404);
  assert.equal((await http.get("/api/suppliers/9999/products")).status, 404);

  let result = await http.post(`/api/products/${product.id}/suppliers/${supplier.id}`);
  assert.equal(result.status, 201);
  assert.equal(result.body.message, "Fornecedor associado com sucesso ao produto!");
  result = await http.post(`/api/products/${product.id}/suppliers/${supplier.id}`);
  assert.equal(result.status, 409);
  assert.equal(result.body.message, "Fornecedor já está associado a este produto!");

  result = await http.post(`/api/products/${product.id}/suppliers/${secondSupplier.id}`);
  assert.equal(result.status, 201);
  result = await http.get(`/api/products/${product.id}/suppliers`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 2);
  assert.deepEqual(result.body.data.map((item) => item.cnpj).sort(), [supplierPayload().cnpj, supplierPayload({ cnpj: "98.765.432/0001-10" }).cnpj].sort());

  result = await http.get(`/api/suppliers/${supplier.id}/products`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 1);
  assert.equal(result.body.data[0].id, product.id);

  result = await http.delete(`/api/products/${product.id}/suppliers/${supplier.id}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.message, "Fornecedor desassociado com sucesso!");
  result = await http.delete(`/api/products/${product.id}/suppliers/${supplier.id}`);
  assert.equal(result.status, 404);

  await http.delete(`/api/products/${product.id}`);
  result = await http.get(`/api/suppliers/${secondSupplier.id}/products`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 0);
});
