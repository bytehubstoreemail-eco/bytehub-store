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
    updateCartDropdown();
    if(redirect) window.location.href = '/p/cart.html';
    else alert('✅ تمت إضافة المنتج إلى السلة');
  }
window.addToCartFromGrid = addToCart;
   
  function toggleWishlist(product, redirect=false){
    const wish = readWish();
    if(!wish.find(p=>p.id===product.id)){
      wish.push(product);
      localStorage.setItem('wishlist', JSON.stringify(wish));
      alert('❤️ تمت الإضافة إلى المفضلة');
    }
    if(redirect) window.location.href = '/p/wishlist.html';
  }
   window.toggleWishlistFromGrid = toggleWishlist;
   
const cartBtn = qs('#cartBtn');
const cartMenu = qs('.cart-menu');
cartBtn.addEventListener('mouseenter', ()=> cartMenu.style.display = 'block');
cartBtn.addEventListener('mouseleave', ()=> setTimeout(()=>{ if(!cartMenu.matches(':hover')) cartMenu.style.display='none'; }, 200));
cartMenu.addEventListener('mouseleave', ()=> cartMenu.style.display = 'none');
cartMenu.addEventListener('mouseenter', ()=> cartMenu.style.display = 'block');
function updateCartDropdown(){
  const container = qs('#cartItemsContainer');
  const cart = readCart();
  if(!container) return;

  if(cart.length===0){
    container.innerHTML = "<p>Cart is empty.</p>";
    qs('#cartSubtotal').textContent = "0.00";
    return;
  }
 

  container.innerHTML = cart.map(p => `
    <div class="cart-item" data-id="${p.id}">
      <img src="${p.img}" alt="${p.title}">
      <div class="cart-item-info">
        <div>${p.title}</div>
        <div>$${p.price.toFixed(2)} x ${p.quantity}</div>
      </div>
      <button class="remove-item" title="Remove"><i class="fa fa-trash-o"></i></button>
    </div>
  `).join('');

  const subtotal = cart.reduce((s,p)=>s + (p.price*(p.quantity||1)),0);
  qs('#cartSubtotal').textContent = subtotal.toFixed(2);
}

// حذف عنصر واحد
document.addEventListener('click', e => {
  if(e.target.closest('.remove-item')){
    const id = e.target.closest('.cart-item').dataset.id;
    const cart = readCart().filter(p=>p.id!==id);
    writeCart(cart);
    updateCartDropdown();
  }
});

/* ---------------- Dropdown Cart HTML & Events ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  const cartWrapper = document.createElement('div');
  cartWrapper.innerHTML = `
    <button id="cartBtn">🛒 Cart <span id="cartCount">0</span></button>
    <div class="cart-menu" style="display:none;">
      <div id="cartItemsContainer"></div>
      <div>Subtotal: $<span id="cartSubtotal">0.00</span></div>
      <button id="emptyCart">Empty Cart</button>
      <button id="checkout"><i class="fa fa-credit-card"></i> Checkout</button>
    </div>
  `;
  document.body.prepend(cartWrapper);

  // **ربط أزرار السلة بعد إنشاء HTML**
  qs('#emptyCart').addEventListener('click', ()=>{
    writeCart([]);
    updateCartCount();
    updateCartDropdown();
  });

  qs('#checkout').addEventListener('click', ()=>{
    window.location.href = '/p/cart.html'; 
  });
});
    // تحديث السلة عند تحميل الصفحة
    updateCartDropdown();
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
  <!-- صورة المنتج -->
  <a class='product-link' href='javascript:void(0)' 
     onclick='openProductDetails(${JSON.stringify(productObj)})'>
    <img src='${productObj.img}' alt='${productObj.title}'/>
  </a>
  <!-- أزرار التفاعل -->
  <div class='card-actions'>
    <button class='rect-btn add' title='Add to Cart' 
            onclick='addToCart(${JSON.stringify(productObj)}, false)'>
      <i class="fa fa-cart-plus"></i> Add to Cart
    </button>
    <button class='rect-btn view' title='Quick View' 
            onclick='openQuickView(${JSON.stringify(productObj)})'>
      <i class="fa fa-eye"></i> View
    </button>
    <button class='wishlist-btn' title='Add to Wishlist' 
            onclick='toggleWishlist(${JSON.stringify(productObj)}, false)'>
      <i class="fa fa-heart"></i>
    </button>
  </div>
  <!-- اسم المنتج -->
  <a class='product-name' href='javascript:void(0)' 
     onclick='openProductDetails(${JSON.stringify(productObj)})'>
    ${productObj.title}
  </a>
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

