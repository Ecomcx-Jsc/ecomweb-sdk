# @ecomcx/create-ecomweb

CLI for Ecomweb CMS themes and plugins: create, validate, pack, test and deploy.

```bash
npm create @ecomcx/ecomweb theme "My theme"      # new theme (code; --blocks for a block theme)
npm create @ecomcx/ecomweb plugin "My plugin"    # new plugin (plugin.json + one C# file)
npx @ecomcx/create-ecomweb validate              # check the package
npx @ecomcx/create-ecomweb pack                  # zip for upload / the Store
npx @ecomcx/create-ecomweb env up && npx @ecomcx/create-ecomweb dev   # local CMS, reinstall on save
```

Work on a theme that already runs on a site (needs CMS 1.35+ and an API token: admin › Profile › API tokens; no password, so 2FA does not matter):

```bash
npx @ecomcx/create-ecomweb login --url https://site --token cmsp_…   # token saved in ~/.config/ecomweb (mode 600)
npx @ecomcx/create-ecomweb clone my-theme                            # source of the running theme -> ./my-theme
npx @ecomcx/create-ecomweb pull                                      # take what changed on the server; your edits are kept
npx @ecomcx/create-ecomweb push                                      # like deploy, refused if the server changed since your last pull (--force to overwrite)
```

Preview it with the site's real data, no Docker, nothing written to the site:

```bash
npx @ecomcx/create-ecomweb dev --data https://site    # website on http://localhost:3000 with this theme; edits show on save
```

The website source of the site's CMS version is fetched once from the Store (signature checked) into `~/.cache/ecomweb`, then `npm install`; npm packages listed in the theme's `package.json` are installed too. Parts drawn by plugins stay empty, and customer login / cart do not work locally.

`pull` stops without writing anything when the same file changed on both sides. Plugins are not cloned: the server keeps only the compiled build.

Themes and plugins import `@ecomcx/ecomweb-theme-sdk` / `@ecomcx/ecomweb-admin-sdk`; the scaffold installs them as npm aliases
(`"@ecomcx/ecomweb-theme-sdk": "npm:@ecomcx/ecomweb-theme-sdk@^x.y.z"`). Guides: theme-guide.md and plugin-guide.md in the CMS repository.
