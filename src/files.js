const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const { IGNORE_DIRS, IGNORE_FILES } = require("./constants");

async function collectFiles(rootDir) {
  const files = {};
  const fileMap = new Map();
  const hashMap = new Map();
  await walkDir(rootDir, rootDir, async (absPath, relPath) => {
    const hash = await hashFile(absPath);
    const normalized = normalizePath(relPath);
    files[normalized] = hash;
    fileMap.set(normalized, absPath);
    hashMap.set(hash, normalized);
  });
  return { files, fileMap, hashMap };
}

async function walkDir(currentDir, baseDir, onFile) {
  const entries = await fsp.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }
      await walkDir(path.join(currentDir, entry.name), baseDir, onFile);
    } else {
      if (IGNORE_FILES.has(entry.name)) {
        continue;
      }
      const absPath = path.join(currentDir, entry.name);
      const relPath = path.relative(baseDir, absPath);
      await onFile(absPath, relPath);
    }
  }
}

function normalizePath(relPath) {
  const normalized = relPath.split(path.sep).join("/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

module.exports = {
  collectFiles,
  normalizePath,
  hashFile
};
