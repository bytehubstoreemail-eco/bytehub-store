/* ==========================================================
   🛍️ ByteHubStore.js — IndexedDB + Encrypted Storage version
   Version: 2.0.0-mod | Author: ByteHub Store (modified)
   Note: Uses IndexedDB (objectStore: 'kv') and Web Crypto AES-GCM encryption
   ========================================================== */
(function(){ "use strict";
   const PRODUCTS_FEED = window.PRODUCTS_FEED || "https://bytehubstoren.blogspot.com/feeds/posts/default/-/product?alt=json-in-script&callback=renderProductsFromFeed";

  /* ------------------ Helpers & Selectors ------------------ */
  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from((root || document).querySelectorAll(sel));

            
  /* ================== Utility placeholders referenced earlier ================== */
  // تم تعريف PRODUCTS_FEED و detectPageType سابقًا في الجزء الأصلي — إذا لم تُعرَّف قم بتعريفها:

  function detectPageType() {
    const path = window.location.pathname.toLowerCase();

    if (path.includes('/p/checkout')) return 'checkout';
    if (path.includes('/p/cart')) return 'cart';
    if (path.includes('/p/wishlist')) return 'wishlist';
    if (path === '/' || path.includes('/search') || path.includes('/index')) return 'home';

    if (document.body.classList.contains('item-view') || document.querySelector('.post-body')) {
      return 'product';
    }
    return 'other';
  }
  /* ------------------ Crypto (Web Crypto) ------------------ */
  // غيّر هذه العبارة إلى عبارة سرية خاصة بك قبل النشر
  const PASS_PHRASE = "gggFDTEHGYtfy59GGTFÙ$ỀÈÈTF5588GFYgggtytf";

  async function deriveKey(passphrase) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    // استخدام ملح ثابت هنا لسهولة التنفيذ؛ للأمان الأفضل استخدم ملح مختلف لكل مستخدم/جلسة
    const salt = enc.encode('bytehub-salt-v1');
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt','decrypt']
    );
  }

  function toBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    const view = new Uint8Array(bytes);
    for (let i = 0; i < len; i++) binary += String.fromCharCode(view[i]);
    return btoa(binary);
  }
  function fromBase64(b64) {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  async function encryptJSON(obj) {
    const key = await deriveKey(PASS_PHRASE);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
    const enc = new TextEncoder();
    const data = enc.encode(JSON.stringify(obj));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    // تخزين iv + cipher في base64
    const ivB64 = toBase64(iv.buffer);
    const cipherB64 = toBase64(cipher);
    return `${ivB64}:${cipherB64}`;
  }

  async function decryptJSON(encryptedStr) {
    if (!encryptedStr) return null;
    const [ivB64, cipherB64] = encryptedStr.split(':');
    if (!ivB64 || !cipherB64) return null;
    const key = await deriveKey(PASS_PHRASE);
    const iv = new Uint8Array(fromBase64(ivB64));
    const cipher = fromBase64(cipherB64);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(plain));
  }

  /* ------------------ IndexedDB (single kv store) ------------------ */
  let db;
  const DB_NAME = 'ByteHubStoreDB_v1';
  const STORE = 'kv';

  const dbReady = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains(STORE)) {
        idb.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };
    req.onerror = (e) => {
      console.error("IndexedDB open error:", e.target.error);
      reject(e.target.error);
    };
  });

  async function kvSet(key, valueObj) {
    await dbReady;
    try {
      const enc = await encryptJSON(valueObj);
      return new Promise((res, rej) => {
        const tx = db.transaction([STORE], 'readwrite');
        const store = tx.objectStore(STORE);
        const r = store.put({ key, value: enc });
        r.onsuccess = () => res();
        r.onerror = (e) => rej(e);
      });
    } catch (err) {
      console.error("kvSet error:", err);
      throw err;
    }
  }

  async function kvGet(key) {
    await dbReady;
    return new Promise((res, rej) => {
      const tx = db.transaction([STORE], 'readonly');
      const store = tx.objectStore(STORE);
      const r = store.get(key);
      r.onsuccess = async () => {
        if (!r.result) return res(null);
        try {
          const decrypted = await decryptJSON(r.result.value);
          res(decrypted);
        } catch (err) {
          console.error("kvGet decrypt error:", err);
          res(null);
        }
      };
      r.onerror = (e) => rej(e);
    });
  }

  async function kvRemove(key) {
    await dbReady;
    return new Promise((res, rej) => {
      const tx = db.transaction([STORE], 'readwrite');
      const store = tx.objectStore(STORE);
      const r = store.delete(key);
      r.onsuccess = () => res();
      r.onerror = (e) => rej(e);
    });
  }

  /* ------------------ In-memory caches for sync-like use ------------------ */
  let currencyRates = { USD: 1, EUR: 0.92, DZD: 135 };
  let currencyCache = 'USD'; // loaded on init
  (async function initCaches(){
    try {
      await dbReady;
      const cr = await kvGet('currencyRates');
      if (cr) currencyRates = cr;
      const cur = await kvGet('currency');
      if (cur) currencyCache = cur;
    } catch(e){
      console.warn("Failed loading caches from IndexedDB, using defaults", e);
    }
  })();

  /* ---------------- Currency Handling (fetch & convert) ---------------- */
  async function fetchCurrencyRates(){
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,DZD');
      const data = await res.json();
      currencyRates = { USD: 1, ...data.rates };
      await kvSet('currencyRates', currencyRates);
    } catch (e) {
      console.warn("فشل في جلب أسعار الصرف، سيتم استخدام القيم المخزنة/الافتراضية");
      const stored = await kvGet('currencyRates');
      if (stored) currencyRates = stored;
    }
  }

  function convertPrice(price){
    const currency = currencyCache || 'USD';
    const rate = currencyRates[currency] || 1;
    const symbol = ({USD:"$",EUR:"€",DZD:"دج"})[currency] || "$";
    return `${symbol}${(price * rate).toFixed(2)}`;
  }

  async function setCurrencyDropdown(){
    const dropdown = qs('#currencyDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = ['USD','EUR','DZD'].map(c => `
      <button class="currency-option" data-currency="${c}">
        <i class="fa fa-credit-card"></i> ${({USD:"$",EUR:"€",DZD:"دج"})[c]} ${c}
      </button>
    `).join('');
    qsa('.currency-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        currencyCache = btn.dataset.currency;
        await kvSet('currency', currencyCache);
        updateCartDropdown();
        if (typeof lastFetchedFeed === 'object' && lastFetchedFeed) renderProductsFromFeed(lastFetchedFeed);
      });
    });
  }

  (async function(){
    await dbReady;
    await fetchCurrencyRates();
    await setCurrencyDropdown();
  })();

  function injectCurrencyDropdown(){
    const trackingItem = qsa("li.nav-item").find(li =>
      li.textContent.includes("Order Tracking")
    );

    if (!trackingItem || qs('#currencyDropdown')) return;

    const wrapper = document.createElement('li');
    wrapper.id = 'currencyDropdown';
    wrapper.className = 'nav-item currency-dropdown';
    wrapper.innerHTML = `
      <button class="currency-toggle nav-link">
        💱 <span id="selectedCurrency">${currencyCache || 'USD'}</span> <i class="fa fa-chevron-down"></i>
      </button>
      <div class="currency-menu" style="display:none">
        <button data-currency="USD">$ USD</button>
        <button data-currency="EUR">€ EUR</button>
        <button data-currency="DZD">دج DZD</button>
      </div>
    `;

    trackingItem.after(wrapper);

    const toggle = wrapper.querySelector('.currency-toggle');
    const menu = wrapper.querySelector('.currency-menu');
    toggle.addEventListener('click', () => {
      menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    });

    wrapper.querySelectorAll('.currency-menu button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const currency = btn.dataset.currency;
        currencyCache = currency;
        await kvSet('currency', currency);
        qs('#selectedCurrency').textContent = currency;
        menu.style.display = 'none';
        updateCartDropdown();
        if (typeof lastFetchedFeed === 'object' && lastFetchedFeed) renderProductsFromFeed(lastFetchedFeed);
      });
    });
  }

  /* ---------------- Cart / Wishlist Helpers (kv-backed) ---------------- */
  async function readCart() {
    const items = await kvGet('cart');
    return Array.isArray(items) ? items : [];
  }
  async function writeCart(c) {
    await kvSet('cart', c || []);
  }
  async function readWish() {
    const items = await kvGet('wishlist');
    return Array.isArray(items) ? items : [];
  }
  async function writeWish(w) {
    await kvSet('wishlist', w || []);
  }

  async function updateCartCount(){
    const el = qs('#cartCount');
    if(!el) return;
    const cart = await readCart();
    const count = cart.reduce((s,i) => s + (i.quantity || 1), 0) || 0;
    el.textContent = count;
  }

  async function addToCart(product, redirect=false){
    if (!product?.id || !product?.price) return;
    const cart = await readCart();
    const existing = cart.find(p => p.id === product.id);
    if (existing) existing.quantity = (existing.quantity || 1) + (product.quantity || 1);
    else { product.quantity = product.quantity || 1; cart.push(product); }
    await writeCart(cart);
    await updateCartCount();
    await updateCartDropdown();
    if (redirect) window.location.href = '/p/cart.html';
    else alert('✅ تمت إضافة المنتج إلى السلة');
  }
  // تصدير دوال للجانبين: inline onclick قد يستدعيها
  window.addToCart = (p, r=false) => { addToCart(p, r); };
  window.addToCartFromGrid = window.addToCart;

  async function toggleWishlist(product, redirect=false){
    if (!product?.id) return;
    const wish = await readWish();
    if (!wish.find(p => p.id === product.id)){
      wish.push(product);
      await writeWish(wish);
      alert('❤️ تمت الإضافة إلى المفضلة');
    }
    if (redirect) window.location.href = '/p/wishlist.html';
  }
  window.toggleWishlistFromGrid = (p,r=false) => { toggleWishlist(p,r); };

  async function updateCartDropdown(){
    const container = qs('#cartItemsContainer');
    const cart = await readCart();
    if (!container) return;

    if (cart.length === 0){
      container.innerHTML = "<p>السلة فارغة</p>";
      qs('#cartSubtotal') && (qs('#cartSubtotal').textContent = convertPrice(0));
      return;
    }

    container.innerHTML = cart.map(p => `
      <div class="cart-item" data-id="${p.id}">
        <img src="${p.img}" alt="${p.title}">
        <div class="cart-item-info">
          <div class="cart-item-header">
            <span class="cart-item-name">${p.title}</span>
            <button class="remove-item"><i class="fa fa-trash"></i></button>
          </div>
          <div class="cart-item-price">${convertPrice(p.price)}</div>
          <div class="cart-quantity">
            <button class="qty-btn minus"><i class="fa fa-minus"></i></button>
            <span class="qty-value">${p.quantity}</span>
            <button class="qty-btn plus"><i class="fa fa-plus"></i></button>
          </div>
        </div>
      </div>
    `).join('');

    const subtotal = cart.reduce((s, p) => s + (p.price * (p.quantity || 1)), 0);
    qs('#cartSubtotal') && (qs('#cartSubtotal').textContent = convertPrice(subtotal));
  }

  // تعامل مع أحداث داخل الDOM للـ cart items (يستخدم read/write async)
  document.addEventListener('click', async (e) => {
    const item = e.target.closest('.cart-item');
    if (!item) return;
    const id = item.dataset.id;
    let cart = await readCart();
    const index = cart.findIndex(p => p.id === id);
    if (index === -1) return;

    if (e.target.closest('.remove-item')){
      cart.splice(index, 1);
    } else if (e.target.closest('.qty-btn.plus')){
      cart[index].quantity = (cart[index].quantity || 1) + 1;
    } else if (e.target.closest('.qty-btn.minus')){
      cart[index].quantity = Math.max(1, (cart[index].quantity || 1) - 1);
    } else return;

    await writeCart(cart);
    await updateCartCount();
    await updateCartDropdown();
  });

  // Empty / Checkout Buttons (DOMContentLoaded may attach later)
  async function emptyCartAction(){
    await writeCart([]);
    await updateCartCount();
    await updateCartDropdown();
  }
  function checkoutAction(){ window.location.href = '/p/checkout.html'; }
  // زر event listeners will be attached later in init when elements exist

  /* ---------------- end Part 1 ---------------- */
  /* ---------------- Quick View ---------------- */
  async function openProductDetails(product){
    await kvSet('currentProduct', product); // تخزين مشفّر للمراجعة في صفحة المنتج
    window.location.href = '/p/product.html';
  }

  async function renderQuickView(product){
    const modal = qs('#quickViewModal');
    if (!modal) return;
    const colors = product.colors || ["Default"];
    modal.innerHTML = `
      <div class="qv-inner">
        <!-- Images -->
        <div class="qv-left">
          <img id="mainQvImage" src="${product.img}" alt="${product.title}"/>
          <div class="thumbnail-slider">
            ${(product.images || [product.img]).map(img => `
              <img src="${img}" onclick="document.getElementById('mainQvImage').src='${img}'"/>
            `).join('')}
          </div>
        </div>

        <!-- Details -->
        <div class="qv-right">
          <h2>${product.title}</h2>
          <div class="product-category">الفئة: ${product.category}</div>
          <div class="price-row">
            <span class="price">${convertPrice(product.price)}</span>
            ${product.oldPrice ? `<span class="old-price">${convertPrice(product.oldPrice)}</span>` : ""}
          </div>
          <p class="short-desc">${product.shortDesc}</p>
          <div class="product-options">
            <select id="qvColorSelect">${colors.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
            <input id="qvQuantity" type="number" min="1" value="1"/>
          </div>
          <div class="qv-actions">
            <button class="add-to-cart">🛒 أضف إلى السلة</button>
            <button class="view-cart">عرض السلة</button>
            <button class="wishlist">❤️ المفضلة</button>
            <button class="whatsapp">📱 واتساب</button>
          </div>
          <div class="social-share">
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}" target="_blank">Facebook</a>
            <a href="https://twitter.com/share?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(product.title)}" target="_blank">Twitter</a>
          </div>
        </div>

        <button class="qv-close">×</button>
      </div>
    `;
    modal.style.display = 'block';

    modal.querySelector('.add-to-cart')?.addEventListener('click', async () => {
      const qty = parseInt(qs('#qvQuantity').value) || 1;
      const color = qs('#qvColorSelect').value;
      const productToAdd = {...product, quantity: qty, selectedColor: color};
      await addToCart(productToAdd);
    });

    modal.querySelector('.qv-close')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.querySelector('.wishlist')?.addEventListener('click', () => {
      toggleWishlist(product);
    });

    modal.querySelector('.view-cart')?.addEventListener('click', () => {
      cartMenu.style.display = 'block';
    });
  }

  async function openQuickView(product){
    await kvSet('currentProduct', product);
    renderQuickView(product);
  }

  /* ---------------- Feed Rendering ---------------- */
  let lastFetchedFeed = null;

  function safeJsonEncode(o){
    // ضمان عدم حدوث أخطاء عند تضمين JSON داخل onclick inline
    return encodeURIComponent(JSON.stringify(o).replace(/'/g,"\\'"));
  }

  function renderProductsFromFeed(json) {
    lastFetchedFeed = json;
    const entries = json.feed.entry || [];
    const container = qs('#productsContainer');
    if (!container) return;
    if (!entries.length) { container.innerHTML = "<p>لا توجد منتجات حاليا!</p>"; return; }

    container.innerHTML = entries.map(entry => {
  const title = entry.title.$t;
  const content = entry.content.$t;
  let img = (content.match(/<img[^>]+src=['"]([^'"]+)['"]/i) || [])[1] || "https://via.placeholder.com/300x220";
  const currentPrice = parseFloat((content.match(/\$([0-9.]+)/) || [])[1] || 0);
  const oldPrice = parseFloat((content.match(/~\$?([0-9.]+)~|<del>\$?([0-9.]+)<\/del>/i) || [])[1] || 0);
  const category = (entry.category && entry.category[0]?.term) || "غير مصنف";
  
  // توليد المفتاح الفريد باستخدام الوقت (timestamp) و القيمة العشوائية
  function generateUniqueId() {
    const timestamp = Date.now(); // الوقت الحالي
    const randomValue = Math.floor(Math.random() * 1000000); // قيمة عشوائية
    return `${timestamp}-${randomValue}`;
  }

  const productObj = {
    id: generateUniqueId(), // استخدام المفتاح الفريد
    title,
    img,
    price: currentPrice,
    oldPrice,
    category,
    shortDesc: content.replace(/(<([^>]+)>)/ig, "").slice(0, 150)
  };
});

      // استخدم مَعْدِل التشفير في الأعلى: openProductDetails و openQuickView يعملان بشكل async
      return `
        <div class='product-card' data-product='${safeJsonEncode(productObj)}'>
          <a class='product-link' href='javascript:void(0)' onclick='(function(){ window.bytehub_openPD && window.bytehub_openPD(${safeJsonEncode(productObj)}) })()'>
            <img src='${productObj.img}' alt='${productObj.title}'/>
          </a>
          <div class='card-actions'>
            <button class='rect-btn add' title='Add to Cart' onclick='(function(){ window.bytehub_add && window.bytehub_add(${safeJsonEncode(productObj)}) })()'>
              <i class="fa fa-cart-plus"></i> أضف
            </button>
            <button class='rect-btn view' title='Quick View' onclick='(function(){ window.bytehub_qv && window.bytehub_qv(${safeJsonEncode(productObj)}) })()'>
              <i class="fa fa-eye"></i> عرض
            </button>
            <button class='wishlist-btn' title='Add to Wishlist' onclick='(function(){ window.bytehub_wish && window.bytehub_wish(${safeJsonEncode(productObj)}) })()'>
              <i class="fa fa-heart"></i>
            </button>
          </div>
          <a class='product-name' href='javascript:void(0)' onclick='(function(){ window.bytehub_openPD && window.bytehub_openPD(${safeJsonEncode(productObj)}) })()'>
            ${productObj.title}
          </a>
          <div class='product-info'>
            <div class='product-category'>${productObj.category}</div>
            <div class='price-row'>
              <span class='price'>${convertPrice(productObj.price)}</span>
              ${productObj.oldPrice ? `<span class='old-price'>${convertPrice(productObj.oldPrice)}</span>` : ""}
            </div>
          </div>
        </div>
      `;
    }).join('');
    updateCartCount();
  }

  // واجهات بسيطة لاستدعاء async من inline onclick
  window.bytehub_add = (encodedProduct) => {
    try {
      const p = JSON.parse(decodeURIComponent(encodedProduct));
      addToCart(p);
    } catch(e){ console.error(e); }
  };
  window.bytehub_qv = (encodedProduct) => {
    try {
      const p = JSON.parse(decodeURIComponent(encodedProduct));
      openQuickView(p);
    } catch(e){ console.error(e); }
  };
  window.bytehub_wish = (encodedProduct) => {
    try {
      const p = JSON.parse(decodeURIComponent(encodedProduct));
      toggleWishlist(p);
    } catch(e){ console.error(e); }
  };
  window.bytehub_openPD = async (encodedProduct) => {
    try {
      const p = JSON.parse(decodeURIComponent(encodedProduct));
      await openProductDetails(p);
    } catch(e){ console.error(e); }
  };

  window.renderProductsFromFeed = renderProductsFromFeed;

  /* ---------------- Event Delegation for Dynamic Buttons ---------------- */
  document.addEventListener('click', function(e){
    const card = e.target.closest('.product-card');
    if (!card) return;
    const product = JSON.parse(decodeURIComponent(card.dataset.product));

    if (e.target.matches('.rect-btn.add, .rect-btn.add *')) addToCart(product);
    if (e.target.matches('.rect-btn.view, .rect-btn.view *')) openQuickView(product);
    if (e.target.matches('.wishlist-btn, .wishlist-btn *')) toggleWishlist(product);
  });

  /* ---------------- Quick View Close ---------------- */
  document.addEventListener('click', e => {
    if (e.target.matches('.qv-close')) e.target.closest('#quickViewModal').style.display = 'none';
  });

  /* ---------------- Search Functionality ---------------- */
  const searchInput = qs('#searchInput');
  const searchBtn = qs('#searchBtn');
  if (searchInput){
    const filterProducts = () => {
      const query = searchInput.value.toLowerCase();
      qsa('.product-card').forEach(card => {
        const data = JSON.parse(decodeURIComponent(card.dataset.product));
        const match = data.title.toLowerCase().includes(query) || data.category.toLowerCase().includes(query);
        card.style.display = match ? 'block' : 'none';
      });
    };
    searchInput.addEventListener('input', filterProducts);
    searchBtn?.addEventListener('click', filterProducts);
  }

  /* ---------------- Header Buttons ---------------- */
  qs('#langToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('rtl');
    const font = document.body.classList.contains('rtl')
      ? "'Cairo', sans-serif"
      : "'Poppins', sans-serif";
    document.documentElement.style.setProperty('font-family', font);
  });

  qs('#themeToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const root = document.documentElement;
    if (document.body.classList.contains('dark')) {
      root.style.setProperty('--primary', '#071428');
      root.style.setProperty('--card-bg', '#0f1724');
      root.style.setProperty('--text', '#e6eef8');
    } else {
      root.style.setProperty('--primary', '#0b2545');
      root.style.setProperty('--card-bg', '#fff');
      root.style.setProperty('--text', '#222');
    }
  });

  qs('#wishlistBtn')?.addEventListener('click', () => {
    window.location.href = '/p/wishlist.html';
  });

  /* ---------------- Cart Dropdown UI Creation ---------------- */
  const cartBtn = qs('#cartBtn');
  let cartMenu = qs('#cartDropdown');
  if (!cartMenu) {
    cartMenu = document.createElement('div');
    cartMenu.id = 'cartDropdown';
    cartMenu.style.display = 'none';
    cartMenu.innerHTML = `
      <div id="cartItemsContainer"></div>
      <div class="cart-footer">
        <div class="subtotal">المجموع: <span id="cartSubtotal">0.00</span></div>
        <div class="cart-actions">
          <button id="emptyCart">🗑️ إفراغ</button>
          <button id="checkout">💳 الدفع</button>
        </div>
      </div>
    `;
    if (cartBtn && cartBtn.parentNode) cartBtn.parentNode.appendChild(cartMenu);
  }

  if (cartBtn) {
    cartBtn.addEventListener('mouseenter', () => cartMenu.style.display = 'block');
    cartBtn.addEventListener('mouseleave', () => setTimeout(() => {
      if (!cartMenu.matches(':hover')) cartMenu.style.display = 'none';
    }, 200));
    cartMenu.addEventListener('mouseenter', () => cartMenu.style.display = 'block');
    cartMenu.addEventListener('mouseleave', () => cartMenu.style.display = 'none');
    cartBtn.addEventListener('click', () => {
      cartMenu.style.display = (cartMenu.style.display === 'block') ? 'none' : 'block';
    });
  }

  // Hook up empty & checkout buttons
  document.addEventListener('click', async (e) => {
    if (e.target.matches('#emptyCart')) await emptyCartAction();
    if (e.target.matches('#checkout')) checkoutAction();
  });

  // إعادة محاولة تحميل feed إذا كانت _pendingFeed محفوظة
  if (!window._pendingFeed) {
    const script = document.createElement('script');
    script.src = PRODUCTS_FEED;
    document.body.appendChild(script);
  } else {
    renderProductsFromFeed(window._pendingFeed);
    window._pendingFeed = null;
  }

  /* ---------------- end Part 2 ---------------- */
  /* ---------------- Checkout Page JS ---------------- */
  async function initCheckoutPage() {
    console.log("🛒 تهيئة صفحة Checkout");

    // قراءة محتويات السلة من IndexedDB
    const cart = await readCart();

    // دالة لعرض السلة المنسدلة
    async function cartMenu() {
      const cart = await readCart();
      const cartDropdown = document.querySelector('#cartDropdown'); // حاوية السلة المنسدلة

      if (cartDropdown) {
        if (cart.length === 0) {
          cartDropdown.innerHTML = '<p>السلة فارغة</p>';
        } else {
          cartDropdown.innerHTML = cart.map(item => `
            <div class="cart-item">
              <span>${item.title} × ${item.quantity}</span>
              <span>${item.price.toLocaleString()} ر.س</span>
            </div>
          `).join('');
        }
      }
    }

    const qsLocal = s => document.querySelector(s);
    const checkoutForm = qsLocal('#checkoutForm');
    const cartReviewContainer = qsLocal('#checkoutItemsContainer');
    const subtotalEl = qsLocal('#checkoutSubtotal');
    const thankYouMessage = qsLocal('#thankYouMessage');

    if (!checkoutForm || !cartReviewContainer || !subtotalEl) return;

    // إنشاء حاوية للرسائل داخل النموذج
    let messageContainer = qsLocal('#checkoutMessageContainer');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.id = 'checkoutMessageContainer';
      messageContainer.style.cssText = `
        color: white; 
        background-color: red; 
        padding: 10px; 
        margin-bottom: 10px; 
        text-align: center; 
        display: none; 
        font-weight: bold; 
        opacity: 0; 
        transition: opacity 0.5s ease-in-out;
      `;
      checkoutForm.prepend(messageContainer);
    }

    // 🧱 عرض هيكل الصفحة دائمًا
    if (cart.length === 0) {
      cartReviewContainer.innerHTML = `
        <p style="color: red; font-weight: bold; text-align:center;">
          🛍️ السلة فارغة حاليًا.
        </p>
      `;
      subtotalEl.textContent = "0.00 ر.س";
    } else {
      cartReviewContainer.innerHTML = cart.map(i => `
        <div class="checkout-item">
          <span>${i.title} × ${i.quantity}</span>
          <span>${i.price.toLocaleString()} ر.س</span>
        </div>
      `).join('');
      const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
      subtotalEl.textContent = subtotal.toLocaleString() + " ر.س";
    }

    // دالة لعرض الرسالة بشكل fade in/out
    function showMessage(msg) {
      messageContainer.textContent = msg;
      messageContainer.style.display = 'block';
      setTimeout(() => messageContainer.style.opacity = 1, 50); // fade in

      setTimeout(() => {
        messageContainer.style.opacity = 0; // fade out
        setTimeout(() => messageContainer.style.display = 'none', 500);
      }, 10000); // 10 ثواني
    }

    // 🧩 التعامل مع تقديم الطلب
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const cartNow = await readCart();

      // إذا كانت السلة فارغة → عرض رسالة
      if (cartNow.length === 0) {
        showMessage("⚠️ يرجى إضافة منتج إلى السلة قبل إتمام الطلب.");
        return; // ⛔ إيقاف العملية
      }

      // التحقق من جميع الحقول (Required)
      const fields = [
        {el: qsLocal('#customerName'), name: 'الاسم'},
        {el: qsLocal('#customerEmail'), name: 'البريد الإلكتروني'},
        {el: qsLocal('#customerPhone'), name: 'رقم الهاتف'},
        {el: qsLocal('#customerAddress'), name: 'العنوان'},
        {el: qsLocal('#customerCity'), name: 'المدينة'},
        {el: qsLocal('#customerPostcode'), name: 'الرمز البريدي'},
        {el: qsLocal('#paymentMethod'), name: 'طريقة الدفع'}
      ];

      for (let f of fields) {
        if (!f.el.value.trim()) {
          showMessage(`⚠️ يرجى ملء حقل ${f.name}.`);
          f.el.focus();
          return; // إيقاف العملية
        }
      }

      // إنشاء بيانات الطلب
      const customer = {
        name: qsLocal('#customerName').value.trim(),
        email: qsLocal('#customerEmail').value.trim(),
        phone: qsLocal('#customerPhone').value.trim(),
        address: qsLocal('#customerAddress').value.trim(),
        city: qsLocal('#customerCity').value,
        postcode: qsLocal('#customerPostcode').value.trim(),
        payment: qsLocal('#paymentMethod').value
      };

      const orderId = Math.floor(Math.random() * 1e11);
      const orderTotal = cartNow.reduce((sum, i) => sum + i.price * i.quantity, 0);

      qsLocal('#orderDetails').innerHTML = `
        <p><strong>طريقة الدفع:</strong> ${customer.payment}</p>
        <p><strong>رقم الطلب:</strong> ${orderId}</p>
        <p><strong>تاريخ الطلب:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>الإجمالي:</strong> ${orderTotal.toLocaleString()} ر.س</p>
        <ul>
          ${cartNow.map(i => `<li>${i.title} × ${i.quantity} = ${i.price.toLocaleString()} ر.س</li>`).join('')}
        </ul>
        <p>الاسم: ${customer.name}</p>
        <p>البريد: ${customer.email}</p>
        <p>الهاتف: ${customer.phone}</p>
        <p>العنوان: ${customer.address}</p>
        <p>المدينة: ${customer.city}</p>
        <p>الرمز البريدي: ${customer.postcode}</p>
        <button id="printOrder">طباعة الطلب</button>
      `;

      thankYouMessage.style.display = 'block';
      checkoutForm.style.display = 'none';

      // تفريغ السلة بعد الطلب (IndexedDB)
      await writeCart([]);
      qsLocal('#cartCount') && (qsLocal('#cartCount').textContent = "0");

      qsLocal('#printOrder')?.addEventListener('click', () => window.print());
    });
  }

  // استدعاء دالة cartMenu عند تحميل الصفحة
  document.addEventListener('DOMContentLoaded', () => {
    // محاولة عرض السلة المنسدلة عند التحميل
    updateCartCount();
    updateCartDropdown();
    injectCurrencyDropdown();
    // attach empty/checkout buttons if exist
    document.getElementById('emptyCart')?.addEventListener('click', async () => { await emptyCartAction(); });
    document.getElementById('checkout')?.addEventListener('click', () => checkoutAction());
  });

  /* ---------------- Init ---------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    // تحديد نوع الصفحة بناءً على المسار
    const PAGE_TYPE = detectPageType();

    // تحديث العداد والقائمة المنسدلة الخاصة بالسلة والعملات
    await updateCartCount();
    await updateCartDropdown();
    injectCurrencyDropdown();

    // تحميل المنتجات فقط في الصفحة الرئيسية أو صفحة التصنيف
    if (PAGE_TYPE === 'home' || PAGE_TYPE === 'category') {
      const script = document.createElement('script');
      script.src = PRODUCTS_FEED;
      document.body.appendChild(script);
    }

    // تهيئة صفحة الـ Checkout
    if (PAGE_TYPE === 'checkout') {
      initCheckoutPage();
    }

    // تهيئة صفحة الـ Wishlist
    if (PAGE_TYPE === 'wishlist') {
      initWishlistPage();
    }

    // تهيئة صفحة الـ Product
    if (PAGE_TYPE === 'product') {
      initProductPage();
    }

    // تهيئة صفحة الـ Cart
    if (PAGE_TYPE === 'cart') {
      initCartPage();
    }
  });

  // دالة تهيئة صفحة Wishlist
  function initWishlistPage() {
    console.log("تهيئة صفحة Wishlist");
    // عرض العناصر من indexedDB
    (async()=>{
      const wish = await readWish();
      const container = qs('#wishlistContainer');
      if (!container) return;
      if (wish.length === 0) container.innerHTML = "<p>لا توجد منتجات في المفضلة</p>";
      else container.innerHTML = wish.map(i => `
        <div class="wish-item">
          <img src="${i.img}" alt="${i.title}" />
          <div>${i.title}</div>
        </div>
      `).join('');
    })();
  }

  // دالة تهيئة صفحة Product
  async function initProductPage() {
    console.log("تهيئة صفحة Product");
    // تحميل المنتج الحالي من IndexedDB إن وُجد
    const current = await kvGet('currentProduct');
    if (!current) return;
    // ثم يمكنك ملء عناصر DOM ببيانات current
  }

  // دالة تهيئة صفحة Cart
  function initCartPage() {
    console.log("تهيئة صفحة Cart");
    renderCartItems();
    updateCartTotal();
    handleCartActions();
  }

  // عرض العناصر المضافة إلى السلة
  async function renderCartItems() {
    const cart = await readCart();
    const container = document.getElementById('cartItemsContainer');
    if (!container) return;
    if (cart.length === 0) {
      container.innerHTML = "<p>السلة فارغة</p>";
    } else {
      container.innerHTML = cart.map(item => `
        <div class="cart-item">
          <img src="${item.img}" alt="${item.title}">
          <div class="cart-item-details">
            <h5>${item.title}</h5>
            <p>الكمية: ${item.quantity}</p>
            <p>السعر: ${convertPrice(item.price * item.quantity)}</p>
            <button class="remove-item" data-id="${item.id}">حذف</button>
          </div>
        </div>
      `).join('');
    }
  }

  // تحديث إجمالي السلة
  async function updateCartTotal() {
    const cart = await readCart();
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const subtotalElement = document.getElementById('cartSubtotal');
    if (subtotalElement) subtotalElement.textContent = convertPrice(total);
  }

  // التعامل مع الأزرار مثل الحذف أو تعديل الكمية
  function handleCartActions() {
    document.querySelectorAll('.remove-item').forEach(button => {
      button.addEventListener('click', async (e) => {
        const itemId = e.target.getAttribute('data-id');
        await removeItemFromCart(itemId);
      });
    });

    // إضافة أي وظائف أخرى مثل تعديل الكمية أو إفراغ السلة.
  }

  // إزالة عنصر من السلة
  async function removeItemFromCart(itemId) {
    let cart = await readCart();
    cart = cart.filter(item => item.id !== itemId);
    await writeCart(cart);
    await renderCartItems();
    await updateCartTotal();
    await updateCartCount();
    await updateCartDropdown();
  }


  // ensure updateCartDropdown available globally
  window.updateCartDropdown = updateCartDropdown;
  window.updateCartCount = updateCartCount;

})();
