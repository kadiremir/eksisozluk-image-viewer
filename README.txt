# Ekşisözlük Görsel · 1.0.0

Displays linked photos inline on Ekşisözlük.

## Install

1. Keep this folder in a permanent location.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the folder containing `manifest.json`.
4. Refresh your Ekşisözlük tab.

After an update, reload the extension and refresh open Ekşi tabs.

## Use

Photos load as you scroll. Use **Fotoğrafları gizle / Fotoğrafları göster**
on the page or click the extension icon to toggle previews. Click a preview
to open the image in a new tab. The popup setting applies to the current page.

## Supported links

- Ekşi image links: `soz.lk/i/ID` and `eksisozluk.com/img/ID`
- ImgBB: `ibb.co/ID`
- Imgur images, albums, and galleries
- Resmim image links: `resmim.net/i/ID`
- Direct HTTPS image URLs ending in `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`,
  or `.avif`

Links are detected in entry text and clickable URLs. Unsupported viewer pages,
including Instagram, are not resolved. Removed, private, or blocked images may
not load.

## Privacy

The content script runs only on Ekşisözlük. The extension uses a service worker
to resolve supported public image pages. It has no analytics, remote scripts,
third-party proxy, or Chrome Cookies or History API access. Ekşi viewer requests
use same-origin credentials; requests to other viewer pages omit credentials.
Image hosts receive normal requests, including your IP address.

## Remove

Open `chrome://extensions` and remove **Ekşisözlük Görsel**.
