# Taobao Clean

A userscript that makes Taobao and Tmall calmer to use, in English.

- **Clean start page.** `www.taobao.com` becomes a plain search box with shortcuts to Cart, Orders, Favorites, Recently viewed and Refunds. Type in English and it is translated to Chinese before searching.
- **No popups.** Coupon pop-ups, "download the app" overlays and lottery wheels that open on their own get closed. Anything you open yourself is left alone.
- **No noise.** Hides sponsored results, countdown timers, red-packet widgets, floating sidebars and the "猜你喜欢 / 为你推荐 / 看了又看" recommendation feeds.
- **English.** Buttons, labels, order statuses and sales counts use a built-in dictionary (instant, offline). Product titles and specs are machine translated with Google Translate and cached. The **EN / 中** button in the bottom-left corner switches back to Chinese at any time.
- **Prices in your currency.** Every ¥ price gets an approximate GEL, USD or EUR price next to it (exchange rate refreshed twice a day). Pick the currency on the start page.
- **Tracking numbers.** The orders list shows each order's courier and tracking number with a Copy button, and **CSV** downloads the page's orders and tracking numbers (handy for forwarder warehouses).
- **Links that behave.** Items open in the same tab instead of piling up new ones (Ctrl+click still opens a new tab), and **Copy link** copies a short, clean item link.
- **Cost to Georgia.** On item pages, **🧮** shows the item price plus your forwarder's freight (air or ground, using the weight from the specs or one you type in) and warns when a parcel goes over the duty-free limit (300 GEL including shipping; check with your forwarder, it can change). In the cart it checks the selected total. Enter your forwarder's USD per kg in ⚙.
- **Seller check.** The same card shows the store's age and ratings, and flags new stores and low scores.
- **Photo wall.** **📷 Photo reviews** opens only the reviews that have photos, shown as a big photo grid. Press it again to show the review text.
- **Watchlist.** **☆ Watch** saves an item. The start page lists saved items with their latest price and how much it changed since you saved it (prices update whenever you open the item).
- **Sizes.** Shoe sizes get EU/US equivalents, clothing sizes like 170/92A are explained, and cm values get inches.
- **No "new feature" bubbles.** The "AI comparison newly launched... Got it" style tips are hidden.
- **Hide anything else.** Hold **Alt + Shift** and click any element to hide it on that site for good. Undo from the Tampermonkey menu.

Login pages are translated to English (built-in dictionary only, nothing is sent to Google) but otherwise left exactly as they are. Slider captchas and security checks are never touched; you solve those as usual. Checkout is only translated, never altered.

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

Everything is in the floating bar at the bottom-left of every Taobao page:

- **EN / 中文** switches between English and the original Chinese.
- **⌂ Start** goes to the clean start page (the original homepage is always at `https://www.taobao.com/?tbclean=off`).
- **⚙** opens the settings: translation, product-title translation, popup blocking, opening items in the same tab, tracking numbers, the clean start page, the price currency, and **Show again** for anything you hid with Alt + Shift + click.

Item pages also get **🧮 Cost**, **📷 Photo reviews**, **☆ Watch** and **🔗 Copy link**, the cart gets **🧮 Cart total**, and the orders page gets **⬇ Export CSV**. ⚙ also holds your forwarder's prices per kg and the duty-free limit.

## Privacy

Nothing is collected. The only outside requests are to Google Translate, with the Chinese text on the page (the same thing Chrome's built-in translate does), and to open.er-api.com for the exchange rate. Turn off "Machine-translate titles" to keep everything local; the built-in dictionary still works.

## Uninstall

Tampermonkey dashboard, find **Taobao Clean**, click the trash icon.
