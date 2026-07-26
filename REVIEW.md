# Swatchwell — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/swatchwell/ *(redirects to custom domain once DNS is set)*
- **Custom domain:** https://swatchwell.benrichardson.dev *(live after DNS + cert below)*

## DNS setup required

Add in Cloudflare (`benrichardson.dev` zone) — already created by the build:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `swatchwell` | `ben-gy.github.io` | DNS only (grey cloud) |

Then trigger cert issuance:
```bash
gh api repos/ben-gy/swatchwell/pages -X PUT -f cname=""
sleep 3
gh api repos/ben-gy/swatchwell/pages -X PUT -f cname="swatchwell.benrichardson.dev"
```
