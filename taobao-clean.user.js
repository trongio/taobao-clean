// ==UserScript==
// @name         Taobao Clean
// @namespace    https://github.com/trongio/taobao-clean
// @version      1.0.0
// @description  Calmer Taobao/Tmall: clean start page, no popups, ads, countdowns or recommendation feeds, plus English translation.
// @author       trongio
// @match        *://*.taobao.com/*
// @match        *://*.tmall.com/*
// @match        *://*.tmall.hk/*
// @exclude      *://login.taobao.com/*
// @exclude      *://login.tmall.com/*
// @exclude      *://passport.taobao.com/*
// @exclude      *://*/*_____tmd_____*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @updateURL    https://raw.githubusercontent.com/trongio/taobao-clean/main/taobao-clean.user.js
// @downloadURL  https://raw.githubusercontent.com/trongio/taobao-clean/main/taobao-clean.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------- settings

  const DEFAULTS = { enabled: true, home: true, translate: true, machine: true, popups: true, queryToZh: true };
  const settings = Object.assign({}, DEFAULTS, GM_getValue('settings', {}));
  const save = () => GM_setValue('settings', settings);

  const host = location.hostname;
  const path = location.pathname;
  const params = new URLSearchParams(location.search);

  const KIND =
    host === 'www.taobao.com' && (path === '/' || path === '/index.php') ? 'home'
    : host === 's.taobao.com' || host === 'list.tmall.com' ? 'search'
    : /^(item\.taobao\.com|detail\.tmall\.com|chaoshi\.detail\.tmall\.com|detail\.tmall\.hk)$/.test(host) ? 'item'
    : /^cart\./.test(host) ? 'cart'
    : /^buy\./.test(host) ? 'checkout'
    : /^(buyertrade|trade|i|refund2?|wuliu)\./.test(host) ? 'orders'
    : 'other';

  // Never touch login or anti-bot UI: Taobao must be able to show and verify these.
  const PROTECTED = [
    'iframe[src*="login"]', 'iframe[src*="punish"]', 'iframe[src*="captcha"]', 'iframe[src*="_____tmd_____"]',
    '[id*="baxia" i]', '[class*="baxia" i]', '[id^="nc_"]', '[class*="nc-container"]', '[class*="nc_wrapper"]',
    '.J_MIDDLEWARE_FRAME_WIDGET', '[id*="login" i]', '[class*="login" i]', '[class*="captcha" i]',
  ].join(',');
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
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
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
  if (css.length) GM_addStyle(css.join('\n'));
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

  function hideAds(root) {
    for (const a of root.querySelectorAll('a[href*="simba.taobao.com"]')) hide(cardOf(a) || a);
    // Small "广告"/"AD" labels mark sponsored cards.
    for (const el of root.querySelectorAll('span,div,i,em')) {
      if (el.childElementCount) continue;
      const t = (origText.get(el.firstChild) ?? el.textContent).trim();
      if (t !== '广告' && t !== 'AD') continue;
      const card = cardOf(el);
      if (card) hide(card);
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
    '登录': 'Log in', '请登录': 'Log in', '免费注册': 'Sign up', '退出': 'Log out', '搜索': 'Search', '宝贝': 'Items',
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
    if (p.closest(PROTECTED)) return;
    const local = localTranslate(t);
    if (local) return setText(node, orig, local);
    const key = t.replace(/\s+/g, ' ');
    if (cache.has(key)) return setText(node, orig, cache.get(key));
    if (!settings.machine) return;
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
    if (!(e.altKey && e.shiftKey) || e.target.closest('#tbclean-ui')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    outline(e.target, false);
    userHidden = [...userHidden, selectorFor(e.target)];
    GM_setValue(hiddenKey, userHidden);
    applyUserHidden();
    toast('Hidden. Undo from the Tampermonkey menu.');
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
    root.innerHTML = `<style>
      .bar{position:fixed;left:12px;bottom:12px;z-index:2147483647;display:flex;gap:4px;font:600 12px/1 system-ui,sans-serif}
      button{border:1px solid #0002;border-radius:999px;padding:7px 10px;background:#fffd;color:#222;cursor:pointer;backdrop-filter:blur(6px)}
      button.on{background:#ff5000;color:#fff;border-color:#ff5000}
      .toast{position:fixed;left:12px;bottom:48px;z-index:2147483647;background:#222;color:#fff;padding:8px 12px;border-radius:8px;
        font:13px system-ui,sans-serif;opacity:0;transition:opacity .2s;pointer-events:none}
    </style>
    <div class="bar"><button id="lang" title="Toggle English translation"></button>
    <button id="home" title="Clean start page">⌂</button></div><div class="toast"></div>`;
    const lang = root.getElementById('lang');
    const paint = () => { lang.textContent = settings.translate ? 'EN' : '中'; lang.classList.toggle('on', settings.translate); };
    paint();
    lang.onclick = () => {
      settings.translate = !settings.translate;
      save();
      paint();
      if (settings.translate) translateTree(document.body); else untranslateAll();
    };
    root.getElementById('home').onclick = () => { location.href = 'https://www.taobao.com/'; };
    toastEl = root.querySelector('.toast');
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
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (KIND !== 'checkout') hideFeeds(root);
    if (KIND === 'search') hideAds(root);
  }

  function start() {
    mountUI();
    cleanTree(document.body);
    translateTree(document.body);
    killPopups();

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
          if (n.nodeType === Node.ELEMENT_NODE) cleanTree(n);
          translateTree(n);
        }
        killPopups();
        for (const n of touched) if (!n.isConnected) touched.delete(n);
      }, 250);
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
