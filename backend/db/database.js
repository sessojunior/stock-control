const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const configuredPath = process.env.STOCK_DB_PATH || path.join(__dirname, "stock.sqlite");

if (configuredPath !== ":memory:") {
  fs.mkdirSync(path.dirname(configuredPath), { recursive: true });
}

const db = new Database(configuredPath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

module.exports = { db, dbPath: configuredPath };
