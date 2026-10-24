# @ecomcx/create-ecomweb

CLI for Ecomweb CMS themes and plugins: create, validate, pack, test and deploy.

```bash
npm create @ecomcx/ecomweb theme "My theme"      # new theme (code; --blocks for a block theme)
npm create @ecomcx/ecomweb plugin "My plugin"    # new plugin (plugin.json + one C# file)
npx @ecomcx/create-ecomweb validate              # check the package
npx @ecomcx/create-ecomweb pack                  # zip for upload / the Store
npx @ecomcx/create-ecomweb env up && npx @ecomcx/create-ecomweb dev   # local CMS, reinstall on save
```

Themes and plugins import `@ecomcx/ecomweb-theme-sdk` / `@ecomcx/ecomweb-admin-sdk`; the scaffold installs them as npm aliases
(`"@ecomcx/ecomweb-theme-sdk": "npm:@ecomcx/ecomweb-theme-sdk@^x.y.z"`). Guides: theme-guide.md and plugin-guide.md in the CMS repository.
