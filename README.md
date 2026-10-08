# Hedley Ventures website

A self-contained, five-page static website for Hedley Ventures. It uses plain HTML, CSS and JavaScript; there is no package installation or build step. The deployable website is in `dist/`. It includes the supplied brand, portrait, testimonial photography, logos, bespoke icons and locally hosted fonts. The contact form opens a prefilled email for the visitor to review and send.

## Put this in your GitHub account

1. Download and unzip this folder.
2. Create a new empty GitHub repository (for example, `hedley-ventures`).
3. Add this folder as a local repository in GitHub Desktop, commit the files, then publish it to your GitHub account.
4. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the build and deployment source. The included workflow publishes the contents of `dist/` whenever you push to `main`.

The website currently uses root-based paths such as `/about/`, so GitHub Pages works best on a custom domain at the domain root. Before launch, confirm the domain and update the canonical and `og:url` links in each page’s `<head>` and the domain in `dist/sitemap.xml` to match it. The bundled workflow is a static deployment workflow and contains no secrets.

## Pages

- `dist/index.html` — Home
- `dist/about/index.html` — About
- `dist/services/index.html` — Services
- `dist/track-record/index.html` — Track Record
- `dist/contact/index.html` — Contact
- `dist/assets/` — shared styles, scripts, fonts and image assets

`FONT-LICENSES/` contains the open font licences. `v3-asset-manifest.json` records the source brochure page and crop for each extracted brochure asset. This export excludes the ChatGPT Sites repository history and hosting configuration; it is a clean starting point for your own GitHub repository.
