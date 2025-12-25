# Netlify Deploy (VS Code Extension)

Upload and deploy a static project to Netlify without using the CLI.

## Features
- PAT-based authentication stored in VS Code SecretStorage.
- Pick a folder to deploy.
- Choose an existing site or create a new one.
- Deploy progress and completion URL.
- Activity Bar panel with quick actions.
- English/Chinese UI localization.

## Requirements
- A Netlify Personal Access Token (PAT).
  - Create one at https://app.netlify.com/user/applications#personal-access-tokens

## Quick Start
1. Open the Netlify panel in the Activity Bar.
2. Run **Netlify: Set PAT** and paste your token.
3. Run **Netlify: Select Deploy Folder**.
4. Run **Netlify: Choose Existing Site** or **Netlify: Create New Site**.
5. Run **Netlify: Deploy to Netlify**.

## Commands
- Netlify: Set PAT
- Netlify: Clear PAT
- Netlify: Select Deploy Folder
- Netlify: Choose Existing Site
- Netlify: Create New Site
- Netlify: Deploy to Netlify
- Netlify: Refresh Panel
- Netlify: Open Site URL

## Data & Privacy
This extension stores only your PAT using VS Code SecretStorage. It does not log or transmit the token anywhere except to Netlify's API.

## Publish Notes
Update `package.json` with your real repository URL before publishing:
- `repository.url`
- `bugs.url`
- `homepage`

Package with:
```
vsce package -o build/netlify-deploy-0.0.1.vsix
```

## License
MIT
