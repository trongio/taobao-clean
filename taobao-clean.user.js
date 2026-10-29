// ==UserScript==
// @name         Taobao Clean
// @namespace    https://github.com/trongio/taobao-clean
// @version      1.2.1
// @description  Calmer Taobao/Tmall: clean start page, no popups, ads, countdowns or recommendation feeds, plus English translation.
// @author       trongio
// @match        *://*.taobao.com/*
// @match        *://*.tmall.com/*
// @match        *://*.tmall.hk/*
// @exclude      *://passport.taobao.com/*
// @exclude      *://*/*_____tmd_____*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      translate.googleapis.com
// @connect      open.er-api.com
// @connect      buyertrade.taobao.com
// @updateURL    https://raw.githubusercontent.com/trongio/taobao-clean/main/taobao-clean.user.js
// @downloadURL  https://raw.githubusercontent.com/trongio/taobao-clean/main/taobao-clean.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------- settings

  const DEFAULTS = { enabled: true, home: true, translate: true, machine: true, popups: true, queryToZh: true,
    currency: 'GEL', sameTab: true, tracking: true };
  const settings = Object.assign({}, DEFAULTS, GM_getValue('settings', {}));
  const save = () => GM_setValue('settings', settings);

  const host = location.hostname;
  const path = location.pathname;
  const params = new URLSearchParams(location.search);

  const KIND =
    /^login\.(taobao|tmall)\.com$/.test(host) ? 'login'
    : host === 'www.taobao.com' && (path === '/' || path === '/index.php') ? 'home'
    : host === 's.taobao.com' || host === 'list.tmall.com' ? 'search'
    : /^(item\.taobao\.com|detail\.tmall\.com|chaoshi\.detail\.tmall\.com|detail\.tmall\.hk)$/.test(host) ? 'item'
    : /^cart\./.test(host) ? 'cart'
    : /^buy\./.test(host) ? 'checkout'
    : /^(buyertrade|trade|i|refund2?|wuliu)\./.test(host) ? 'orders'
    : 'other';

  // Login pages and the login iframe only get their labels translated.
  // Ad and widget iframes are left alone.
  if (window.top !== window && KIND !== 'login') return;

  // Never touch anti-bot UI, not even its text: Taobao must be able to show and verify it.
  const CAPTCHA = [
    'iframe[src*="punish"]', 'iframe[src*="captcha"]', 'iframe[src*="_____tmd_____"]',
    '[id*="baxia" i]', '[class*="baxia" i]', '[id^="nc_"]', '[class*="nc-container"]', '[class*="nc_wrapper"]',
    '.J_MIDDLEWARE_FRAME_WIDGET', '[class*="captcha" i]',
  ].join(',');
  // Never hide login UI either.
  const PROTECTED = [CAPTCHA, 'iframe[src*="login"]', '[id*="login" i]', '[class*="login" i]'].join(',');
  const isProtected = (el) => !!(el.closest && (el.closest(PROTECTED) || el.querySelector(PROTECTED)));

  const CJK = /[㐀-鿿豈-﫿]/;
  const ADDR = {
    cart: 'https://cart.taobao.com/cart.htm',
    orders: 'https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm',
    favorites: 'https://shoucang.taobao.com/item_collect.htm',
    footprints: 'https://www.taobao.com/markets/footmark/tbfoot',
    myTaobao: 'https://i.taobao.com/my_itaobao',
    refunds: 'https://refund2.taobao.com/dispute/buyerDisputeList.htm',
  };

  if (!settings.enabled) {
    registerMenu();
    return;
  }

  // -------------------------------------------------------- machine translate

  const cache = new Map(Object.entries(GM_getValue('trCache', {})));
  let cacheTimer;
  function persistCache() {
    clearTimeout(cacheTimer);
    cacheTimer = setTimeout(() => {
      const entries = [...cache.entries()].slice(-4000);
      GM_setValue('trCache', Object.fromEntries(entries));
    }, 2000);
  }

  // Google's free endpoint (same one Chrome's page translation uses). Lines are
  // joined with \n in one request and split again; on a mismatch we bisect.
  function gtx(texts, sl, tl) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        data: 'q=' + encodeURIComponent(texts.join('\n')),
        timeout: 15000,
        onload: (r) => {
          try {
            const out = JSON.parse(r.responseText)[0].map((s) => s[0]).join('').split('\n').map((s) => s.trim());
            resolve(out);
          } catch (e) { reject(e); }
        },
        onerror: reject,
        ontimeout: reject,
      });
    });
  }

  async function translateMany(texts, sl = 'zh-CN', tl = 'en') {
    const out = await gtx(texts, sl, tl);
    if (out.length === texts.length) return out;
    if (texts.length === 1) return [out.join(' ')];
    const mid = texts.length >> 1;
    return [...await translateMany(texts.slice(0, mid), sl, tl), ...await translateMany(texts.slice(mid), sl, tl)];
  }

  // ------------------------------------------------------------- clean home

  if (KIND === 'home' && settings.home && params.get('tbclean') !== 'off') {
    window.stop();
    renderHome();
    registerMenu();
    return;
  }

  function renderHome() {
    const recent = GM_getValue('recent', []);
    if (!document.documentElement) document.appendChild(document.createElement('html'));
    document.documentElement.innerHTML = `
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Taobao</title>
<style>
:root{--bg:#fafaf7;--fg:#1d1d1b;--muted:#77746c;--line:#e4e1d8;--accent:#ff5000;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#ecebe6;--muted:#9a978e;--line:#2c2b28;--card:#1c1c1a}}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;min-height:100vh;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:720px;margin:0 auto;padding:12vh 16px 48px}
h1{font-size:28px;margin:0 0 20px;letter-spacing:-.02em}h1 span{color:var(--accent)}
form{display:flex;gap:8px;flex-wrap:wrap}
input[type=search]{flex:1 1 320px;min-width:0;padding:14px 16px;font:inherit;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--fg);outline:none}
input[type=search]:focus{border-color:var(--accent)}
button{padding:14px 22px;font:inherit;font-weight:600;border:0;border-radius:10px;background:var(--accent);color:#fff;cursor:pointer}
.opts{display:flex;gap:18px;flex-wrap:wrap;margin:12px 2px 0;color:var(--muted);font-size:14px}
.opts label{display:flex;gap:6px;align-items:center;cursor:pointer}
select{font:inherit;font-size:14px;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:2px 6px}
#status{min-height:20px;margin:10px 2px 0;font-size:14px;color:var(--muted)}
nav{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:36px}
nav a{display:block;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:10px;color:var(--fg);text-decoration:none;font-weight:500}
nav a:hover{border-color:var(--accent)}nav small{display:block;color:var(--muted);font-weight:400;font-size:13px}
.recent{margin-top:32px}.recent h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 10px}
.recent button{background:var(--card);color:var(--fg);border:1px solid var(--line);padding:6px 12px;font-weight:400;font-size:14px;margin:0 6px 6px 0}
footer{margin-top:48px;font-size:13px;color:var(--muted)}footer a{color:var(--muted)}
</style></head>
<body><main>
<h1>Taobao <span>clean</span></h1>
<form id="f">
  <input id="q" type="search" placeholder="Search in English or Chinese" autofocus autocomplete="off">
  <button>Search</button>
</form>
<div class="opts">
  <label>Sort <select id="sort">
    <option value="">Best match</option><option value="sale-desc">Most sold</option>
    <option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
  </select></label>
  <label><input type="checkbox" id="tmall"> Tmall only</label>
  <label><input type="checkbox" id="zh"> Translate English query to Chinese</label>
  <label>Prices in <select id="cur">
    <option value="GEL">GEL ₾</option><option value="USD">USD $</option><option value="EUR">EUR €</option><option value="off">Yuan only</option>
  </select></label>
</div>
<div id="status"></div>
<nav>
  <a href="${ADDR.cart}">Cart<small>购物车</small></a>
  <a href="${ADDR.orders}">Orders &amp; tracking<small>已买到的宝贝</small></a>
  <a href="${ADDR.favorites}">Favorites<small>收藏夹</small></a>
  <a href="${ADDR.footprints}">Recently viewed<small>足迹</small></a>
  <a href="${ADDR.refunds}">Refunds<small>退款/售后</small></a>
  <a href="${ADDR.myTaobao}">My Taobao<small>我的淘宝</small></a>
</nav>
<div class="recent" id="recent"></div>
<footer>Taobao Clean. <a href="/?tbclean=off">Open the original homepage</a></footer>
</main></body>`;

    const $ = (id) => document.getElementById(id);
    $('zh').checked = settings.queryToZh;
    $('sort').value = GM_getValue('sort', '');
    $('tmall').checked = GM_getValue('tmall', false);
    $('cur').value = settings.currency;
    $('cur').onchange = () => { settings.currency = $('cur').value; save(); };

    const recentBox = $('recent');
    if (recent.length) {
      recentBox.innerHTML = '<h2>Recent searches</h2>';
      for (const r of recent) {
        const b = document.createElement('button');
        b.textContent = r.shown;
        b.title = r.q;
        b.onclick = () => go(r.q);
        recentBox.appendChild(b);
      }
    }

    function go(q) {
      const sort = $('sort').value;
      GM_setValue('sort', sort);
      GM_setValue('tmall', $('tmall').checked);
      let url = 'https://s.taobao.com/search?q=' + encodeURIComponent(q);
      if (sort) url += '&sort=' + sort;
      if ($('tmall').checked) url += '&tab=mall';
      location.href = url;
    }

    $('f').onsubmit = async (e) => {
      e.preventDefault();
      const raw = $('q').value.trim();
      if (!raw) return;
      settings.queryToZh = $('zh').checked;
      save();
      let q = raw;
      if (settings.queryToZh && !CJK.test(raw)) {
        $('status').textContent = 'Translating...';
        try { q = (await translateMany([raw], 'en', 'zh-CN'))[0] || raw; } catch { q = raw; }
        $('status').textContent = `Searching for ${q}`;
      }
      const shown = q === raw ? raw : `${raw} (${q})`;
      const next = [{ q, shown }, ...recent.filter((r) => r.q !== q)].slice(0, 12);
      GM_setValue('recent', next);
      go(q);
    };
  }

  // --------------------------------------------------------------- cleaning

  const hiddenKey = 'hidden:' + host;
  let userHidden = GM_getValue(hiddenKey, []);

  const css = [];
  if (['search', 'item', 'other'].includes(KIND)) {
    // Urgency timers and floating promo widgets.
    css.push(`[class*="countdown" i],[class*="count-down" i],[class*="CountDown"],[class*="timeLimit" i],
      [class*="tb-toolkit" i],[class*="FloatBar" i],[class*="float-bar" i],[class*="floatLayer" i],
      [class*="J_Toolkit"],[class*="redPacket" i],[class*="red-packet" i],[class*="hongbao" i]{display:none!important}`);
  }
  if (KIND === 'search') {
    css.push(`[class*="RightLay"],[class*="rightLay"],[id*="J_shopkeeper"],[class*="Feedback--"],
      [class*="tbpc-sidebar" i],[class*="SideBar--"],[class*="sideBar--"]{display:none!important}`);
  }
  css.push(`[data-tbclean-fx]::after{content:" ≈ " attr(data-tbclean-fx);font:400 12px system-ui,sans-serif;color:#8a8780;margin-left:4px;white-space:nowrap}
    img[data-tbclean-rev]{width:120px!important;height:120px!important;max-width:none!important;object-fit:cover!important;cursor:zoom-in!important;border-radius:6px}
    .tbclean-track{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0 4px 12px;font:12px system-ui,sans-serif;color:#444;background:#fff4ec;border:1px solid #ffd2b8;border-radius:6px;padding:2px 8px}
    .tbclean-track button{font-size:11px;border:1px solid #ff5000;color:#ff5000;background:#fff;border-radius:4px;padding:0 6px;cursor:pointer}`);
  GM_addStyle(css.join('\n'));
  const userStyle = GM_addStyle('');
  const applyUserHidden = () => {
    userStyle.textContent = userHidden.length ? userHidden.join(',\n') + '{display:none!important}' : '';
  };
  applyUserHidden();

  const hide = (el) => { if (el && !isProtected(el)) el.style.setProperty('display', 'none', 'important'); };

  const FEED_HEADINGS = [
    '猜你喜欢', '为你推荐', '看了又看', '大家都在买', '热销推荐', '相似推荐', '你可能还喜欢', '店铺推荐',
    '热卖推荐', '掌柜热卖', '为您推荐', '推荐商品', '买了又买', '人气推荐', '同店推荐', '精选推荐', '你可能喜欢',
  ];

  // A feed block is the highest ancestor (within a few levels) whose text still
  // starts with the heading, i.e. the heading sits on top of it.
  function hideFeeds(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let n; (n = walker.nextNode());) {
      const t = (origText.get(n) ?? n.data).trim();
      if (t.length <= 8 && FEED_HEADINGS.includes(t)) hits.push(n.parentElement);
    }
    for (const h of hits) {
      if (!h || h.closest('[data-tbclean-hidden]')) continue;
      let block = h;
      for (let el = h.parentElement, i = 0; el && el !== document.body && i < 7; el = el.parentElement, i++) {
        if (el.querySelector('input,button[type=submit],form') || el.matches('main,[role=main]')) break;
        const txt = (el.innerText || '').trim();
        if (!FEED_HEADINGS.some((k) => txt.startsWith(k))) break;
        block = el;
      }
      if (block !== h || block.innerText.length > 20) {
        block.dataset.tbcleanHidden = '1';
        hide(block);
      }
    }
  }

  // Nearest card-like ancestor, but never a wrapper holding several results.
  const ITEM_LINKS = 'a[href*="item.htm"],a[href*="simba.taobao.com"]';
  function cardOf(el) {
    const card = el.closest('[class*="Card--"],[class*="doubleCard" i],[class*="item" i],a[href*="item.htm"]');
    return card && card.querySelectorAll(ITEM_LINKS).length <= 3 ? card : null;
  }

  // Hide the grid cell too, otherwise the ad leaves a hole in the results.
  function cellOf(el) {
    while (el.parentElement && el.parentElement !== document.body && el.parentElement.childElementCount === 1) el = el.parentElement;
    return el;
  }

  function hideAds(root) {
    for (const a of root.querySelectorAll('a[href*="simba.taobao.com"]')) hide(cellOf(cardOf(a) || a));
    // Small "广告"/"AD" labels mark sponsored cards.
    for (const el of root.querySelectorAll('span,div,i,em')) {
      if (el.childElementCount) continue;
      const t = (origText.get(el.firstChild) ?? el.textContent).trim();
      if (t !== '广告' && t !== 'AD') continue;
      const card = cardOf(el);
      if (card) hide(cellOf(card));
    }
  }

  // Popups that show up on their own (coupons, "download the app", lottery wheels).
  // Anything appearing right after a click or key press is assumed to be wanted.
  let lastInput = 0;
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { lastInput = Date.now(); }, true);

  function killPopups() {
    if (!settings.popups || !['home', 'search', 'item', 'other'].includes(KIND)) return;
    const userOpened = Date.now() - lastInput < 2000;
    const vw = innerWidth, vh = innerHeight;
    let killed = false;
    // Popups get appended near the top of <body>, so two levels is enough and cheap.
    const candidates = [];
    for (const c of document.body.children) candidates.push(c, ...c.children);
    for (const el of candidates) {
      if (el.dataset.tbcleanSeen || el.id === 'tbclean-ui') continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      el.dataset.tbcleanSeen = '1';
      if (userOpened) continue;
      const area = (r.width * r.height) / (vw * vh);
      const z = parseInt(cs.zIndex, 10) || 0;
      if (area < 0.12 || z < 10 || isProtected(el)) continue;
      hide(el);
      killed = true;
    }
    if (killed) {
      for (const el of [document.documentElement, document.body]) {
        if (getComputedStyle(el).overflow === 'hidden') el.style.setProperty('overflow', 'auto', 'important');
      }
    }
  }

  // ------------------------------------------------------------ translation

  const DICT = {
    '加入购物车': 'Add to cart', '立即购买': 'Buy now', '领券购买': 'Buy with coupon', '购物车': 'Cart',
    '我的淘宝': 'My Taobao', '收藏夹': 'Favorites', '收藏': 'Favorite', '已收藏': 'Saved', '收藏宝贝': 'Save item',
    '登录': 'Log in', '请登录': 'Log in', '免费注册': 'Sign up', '退出': 'Log out', '搜索': 'Search', '宝贝': 'Items', '所有宝贝': 'All items',
    '天猫': 'Tmall', '店铺': 'Store', '进店逛逛': 'Visit store', '进入店铺': 'Visit store', '综合': 'Best match',
    '综合排序': 'Best match', '销量': 'Sales', '价格': 'Price', '信用': 'Rating', '新品': 'New', '包邮': 'Free shipping',
    '运费': 'Shipping', '快递': 'Express', '免运费': 'Free shipping', '快递: 免运费': 'Free shipping', '发货': 'Ships',
    '付款': 'Pay', '月销': 'Monthly sales', '已售': 'Sold', '库存': 'Stock', '数量': 'Quantity', '颜色分类': 'Color',
    '颜色': 'Color', '尺码': 'Size', '尺寸': 'Size', '型号': 'Model', '规格': 'Spec', '套餐': 'Bundle', '款式': 'Style',
    '版本': 'Version', '容量': 'Capacity', '参数信息': 'Specs', '商品参数': 'Specs', '宝贝详情': 'Details',
    '商品详情': 'Details', '图文详情': 'Details', '用户评价': 'Reviews', '评价': 'Reviews', '累计评价': 'Reviews',
    '宝贝评价': 'Reviews', '好评': 'Positive', '中评': 'Neutral', '差评': 'Negative', '追评': 'Follow-up',
    '有图': 'With photos', '有视频': 'With video', '全部': 'All', '客服': 'Support', '联系客服': 'Contact seller',
    '旺旺': 'Chat', '和我联系': 'Chat with seller', '品牌': 'Brand', '产地': 'Origin', '材质': 'Material',
    '保障': 'Guarantee', '服务': 'Service', '七天无理由退换': '7-day free returns', '7天无理由退货': '7-day free returns',
    '7天无理由退换': '7-day free returns', '运费险': 'Return shipping insurance', '退货宝': 'Free return shipping',
    '正品保证': 'Authentic guaranteed', '假一赔四': 'Fake? 4x refund', '极速退款': 'Fast refund', '优惠': 'Discount',
    '优惠券': 'Coupon', '领券': 'Get coupon', '满减': 'Spend & save', '券后': 'After coupon', '原价': 'Original price',
    '现价': 'Price', '到手价': 'Final price', '促销价': 'Promo price', '淘宝价': 'Taobao price', '结算': 'Checkout',
    '删除': 'Delete', '移入收藏夹': 'Move to favorites', '全选': 'Select all', '合计': 'Total', '合计:': 'Total:',
    '已选商品': 'Selected', '提交订单': 'Place order', '收货地址': 'Shipping address', '新增收货地址': 'Add address',
    '使用新地址': 'Use new address', '确认收货地址': 'Confirm address', '确认订单信息': 'Confirm order',
    '给卖家留言': 'Note to seller', '配送方式': 'Delivery', '普通配送': 'Standard delivery', '实付款': 'Total paid',
    '实付款:': 'Total paid:', '应付总额': 'Amount due', '我的订单': 'My orders', '已买到的宝贝': 'My orders',
    '所有订单': 'All orders', '待付款': 'To pay', '待发货': 'To ship', '待收货': 'To receive', '待评价': 'To review',
    '退款/售后': 'Refunds', '退款': 'Refund', '售后': 'After-sales', '查看物流': 'Track package',
    '物流详情': 'Tracking', '确认收货': 'Confirm receipt', '订单详情': 'Order details', '交易成功': 'Completed',
    '交易关闭': 'Closed', '卖家已发货': 'Shipped', '买家已付款': 'Paid', '等待买家付款': 'Awaiting payment',
    '等待卖家发货': 'Awaiting shipment', '申请退款': 'Request refund', '再次购买': 'Buy again', '订单号': 'Order no.',
    '订单号:': 'Order no.:', '成交时间': 'Order time', '商品': 'Item', '单价': 'Unit price', '实付': 'Paid',
    '交易状态': 'Status', '交易操作': 'Actions', '上一页': 'Prev', '下一页': 'Next', '首页': 'Home', '筛选': 'Filter',
    '发货地': 'Ships from', '所在地': 'Location', '天猫超市': 'Tmall Supermarket', '天猫国际': 'Tmall Global',
    '展开': 'Expand', '收起': 'Collapse', '更多': 'More', '确定': 'OK', '确认': 'Confirm', '取消': 'Cancel',
    '关闭': 'Close', '复制': 'Copy', '分享': 'Share', '举报': 'Report', '掌柜': 'Seller', '卖家': 'Seller',
    '买家': 'Buyer', '宝贝描述': 'Description', '卖家服务': 'Service', '物流服务': 'Logistics', '粉丝': 'Followers',
    '关注': 'Follow', '已关注': 'Following', '销量从高到低': 'Most sold', '价格从低到高': 'Price: low to high',
    '价格从高到低': 'Price: high to low', '预计': 'Est.', '送至': 'Deliver to', '现货': 'In stock', '预售': 'Pre-order',
    '有货': 'In stock', '无货': 'Out of stock', '选择': 'Select', '请选择': 'Please select', '修改': 'Edit',
    '默认地址': 'Default address', '设为默认': 'Set as default', '手机号码': 'Phone', '收货人': 'Recipient',
    '详细地址': 'Street address', '邮政编码': 'Postcode', '保存': 'Save', '编辑': 'Edit', '足迹': 'Recently viewed',
    '店铺动态': 'Store news', '本店搜索': 'Search this store', '搜本店': 'Search this store', '搜全站': 'Search all',
    '旗舰店': 'Flagship store', '专卖店': 'Brand store', '专营店': 'Retailer', '企业店铺': 'Business store',
    '金牌卖家': 'Gold seller', '描述': 'Description', '物流': 'Logistics', '高': 'High', '低': 'Low', '平': 'Avg',
    // login
    '密码登录': 'Password', '短信登录': 'SMS code', '扫码登录': 'QR code', '手机扫码登录': 'Scan with the Taobao app',
    '阿里企业购登录 >': 'Alibaba business login >', '忘记密码': 'Forgot password', '忘记账号': 'Forgot account',
    '怎么扫码登录?': 'How do I scan?', '怎么扫码登录？': 'How do I scan?', '打开': 'Open', '账号名/邮箱/手机号': 'Account name / email / phone',
    '请输入账号名/邮箱/手机号': 'Account name / email / phone', '请输入登录密码': 'Password', '请输入密码': 'Password',
    '请输入手机号': 'Phone number', '请输入手机号码': 'Phone number', '请输入验证码': 'Verification code',
    '获取验证码': 'Get code', '重新获取': 'Resend', '重新发送': 'Resend', '验证码': 'Code', '手机号': 'Phone',
    '账号': 'Account', '密码': 'Password', '登录中...': 'Logging in...', '下次自动登录': 'Stay logged in',
    '已阅读并同意以下协议': 'I have read and agree to:', '淘宝平台服务协议': 'Taobao Platform Service Agreement',
    '《淘宝平台服务协议》': 'Taobao Platform Service Agreement', '隐私权政策': 'Privacy Policy',
    '《隐私权政策》': 'Privacy Policy', '法律声明': 'Legal Notice', '《法律声明》': 'Legal Notice',
    '支付宝及客户端服务协议': 'Alipay and Client Service Agreement', '《支付宝及客户端服务协议》': 'Alipay and Client Service Agreement',
    '同意': 'Agree', '不同意': 'Disagree', '同意并登录': 'Agree and log in', '同意协议并登录': 'Agree and log in',
    '温馨提示': 'Notice', '请阅读并同意以下条款': 'Please read and agree to the terms below',
    '其他登录方式': 'Other ways to log in', '支付宝': 'Alipay', '微博': 'Weibo', '二维码已失效': 'QR code expired',
    '刷新': 'Refresh', '点击刷新': 'Refresh', '扫描成功': 'Scanned', '请在手机上确认登录': 'Confirm the login on your phone',
    '中国大陆': 'Mainland China', '返回': 'Back', '安全验证': 'Security check', '请完成安全验证': 'Please complete the security check',
  };

  const wan = (s) => s.replace(/([\d.]+)万/g, (_, n) => {
    const v = parseFloat(n) * 10;
    return (Number.isInteger(v) ? v : v.toFixed(1)) + 'k';
  });
  const N = '([\\d.]+万?\\+?)';
  const PATTERNS = [
    [new RegExp(`^月销\\s*${N}\\s*件?$`), (m) => `${wan(m[1])} sold/mo`],
    [new RegExp(`^已售\\s*${N}\\s*件?$`), (m) => `${wan(m[1])} sold`],
    [new RegExp(`^${N}\\s*人付款$`), (m) => `${wan(m[1])} bought`],
    [new RegExp(`^${N}\\s*人收货$`), (m) => `${wan(m[1])} received`],
    [new RegExp(`^${N}\\s*人(评价|已评价)$`), (m) => `${wan(m[1])} reviews`],
    [new RegExp(`^${N}\\s*人加购$`), (m) => `${wan(m[1])} added to cart`],
    [new RegExp(`^${N}\\s*人想要$`), (m) => `${wan(m[1])} want it`],
    [new RegExp(`^累计评价\\s*${N}$`), (m) => `${wan(m[1])} reviews`],
    [/^共\s*(\d+)\s*页$/, (m) => `${m[1]} pages`],
    [/^共\s*(\d+)\s*件(宝贝|商品)?$/, (m) => `${m[1]} items`],
    [/^(\d+)\s*件$/, (m) => `${m[1]} pcs`],
    [/^(\d+)\s*天内发货$/, (m) => `Ships within ${m[1]} days`],
    [/^(\d+)\s*小时内发货$/, (m) => `Ships within ${m[1]}h`],
    [/^淘宝APP\s*[\u2014\-]+\s*点击左上角扫一扫$/, () => 'Taobao app: tap Scan in the top left'],
    [/^(\d+)\s*秒后重新获取$/, (m) => `Resend in ${m[1]}s`],
  ];

  function localTranslate(t) {
    if (DICT[t]) return DICT[t];
    for (const [re, fn] of PATTERNS) {
      const m = t.match(re);
      if (m) return fn(m);
    }
    return null;
  }

  const origText = new WeakMap();   // text node -> original Chinese
  const shownText = new WeakMap();  // text node -> what we wrote
  const touched = new Set();
  const pending = new Map();        // original -> [nodes]
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'SELECT', 'OPTION']);

  function setText(node, orig, translated) {
    const lead = orig.match(/^\s*/)[0], trail = orig.match(/\s*$/)[0];
    const v = lead + translated + trail;
    origText.set(node, orig);
    shownText.set(node, v);
    touched.add(node);
    if (node.data !== v) node.data = v;
  }

  function translateNode(node) {
    const p = node.parentElement;
    if (!p || SKIP.has(p.tagName) || p.isContentEditable || p.closest('#tbclean-ui')) return;
    // React may rewrite our node; treat anything we didn't write as fresh text.
    if (shownText.get(node) === node.data) return;
    const orig = node.data;
    const t = orig.trim();
    if (!t || !CJK.test(t) || t.length > 600) return;
    if (p.closest(CAPTCHA)) return;
    const local = localTranslate(t);
    if (local) return setText(node, orig, local);
    const key = t.replace(/\s+/g, ' ');
    if (cache.has(key)) return setText(node, orig, cache.get(key));
    // Nothing from login pages goes to Google; the dictionary covers their labels.
    if (!settings.machine || KIND === 'login') return;
    origText.set(node, orig);
    if (!pending.has(key)) pending.set(key, []);
    pending.get(key).push(node);
    scheduleFlush();
  }

  let flushTimer, inflight = 0;
  function scheduleFlush() {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 350);
  }

  async function flush() {
    if (!pending.size || inflight > 2) return scheduleFlush();
    const batch = [];
    let chars = 0;
    for (const key of pending.keys()) {
      if (batch.length >= 60 || chars + key.length > 4500) break;
      batch.push(key);
      chars += key.length;
    }
    const nodes = batch.map((k) => { const n = pending.get(k); pending.delete(k); return n; });
    inflight++;
    try {
      const out = await translateMany(batch);
      batch.forEach((k, i) => {
        if (!out[i]) return;
        cache.set(k, out[i]);
        if (!settings.translate) return;
        for (const n of nodes[i]) {
          const orig = origText.get(n);
          if (n.isConnected && orig !== undefined && n.data === orig) setText(n, orig, out[i]);
        }
      });
      persistCache();
    } catch (e) {
      console.warn('[taobao-clean] translation failed', e);
    } finally {
      inflight--;
      if (pending.size) scheduleFlush();
    }
  }

  function translateTree(root) {
    if (!settings.translate) return;
    if (root.nodeType === Node.TEXT_NODE) return translateNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE || SKIP.has(root.tagName)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) translateNode(n);
    for (const el of root.querySelectorAll('input[placeholder],[title]')) {
      for (const attr of ['placeholder', 'title']) {
        const v = el.getAttribute(attr);
        const t = v && localTranslate(v.trim());
        if (t) { el.dataset['tbcleanOrig' + attr] = v; el.setAttribute(attr, t); }
      }
    }
  }

  function untranslateAll() {
    for (const n of touched) if (n.isConnected) n.data = origText.get(n);
    touched.clear();
    pending.clear();
    for (const el of document.querySelectorAll('[data-tbclean-origplaceholder],[data-tbclean-origtitle]')) {
      if (el.dataset.tbcleanOrigplaceholder) el.setAttribute('placeholder', el.dataset.tbcleanOrigplaceholder);
      if (el.dataset.tbcleanOrigtitle) el.setAttribute('title', el.dataset.tbcleanOrigtitle);
    }
  }

  // ---------------------------------------------------------------- picker

  // Alt+Shift+click hides an element on this site for good.
  function selectorFor(el) {
    const parts = [];
    for (let cur = el; cur && cur !== document.body && cur !== document.documentElement; cur = cur.parentElement) {
      if (cur.id && !/\d{3,}/.test(cur.id)) { parts.unshift('#' + CSS.escape(cur.id)); break; }
      let s = cur.tagName.toLowerCase();
      for (const c of [...cur.classList].slice(0, 3)) {
        const m = c.match(/^(.+--[A-Za-z0-9]+)--[A-Za-z0-9_-]{5,}$/);
        if (m) s += `[class*="${m[1]}--"]`;
        else if (!/\d{4,}|^tbclean/.test(c)) s += '.' + CSS.escape(c);
      }
      parts.unshift(s);
      const sel = parts.join(' > ');
      if (document.querySelectorAll(sel).length === 1) return sel;
      if (parts.length >= 6) break;
    }
    const idx = [...el.parentElement.children].filter((c) => c.tagName === el.tagName).indexOf(el) + 1;
    parts[parts.length - 1] += `:nth-of-type(${idx})`;
    return parts.join(' > ');
  }

  let picked = null;
  const outline = (el, on) => { if (el) el.style.outline = on ? '3px solid #ff5000' : ''; };
  addEventListener('mousemove', (e) => {
    const target = e.altKey && e.shiftKey ? e.target : null;
    if (target === picked) return;
    outline(picked, false);
    picked = target && !target.closest('#tbclean-ui') ? target : null;
    outline(picked, true);
  }, true);
  addEventListener('keyup', () => { outline(picked, false); picked = null; }, true);
  addEventListener('click', (e) => {
    if (!(e.altKey && e.shiftKey) || KIND === 'login' || e.target.closest('#tbclean-ui')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    outline(e.target, false);
    userHidden = [...userHidden, selectorFor(e.target)];
    GM_setValue(hiddenKey, userHidden);
    applyUserHidden();
    toast('Hidden. Undo from the Tampermonkey menu.');
  }, true);

  // ---------------------------------------------------------------- prices

  // Approximate price in the viewer's currency, shown via ::after so the
  // page's own (React-managed) DOM is never restructured.
  const FX_SYMBOL = { GEL: '₾', USD: '$', EUR: '€' };
  let fxRate = null;

  function loadRate() {
    if (!FX_SYMBOL[settings.currency]) return;
    const saved = GM_getValue('fx', null);
    if (saved && saved.rates[settings.currency]) fxRate = saved.rates[settings.currency];
    if (saved && Date.now() - saved.at < 12 * 3600e3) return;
    GM_xmlhttpRequest({
      method: 'GET',
      url: 'https://open.er-api.com/v6/latest/CNY',
      timeout: 15000,
      onload: (r) => {
        try {
          const j = JSON.parse(r.responseText);
          if (j.result !== 'success' || !j.rates[settings.currency]) return;
          GM_setValue('fx', { at: Date.now(), rates: j.rates });
          fxRate = j.rates[settings.currency];
          convertPrices();
        } catch (e) { console.warn('[taobao-clean] exchange rate failed', e); }
      },
    });
  }

  const money = (cny) => {
    const v = cny * fxRate;
    return FX_SYMBOL[settings.currency] + (v < 100 ? v.toFixed(2) : Math.round(v).toLocaleString('en'));
  };
  const PRICE_RE = /^[¥￥]([\d,]+(?:\.\d+)?)(?:[-~]([\d,]+(?:\.\d+)?))?起?$/;
  const priceOf = (el) => (el.textContent || '').replace(/\s+/g, '').match(PRICE_RE);
  const num = (s) => parseFloat(s.replace(/,/g, ''));

  function convertPrices() {
    if (!fxRate || !document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const done = new Set();
    const mark = (el, m) => {
      if (done.has(el)) return;
      done.add(el);
      const label = m[2] ? `${money(num(m[1]))}-${money(num(m[2]))}` : money(num(m[1]));
      if (el.dataset.tbcleanFx !== label) el.dataset.tbcleanFx = label;
    };
    for (let n; (n = walker.nextNode());) {
      if (!/[¥￥]/.test(n.data)) continue;
      // A lone "¥" unit followed by the digits in the next element (search cards).
      const unit = n.parentElement;
      if (unit && /^[¥￥]$/.test(n.data.trim()) && unit.childNodes.length === 1) {
        const sib = unit.nextElementSibling;
        const m = sib && (sib.textContent || '').replace(/\s+/g, '').match(/^([\d,]+(?:\.\d+)?)(?:[-~]([\d,]+(?:\.\d+)?))?/);
        if (m) { mark(sib, m); continue; }
      }
      // Otherwise climb to the element holding both "¥" and the digits.
      let el = n.parentElement;
      for (let i = 0; el && i < 4 && !priceOf(el); i++) el = el.parentElement;
      if (!el || !priceOf(el) || el.closest('#tbclean-ui')) continue;
      while (el.parentElement && el.parentElement !== document.body && priceOf(el.parentElement)) el = el.parentElement;
      mark(el, priceOf(el));
    }
  }

  let fxTimer;
  const scheduleFx = () => { clearTimeout(fxTimer); fxTimer = setTimeout(convertPrices, 500); };

  // -------------------------------------------------------------- tracking

  const COURIERS = {
    '中通快递': 'ZTO Express', '圆通速递': 'YTO Express', '圆通快递': 'YTO Express', '申通快递': 'STO Express',
    '韵达快递': 'Yunda Express', '韵达速递': 'Yunda Express', '顺丰速运': 'SF Express', '顺丰快递': 'SF Express',
    '极兔速递': 'J&T Express', '京东快递': 'JD Logistics', '京东物流': 'JD Logistics', '邮政快递包裹': 'China Post',
    '中国邮政': 'China Post', 'EMS': 'EMS', '德邦快递': 'Deppon', '德邦物流': 'Deppon', '百世快递': 'Best Express',
    '菜鸟速递': 'Cainiao', '丹鸟': 'Danniao', '天天快递': 'TTK Express', '宅急送': 'ZJS Express',
  };
  const trackCache = GM_getValue('tracking', {});
  const trackQueue = [];
  const pageOrders = new Set();
  let trackBusy = false;
  const ORDER_NO = /(?:订单号|Order no\.)\s*[:：]?\s*(\d{12,})/;

  function findOrders(root) {
    if (!settings.tracking || KIND !== 'orders' || root.nodeType !== Node.ELEMENT_NODE) return;
    for (const el of [root, ...root.querySelectorAll('span,div,td,p,label')]) {
      if (el.dataset.tbcleanOrder || el.childElementCount > 4) continue;
      const text = el.textContent || '';
      const m = text.length <= 80 && text.match(ORDER_NO);
      if (!m || [...el.children].some((c) => ORDER_NO.test(c.textContent))) continue;
      el.dataset.tbcleanOrder = m[1];
      pageOrders.add(m[1]);
      trackQueue.push({ id: m[1], anchor: el });
    }
    pumpTracking();
  }

  // Same endpoint the orders page uses for its "track package" hover card.
  function fetchTracking(id) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `https://buyertrade.taobao.com/trade/json/transit_step.do?bizOrderId=${id}`,
        responseType: 'arraybuffer',
        timeout: 15000,
        onload: (r) => {
          try {
            const gbk = /gbk|gb2312/i.test(r.responseHeaders || '');
            const j = JSON.parse(new TextDecoder(gbk ? 'gbk' : 'utf-8').decode(r.response));
            if (!j.expressId) return resolve(null);
            const steps = (j.list || []).slice().sort((a, b) => String(b.time).localeCompare(String(a.time)));
            const last = steps[0] || {};
            resolve({
              courier: COURIERS[j.expressName] || j.expressName || '',
              number: String(j.expressId),
              status: last.place || '',
              time: last.time || '',
              done: /签收|已妥投|delivered/i.test(last.place || ''),
            });
          } catch { resolve(null); }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      });
    });
  }

  async function pumpTracking() {
    if (trackBusy) return;
    trackBusy = true;
    while (trackQueue.length) {
      const { id, anchor } = trackQueue.shift();
      let info = trackCache[id];
      if (!info || !info.done) {
        info = (await fetchTracking(id)) || info;
        if (info) {
          trackCache[id] = info;
          const keep = Object.keys(trackCache).slice(-400);
          GM_setValue('tracking', Object.fromEntries(keep.map((k) => [k, trackCache[k]])));
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      if (info && anchor.isConnected) renderTracking(anchor, info);
    }
    trackBusy = false;
  }

  function renderTracking(anchor, info) {
    let box = anchor.nextElementSibling;
    if (!box || !box.classList.contains('tbclean-track')) {
      box = document.createElement('span');
      box.className = 'tbclean-track';
      anchor.insertAdjacentElement('afterend', box);
    }
    box.textContent = '';
    const b = document.createElement('b');
    b.textContent = `${info.courier} ${info.number}`;
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.onclick = (e) => { e.preventDefault(); e.stopPropagation(); GM_setClipboard(info.number); toast('Tracking number copied'); };
    const status = document.createElement('span');
    status.textContent = info.status ? ` ${info.time} ${info.status}` : '';
    box.append(b, copy, status);
  }

  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Order', 'Courier', 'Tracking number', 'Last update', 'Status']];
    for (const id of pageOrders) {
      const t = trackCache[id];
      rows.push([id, t?.courier, t?.number, t?.time, t?.status]);
    }
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `taobao-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ----------------------------------------------------------------- links

  const ITEM_HOST = /^(item\.taobao\.com|detail\.tmall\.com|detail\.tmall\.hk|chaoshi\.detail\.tmall\.com)$/;
  function cleanItemUrl(href) {
    try {
      const u = new URL(href, location.href);
      const id = u.searchParams.get('id');
      if (!ITEM_HOST.test(u.hostname) || !id) return null;
      const out = new URL(`https://${u.hostname}${u.pathname}`);
      out.searchParams.set('id', id);
      if (u.searchParams.get('skuId')) out.searchParams.set('skuId', u.searchParams.get('skuId'));
      return out.href;
    } catch { return null; }
  }

  // Plain clicks on item links stay in this tab. Ctrl/middle click still opens a new one.
  addEventListener('click', (e) => {
    if (!settings.sameTab || KIND === 'login' || e.defaultPrevented || e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target !== '_blank') return;
    const url = cleanItemUrl(a.href);
    if (!url) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    location.href = url;
  }, true);

  // --------------------------------------------------------------- reviews

  const textOf = (n) => (origText.get(n) ?? n.data).trim();
  function findText(test) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      const el = n.parentElement;
      if (el && test(textOf(n)) && el.getClientRects().length && !el.closest('#tbclean-ui')) return el;
    }
    return null;
  }
  const REVIEW_TAB = /^(用户评价|宝贝评价|累计评价|评价)\s*[(（]?[\d.万+]*[)）]?$/;
  const PHOTO_FILTER = /^(有图|图片|带图|有图\/视频|图\/视频|图片\/视频)\s*[(（]?[\d.万+]*[)）]?$/;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function openPhotoReviews() {
    lastInput = Date.now() + 8000; // the reviews dialog is wanted, don't treat it as a popup
    let filter = findText((t) => PHOTO_FILTER.test(t));
    if (!filter) {
      const tab = findText((t) => REVIEW_TAB.test(t));
      if (!tab) return toast('No reviews section found on this page');
      tab.scrollIntoView({ block: 'center' });
      tab.click();
      for (let i = 0; i < 10 && !(filter = findText((t) => PHOTO_FILTER.test(t))); i++) await sleep(400);
    }
    if (!filter) return toast('Reviews opened, but no "with photos" filter was found');
    filter.scrollIntoView({ block: 'center' });
    filter.click();
  }

  // Review photos: bigger thumbnails and a full-size viewer. The review area is
  // whatever holds the photo filter, found again as the page re-renders.
  const fullSize = (src) => src.replace(/^\/\//, 'https://').replace(/(\.(?:jpe?g|png|webp|gif))_[^/]*$/i, '$1');
  function reviewRoots() {
    const roots = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      if (!PHOTO_FILTER.test(textOf(n))) continue;
      let el = n.parentElement;
      for (let i = 0; el && el !== document.body && i < 10; i++, el = el.parentElement) {
        if (el.querySelectorAll('img').length >= 3) { roots.push(el); break; }
      }
    }
    return roots;
  }
  function markReviewImages() {
    if (KIND !== 'item') return;
    for (const root of reviewRoots()) {
      for (const img of root.querySelectorAll('img')) {
        if (img.dataset.tbcleanRev || /avatar|tps-|\.gif|\.svg/i.test(img.src)) continue;
        if (img.closest('[class*="avatar" i],[class*="head" i]')) continue;
        img.dataset.tbcleanRev = '1';
      }
    }
  }

  let viewer;
  function openViewer(list, index) {
    viewer.list = list;
    viewer.index = index;
    viewer.show();
  }
  addEventListener('click', (e) => {
    const img = e.target.closest && e.target.closest('img[data-tbclean-rev]');
    if (!img || !viewer) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const scope = img.closest('li,[class*="item" i],[class*="Comment" i]') || document.body;
    let list = [...scope.querySelectorAll('img[data-tbclean-rev]')];
    if (list.length < 2) list = [...document.querySelectorAll('img[data-tbclean-rev]')];
    openViewer(list.map((i) => fullSize(i.currentSrc || i.src)), list.indexOf(img));
  }, true);

  // --------------------------------------------------------------- toolbar

  let toastEl;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    setTimeout(() => { toastEl.style.opacity = '0'; }, 2200);
  }

  function mountUI() {
    const hostEl = document.createElement('div');
    hostEl.id = 'tbclean-ui';
    const root = hostEl.attachShadow({ mode: 'open' });
    const extra = KIND === 'item' ? '<button id="photos">Photo reviews</button><button id="copy">Copy link</button>'
      : KIND === 'orders' ? '<button id="csv" title="Download orders and tracking numbers on this page">CSV</button>' : '';
    root.innerHTML = `<style>
      .bar{position:fixed;left:12px;bottom:12px;z-index:2147483646;display:flex;gap:4px;font:600 12px/1 system-ui,sans-serif}
      .bar button{border:1px solid #0002;border-radius:999px;padding:7px 10px;background:#fffd;color:#222;cursor:pointer;backdrop-filter:blur(6px);font:inherit}
      .bar button.on{background:#ff5000;color:#fff;border-color:#ff5000}
      .toast{position:fixed;left:12px;bottom:48px;z-index:2147483647;background:#222;color:#fff;padding:8px 12px;border-radius:8px;
        font:13px system-ui,sans-serif;opacity:0;transition:opacity .2s;pointer-events:none}
      .viewer{position:fixed;inset:0;z-index:2147483647;background:#000e;display:none;align-items:center;justify-content:center}
      .viewer.open{display:flex}
      .viewer img{max-width:92vw;max-height:88vh;object-fit:contain;border-radius:6px}
      .viewer button{position:absolute;border:0;border-radius:999px;background:#fff2;color:#fff;font:28px/1 system-ui,sans-serif;
        width:52px;height:52px;cursor:pointer}
      .viewer button:hover{background:#fff4}
      .viewer .prev{left:16px;top:50%;transform:translateY(-50%)}.viewer .next{right:16px;top:50%;transform:translateY(-50%)}
      .viewer .x{right:16px;top:16px;font-size:22px;width:44px;height:44px}
      .viewer .count{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);color:#fff;font:13px system-ui,sans-serif}
    </style>
    <div class="bar"><button id="lang" title="Toggle English translation"></button>${extra}
    <button id="home" title="Clean start page">⌂</button></div><div class="toast"></div>
    <div class="viewer"><img alt=""><button class="prev" title="Previous">‹</button><button class="next" title="Next">›</button>
    <button class="x" title="Close">×</button><div class="count"></div></div>`;
    const $ = (sel) => root.querySelector(sel);
    const lang = $('#lang');
    const paint = () => { lang.textContent = settings.translate ? 'EN' : '中'; lang.classList.toggle('on', settings.translate); };
    paint();
    lang.onclick = () => {
      settings.translate = !settings.translate;
      save();
      paint();
      if (settings.translate) translateTree(document.body); else untranslateAll();
    };
    $('#home').onclick = () => { location.href = 'https://www.taobao.com/'; };
    if ($('#photos')) $('#photos').onclick = openPhotoReviews;
    if ($('#copy')) $('#copy').onclick = () => { GM_setClipboard(cleanItemUrl(location.href) || location.href); toast('Link copied'); };
    if ($('#csv')) $('#csv').onclick = exportCsv;
    toastEl = $('.toast');

    const v = $('.viewer'), vimg = v.querySelector('img'), count = $('.count');
    viewer = {
      list: [], index: 0,
      show() {
        if (!this.list.length) return;
        this.index = (this.index + this.list.length) % this.list.length;
        vimg.src = this.list[this.index];
        count.textContent = `${this.index + 1} / ${this.list.length}`;
        v.classList.add('open');
      },
      hide() { v.classList.remove('open'); vimg.removeAttribute('src'); },
    };
    $('.prev').onclick = () => { viewer.index--; viewer.show(); };
    $('.next').onclick = () => { viewer.index++; viewer.show(); };
    $('.x').onclick = () => viewer.hide();
    v.onclick = (e) => { if (e.target === v || e.target === vimg) viewer.hide(); };
    addEventListener('keydown', (e) => {
      if (!v.classList.contains('open')) return;
      if (e.key === 'Escape') viewer.hide();
      else if (e.key === 'ArrowLeft') { viewer.index--; viewer.show(); }
      else if (e.key === 'ArrowRight') { viewer.index++; viewer.show(); }
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
    document.documentElement.appendChild(hostEl);
  }

  // ------------------------------------------------------------------ menu

  function registerMenu() {
    const toggle = (key, label) => GM_registerMenuCommand(`${settings[key] ? '✓' : '✗'} ${label}`, () => {
      settings[key] = !settings[key];
      save();
      location.reload();
    });
    toggle('enabled', 'Taobao Clean enabled');
    toggle('home', 'Clean start page');
    toggle('translate', 'English translation');
    toggle('machine', 'Machine-translate titles (uses Google)');
    toggle('popups', 'Block popups');
    toggle('sameTab', 'Open items in the same tab');
    toggle('tracking', 'Show tracking numbers on orders');
    const order = ['GEL', 'USD', 'EUR', 'off'];
    GM_registerMenuCommand(`Prices in: ${settings.currency} (click to change)`, () => {
      settings.currency = order[(order.indexOf(settings.currency) + 1) % order.length];
      save();
      location.reload();
    });
    GM_registerMenuCommand('Undo last hidden element', () => {
      const list = GM_getValue(hiddenKey, []);
      list.pop();
      GM_setValue(hiddenKey, list);
      location.reload();
    });
    GM_registerMenuCommand('Reset hidden elements on this site', () => {
      GM_setValue(hiddenKey, []);
      location.reload();
    });
    GM_registerMenuCommand('Clear translation cache', () => GM_setValue('trCache', {}));
  }

  // ------------------------------------------------------------------ boot

  registerMenu();

  function cleanTree(root) {
    if (root.nodeType !== Node.ELEMENT_NODE || KIND === 'login') return;
    if (KIND !== 'checkout') hideFeeds(root);
    if (KIND === 'search') hideAds(root);
  }

  function start() {
    if (window.top === window) mountUI();
    if (KIND === 'item') {
      const clean = cleanItemUrl(location.href);
      if (clean && clean !== location.href) history.replaceState(history.state, '', clean);
    }
    loadRate();
    cleanTree(document.body);
    translateTree(document.body);
    killPopups();
    convertPrices();
    findOrders(document.body);
    markReviewImages();

    const dirty = new Set();
    let timer;
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') dirty.add(m.target);
        else for (const n of m.addedNodes) dirty.add(n);
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const nodes = [...dirty];
        dirty.clear();
        for (const n of nodes) {
          if (!n.isConnected) continue;
          if (n.nodeType === Node.ELEMENT_NODE) { cleanTree(n); findOrders(n); }
          translateTree(n);
        }
        killPopups();
        scheduleFx();
        markReviewImages();
        for (const n of touched) if (!n.isConnected) touched.delete(n);
      }, 250);
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
