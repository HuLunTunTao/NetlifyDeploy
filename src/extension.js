const vscode = require("vscode");
const { NetlifyTreeProvider } = require("./treeProvider");
const { registerCommands } = require("./commands");
const { VIEW_ID } = require("./constants");
const { initI18n } = require("./i18n");

function activate(context) {
  initI18n();
  const provider = new NetlifyTreeProvider(context);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(VIEW_ID, provider)
  );
  registerCommands(context, provider);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
