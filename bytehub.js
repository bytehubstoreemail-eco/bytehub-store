/* ==========================================================
   🛍️ StoreApp.js — Blogger Store Integration
   Version: 1.2.0 | Author: ByteHub Store
   Description: Handles product rendering, cart, wishlist, Quick View and UI actions.
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

  function addToCart(product, redirect=false){
    const cart = readCart();
    const existing = cart.find(p=>p.id===product.id);
    if(existing) existing.quantity = (existing.quantity||1)+1;
    else { product.quantity = product.quantity || 1; cart.push(product); }
    writeCart(cart);
    updateCartCount();
    if(redirect) window.location.href = '/p/cart.html';
    else alert('✅ تمت إضافة المنتج إلى السلة');
  }

  function toggleWishlist(product, redirect=false){
    const wish = readWish();
    if(!wish.find(p=>p.id===product.id)){
      wish.push(product);
      localStorage.setItem('wishlist', JSON.stringify(wish));
      alert('❤️ تمت الإضافة إلى المفضلة');
    }
    if(redirect) window.location.href = '/p/wishlist.html';
  }

  /* ---------------- Quick View ---------------- */
  function openProductDetails(product){
    localStorage.setItem('currentProduct', JSON.stringify(product));
    window.location.href = '/p/product.html';
  }

  function renderQuickView(product){
    const modal = qs('#quickViewModal');
    if(!modal) return;
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
          <div class="product-category">Category: ${product.category}</div>
          <div class="price-row">
            <span class="price">$${product.price.toFixed(2)}</span>
            ${product.oldPrice ? `<span class="old-price">$${product.oldPrice.toFixed(2)}</span>` : ""}
          </div>
          <p class="short-desc">${product.shortDesc}</p>
          <div class="product-options">
            <select id="qvColorSelect">${colors.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
            <input id="qvQuantity" type="number" min="1" value="1"/>
          </div>
          <div class="qv-actions">
            <button class="add-to-cart">🛒 Add to Cart</button>
            <button class="view-cart">View Cart</button>
            <button class="wishlist">❤️ Wishlist</button>
            <button class="whatsapp">📱 WhatsApp</button>
          </div>
          <div class="social-share">
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}" target="_blank">Facebook</a>
            <a href="https://twitter.com/share?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(product.title)}" target="_blank">Twitter</a>
            <a href="#" target="_blank">Instagram</a>
            <a href="#" target="_blank">YouTube</a>
            <a href="#" target="_blank">TikTok</a>
          </div>
        </div>

        <button class="qv-close">×</button>
      </div>
    `;
    modal.style.display = 'block';
  }

  function openQuickView(product){
    localStorage.setItem('currentProduct', JSON.stringify(product));
    renderQuickView(product);
  }

  /* ---------------- Feed Rendering ---------------- */
  function renderProductsFromFeed(json) {
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
      const category = (entry.category && entry.category[0]?.term) || "Uncategorized";
      const productObj = {
        id: entry.id?.$t || title,
        title, img, price: currentPrice, oldPrice,
        category,
        shortDesc: content.replace(/(<([^>]+)>)/ig, "").slice(0,150)
      };
      return `
        <div class='product-card' data-product='${encodeURIComponent(JSON.stringify(productObj))}'>
          <a class='product-link'><img src='${productObj.img}'/></a>
          <div class='card-actions'>
            <button class='rect-btn add'>🛒</button>
            <button class='rect-btn view'>👁️</button>
            <button class='wishlist-btn'>❤️</button>
          </div>
          <div class='product-info'>
            <div class='product-category'>${productObj.category}</div>
            <div class='product-name'>${productObj.title}</div>
            <div class='price-row'>
              <span class='price'>$${productObj.price.toFixed(2)}</span>
              ${productObj.oldPrice ? `<span class='old-price'>$${productObj.oldPrice.toFixed(2)}</span>` : ""}
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
    if(!card) return;
    const product = JSON.parse(decodeURIComponent(card.dataset.product));

    if(e.target.matches('.rect-btn.add, .rect-btn.add *')) addToCart(product);
    if(e.target.matches('.rect-btn.view, .rect-btn.view *')) openQuickView(product);
    if(e.target.matches('.wishlist-btn, .wishlist-btn *')) toggleWishlist(product);
  });

  /* ---------------- Quick View Close ---------------- */
  document.addEventListener('click', e => {
    if(e.target.matches('.qv-close')) e.target.closest('#quickViewModal').style.display='none';
  });

  /* ---------------- Init ---------------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    updateCartCount();

    // Load products feed
    const script = document.createElement('script');
    script.src = PRODUCTS_FEED;
    document.body.appendChild(script);
  });

})();

