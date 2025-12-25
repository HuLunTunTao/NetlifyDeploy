const PAT_KEY = "netlify.accessToken";
const STATE_FOLDER_KEY = "netlify.folder";
const STATE_SITE_KEY = "netlify.site";
const VIEW_ID = "netlifyDeploy.panel";

const IGNORE_DIRS = new Set([".git", "node_modules", ".netlify"]);
const IGNORE_FILES = new Set([".DS_Store"]);

module.exports = {
  PAT_KEY,
  STATE_FOLDER_KEY,
  STATE_SITE_KEY,
  VIEW_ID,
  IGNORE_DIRS,
  IGNORE_FILES
};
