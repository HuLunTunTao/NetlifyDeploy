const vscode = require("vscode");
const fsp = require("fs/promises");
const { collectFiles } = require("./files");
const {
  netlifyRequest,
  finishDeploy,
  waitForDeploy,
  encodePath
} = require("./netlify");
const {
  PAT_KEY,
  STATE_FOLDER_KEY,
  STATE_SITE_KEY
} = require("./constants");
const { t } = require("./i18n");
const { openSiteUrl } = require("./utils");

function registerCommands(context, provider) {
  const commands = [
    ["netlifyDeploy.setPAT", () => setPAT(context, provider)],
    ["netlifyDeploy.clearPAT", () => clearPAT(context, provider)],
    ["netlifyDeploy.selectFolder", () => selectFolder(context, provider)],
    ["netlifyDeploy.chooseSite", () => chooseSite(context, provider)],
    ["netlifyDeploy.createSite", () => createSite(context, provider)],
    ["netlifyDeploy.deploy", () => deploy(context, provider)],
    ["netlifyDeploy.refresh", () => provider.refresh()],
    [
      "netlifyDeploy.openSiteUrl",
      (_, url) => openSiteUrl(url || provider.getSite()?.url, t)
    ]
  ];

  commands.forEach(([cmd, handler]) =>
    context.subscriptions.push(vscode.commands.registerCommand(cmd, handler))
  );
}

async function setPAT(context, provider) {
  const pat = await vscode.window.showInputBox({
    prompt: t("input.pat.prompt"),
    placeHolder: t("input.pat.placeholder"),
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value.trim()) {
        return t("input.pat.required");
      }
      return null;
    }
  });
  if (!pat) {
    return;
  }
  await context.secrets.store(PAT_KEY, pat.trim());
  vscode.window.showInformationMessage(t("info.pat.saved"));
  provider.refresh();
}

async function clearPAT(context, provider) {
  await context.secrets.delete(PAT_KEY);
  vscode.window.showInformationMessage(t("info.pat.cleared"));
  provider.refresh();
}

async function selectFolder(context, provider) {
  const selection = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: t("input.folder.select")
  });
  if (!selection || selection.length === 0) {
    return;
  }
  const folderPath = selection[0].fsPath;
  await context.globalState.update(STATE_FOLDER_KEY, folderPath);
  vscode.window.showInformationMessage(
    t("info.folder.selected", { path: folderPath })
  );
  provider.refresh();
}

async function chooseSite(context, provider) {
  const pat = await requirePat(context, provider);
  if (!pat) {
    return;
  }

  let sites = [];
  try {
    sites = await netlifyRequest(pat, "/sites?per_page=50");
  } catch (error) {
    vscode.window.showErrorMessage(error.message || t("error.getSites"));
    return;
  }

  if (!Array.isArray(sites) || sites.length === 0) {
    vscode.window.showWarningMessage(t("warn.noSites"));
    return;
  }

  const picks = sites.map((site) => ({
    label: site.name || site.id,
    description: site.ssl_url || site.url || "",
    detail: site.id,
    site
  }));

  const picked = await vscode.window.showQuickPick(picks, {
    placeHolder: t("quickPick.site.placeholder")
  });
  if (!picked) {
    return;
  }

  await context.globalState.update(STATE_SITE_KEY, {
    id: picked.site.id,
    name: picked.site.name,
    url: picked.site.ssl_url || picked.site.url || ""
  });
  vscode.window.showInformationMessage(
    t("info.site.selected", { name: picked.label })
  );
  provider.refresh();
}

async function createSite(context, provider) {
  const pat = await requirePat(context, provider);
  if (!pat) {
    return;
  }
  const name = await vscode.window.showInputBox({
    prompt: t("input.site.prompt"),
    placeHolder: t("input.site.placeholder"),
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (value && !/^[a-zA-Z0-9]+$/.test(value)) {
        return t("input.site.validate");
      }
      return null;
    }
  });

  const payload = {};
  if (name && name.trim()) {
    payload.name = name.trim();
  }

  try {
    const site = await netlifyRequest(pat, "/sites", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await context.globalState.update(STATE_SITE_KEY, {
      id: site.id,
      name: site.name,
      url: site.ssl_url || site.url || ""
    });
    if (name && site.name && name.trim() !== site.name) {
      vscode.window.showWarningMessage(
        t("info.site.created.adjusted", { name: site.name })
      );
    } else {
      vscode.window.showInformationMessage(
        t("info.site.created", { name: site.name || site.id })
      );
    }
    provider.refresh();
  } catch (error) {
    const msg = error.message || t("error.getSites");
    if (msg.includes("subdomain") && msg.includes("unique")) {
      vscode.window.showErrorMessage(t("error.site.name.taken"));
    } else {
      vscode.window.showErrorMessage(msg);
    }
  }
}

async function deploy(context, provider) {
  const pat = await requirePat(context, provider);
  if (!pat) {
    return;
  }

  let folder = provider.getFolderPath();
  if (!folder) {
    await selectFolder(context, provider);
    folder = provider.getFolderPath();
    if (!folder) {
      return;
    }
  }

  let site = provider.getSite();
  if (!site) {
    await chooseSite(context, provider);
    site = provider.getSite();
    if (!site) {
      return;
    }
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t("tree.deploy"),
      cancellable: false
    },
    async (progress) => {
      try {
        progress.report({ message: t("progress.verifySite") });
        await netlifyRequest(pat, `/sites/${site.id}`);

        progress.report({ message: t("progress.scanFiles") });
        const { files, fileMap, hashMap } = await collectFiles(folder);
        if (Object.keys(files).length === 0) {
          throw new Error(t("error.emptyDir"));
        }

        progress.report({ message: t("progress.createDeploy") });
        const deploy = await netlifyRequest(
          pat,
          `/sites/${site.id}/deploys`,
          {
            method: "POST",
            body: JSON.stringify({ files })
          }
        );

        const required = Array.isArray(deploy.required)
          ? deploy.required
          : [];
        let uploaded = 0;
        for (const relPath of required) {
          const maybeHex = /^[a-f0-9]{40}$/i.test(relPath);
          let targetPath = relPath.startsWith("/") ? relPath : `/${relPath}`;
          let absPath =
            fileMap.get(targetPath) ||
            fileMap.get(relPath) ||
            (maybeHex ? fileMap.get(hashMap.get(relPath) || "") : null) ||
            null;

          if (!absPath && maybeHex) {
            const mappedPath = hashMap.get(relPath);
            if (mappedPath) {
              targetPath = mappedPath;
              absPath = fileMap.get(mappedPath) || null;
            }
          }

          if (!absPath) {
            throw new Error(t("error.missingFile", { file: relPath }));
          }
          const buffer = await fsp.readFile(absPath);
          await netlifyRequest(
            pat,
            `/deploys/${deploy.id}/files/${encodePath(targetPath)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/octet-stream" },
              body: buffer,
              rawResponse: true
            }
          );
          uploaded += 1;
          progress.report({
            message: t("progress.uploadFile", {
              uploaded,
              total: required.length
            })
          });
        }

        progress.report({ message: t("progress.finish") });
        await finishDeploy(pat, deploy.id);

        const url =
          deploy.deploy_ssl_url ||
          deploy.deploy_url ||
          deploy.ssl_url ||
          deploy.url ||
          site.url;

        progress.report({ message: t("progress.wait") });
        const readyDeploy = await waitForDeploy(pat, deploy.id);
        const finalUrl =
          readyDeploy.deploy_ssl_url ||
          readyDeploy.deploy_url ||
          readyDeploy.ssl_url ||
          readyDeploy.url ||
          url;

        vscode.window.showInformationMessage(
          t("info.deploy.done", { url: finalUrl || url || "" })
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          error.message || t("error.deploy.failed")
        );
      }
    }
  );
}

async function requirePat(context, provider) {
  const pat = await context.secrets.get(PAT_KEY);
  if (pat) {
    return pat;
  }
  const action = await vscode.window.showInformationMessage(
    t("warn.needPat"),
    t("action.setPAT")
  );
  if (action === t("action.setPAT")) {
    await setPAT(context, provider);
    return context.secrets.get(PAT_KEY);
  }
  return "";
}

module.exports = {
  registerCommands
};
