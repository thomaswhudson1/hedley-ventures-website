# Hedley Ventures website

A self-contained, five-page static website for Hedley Ventures. It uses plain HTML, CSS and JavaScript; there is no package installation or build step. The deployable website is in `dist/`. It includes the supplied brand, portrait, testimonial photography, logos, bespoke icons and locally hosted fonts. The contact form opens a prefilled email for the visitor to review and send.

## Put this in your GitHub account

1. Download and unzip this folder.
2. Create a new empty GitHub repository (for example, `hedley-ventures`).
3. Add this folder as a local repository in GitHub Desktop, commit the files, then publish it to your GitHub account.
4. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the build and deployment source. The included workflow publishes the contents of `dist/` whenever you push to `main`.

The website uses root-based paths such as `/about/` and `/assets/site.css`, so it must be served from the root of a domain. It is set up for **https://hedleyventures.com/**: the canonical and `og:url` links, `dist/sitemap.xml` and `dist/robots.txt` all use that address. The project address `thomaswhudson1.github.io/hedley-ventures-website/` will show an unstyled page, because that address is not the domain root. The bundled workflow is a static deployment workflow and contains no secrets.

### Connect the custom domain

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**. The deploy workflow fails at "Set up Pages" until you do this.
2. **Settings → Pages → Custom domain:** enter `hedleyventures.com` and save. With Actions deployments, this setting is used and a `CNAME` file is not needed.
3. At your domain registrar, add DNS records for the apex domain: four `A` records pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`, plus a `CNAME` record for `www` pointing to `thomaswhudson1.github.io`.
4. Once the DNS check passes, tick **Enforce HTTPS**.
5. Optional but recommended: verify the domain under your GitHub account's **Settings → Pages**, so nobody else can claim it.

## Preview locally

No installation is needed. In PowerShell, from this folder, run:

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open http://localhost:8080/. Press Ctrl+C to stop. Opening the HTML files directly (double-clicking them) will not work, because the root-based paths need a web server.

## Pages

- `dist/index.html` — Home
- `dist/about/index.html` — About
- `dist/services/index.html` — Services
- `dist/deals/index.html` — Deals (transaction tombstones, built from `dist/assets/data/transactions.js`)
- `dist/track-record/index.html` — redirect from the old Track Record address to `/deals/`
- `dist/contact/index.html` — Contact
- `dist/assets/` — shared styles, scripts, fonts and image assets

## Adding a deal

Open `dist/assets/data/transactions.js`, copy an existing entry, paste it at the end of the list and change the details (the instructions are at the top of that file). Put the logos in `dist/assets/proof/`. The Deals page builds the new tombstone automatically. To show a founder testimonial, add it to `dist/assets/data/testimonials.js` and put its `id` in the deal's `testimonial` field.

`FONT-LICENSES/` contains the open font licences. `v3-asset-manifest.json` records the source brochure page and crop for each extracted brochure asset. This export excludes the ChatGPT Sites repository history and hosting configuration; it is a clean starting point for your own GitHub repository.
