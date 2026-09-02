const { db } = require("../db/database");
const { formatCnpjForResponse } = require("../utils/normalize");
const { serializeProduct } = require("./productController");

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function serializeSupplier(row) {
  return formatCnpjForResponse({
    id: row.id,
    companyName: row.company_name,
    cnpj: row.cnpj,
    address: row.address,
    phone: row.phone,
    email: row.email,
    primaryContact: row.primary_contact,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function associateSupplier(req, res, next) {
  const productId = parseId(req.params.productId);
  const supplierId = parseId(req.params.supplierId);
  const product = productId && db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
  if (!product) return res.status(404).json({ message: "Produto não encontrado." });
  const supplier = supplierId && db.prepare("SELECT id FROM suppliers WHERE id = ?").get(supplierId);
  if (!supplier) return res.status(404).json({ message: "Fornecedor não encontrado." });
  if (db.prepare("SELECT 1 FROM product_suppliers WHERE product_id = ? AND supplier_id = ?").get(productId, supplierId)) {
    return res.status(409).json({ message: "Fornecedor já está associado a este produto!" });
  }

  try {
    db.prepare("INSERT INTO product_suppliers (product_id, supplier_id) VALUES (?, ?)").run(productId, supplierId);
    return res.status(201).json({ message: "Fornecedor associado com sucesso ao produto!" });
  } catch (error) {
    if (error.code?.includes("SQLITE_CONSTRAINT_PRIMARYKEY")) {
      return res.status(409).json({ message: "Fornecedor já está associado a este produto!" });
    }
    return next(error);
  }
}

function getProductSuppliers(req, res) {
  const productId = parseId(req.params.productId);
  if (!productId || !db.prepare("SELECT id FROM products WHERE id = ?").get(productId)) {
    return res.status(404).json({ message: "Produto não encontrado." });
  }
  const suppliers = db.prepare(`
    SELECT s.*
    FROM suppliers s
    INNER JOIN product_suppliers ps ON ps.supplier_id = s.id
    WHERE ps.product_id = ?
    ORDER BY s.company_name COLLATE NOCASE, s.id
  `).all(productId).map(serializeSupplier);
  return res.json({ data: suppliers });
}

function removeSupplierAssociation(req, res) {
  const productId = parseId(req.params.productId);
  const supplierId = parseId(req.params.supplierId);
  if (!productId || !supplierId) return res.status(404).json({ message: "Associação não encontrada." });
  const result = db.prepare("DELETE FROM product_suppliers WHERE product_id = ? AND supplier_id = ?").run(productId, supplierId);
  if (!result.changes) return res.status(404).json({ message: "Associação não encontrada." });
  return res.json({ message: "Fornecedor desassociado com sucesso!" });
}

function getSupplierProducts(req, res) {
  const supplierId = parseId(req.params.supplierId);
  if (!supplierId || !db.prepare("SELECT id FROM suppliers WHERE id = ?").get(supplierId)) {
    return res.status(404).json({ message: "Fornecedor não encontrado." });
  }
  const products = db.prepare(`
    SELECT p.*
    FROM products p
    INNER JOIN product_suppliers ps ON ps.product_id = p.id
    WHERE ps.supplier_id = ?
    ORDER BY p.name COLLATE NOCASE, p.id
  `).all(supplierId).map(serializeProduct);
  return res.json({ data: products });
}

module.exports = { associateSupplier, getProductSuppliers, getSupplierProducts, removeSupplierAssociation };
