# Met Collection Explorer

Two modes:

1. **API Mode** (default): live queries via The Met Collection API `/search`.
2. **Full Catalogue Mode**: uses a prebuilt static index you host at `catalog/`.

## Quick start

1. Put `index.html` in the repo root (or `public/` on some hosts).
2. Optional full catalogue:

```bash
# Node 18+
npm init -y  # if you like; not required
# create tools/build-index.mjs (already provided here)
node tools/build-index.mjs   # downloads the CSV (GB-scale), writes JSON chunks to ./catalog/
```

> Tip: first run is heavy. Subsequent runs reuse `.cache/MetObjects.csv`.

## Deploy

- **GitHub Pages**: push the repo; Settings → Pages → Deploy from `main` / root.
- **Netlify / Cloudflare / Vercel**: deploy the folder. No build step required.

## Using Full Catalogue Mode

- After `build:catalog`, your site finds `/catalog/manifest.json` when you toggle **Full Catalogue (static)** in the header.
- The app streams chunk files and filters locally using the same UI filters (department, medium, date range, has images, on view, highlights, tags, artist/culture, title-only).

## Updating the index

Re-run `npm run build:catalog` periodically to refresh, commit the updated `catalog/` directory, and redeploy.

## Data Source

CSV: https://github.com/metmuseum/openaccess (file: `MetObjects.csv`).  
Static index fields: `objectID, title, artistDisplayName, culture, objectDate, objectBeginDate, objectEndDate, department, medium, geoLocation, isPublicDomain, isOnView, isHighlight, primaryImage, primaryImageSmall, objectURL, tags`.
