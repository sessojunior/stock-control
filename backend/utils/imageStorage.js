const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const uploadsRoot = process.env.STOCK_UPLOADS_DIR || path.join(__dirname, "..", "uploads");
const productUploadsDir = path.join(uploadsRoot, "products");
const publicProductImagePath = "/uploads/products";
const allowedImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

class ImageUploadError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImageUploadError";
    this.status = 400;
  }
}

function ensureProductUploadsDir() {
  fs.mkdirSync(productUploadsDir, { recursive: true });
}

function hasImageSignature(buffer, mimetype) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (mimetype === "image/jpeg") return buffer.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
  if (mimetype === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function saveProductImage(file) {
  const extension = allowedImageTypes.get(file?.mimetype);
  if (!extension) throw new ImageUploadError("Envie uma imagem JPG, PNG ou WEBP.");
  if (!hasImageSignature(file.buffer, file.mimetype)) throw new ImageUploadError("O arquivo enviado não é uma imagem válida.");

  ensureProductUploadsDir();
  const filename = `${crypto.randomUUID()}${extension}`;
  const absolutePath = path.join(productUploadsDir, filename);
  fs.writeFileSync(absolutePath, file.buffer, { flag: "wx" });
  return `${publicProductImagePath}/${filename}`;
}

function absoluteProductImagePath(imagePath) {
  if (typeof imagePath !== "string" || !imagePath.startsWith(`${publicProductImagePath}/`)) return null;
  const filename = imagePath.slice(publicProductImagePath.length + 1);
  if (!/^[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(filename)) return null;
  return path.join(productUploadsDir, filename);
}

function removeProductImage(imagePath) {
  const absolutePath = absoluteProductImagePath(imagePath);
  if (!absolutePath) return;
  try {
    fs.unlinkSync(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function decodeLegacyDataUri(value) {
  const match = typeof value === "string" && value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return null;
  const mimetype = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  return hasImageSignature(buffer, mimetype) ? { mimetype, buffer } : null;
}

function migrateLegacyProductImages(database) {
  const legacyRows = database.prepare("SELECT id, image FROM products WHERE image LIKE 'data:%'").all();
  if (!legacyRows.length) return 0;

  let migrated = 0;
  const updateImage = database.prepare("UPDATE products SET image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
  for (const row of legacyRows) {
    const legacyFile = decodeLegacyDataUri(row.image);
    if (!legacyFile) {
      updateImage.run(null, row.id);
      continue;
    }
    const imagePath = saveProductImage(legacyFile);
    try {
      updateImage.run(imagePath, row.id);
      migrated += 1;
    } catch (error) {
      removeProductImage(imagePath);
      throw error;
    }
  }
  return migrated;
}

module.exports = {
  ImageUploadError,
  allowedImageTypes,
  migrateLegacyProductImages,
  productUploadsDir,
  publicProductImagePath,
  removeProductImage,
  saveProductImage,
};
