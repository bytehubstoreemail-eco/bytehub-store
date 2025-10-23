/* ==========================================================
   🛍️ ByteHubStore.js — Blogger Store Integration
   Version: 2.0.0 | Author: ByteHub Store
   Description: Product rendering, cart, wishlist, Quick View, currency, and UI actions.
   ========================================================== */
(function(){ "use strict"; 

  const PRODUCTS_FEED = "https://bytehubstoren.blogspot.com/feeds/posts/default/-/product?alt=json-in-script&callback=renderProductsFromFeed";
  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from((root || document).querySelectorAll(sel));

  // ضمان تعريف الدالة العالمية قبل Blogger JSONP
  if (!window.renderProductsFromFeed) {
    window._pendingFeed = null;
    window.renderProductsFromFeed = function(json){
      console.log("🕐 تم استقبال بيانات المنتجات قبل تحميل ByteHubStore.js");
      window._pendingFeed = json;
    };
  }

  /* ============================
   Page Context Detector
   =========================== */
  function detectPageType() {
    const path = window.location.pathname.toLowerCase();

    if (path.includes('/p/checkout')) return 'checkout';
    if (path.includes('/p/cart')) return 'cart';
    if (path.includes('/p/wishlist')) return 'wishlist';
    if (path === '/' || path.includes('/search') || path.includes('/index')) return 'home';
  
    // Blogger product pages (individual post)
    if (document.body.classList.contains('item-view') || document.querySelector('.post-body')) {
      return 'product';
    }

    return 'other';
  }

  const PAGE_TYPE = detectPageType();
  console.log('📄 Current Page Type:', PAGE_TYPE);

  /* ---------------- Currency Handling ---------------- */
  let currencyRates = { USD: 1, EUR: 0.92, DZD: 135 };
  const currencySymbols = { USD: "$", EUR: "€", DZD: "دج" };

  async function fetchCurrencyRates(){
    try {
      const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,DZD');
      const data = await res.json();
      currencyRates = { USD: 1, ...data.rates };
      localStorage.setItem('currencyRates', JSON.stringify(currencyRates));
    } catch (e) {
      console.warn("فشل في جلب أسعار الصرف، سيتم استخدام القيم المخزنة");
      const stored = localStorage.getItem('currencyRates');
      if(stored) currencyRates = JSON.parse(stored);
    }
  }

  function convertPrice(price){
    const currency = localStorage.getItem('currency') || 'USD';
    const rate = currencyRates[currency] || 1;
    const symbol = currencySymbols[currency] || "$";
    return `${symbol}${(price * rate).toFixed(2)}`;
  }

  function setCurrencyDropdown(){
    const dropdown = qs('#currencyDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = ['USD', 'EUR', 'DZD'].map(c => `
      <button class="currency-option" data-currency="${c}">
        <i class="fa fa-credit-card"></i> ${currencySymbols[c]} ${c}
      </button>
    `).join('');
    qsa('.currency-option').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('currency', btn.dataset.currency);
        updateCartDropdown();
        renderProductsFromFeed(lastFetchedFeed);
      });
    });
  }

  (async function(){
    await fetchCurrencyRates();
    setCurrencyDropdown();
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
        💱 <span id="selectedCurrency">${localStorage.getItem('currency') || 'USD'}</span> <i class="fa fa-chevron-down"></i>
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
      btn.addEventListener('click', () => {
        const currency = btn.dataset.currency;
        localStorage.setItem('currency', currency);
        qs('#selectedCurrency').textContent = currency;
        menu.style.display = 'none';
        updateCartDropdown();
        renderProductsFromFeed(lastFetchedFeed);  // تحديث المنتجات مع العملة الجديدة
      });
    });
  }

  /* ---------------- Cart / Wishlist Helpers ---------------- */
  function readCart() { return JSON.parse(localStorage.getItem('cart') || '[]'); }
  function writeCart(c) { localStorage.setItem('cart', JSON.stringify(c)); }
  function readWish() { return JSON.parse(localStorage.getItem('wishlist') || '[]'); }

  function updateCartCount(){
    const el = qs('#cartCount');
    if(el) el.textContent = readCart().reduce((s, i) => s + (i.quantity || 1), 0) || 0;
  }

  function addToCart(product, redirect=false){
    if (!product?.id || !product?.price) return;
    const cart = readCart();
    const existing = cart.find(p => p.id === product.id);
    if (existing) existing.quantity = (existing.quantity || 1) + 1;
    else { product.quantity = product.quantity || 1; cart.push(product); }
    writeCart(cart);
    updateCartCount();
    updateCartDropdown();
    if (redirect) window.location.href = '/p/cart.html';
    else alert('✅ تمت إضافة المنتج إلى السلة');
  }
  window.addToCart = addToCart;
  window.addToCartFromGrid = addToCart;

  function toggleWishlist(product, redirect=false){
    if (!product?.id) return;
    const wish = readWish();
    if (!wish.find(p => p.id === product.id)){
      wish.push(product);
      localStorage.setItem('wishlist', JSON.stringify(wish));
      alert('❤️ تمت الإضافة إلى المفضلة');
    }
    if (redirect) window.location.href = '/p/wishlist.html';
  }
  window.toggleWishlistFromGrid = toggleWishlist;

  function updateCartDropdown(){
    const container = qs('#cartItemsContainer');
    const cart = readCart();
    if (!container) return;

    if (cart.length === 0){
      container.innerHTML = "<p>السلة فارغة</p>";
      qs('#cartSubtotal').textContent = convertPrice(0);
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
    qs('#cartSubtotal').textContent = convertPrice(subtotal);
  }

  document.addEventListener('click', e => {
    const item = e.target.closest('.cart-item');
    if (!item) return;
    const id = item.dataset.id;
    let cart = readCart();
    const index = cart.findIndex(p => p.id === id);
    if (index === -1) return;

    if (e.target.closest('.remove-item')){
      cart.splice(index, 1);
    } else if (e.target.closest('.qty-btn.plus')){
      cart[index].quantity = (cart[index].quantity || 1) + 1;
    } else if (e.target.closest('.qty-btn.minus')){
      cart[index].quantity = Math.max(1, (cart[index].quantity || 1) - 1);
    } else return;

    writeCart(cart);
    updateCartCount();
    updateCartDropdown();
  });

  // أزرار Empty / Checkout
  qs('#emptyCart')?.addEventListener('click', () => {
    writeCart([]);
    updateCartCount();
    updateCartDropdown();
  });
  qs('#checkout')?.addEventListener('click', () => {
    window.location.href = '/p/checkout.html';
  });

  /* ---------------- Quick View ---------------- */
  function openProductDetails(product){
    localStorage.setItem('currentProduct', JSON.stringify(product));
    window.location.href = '/p/product.html';
  }

  function renderQuickView(product){
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

    modal.querySelector('.add-to-cart')?.addEventListener('click', () => {
      const qty = parseInt(qs('#qvQuantity').value) || 1;
      const color = qs('#qvColorSelect').value;
      const productToAdd = {...product, quantity: qty, selectedColor: color};
      addToCart(productToAdd);
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

  function openQuickView(product){
    localStorage.setItem('currentProduct', JSON.stringify(product));
    renderQuickView(product);
  }

  /* ---------------- Feed Rendering ---------------- */
  let lastFetchedFeed = null;

  function renderProductsFromFeed(json) {
    lastFetchedFeed = json;
    const entries = json.feed.entry || [];
    const container = qs('#productsContainer');
    if (!container) return;
    if (!entries.length) { container.innerHTML = "<p>لا توجد منتجات حاليا!</p>"; return; }

    container.innerHTML = entries.map(entry => {
      const title = entry.title.$t;
      const content = entry.content.$t;
      let img = (content.match(/<img[^>]+src=['"]([^'"]+)['"]/i)||[])[1] || "https://via.placeholder.com/300x220";
      const currentPrice = parseFloat((content.match(/\$([0-9.]+)/)||[])[1]||0);
      const oldPrice = parseFloat((content.match(/~\$?([0-9.]+)~|<del>\$?([0-9.]+)<\/del>/i)||[])[1]||0);
      const category = (entry.category && entry.category[0]?.term) || "غير مصنف";
      const productObj = {
        id: entry.id?.$t || title,
        title, img, price: currentPrice, oldPrice,
        category,
        shortDesc: content.replace(/(<([^>]+)>)/ig, "").slice(0,150)
      };
      return `
        <div class='product-card' data-product='${encodeURIComponent(JSON.stringify(productObj))}'>
          <a class='product-link' href='javascript:void(0)' onclick='openProductDetails(${JSON.stringify(productObj)})'>
            <img src='${productObj.img}' alt='${productObj.title}'/>
          </a>
          <div class='card-actions'>
            <button class='rect-btn add' title='Add to Cart' onclick='addToCart(${JSON.stringify(productObj)}, false)'>
              <i class="fa fa-cart-plus"></i> أضف
            </button>
            <button class='rect-btn view' title='Quick View' onclick='openQuickView(${JSON.stringify(productObj)})'>
              <i class="fa fa-eye"></i> عرض
            </button>
            <button class='wishlist-btn' title='Add to Wishlist' onclick='toggleWishlist(${JSON.stringify(productObj)}, false)'>
              <i class="fa fa-heart"></i>
            </button>
          </div>
          <a class='product-name' href='javascript:void(0)' onclick='openProductDetails(${JSON.stringify(productObj)})'>
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
    cartBtn.after(cartMenu);
  }

  cartBtn.addEventListener('mouseenter', () => cartMenu.style.display = 'block');
  cartBtn.addEventListener('mouseleave', () => setTimeout(() => {
    if (!cartMenu.matches(':hover')) cartMenu.style.display = 'none';
  }, 200));
  cartMenu.addEventListener('mouseenter', () => cartMenu.style.display = 'block');
  cartMenu.addEventListener('mouseleave', () => cartMenu.style.display = 'none');
  cartBtn.addEventListener('click', () => {
    cartMenu.style.display = (cartMenu.style.display === 'block') ? 'none' : 'block';
  });

  // استرجاع بيانات JSONP المحفوظة إن وُجدت
  if (window._pendingFeed) {
    console.log("♻️ إعادة عرض المنتجات من البيانات المحفوظة مسبقًا");
    renderProductsFromFeed(window._pendingFeed);
    window._pendingFeed = null;
  } else {
    const script = document.createElement('script');
    script.src = PRODUCTS_FEED;
    document.body.appendChild(script);
  }

  /* ---------------- Checkout Page JS ---------------- */
  function initCheckoutPage() {
     console.log("تهيئة صفحة Checkout");
    const qs = s => document.querySelector(s);

    const isCheckoutPage = window.location.pathname.includes('/p/checkout.html') && qs('.post-body form#checkoutForm') || qs('#checkoutForm');

    if (isCheckoutPage) {
      const container = qs('#checkoutPageContainer');
      const postBody = qs('.post-body');

      if (container && postBody) {
        container.innerHTML = postBody.innerHTML;
        container.style.display = 'block';
        postBody.style.display = 'none';
             
    // تحديث عداد السلة وDropdown عند الدخول للصفحة
    updateCartCount();
    updateCartDropdown();
        setTimeout(() => {
          const checkoutForm = qs('#checkoutForm');
          const orderDetailsContainer = qs('#orderDetails');
          const thankYouMessage = qs('#thankYouMessage');

          if (!checkoutForm) return;

          const cart = readCart();
          const cartReviewContainer = qs('#checkoutItemsContainer');
          const subtotalEl = qs('#checkoutSubtotal');

          if (cartReviewContainer) {
            cartReviewContainer.innerHTML = cart.length
              ? cart.map(i => `
                  <div class="checkout-item">
                    <span>${i.title} × ${i.quantity}</span>
                    <span>${convertPrice(i.price * i.quantity)}</span>
                  </div>
                `).join('')
              : "<p>السلة فارغة</p>";
          }

          if (subtotalEl) {
            const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
            subtotalEl.textContent = convertPrice(subtotal);
          }

          checkoutForm.addEventListener('submit', e => {
            e.preventDefault();

            if (cart.length === 0) {
              alert('السلة فارغة!');
              return;
            }

            const customer = {
              name: qs('#customerName').value,
              email: qs('#customerEmail').value,
              phone: qs('#customerPhone').value,
              address: qs('#customerAddress').value,
              city: qs('#customerCity').value,
              postcode: qs('#customerPostcode').value,
              payment: qs('#paymentMethod').value
            };

            if (!customer.name || !customer.email || !customer.phone || !customer.address) {
              alert('يرجى ملء جميع الحقول المطلوبة');
              return;
            }

            const orderId = Math.floor(Math.random() * 1e11);
            const orderTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

            const orderHTML = `
              <p><strong>طريقة الدفع:</strong> ${customer.payment}</p>
              <p><strong>رقم الطلب:</strong> ${orderId}</p>
              <p><strong>تاريخ الطلب:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>الإجمالي:</strong> ${convertPrice(orderTotal)}</p>
              <h4>تفاصيل الطلب:</h4>
              <ul>
                ${cart.map(i => `<li>${i.title} × ${i.quantity} = ${convertPrice(i.price * i.quantity)}</li>`).join('')}
              </ul>
              <h4>تفاصيل العميل:</h4>
              <p>الاسم: ${customer.name}</p>
              <p>البريد: ${customer.email}</p>
              <p>الهاتف: ${customer.phone}</p>
              <p>العنوان: ${customer.address}</p>
              <p>المدينة: ${customer.city}</p>
              <p>الرمز البريدي: ${customer.postcode}</p>
              <button id="printOrder">طباعة الطلب</button>
            `;

            orderDetailsContainer.innerHTML = orderHTML;
            thankYouMessage.style.display = 'block';
            checkoutForm.style.display = 'none';

            localStorage.setItem('cart', '[]');
            qs('#cartCount') && (qs('#cartCount').textContent = "0");

            qs('#printOrder')?.addEventListener('click', () => {
              window.print();
            });
          });
        }, 50);
      }
    }
  }

 /* ---------------- Init ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  // تحديد نوع الصفحة بناءً على المسار
  const PAGE_TYPE = detectPageType();

  // تحديث العداد والقائمة المنسدلة الخاصة بالسلة والعملات
  updateCartCount();
  updateCartDropdown();
  injectCurrencyDropdown();

  // تحميل المنتجات فقط في الصفحة الرئيسية
  if (PAGE_TYPE === 'home') {
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

// دالة لتحديد نوع الصفحة بناءً على المسار
function detectPageType() {
  const path = window.location.pathname.toLowerCase();

  if (path.includes('/p/checkout')) return 'checkout';
  if (path.includes('/p/cart')) return 'cart';  // صفحة الـ Cart
  if (path.includes('/p/wishlist')) return 'wishlist';
  if (path === '/' || path.includes('/search') || path.includes('/index')) return 'home';
  
  // صفحات المنتجات (المنشور الفردي)
  if (document.body.classList.contains('item-view') || document.querySelector('.post-body')) {
    return 'product';
  }

  return 'other';
}


// دالة تهيئة صفحة Wishlist
function initWishlistPage() {
  // أي منطق يتعلق بصفحة الـ Wishlist هنا
  console.log("تهيئة صفحة Wishlist");
}

// دالة تهيئة صفحة Product
function initProductPage() {
  // أي منطق يتعلق بصفحة الـ Product هنا
  console.log("تهيئة صفحة Product");
}

// دالة تهيئة صفحة Cart
function initCartPage() {
  // هنا يجب إضافة منطق السلة
  console.log("تهيئة صفحة Cart");

  // يمكن استدعاء دوال مثل:
  renderCartItems();  // عرض العناصر المضافة إلى السلة
  updateCartTotal();  // تحديث إجمالي السلة
  handleCartActions(); // التعامل مع الأزرار مثل الحذف أو تغيير الكمية
}

// دوال أخرى تتعلق بالسلة يمكن إضافتها:

// عرض العناصر المضافة إلى السلة
function renderCartItems() {
  const cart = readCart(); // قراءة محتويات السلة من الـ localStorage
  const container = document.getElementById('cartItemsContainer');

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
function updateCartTotal() {
  const cart = readCart();
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const subtotalElement = document.getElementById('cartSubtotal');
  subtotalElement.textContent = convertPrice(total);
}

// التعامل مع الأزرار مثل الحذف أو تعديل الكمية
function handleCartActions() {
  document.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', (e) => {
      const itemId = e.target.getAttribute('data-id');
      removeItemFromCart(itemId);
    });
  });

  // إضافة أي وظائف أخرى مثل تعديل الكمية أو إفراغ السلة.
}

// إزالة عنصر من السلة
function removeItemFromCart(itemId) {
  let cart = readCart();
  cart = cart.filter(item => item.id !== itemId);
  writeCart(cart);
  renderCartItems();
  updateCartTotal();
}

})();
