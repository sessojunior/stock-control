const { db } = require("../db/database");
const { normalizeBarcode } = require("../utils/normalize");
const { removeProductImage, saveProductImage } = require("../utils/imageStorage");
const { validateProduct } = require("../validators/productValidator");

const DUPLICATE_MESSAGE = "Produto com este código de barras já está cadastrado!";

function validationError(res, errors) {
  return res.status(400).json({ message: "Verifique os campos informados.", errors });
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function serializeProduct(row) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    description: row.description,
    stockQuantity: row.stock_quantity,
    category: row.category,
    customCategory: row.custom_category,
    expirationDate: row.expiration_date,
    image: row.image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function inputValues(body, imagePath = null) {
  return [
    body.name.trim(),
    normalizeBarcode(body.barcode),
    body.description.trim(),
    body.stockQuantity === undefined || body.stockQuantity === null || body.stockQuantity === "" ? 0 : Number(body.stockQuantity),
    body.category === "Outros" ? "Outro" : body.category.trim(),
    body.customCategory?.trim() || null,
    body.expirationDate || null,
    imagePath,
  ];
}

function createProduct(req, res, next) {
  const errors = validateProduct(req.body);
  if (Object.keys(errors).length) return validationError(res, errors);
  const barcode = normalizeBarcode(req.body.barcode);
  if (barcode && db.prepare("SELECT id FROM products WHERE barcode = ?").get(barcode)) {
    return res.status(409).json({ message: DUPLICATE_MESSAGE });
  }

  let imagePath = null;
  try {
    imagePath = req.file ? saveProductImage(req.file) : null;
    const result = db.prepare(`
      INSERT INTO products (name, barcode, description, stock_quantity, category, custom_category, expiration_date, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...inputValues(req.body, imagePath));
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json({ message: "Produto cadastrado com sucesso!", data: serializeProduct(product) });
  } catch (error) {
    if (imagePath) {
      try { removeProductImage(imagePath); } catch { /* best effort cleanup */ }
    }
    if (error.code?.includes("SQLITE_CONSTRAINT_UNIQUE")) return res.status(409).json({ message: DUPLICATE_MESSAGE });
    return next(error);
  }
}

function getProducts(req, res) {
  const products = db.prepare("SELECT * FROM products ORDER BY created_at DESC, id DESC").all().map(serializeProduct);
  return res.json({ data: products });
}

function getProductById(req, res) {
  const id = parseId(req.params.id);
  const product = id && db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!product) return res.status(404).json({ message: "Produto não encontrado." });
  return res.json({ data: serializeProduct(product) });
}

function updateProduct(req, res, next) {
  const id = parseId(req.params.id);
  const currentProduct = id && db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!currentProduct) {
    return res.status(404).json({ message: "Produto não encontrado." });
  }
  const errors = validateProduct(req.body);
  if (Object.keys(errors).length) return validationError(res, errors);
  const barcode = normalizeBarcode(req.body.barcode);
  if (barcode && db.prepare("SELECT id FROM products WHERE barcode = ? AND id <> ?").get(barcode, id)) {
    return res.status(409).json({ message: DUPLICATE_MESSAGE });
  }

  let imagePath = null;
  try {
    imagePath = req.file ? saveProductImage(req.file) : null;
    db.prepare(`
      UPDATE products
      SET name = ?, barcode = ?, description = ?, stock_quantity = ?, category = ?, custom_category = ?, expiration_date = ?, image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(...inputValues(req.body, imagePath || currentProduct.image), id);
    if (imagePath && currentProduct.image) {
      try { removeProductImage(currentProduct.image); } catch (error) { console.error("Não foi possível remover a imagem anterior.", error); }
    }
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    return res.json({ message: "Produto atualizado com sucesso!", data: serializeProduct(product) });
  } catch (error) {
    if (imagePath) {
      try { removeProductImage(imagePath); } catch { /* best effort cleanup */ }
    }
    if (error.code?.includes("SQLITE_CONSTRAINT_UNIQUE")) return res.status(409).json({ message: DUPLICATE_MESSAGE });
    return next(error);
  }
}

function deleteProduct(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ message: "Produto não encontrado." });
  const product = db.prepare("SELECT image FROM products WHERE id = ?").get(id);
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (product?.image && result.changes) removeProductImage(product.image);
  if (!result.changes) return res.status(404).json({ message: "Produto não encontrado." });
  return res.json({ message: "Produto excluído com sucesso!" });
}

module.exports = { createProduct, deleteProduct, getProductById, getProducts, serializeProduct, updateProduct };
