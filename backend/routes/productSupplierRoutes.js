const express = require("express");
const { getSupplierProducts } = require("../controllers/productSupplierController");

const router = express.Router();
router.get("/suppliers/:supplierId/products", getSupplierProducts);

module.exports = router;
