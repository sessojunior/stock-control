const cors = require("cors");
const express = require("express");
require("./db/initDatabase");
const { db } = require("./db/database");
const { ImageUploadError, migrateLegacyProductImages, productUploadsDir } = require("./utils/imageStorage");

const productRoutes = require("./routes/productRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const productSupplierRoutes = require("./routes/productSupplierRoutes");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

migrateLegacyProductImages(db);
app.use(cors());
app.use(express.json({ limit: "3mb" }));
app.use("/uploads/products", express.static(productUploadsDir));

app.get("/", (req, res) => {
  res.type("text").send("Backend do controle de estoque");
});

app.use("/api/products", productRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api", productSupplierRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada." });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "JSON inválido." });
  }
  if (error instanceof ImageUploadError) {
    return res.status(400).json({ message: error.message, errors: { image: error.message } });
  }
  console.error(error);
  return res.status(500).json({ message: "Erro interno do servidor." });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}/`));
}

module.exports = app;
