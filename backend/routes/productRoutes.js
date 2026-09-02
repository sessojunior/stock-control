const express = require("express");
const multer = require("multer");
const {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct,
} = require("../controllers/productController");
const {
  associateSupplier,
  getProductSuppliers,
  removeSupplierAssociation,
} = require("../controllers/productSupplierController");
const { ImageUploadError, allowedImageTypes } = require("../utils/imageStorage");

const router = express.Router();
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) return callback(new ImageUploadError("Envie uma imagem JPG, PNG ou WEBP."));
    return callback(null, true);
  },
});

function parseProductUpload(req, res, next) {
  return productImageUpload.single("image")(req, res, (error) => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "A imagem deve ter no máximo 5 MB."
        : error.message || "Não foi possível receber a imagem.";
      return res.status(400).json({ message, errors: { image: message } });
    }
    return next();
  });
}

router.get("/", getProducts);
router.post("/", parseProductUpload, createProduct);
router.get("/:productId/suppliers", getProductSuppliers);
router.post("/:productId/suppliers/:supplierId", associateSupplier);
router.delete("/:productId/suppliers/:supplierId", removeSupplierAssociation);
router.get("/:id", getProductById);
router.put("/:id", parseProductUpload, updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
