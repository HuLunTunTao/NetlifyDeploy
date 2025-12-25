const https = require("https");
const { t } = require("./i18n");

async function netlifyRequest(token, endpoint, options = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const url = `https://api.netlify.com/api/v1${endpoint}`;
  const useFetch = typeof fetch === "function";
  const response = useFetch
    ? await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body
      })
    : await httpRequest(url, {
        method: options.method || "GET",
        headers,
        body: options.body
      });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(t("error.pat.invalid"));
    }
    const text = await response.text();
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        detail = parsed.join(", ");
      } else if (parsed && typeof parsed === "object") {
        if (parsed.message) {
          detail = parsed.message;
        } else if (parsed.errors) {
          const errs = parsed.errors;
          if (Array.isArray(errs)) {
            detail = errs.join(", ");
          } else if (errs && typeof errs === "object") {
            detail = Object.entries(errs)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("; ");
          }
        }
      }
    } catch (error) {
      // ignore parse errors
    }
    throw new Error(
      t("error.api", {
        status: response.status,
        statusText: response.statusText,
        detail
      })
    );
  }

  if (options.rawResponse) {
    return {};
  }

  return response.json();
}

async function finishDeploy(token, deployId) {
  try {
    await netlifyRequest(token, `/deploys/${deployId}/finish`, {
      method: "POST",
      body: ""
    });
  } catch (error) {
    if (error.message && error.message.includes("404")) {
      // 部分情况下 finish 可能返回 404，但部署实际仍会推进，忽略该错误
      return;
    }
    throw error;
  }
}

async function waitForDeploy(token, deployId) {
  const maxAttempts = 30;
  const delayMs = 2000;
  for (let i = 0; i < maxAttempts; i += 1) {
    const deploy = await netlifyRequest(token, `/deploys/${deployId}`);
    if (deploy.state === "ready") {
      return deploy;
    }
    if (deploy.state === "error") {
      throw new Error(t("error.deploy.processing"));
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return netlifyRequest(token, `/deploys/${deployId}`);
}

function encodePath(filePath) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function httpRequest(url, options = {}) {
  const method = options.method || "GET";
  const headers = options.headers || {};
  const body = options.body;

  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const status = res.statusCode || 0;
        const statusText = res.statusMessage || "";
        const text = () => Promise.resolve(buffer.toString("utf8"));
        const json = async () => JSON.parse(await text());
        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText,
          headers: res.headers,
          text,
          json
        });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

module.exports = {
  netlifyRequest,
  finishDeploy,
  waitForDeploy,
  encodePath
};
