# @ecomcx/create-nexus

CLI for ECX Nexus CMS themes and plugins: create, validate, pack, test and deploy.

```bash
npm create @ecomcx/nexus theme "My theme"      # new theme (code; --blocks for a block theme)
npm create @ecomcx/nexus plugin "My plugin"    # new plugin (plugin.json + one C# file)
npx @ecomcx/create-nexus validate              # check the package
npx @ecomcx/create-nexus pack                  # zip for upload / the Store
npx @ecomcx/create-nexus env up && npx @ecomcx/create-nexus dev   # local CMS, reinstall on save
```

Themes and plugins import `@ecomcx/nexus-theme-sdk` / `@ecomcx/nexus-admin-sdk`; the scaffold installs them as npm aliases
(`"@ecomcx/nexus-theme-sdk": "npm:@ecomcx/nexus-theme-sdk@^x.y.z"`). Guides: theme-guide.md and plugin-guide.md in the CMS repository.
