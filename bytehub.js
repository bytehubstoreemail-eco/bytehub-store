/* ==========================================================
   🛍️ StoreApp.js — Blogger Store Integration
   Version: 1.1.0 | Author: ByteHub Store
   Description: Handles product rendering, cart, wishlist, and UI actions.
   ========================================================== */

(function(){
  "use strict";

  const PRODUCTS_FEED = "https://bytehubstoren.blogspot.com/feeds/posts/default/-/product?alt=json-in-script&callback=renderProductsFromFeed";

  const qs  = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from((root||document).querySelectorAll(sel));

  /* ---------------- Theme Toggle ---------------- */
  function toggleTheme(){
    document.body.classList.toggle('dark');
    const root = document.documentElement;
    if(document.body.classList.contains('dark')){
      root.style.setProperty('--primary','#071428');
      root.style.setProperty('--card-bg','#0f1724');
      root.style.setProperty('--text','#e6eef8');
    } else {
      root.style.setProperty('--primary','#0b2545');
      root.style.setProperty('--card-bg','#fff');
      root.style.setProperty('--text','#222');
    }
  }

  /* ---------------- Language Toggle ---------------- */
  function toggleLang(){
    document.body.classList.toggle('rtl');
    const font = document.body.classList.contains('rtl')
      ? "'Cairo', sans-serif"
      : "'Poppins', sans-serif";
    document.documentElement.style.setProperty('font-family', font);
  }

  /* ---------------- Cart / Wishlist Helpers ---------------- */
  function readCart(){ return JSON.parse(localStorage.getItem('cart') || '[]'); }
  function writeCart(c){ localStorage.setItem('cart', JSON.stringify(c)); }
  function readWish(){ return JSON.parse(localStorage.getItem('wishlist') || '[]'); }

  function updateCartCount(){
    const el = qs('#cartCount');
    if(el) el.textContent = readCart().reduce((s,i)=>s+(i.quantity||1),0) || 0;
  }

  function addToCartFromGrid(product, redirect=false){
    const cart = readCart();
    const existing = cart.find(p=>p.id===product.id);
    if(existing) existing.quantity = (existing.quantity||1)+1;
    else { product.quantity = 1; cart.push(product); }
    writeCart(cart);
    updateCartCount();
    if(redirect) window.location.href = '/p/cart.html';
    else alert('✅ تمت إضافة المنتج إلى السلة');
  }

  function toggleWishlistFromGrid(product, redirect=false){
    const wish = readWish();
    if(!wish.find(p=>p.id===product.id)){
      wish.push(product);
      localStorage.setItem('wishlist', JSON.stringify(wish));
      alert('❤️ تمت الإضافة إلى المفضلة');
    }
    if(redirect) window.location.href = '/p/wishlist.html';
  }

  /* ---------------- Quick View + Details ---------------- */
  function openProductDetails(product){
    localStorage.setItem('currentProduct', JSON.stringify(product));
    window.location.href = '/p/product.html';
  }

function renderProductDetailIntoModal(product, modal){
  const colors = product.colors || ["Default"]; // يمكنك تعديلها حسب المنتج
  modal.innerHTML = `
    <div class="qv-inner" style="display:flex; gap:20px; max-width:900px;">
      
      <!-- قسم الصور -->
      <div class="qv-left" style="flex:1;">
        <img id="mainQvImage" src="${product.img}" alt="${product.title}" style="width:100%; border:1px solid #ccc; border-radius:8px;"/>
        <div class="qv-slider" style="display:flex; gap:10px; margin-top:10px;">
          ${(product.images || [product.img]).map(img => `
            <img src="${img}" style="width:60px; height:60px; object-fit:cover; cursor:pointer; border:1px solid #ccc; border-radius:4px;"
                 onclick="document.getElementById('mainQvImage').src='${img}'" />
          `).join('')}
        </div>
      </div>

      <!-- قسم التفاصيل -->
      <div class="qv-right" style="flex:1.2;">
        <h2 style="margin-bottom:8px;">${product.title}</h2>
        <div class="product-category" style="margin-bottom:8px;">Category: ${product.category}</div>
        <div class="price-row" style="margin-bottom:12px;">
          <span class="price" style="font-weight:bold; font-size:1.2em;">$${product.price.toFixed(2)}</span>
          ${product.oldPrice ? `<span class="old-price" style="text-decoration:line-through; margin-left:8px; color:#999;">$${product.oldPrice.toFixed(2)}</span>` : ""}
        </div>
        <p class="short-desc" style="margin-bottom:12px;">${product.shortDesc}</p>

        <!-- اختيار اللون والكمية -->
        <div style="display:flex; gap:10px; margin-bottom:12px; align-items:center;">
          <select id="qvColorSelect" style="padding:4px;">
            ${colors.map(c=>`<option value="${c}">${c}</option>`).join('')}
          </select>
          <input id="qvQuantity" type="number" value="1" min="1" style="width:60px; padding:4px;"/>
        </div>

        <!-- أزرار التفاعل -->
        <div class="qv-actions" style="display:flex; gap:10px; margin-bottom:12px;">
          <button style="padding:8px 12px; background:#0b2545; color:white; border:none; border-radius:4px;"
                  onclick='addToCartFromGrid(Object.assign({}, ${JSON.stringify(product)}, {color:document.getElementById("qvColorSelect").value, quantity:parseInt(document.getElementById("qvQuantity").value)}), true)'>
            🛒 Add to Cart
          </button>
          <button style="padding:8px 12px; border:1px solid #0b2545; border-radius:4px; background:white; cursor:pointer;"
                  onclick='window.location.href="/p/cart.html"'>
            View Cart
          </button>
          <button style="padding:8px 12px; border:1px solid #f00; border-radius:4px; background:white; cursor:pointer;"
                  onclick='toggleWishlistFromGrid(${JSON.stringify(product)}, true)'>
            ❤️ Wishlist
          </button>
          <button style="padding:8px 12px; background:#25D366; color:white; border:none; border-radius:4px;"
                  onclick='window.open("https://wa.me/1234567890?text=طلب%20منتج%20${encodeURIComponent(product.title)}")'>
            📱 WhatsApp
          </button>
        </div>

        <!-- أيقونات المشاركة الاجتماعية -->
        <div class="social-share" style="display:flex; gap:10px;">
          <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}" target="_blank">Facebook</a>
          <a href="https://twitter.com/share?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(product.title)}" target="_blank">Twitter</a>
          <a href="#" target="_blank">Instagram</a>
          <a href="#" target="_blank">YouTube</a>
          <a href="#" target="_blank">TikTok</a>
        </div>
      </div>

      <!-- زر إغلاق المودال -->
      <button class="qv-close" style="position:absolute; top:10px; right:10px; font-size:24px; background:none; border:none; cursor:pointer;"
              onclick='this.closest("#quickViewModal").style.display="none"'>×</button>
    </div>
  `;
}

  function openQuickView(product){
    localStorage.setItem('currentProduct', JSON.stringify(product));
    const modal = qs('#quickViewModal');
    if(modal){
      renderProductDetailIntoModal(product, modal);
      modal.style.display = 'block';
    } else {
      openProductDetails(product);
    }
  }

  /* ---------------- Feed Rendering ---------------- */
  function renderProductsFromFeed(json) {
    const entries = json.feed.entry || [];
    const container = qs('#productsContainer');
    if (!container) return;
    if (entries.length === 0) {
      container.innerHTML = "<p>لا توجد منتجات حاليا!</p>";
      return;
    }

    container.innerHTML = entries.map(entry => {
      const title = entry.title.$t;
      const link = entry.link.find(l => l.rel === 'alternate').href;
      const content = entry.content.$t;

      let img = "https://via.placeholder.com/300x220";
      const regexImg = /<img[^>]+src=['"]([^'"]+)['"]/i;
      const match = content.match(regexImg);
      if (match) img = match[1];

      const currentPrice = (content.match(/\$([0-9.]+)/) || [])[1];
      const oldPrice = (content.match(/~\$?([0-9.]+)~|<del>\$?([0-9.]+)<\/del>/i) || [])[1];

      const category = (entry.category && entry.category[0]?.term) || "Uncategorized";
      const isHot = /Hot/i.test(content);
      const isSold = /Sold/i.test(content);
      const isAvailable = /متوفر|available/i.test(content);
      const badge = isSold ? "Sold" : isHot ? "Hot" : "";
      const available = isAvailable ? "متوفر" : "غير متوفر";

      const productObj = {
        id: entry.id?.$t || title,
        title, link, img,
        price: currentPrice ? parseFloat(currentPrice) : 0,
        oldPrice: oldPrice ? parseFloat(oldPrice) : null,
        category, available, badge,
        shortDesc: content.replace(/(<([^>]+)>)/ig, "").slice(0,150)
      };

      return `
        <div class='product-card' data-id='${productObj.id}'>
          ${badge ? `<span class='badge'>${badge}</span>` : ""}
          <span class='status ${isAvailable ? '' : 'unavailable'}'>${available}</span>

          <a class='product-link' href='javascript:void(0)' title="View Details" onclick='openProductDetails(${JSON.stringify(productObj)})'>
            <img alt='${productObj.title}' class='product-img' src='${productObj.img}'/>
          </a>

          <div class='card-actions'>
            <button class='rect-btn add' title='Add to Cart' onclick='addToCartFromGrid(${JSON.stringify(productObj)}, false)'><i class="fa fa-cart-plus"></i></button>
            <button class='rect-btn view' title='Quick View' onclick='openQuickView(${JSON.stringify(productObj)})'><i class="fa fa-eye"></i></button>
            <button class='wishlist-btn' title='Add to Wishlist' onclick='toggleWishlistFromGrid(${JSON.stringify(productObj)}, false)'>❤️</button>
          </div>

          <div class='product-info'>
            <div class='product-category'>${productObj.category}</div>
            <a class='product-name' href='javascript:void(0)' title="View Details" onclick='openProductDetails(${JSON.stringify(productObj)})'>${productObj.title}</a>
            <div class='price-row'>
              ${productObj.price ? `<span class='price'>$${productObj.price.toFixed(2)}</span>` : `<span class='price text-muted'>غير متوفر</span>`}
              ${productObj.oldPrice ? `<span class='old-price'>$${productObj.oldPrice.toFixed(2)}</span>` : ""}
            </div>
            <div class='rating'>⭐⭐⭐⭐⭐ (25)</div>
          </div>
        </div>
      `;
    }).join('');

    updateCartCount();
  }

  window.renderProductsFromFeed = renderProductsFromFeed;

  /* ---------------- Hero Slider ---------------- */
  function renderHeroSlides(){
    const slides = [
      {img:"https://demo.graygrids.com/themes/shopgrids/assets/images/hero-slider-1.jpg", alt:"Sale 1"},
      {img:"https://demo.graygrids.com/themes/shopgrids/assets/images/hero-slider-2.jpg", alt:"Sale 2"},
      {img:"https://demo.graygrids.com/themes/shopgrids/assets/images/hero-slider-3.jpg", alt:"Sale 3"}
    ];
    const container = qs("#heroSlides");
    if(container){
      container.innerHTML = slides.map(s => `<img src="${s.img}" alt="${s.alt}"/>`).join("");
    }
  }

  /* ---------------- Page Routing ---------------- */
  function routeByURL(){
    const path = window.location.pathname;

    if(path.includes("/p/cart.html")){
      qs("#cartPageContainer")?.style.setProperty("display","block");
      const cart = readCart();
      const container = qs('#cartPageContainer');
      if(container) container.innerHTML = cart.map(p=>`<div>${p.title} x ${p.quantity}</div>`).join('');
    }

    else if(path.includes("/p/wishlist.html")){
      qs("#wishlistPageContainer")?.style.setProperty("display","block");
      const wish = readWish();
      const container = qs('#wishlistPageContainer');
      if(container) container.innerHTML = wish.map(p=>`<div>${p.title}</div>`).join('');
    }
  }

  /* ---------------- Init ---------------- */
  function attachUI(){
    qs('#themeToggle')?.addEventListener('click', toggleTheme);
    qs('#langToggle')?.addEventListener('click', toggleLang);
    qs('#searchBtn')?.addEventListener('click', ()=>{
      const q = qs('#siteSearch')?.value.trim();
      if(q) window.location.href = '/search?q=' + encodeURIComponent(q);
      else alert('🧐 اكتب كلمة للبحث');
    });
    qs('#wishlistBtn')?.addEventListener('click', ()=>{ window.location.href='/p/wishlist.html'; });
    qs('#cartBtn')?.addEventListener('click', ()=>{ window.location.href='/p/cart.html'; });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    attachUI();
    updateCartCount();
    renderHeroSlides();
    routeByURL();

    // تحميل المنتجات
    const script = document.createElement('script');
    script.src = PRODUCTS_FEED;
    document.body.appendChild(script);
  });

})();
