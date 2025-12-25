const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

let messages = {};
let fallback = {};

function initI18n() {
  const lang = (vscode.env.language || "en").toLowerCase();
  const normalized = lang.startsWith("zh") ? "zh-CN" : "en";
  fallback = loadLocale("en") || {};
  messages = loadLocale(normalized) || fallback;
}

function loadLocale(code) {
  try {
    const filePath = path.join(__dirname, "locales", `${code}.json`);
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function format(text, vars) {
  if (!vars) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return match;
  });
}

function t(key, vars) {
  const text = messages[key] || fallback[key] || key;
  return format(text, vars);
}

module.exports = {
  initI18n,
  t
};
