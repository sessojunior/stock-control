const cors = require("cors");
const express = require("express");
const path = require("node:path");
require("./db/initDatabase");
const { db } = require("./db/database");
const { ImageUploadError, migrateLegacyProductImages, productUploadsDir } = require("./utils/imageStorage");

const productRoutes = require("./routes/productRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const productSupplierRoutes = require("./routes/productSupplierRoutes");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const serveFrontend = process.env.SERVE_FRONTEND === "true";
const frontendDistDir = path.join(__dirname, "..", "frontend", "dist");

migrateLegacyProductImages(db);
app.use(cors());
app.use(express.json({ limit: "3mb" }));
app.use("/uploads/products", express.static(productUploadsDir));

if (serveFrontend) {
  app.use(express.static(frontendDistDir));
}

app.get("/", (req, res) => {
  res.type("text").send("Backend do controle de estoque");
});

app.use("/api/products", productRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api", productSupplierRoutes);

if (serveFrontend) {
  app.use((req, res, next) => {
    const isFrontendRequest = req.method === "GET"
      && req.path !== "/api"
      && !req.path.startsWith("/api/")
      && !req.path.startsWith("/uploads/");
    if (!isFrontendRequest) return next();
    return res.sendFile(path.join(frontendDistDir, "index.html"), (error) => {
      if (error) return next();
      return undefined;
    });
  });
}

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
  app.listen(PORT, "0.0.0.0", () => console.log(`Servidor rodando na porta ${PORT}`));
}

module.exports = app;
