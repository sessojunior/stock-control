const { db } = require("../db/database");
const { formatCnpjForResponse, normalizeCnpj, normalizePhone } = require("../utils/normalize");
const { validateSupplier } = require("../validators/supplierValidator");

const DUPLICATE_MESSAGE = "Fornecedor com esse CNPJ já está cadastrado!";

function validationError(res, errors) {
  return res.status(400).json({ message: "Verifique os campos informados.", errors });
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function serializeSupplier(row) {
  if (!row) return row;
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

function inputValues(body) {
  return [
    body.companyName.trim(),
    normalizeCnpj(body.cnpj),
    body.address.trim(),
    normalizePhone(body.phone),
    body.email.trim().toLowerCase(),
    body.primaryContact.trim(),
  ];
}

function createSupplier(req, res, next) {
  const errors = validateSupplier(req.body);
  if (Object.keys(errors).length) return validationError(res, errors);

  const [companyName, cnpj, address, phone, email, primaryContact] = inputValues(req.body);
  if (db.prepare("SELECT id FROM suppliers WHERE cnpj = ?").get(cnpj)) {
    return res.status(409).json({ message: DUPLICATE_MESSAGE });
  }

  try {
    const result = db.prepare(`
      INSERT INTO suppliers (company_name, cnpj, address, phone, email, primary_contact)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(companyName, cnpj, address, phone, email, primaryContact);
    const supplier = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json({ message: "Fornecedor cadastrado com sucesso!", data: serializeSupplier(supplier) });
  } catch (error) {
    if (error.code?.includes("SQLITE_CONSTRAINT_UNIQUE")) return res.status(409).json({ message: DUPLICATE_MESSAGE });
    return next(error);
  }
}

function getSuppliers(req, res) {
  const suppliers = db.prepare("SELECT * FROM suppliers ORDER BY company_name COLLATE NOCASE, id").all().map(serializeSupplier);
  return res.json({ data: suppliers });
}

function getSupplierById(req, res) {
  const id = parseId(req.params.id);
  const supplier = id && db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
  if (!supplier) return res.status(404).json({ message: "Fornecedor não encontrado." });
  return res.json({ data: serializeSupplier(supplier) });
}

function updateSupplier(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ message: "Fornecedor não encontrado." });
  if (!db.prepare("SELECT id FROM suppliers WHERE id = ?").get(id)) {
    return res.status(404).json({ message: "Fornecedor não encontrado." });
  }

  const errors = validateSupplier(req.body);
  if (Object.keys(errors).length) return validationError(res, errors);
  const [companyName, cnpj, address, phone, email, primaryContact] = inputValues(req.body);
  if (db.prepare("SELECT id FROM suppliers WHERE cnpj = ? AND id <> ?").get(cnpj, id)) {
    return res.status(409).json({ message: DUPLICATE_MESSAGE });
  }

  try {
    db.prepare(`
      UPDATE suppliers
      SET company_name = ?, cnpj = ?, address = ?, phone = ?, email = ?, primary_contact = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(companyName, cnpj, address, phone, email, primaryContact, id);
    const supplier = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
    return res.json({ message: "Fornecedor atualizado com sucesso!", data: serializeSupplier(supplier) });
  } catch (error) {
    if (error.code?.includes("SQLITE_CONSTRAINT_UNIQUE")) return res.status(409).json({ message: DUPLICATE_MESSAGE });
    return next(error);
  }
}

function deleteSupplier(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ message: "Fornecedor não encontrado." });
  const result = db.prepare("DELETE FROM suppliers WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ message: "Fornecedor não encontrado." });
  return res.json({ message: "Fornecedor excluído com sucesso!" });
}

module.exports = { createSupplier, deleteSupplier, getSupplierById, getSuppliers, updateSupplier };
