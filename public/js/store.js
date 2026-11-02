// K-Beauty Storefront JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // Estado local
  let products = [];
  let cart = JSON.parse(localStorage.getItem('kbeauty_cart') || '[]');
  let activeCategory = 'ALL';
  let searchQuery = '';
  let onlyInStock = false;
  let currentSort = 'default';

  // Elementos DOM
  const productsGrid = document.getElementById('productsGrid');
  const catalogSummaryText = document.getElementById('catalogSummaryText');
  const emptyCatalogState = document.getElementById('emptyCatalogState');
  const categoryChips = document.querySelectorAll('.category-chip');
  const searchInput = document.getElementById('searchInput');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterInStockOnly = document.getElementById('filterInStockOnly');
  const sortSelect = document.getElementById('sortSelect');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  // Carrito DOM
  const openCartBtn = document.getElementById('openCartBtn');
  const closeCartBtn = document.getElementById('closeCartBtn');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartBackdrop = document.getElementById('cartBackdrop');
  const cartBadgeCount = document.getElementById('cartBadgeCount');
  const cartDrawerCount = document.getElementById('cartDrawerCount');
  const cartItemsList = document.getElementById('cartItemsList');
  const emptyCartNotice = document.getElementById('emptyCartNotice');
  const cartFooter = document.getElementById('cartFooter');
  const cartSubtotalText = document.getElementById('cartSubtotalText');
  const cartTotalText = document.getElementById('cartTotalText');

  // Checkout DOM
  const openCheckoutModalBtn = document.getElementById('openCheckoutModalBtn');
  const closeCheckoutModalBtn = document.getElementById('closeCheckoutModalBtn');
  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutBackdrop = document.getElementById('checkoutBackdrop');
  const checkoutForm = document.getElementById('checkoutForm');
  const checkoutTotalDisplay = document.getElementById('checkoutTotalDisplay');
  const submitOrderBtn = document.getElementById('submitOrderBtn');

  // Overlay Success DOM
  const orderSuccessOverlay = document.getElementById('orderSuccessOverlay');
  const successOrderNumber = document.getElementById('successOrderNumber');
  const successWhatsAppLink = document.getElementById('successWhatsAppLink');
  const closeSuccessOverlayBtn = document.getElementById('closeSuccessOverlayBtn');

  // Inicializar
  updateCartUI();
  fetchProducts();
  prefillCustomerData();

  // 1. Obtener catálogo
  async function fetchProducts() {
    renderLoadingSkeletons();

    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'ALL') params.append('category', activeCategory);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (onlyInStock) params.append('inStock', 'true');
      if (currentSort !== 'default') params.append('sort', currentSort);

      const res = await fetch(`/api/catalog/products?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        products = json.data;
        renderProducts(products);
        catalogSummaryText.textContent = `${json.pagination.total} productos disponibles • Precios con margen en MXN`;
      } else {
        catalogSummaryText.textContent = 'Error al cargar el catálogo';
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      catalogSummaryText.textContent = 'Error de conexión con el servidor';
    }
  }

  // Render Skeletons
  function renderLoadingSkeletons() {
    productsGrid.innerHTML = Array(8)
      .fill(0)
      .map(
        () => `
      <div class="bg-white rounded-3xl p-4 border border-slate-100 animate-pulse space-y-3">
        <div class="w-full h-48 bg-slate-100 rounded-2xl"></div>
        <div class="h-3 bg-slate-100 rounded w-1/3"></div>
        <div class="h-4 bg-slate-100 rounded w-3/4"></div>
        <div class="h-6 bg-slate-100 rounded w-1/2"></div>
      </div>
    `
      )
      .join('');
    emptyCatalogState.classList.add('hidden');
  }

  // Render Products
  function renderProducts(items) {
    if (!items || items.length === 0) {
      productsGrid.innerHTML = '';
      emptyCatalogState.classList.remove('hidden');
      return;
    }

    emptyCatalogState.classList.add('hidden');
    productsGrid.innerHTML = items
      .map((item) => {
        const inStockBadge = item.inStock
          ? `<span class="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">En Stock</span>`
          : `<span class="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">Agotado</span>`;

        return `
        <div class="glass-card rounded-3xl p-4 flex flex-col justify-between group">
          <div>
            <!-- Image & Badges -->
            <div class="relative w-full h-52 bg-slate-50 rounded-2xl overflow-hidden mb-3.5">
              <img 
                src="${item.imageUrl}" 
                alt="${escapeHtml(item.title)}"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onerror="this.src='https://sv5-cdn.stylevana.com/media/catalog/product/cache/149ac48e39a2c39d615e80655541abf2/b/e/beauty-of-joseon-relief-sun-rice-probiotics-niacinamide-set-spf50-pa-50ml-2-648.png'"
              />
              <div class="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                <span class="bg-white/95 backdrop-blur-md text-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-sm border border-slate-200">
                  ${escapeHtml(item.brand)}
                </span>
                <span class="bg-rose-500/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                  ${escapeHtml(item.category)}
                </span>
              </div>
              <div class="absolute bottom-2.5 right-2.5">
                ${inStockBadge}
              </div>
            </div>

            <!-- Title -->
            <h3 class="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-rose-600 transition" title="${escapeHtml(item.title)}">
              ${escapeHtml(item.title)}
            </h3>

            <!-- Stylevana Link Tag -->
            <div class="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span class="text-[10px] font-mono text-slate-400">SKU: ${escapeHtml(item.externalId.slice(0, 16))}</span>
              <a href="${item.stylevanaUrl}" target="_blank" rel="noopener noreferrer" class="hover:text-rose-500 transition flex items-center gap-1 text-[10px]" title="Ver referencia original en Stylevana">
                <span>Ref. Stylevana</span>
                <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
              </a>
            </div>
          </div>

          <!-- Price & Action -->
          <div class="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between gap-2">
            <div>
              <span class="text-[10px] text-slate-400 block font-semibold">Precio Final MXN</span>
              <span class="text-base sm:text-lg font-black text-rose-600">$${item.calculatedPrice.toFixed(2)}</span>
            </div>

            <button 
              onclick="addToCart('${item.id}')"
              ${!item.inStock ? 'disabled' : ''}
              class="${
                item.inStock
                  ? 'bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-md shadow-rose-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              } px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <i class="fa-solid fa-plus text-[10px]"></i>
              <span>${item.inStock ? 'Agregar' : 'Agotado'}</span>
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  }

  // 2. Manejo de Carrito
  window.addToCart = function (productId) {
    const prod = products.find((p) => p.id === productId);
    if (!prod || !prod.inStock) return;

    const existingIndex = cart.findIndex((item) => item.productId === productId);
    if (existingIndex > -1) {
      cart[existingIndex].quantity += 1;
    } else {
      cart.push({
        productId: prod.id,
        title: prod.title,
        brand: prod.brand,
        imageUrl: prod.imageUrl,
        price: prod.calculatedPrice,
        quantity: 1,
      });
    }

    saveCart();
    updateCartUI();
    openCartDrawer();
  };

  window.changeCartQuantity = function (productId, delta) {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter((i) => i.productId !== productId);
    }

    saveCart();
    updateCartUI();
  };

  window.removeFromCart = function (productId) {
    cart = cart.filter((i) => i.productId !== productId);
    saveCart();
    updateCartUI();
  };

  function saveCart() {
    localStorage.setItem('kbeauty_cart', JSON.stringify(cart));
  }

  function updateCartUI() {
    const totalCount = cart.reduce((acc, i) => acc + i.quantity, 0);
    const totalAmount = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);

    cartBadgeCount.textContent = totalCount;
    cartDrawerCount.textContent = totalCount;
    cartSubtotalText.textContent = `$${totalAmount.toFixed(2)} MXN`;
    cartTotalText.textContent = `$${totalAmount.toFixed(2)} MXN`;
    checkoutTotalDisplay.textContent = `$${totalAmount.toFixed(2)} MXN`;

    if (cart.length === 0) {
      cartItemsList.classList.add('hidden');
      emptyCartNotice.classList.remove('hidden');
      cartFooter.classList.add('hidden');
    } else {
      cartItemsList.classList.remove('hidden');
      emptyCartNotice.classList.add('hidden');
      cartFooter.classList.remove('hidden');

      cartItemsList.innerHTML = cart
        .map(
          (item) => `
        <div class="flex items-center gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
          <img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" class="w-14 h-14 object-cover rounded-xl bg-white border border-slate-200 flex-shrink-0" onerror="this.src='https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80'">
          <div class="flex-1 min-w-0">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">${escapeHtml(item.brand)}</span>
            <h4 class="text-xs font-bold text-slate-800 truncate" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4>
            <div class="text-xs font-black text-rose-600 mt-0.5">$${item.price.toFixed(2)} MXN</div>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center border border-slate-200 bg-white rounded-lg overflow-hidden text-xs">
              <button onclick="changeCartQuantity('${item.productId}', -1)" class="px-2 py-1 hover:bg-slate-100 text-slate-600 font-bold">-</button>
              <span class="px-2 py-1 font-bold text-slate-800">${item.quantity}</span>
              <button onclick="changeCartQuantity('${item.productId}', 1)" class="px-2 py-1 hover:bg-slate-100 text-slate-600 font-bold">+</button>
            </div>
            <button onclick="removeFromCart('${item.productId}')" class="text-slate-300 hover:text-rose-500 transition p-1" title="Eliminar">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
      `
        )
        .join('');
    }
  }

  function openCartDrawer() {
    cartDrawer.classList.remove('hidden');
  }

  function closeCartDrawer() {
    cartDrawer.classList.add('hidden');
  }

  openCartBtn.addEventListener('click', openCartDrawer);
  closeCartBtn.addEventListener('click', closeCartDrawer);
  cartBackdrop.addEventListener('click', closeCartDrawer);

  // 3. Checkout Modal
  openCheckoutModalBtn.addEventListener('click', () => {
    closeCartDrawer();
    checkoutModal.classList.remove('hidden');
  });

  function closeCheckoutModal() {
    checkoutModal.classList.add('hidden');
  }

  closeCheckoutModalBtn.addEventListener('click', closeCheckoutModal);
  checkoutBackdrop.addEventListener('click', closeCheckoutModal);

  // Prefill Customer data from localStorage if exists
  function prefillCustomerData() {
    try {
      const saved = localStorage.getItem('kbeauty_customer');
      if (saved) {
        const c = JSON.parse(saved);
        if (c.name) document.getElementById('custName').value = c.name;
        if (c.phone) document.getElementById('custPhone').value = c.phone;
        if (c.street) document.getElementById('custStreet').value = c.street;
        if (c.exteriorNumber) document.getElementById('custExterior').value = c.exteriorNumber;
        if (c.interiorNumber) document.getElementById('custInterior').value = c.interiorNumber;
        if (c.neighborhood) document.getElementById('custNeighborhood').value = c.neighborhood;
        if (c.postalCode) document.getElementById('custPostalCode').value = c.postalCode;
        if (c.city) document.getElementById('custCity').value = c.city;
        if (c.state) document.getElementById('custState').value = c.state;
        if (c.references) document.getElementById('custReferences').value = c.references;
      }
    } catch {}
  }

  // Submit Order Form
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (cart.length === 0) {
      alert('Tu carrito está vacío.');
      return;
    }

    const customerData = {
      name: document.getElementById('custName').value.trim(),
      phone: document.getElementById('custPhone').value.trim(),
      street: document.getElementById('custStreet').value.trim(),
      exteriorNumber: document.getElementById('custExterior').value.trim(),
      interiorNumber: document.getElementById('custInterior').value.trim() || null,
      neighborhood: document.getElementById('custNeighborhood').value.trim(),
      postalCode: document.getElementById('custPostalCode').value.trim(),
      city: document.getElementById('custCity').value.trim(),
      state: document.getElementById('custState').value.trim(),
      references: document.getElementById('custReferences').value.trim() || null,
    };

    // Validar teléfono mexicano básico
    const cleanPhone = customerData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert('Por favor introduce un número de teléfono válido de 10 dígitos.');
      return;
    }

    // Guardar para futuros pedidos
    localStorage.setItem('kbeauty_customer', JSON.stringify(customerData));

    submitOrderBtn.disabled = true;
    submitOrderBtn.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin text-lg"></i>
      <span>Procesando y registrando orden...</span>
    `;

    try {
      const payload = {
        customer: customerData,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      };

      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        const { order, whatsappLink } = json.data;

        // Limpiar carrito
        cart = [];
        saveCart();
        updateCartUI();

        // Cerrar modal de checkout
        closeCheckoutModal();

        // Mostrar pantalla de éxito
        successOrderNumber.textContent = `#${order.orderNumber}`;
        successWhatsAppLink.href = whatsappLink;
        orderSuccessOverlay.classList.remove('hidden');

        // Abrir WhatsApp automáticamente
        window.open(whatsappLink, '_blank');
      } else {
        alert(json.error || 'Ocurrió un error al registrar tu pedido.');
      }
    } catch (err) {
      console.error('Error submitting order:', err);
      alert('Error de conexión al procesar el pedido.');
    } finally {
      submitOrderBtn.disabled = false;
      submitOrderBtn.innerHTML = `
        <i class="fa-brands fa-whatsapp text-lg"></i>
        <span>Confirmar Orden y Enviar por WhatsApp</span>
      `;
    }
  });

  closeSuccessOverlayBtn.addEventListener('click', () => {
    orderSuccessOverlay.classList.add('hidden');
  });

  // 4. Filtros y Búsqueda
  categoryChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      categoryChips.forEach((c) => {
        c.classList.remove('bg-rose-600', 'text-white', 'shadow-sm');
        c.classList.add('bg-white', 'text-slate-600', 'border', 'border-slate-200');
      });
      chip.classList.add('bg-rose-600', 'text-white', 'shadow-sm');
      chip.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');

      activeCategory = chip.dataset.category;
      fetchProducts();
    });
  });

  let debounceTimer;
  function handleSearch(val) {
    searchQuery = val;
    if (searchQuery.trim().length > 0) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchProducts();
    }, 350);
  }

  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  mobileSearchInput.addEventListener('input', (e) => handleSearch(e.target.value));

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    mobileSearchInput.value = '';
    handleSearch('');
  });

  filterInStockOnly.addEventListener('change', (e) => {
    onlyInStock = e.target.checked;
    fetchProducts();
  });

  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    fetchProducts();
  });

  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    mobileSearchInput.value = '';
    searchQuery = '';
    onlyInStock = false;
    filterInStockOnly.checked = false;
    currentSort = 'default';
    sortSelect.value = 'default';

    categoryChips.forEach((c) => {
      if (c.dataset.category === 'ALL') {
        c.classList.add('bg-rose-600', 'text-white', 'shadow-sm');
        c.classList.remove('bg-white', 'text-slate-600');
      } else {
        c.classList.remove('bg-rose-600', 'text-white', 'shadow-sm');
        c.classList.add('bg-white', 'text-slate-600');
      }
    });
    activeCategory = 'ALL';
    fetchProducts();
  });

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});

