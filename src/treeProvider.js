const vscode = require("vscode");
const {
  STATE_FOLDER_KEY,
  STATE_SITE_KEY,
  PAT_KEY,
  VIEW_ID
} = require("./constants");
const { t } = require("./i18n");
const { makeItem } = require("./utils");

class NetlifyTreeProvider {
  static viewId = VIEW_ID;

  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getFolderPath() {
    return this.context.globalState.get(STATE_FOLDER_KEY) || "";
  }

  getSite() {
    return this.context.globalState.get(STATE_SITE_KEY) || null;
  }

  async hasPat() {
    const pat = await this.context.secrets.get(PAT_KEY);
    return Boolean(pat);
  }

  async getChildren(element) {
    if (element) {
      return [];
    }

    const items = [];
    const hasPat = await this.hasPat();
    const folder = this.getFolderPath();
    const site = this.getSite();

    items.push(
      makeItem(
        hasPat ? t("tree.pat.set.exists") : t("tree.pat.set"),
        hasPat ? t("tree.pat.set.exists.desc") : t("tree.pat.set.desc"),
        "netlifyDeploy.setPAT",
        hasPat ? "key" : "unlock"
      )
    );

    if (hasPat) {
      items.push(
        makeItem(
          t("tree.pat.clear"),
          t("tree.pat.clear.desc"),
          "netlifyDeploy.clearPAT",
          "debug-disconnect"
        )
      );
    }

    items.push(
      makeItem(
        t("tree.folder"),
        folder || t("tree.folder.none"),
        "netlifyDeploy.selectFolder",
        "folder"
      )
    );

    const siteDesc = site
      ? `${site.name || site.id}${site.url ? " · " + site.url : ""}`
      : t("tree.site.none");
    const siteTooltip =
      site && site.url ? `${site.name || site.id}\n${site.url}` : undefined;
    items.push(
      makeItem(
        t("tree.site"),
        siteDesc,
        "netlifyDeploy.chooseSite",
        "globe",
        siteTooltip
      )
    );
    if (site && site.url) {
      const url = site.url;
      const label = t("tree.site.url");
      const tooltip = t("tree.site.url.tooltip", { url });
      const item = makeItem(
        label,
        url,
        "netlifyDeploy.openSiteUrl",
        "link-external",
        tooltip
      );
      item.command = {
        command: "netlifyDeploy.openSiteUrl",
        title: label,
        arguments: [url]
      };
      items.push(item);
    }

    items.push(makeItem(t("tree.createSite"), "", "netlifyDeploy.createSite", "add"));
    items.push(
      makeItem(t("tree.deploy"), "", "netlifyDeploy.deploy", "cloud-upload")
    );
    items.push(makeItem(t("tree.refresh"), "", "netlifyDeploy.refresh", "refresh"));
    return items;
  }

  getTreeItem(element) {
    return element;
  }
}

module.exports = {
  NetlifyTreeProvider
};
