# Taobao Clean

A userscript that makes Taobao and Tmall calmer to use, in English.

- **Clean start page.** `www.taobao.com` becomes a plain search box with shortcuts to Cart, Orders, Favorites, Recently viewed and Refunds. Type in English and it is translated to Chinese before searching.
- **No popups.** Coupon pop-ups, "download the app" overlays and lottery wheels that open on their own get closed. Anything you open yourself is left alone.
- **No noise.** Hides sponsored results, countdown timers, red-packet widgets, floating sidebars and the "猜你喜欢 / 为你推荐 / 看了又看" recommendation feeds.
- **English.** Buttons, labels, order statuses and sales counts use a built-in dictionary (instant, offline). Product titles and specs are machine translated with Google Translate and cached. The **EN / 中** button in the bottom-left corner switches back to Chinese at any time.
- **Hide anything else.** Hold **Alt + Shift** and click any element to hide it on that site for good. Undo from the Tampermonkey menu.

Login pages, slider captchas and security checks are never touched. You solve those as usual. Checkout is only translated, never altered.

## Install

The installer opens your browser to add [Tampermonkey](https://www.tampermonkey.net/) (skipped if you already have it), then opens the script so you can click **Install**. It takes about a minute, and the script updates itself after that.

### Windows

Open **PowerShell** (Start menu, type `powershell`) and paste:

```powershell
irm https://raw.githubusercontent.com/trongio/taobao-clean/main/install.ps1 | iex
```

For another browser (`edge`, `firefox` or `brave`):

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/trongio/taobao-clean/main/install.ps1))) edge
```

### Linux

Open a terminal and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/trongio/taobao-clean/main/install.sh | bash
```

For another browser (`chromium`, `brave`, `edge` or `firefox`):

```bash
curl -fsSL https://raw.githubusercontent.com/trongio/taobao-clean/main/install.sh | bash -s -- firefox
```

### Manual

1. Install Tampermonkey for [Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo), [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) or [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/).
2. Chrome, Edge and Brave only: open the extensions page, click **Details** on Tampermonkey and turn on **Allow User Scripts** (on older versions, turn on **Developer mode** instead).
3. Open [taobao-clean.user.js](https://raw.githubusercontent.com/trongio/taobao-clean/main/taobao-clean.user.js) and click **Install**.

## Why not one fully automatic command?

Browsers deliberately block programs from installing extensions silently. The only way around that is an admin-level policy, which marks the browser as "managed by your organization". So the installer opens the right pages and you click twice.

## Settings

Click the Tampermonkey icon while on Taobao to toggle:

- Taobao Clean on or off
- Clean start page (the original is always at `https://www.taobao.com/?tbclean=off`)
- English translation, and machine translation of titles
- Popup blocking
- Undo the last hidden element, or reset hidden elements for the site

## Privacy

Nothing is collected. The only outside request is to Google Translate, with the Chinese text on the page (the same thing Chrome's built-in translate does). Turn off "Machine-translate titles" to keep everything local; the built-in dictionary still works.

## Uninstall

Tampermonkey dashboard, find **Taobao Clean**, click the trash icon.
