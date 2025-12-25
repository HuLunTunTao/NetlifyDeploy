const vscode = require("vscode");

function makeItem(label, description, command, icon, tooltip) {
  const item = new vscode.TreeItem(
    label,
    vscode.TreeItemCollapsibleState.None
  );
  item.description = description || undefined;
  if (command) {
    item.command = { command, title: label };
  }
  if (icon) {
    item.iconPath = new vscode.ThemeIcon(icon);
  }
  if (tooltip) {
    item.tooltip = tooltip;
  }
  return item;
}

async function openSiteUrl(url, t) {
  if (!url) {
    vscode.window.showWarningMessage(t("warn.noSiteUrl"));
    return;
  }
  await vscode.env.clipboard.writeText(url);
  vscode.env.openExternal(vscode.Uri.parse(url));
  vscode.window.showInformationMessage(t("info.site.opened"));
}

module.exports = {
  makeItem,
  openSiteUrl
};
