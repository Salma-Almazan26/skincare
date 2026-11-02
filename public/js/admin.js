// K-Beauty Admin Dashboard JavaScript
document.addEventListener('DOMContentLoaded', () => {
  let authToken = localStorage.getItem('kbeauty_admin_token') || null;

  // DOM Elements - Auth
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const adminEmail = document.getElementById('adminEmail');
  const adminPassword = document.getElementById('adminPassword');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const adminLayout = document.getElementById('adminLayout');
  const adminNameDisplay = document.getElementById('adminNameDisplay');
  const logoutBtn = document.getElementById('logoutBtn');

  // DOM Elements - Navigation Tabs
  const adminTabs = document.querySelectorAll('.admin-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // DOM Elements - KPIs
  const kpiRevenue = document.getElementById('kpiRevenue');
  const kpiTotalOrders = document.getElementById('kpiTotalOrders');
  const kpiPendingOrders = document.getElementById('kpiPendingOrders');
  const kpiMargin = document.getElementById('kpiMargin');
  const kpiProducts = document.getElementById('kpiProducts');
  const kpiInStockText = document.getElementById('kpiInStockText');

  // DOM Elements - Orders Tab
  const orderSearchInput = document.getElementById('orderSearchInput');
  const orderStatusFilter = document.getElementById('orderStatusFilter');
  const refreshOrdersBtn = document.getElementById('refreshOrdersBtn');
  const ordersTableBody = document.getElementById('ordersTableBody');

  // DOM Elements - Products Tab
  const productSearchInput = document.getElementById('productSearchInput');
  const productCategoryFilter = document.getElementById('productCategoryFilter');
  const productStockFilter = document.getElementById('productStockFilter');
  const productsTableBody = document.getElementById('productsTableBody');

  // DOM Elements - Margin Config Tab
  const marginConfigForm = document.getElementById('marginConfigForm');
  const marginInput = document.getElementById('marginInput');
  const recalcAllPricesCheck = document.getElementById('recalcAllPricesCheck');
  const storePhoneInput = document.getElementById('storePhoneInput');
  const saveMarginBtn = document.getElementById('saveMarginBtn');
  const configSuccessAlert = document.getElementById('configSuccessAlert');
  const configSuccessMsg = document.getElementById('configSuccessMsg');

  // DOM Elements - Scraper Tab & Buttons
  const triggerScraperBtn = document.getElementById('triggerScraperBtn');
  const navbarSyncScraperBtn = document.getElementById('navbarSyncScraperBtn');
  const productsTabSyncBtn = document.getElementById('productsTabSyncBtn');
  const syncFeedbackAlert = document.getElementById('syncFeedbackAlert');
  const syncFeedbackText = document.getElementById('syncFeedbackText');
  const syncFeedbackIcon = document.getElementById('syncFeedbackIcon');
  const scraperLogsTableBody = document.getElementById('scraperLogsTableBody');

  // Helper de Peticiones Autenticadas
  async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    options.credentials = 'include'; // Enviar cookie HttpOnly

    const res = await fetch(url, options);
    if (res.status === 401) {
      // Sesión expirada
      handleLogout();
      throw new Error('Sesión no autorizada');
    }
    return res;
  }

  // Verificar estado de sesión
  async function checkAuth() {
    try {
      const res = await apiFetch('/api/auth/me');
      const json = await res.json();
      if (json.success && json.data) {
        showAdminView(json.data);
      } else {
        showLoginView();
      }
    } catch {
      showLoginView();
    }
  }

  function showAdminView(user) {
    loginOverlay.classList.add('hidden');
    adminLayout.classList.remove('hidden');
    adminNameDisplay.textContent = user.name || user.email;

    // Cargar datos iniciales
    loadMetrics();
    loadOrders();
    loadProducts();
    loadConfig();
    loadScraperLogs();
  }

  function showLoginView() {
    adminLayout.classList.add('hidden');
    loginOverlay.classList.remove('hidden');
  }

  function handleLogout() {
    authToken = null;
    localStorage.removeItem('kbeauty_admin_token');
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      showLoginView();
    });
  }

  logoutBtn.addEventListener('click', handleLogout);

  // Formulario Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorMsg.classList.add('hidden');
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Ingresando...</span>';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.value.trim(),
          password: adminPassword.value,
        }),
      });

      const json = await res.json();
      if (json.success) {
        authToken = json.data.token;
        localStorage.setItem('kbeauty_admin_token', authToken);
        showAdminView(json.data.admin);
      } else {
        loginErrorMsg.textContent = json.error || 'Credenciales incorrectas';
        loginErrorMsg.classList.remove('hidden');
      }
    } catch (err) {
      loginErrorMsg.textContent = 'Error de conexión con el servidor.';
      loginErrorMsg.classList.remove('hidden');
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.innerHTML = '<span>Iniciar Sesión</span><i class="fa-solid fa-arrow-right text-xs"></i>';
    }
  });

  // Navegación por pestañas
  adminTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      adminTabs.forEach((t) => {
        t.classList.remove('active', 'border-rose-500', 'text-rose-400');
        t.classList.add('border-transparent', 'text-slate-400');
      });
      tab.classList.add('active', 'border-rose-500', 'text-rose-400');
      tab.classList.remove('border-transparent', 'text-slate-400');

      tabPanes.forEach((p) => p.classList.add('hidden'));
      const activePane = document.getElementById(`tab-${target}`);
      if (activePane) activePane.classList.remove('hidden');

      if (target === 'orders') loadOrders();
      if (target === 'products') loadProducts();
      if (target === 'margin') loadConfig();
      if (target === 'scraper') loadScraperLogs();
    });
  });

  // 1. Cargar Métricas KPIs
  async function loadMetrics() {
    try {
      const res = await apiFetch('/api/admin/metrics');
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        kpiRevenue.textContent = `$${d.totalRevenue.toFixed(2)} MXN`;
        kpiTotalOrders.textContent = d.totalOrders;
        kpiPendingOrders.textContent = d.pendingOrders;
        kpiMargin.textContent = `${d.activeMargin}%`;
        kpiProducts.textContent = d.totalProducts;
        kpiInStockText.textContent = `${d.totalProducts - d.outOfStockProducts} en stock`;
      }
    } catch (err) {
      console.error('Error cargando métricas:', err);
    }
  }

  // 2. Gestión de Pedidos
  async function loadOrders() {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-slate-500">
          <i class="fa-solid fa-spinner fa-spin text-lg mb-2"></i>
          <div>Cargando pedidos...</div>
        </td>
      </tr>
    `;

    try {
      const params = new URLSearchParams();
      const status = orderStatusFilter.value;
      const search = orderSearchInput.value.trim();

      if (status !== 'ALL') params.append('status', status);
      if (search) params.append('search', search);

      const res = await apiFetch(`/api/admin/orders?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        renderOrdersTable(json.data);
      }
    } catch (err) {
      console.error('Error cargando pedidos:', err);
      ordersTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-rose-400">Error al cargar pedidos</td></tr>`;
    }
  }

  function renderOrdersTable(orders) {
    if (!orders || orders.length === 0) {
      ordersTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-500">No hay pedidos que coincidan con los filtros.</td></tr>`;
      return;
    }

    ordersTableBody.innerHTML = orders
      .map((ord) => {
        const date = new Date(ord.createdAt).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const itemsSummary = ord.items
          .map((i) => `${i.quantity}× ${escapeHtml(i.product?.title || 'Producto')}`)
          .join('<br>');

        const addressFull = `${ord.customer.street} #${ord.customer.exteriorNumber}${
          ord.customer.interiorNumber ? `, Int ${ord.customer.interiorNumber}` : ''
        }, Col. ${ord.customer.neighborhood}, ${ord.customer.city}, ${ord.customer.state} (CP ${ord.customer.postalCode})`;

        return `
        <tr class="hover:bg-slate-700/30 transition">
          <td class="py-3 px-4 font-mono font-bold text-rose-400">#${ord.orderNumber}</td>
          <td class="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">${date}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-white">${escapeHtml(ord.customer.name)}</div>
            <div class="text-[11px] text-slate-400 font-mono">${escapeHtml(ord.customer.phone)}</div>
          </td>
          <td class="py-3 px-4 max-w-xs text-[11px] text-slate-300">
            <div>${escapeHtml(addressFull)}</div>
            ${
              ord.customer.references
                ? `<div class="text-slate-500 italic mt-0.5">Ref: ${escapeHtml(ord.customer.references)}</div>`
                : ''
            }
          </td>
          <td class="py-3 px-4 text-[11px] max-w-xs leading-snug">${itemsSummary}</td>
          <td class="py-3 px-4 font-black text-white whitespace-nowrap">$${ord.totalAmount.toFixed(2)} MXN</td>
          <td class="py-3 px-4">
            <select 
              onchange="updateOrderStatus('${ord.id}', this.value)"
              class="status-badge-select ${getStatusClass(ord.status)} text-[11px] font-bold rounded-lg px-2.5 py-1 outline-none border cursor-pointer"
            >
              <option value="PENDING" ${ord.status === 'PENDING' ? 'selected' : ''}>PENDIENTE</option>
              <option value="CONFIRMED" ${ord.status === 'CONFIRMED' ? 'selected' : ''}>CONFIRMADO</option>
              <option value="SHIPPED" ${ord.status === 'SHIPPED' ? 'selected' : ''}>ENVIADO</option>
              <option value="DELIVERED" ${ord.status === 'DELIVERED' ? 'selected' : ''}>ENTREGADO</option>
              <option value="CANCELLED" ${ord.status === 'CANCELLED' ? 'selected' : ''}>CANCELADO</option>
            </select>
          </td>
          <td class="py-3 px-4 text-center">
            <a 
              href="${ord.customerWhatsAppLink}" 
              target="_blank" 
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-400 font-bold text-[11px] border border-emerald-800 transition"
              title="Contactar al cliente por WhatsApp"
            >
              <i class="fa-brands fa-whatsapp text-sm"></i>
              <span>Chat</span>
            </a>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  function getStatusClass(status) {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/80';
      case 'CONFIRMED':
        return 'bg-blue-950/60 text-blue-300 border-blue-800/80';
      case 'SHIPPED':
        return 'bg-purple-950/60 text-purple-300 border-purple-800/80';
      case 'DELIVERED':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
      case 'CANCELLED':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  }

  window.updateOrderStatus = async function (orderId, newStatus) {
    try {
      const res = await apiFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        loadMetrics();
        loadOrders();
      } else {
        alert(json.error || 'Error al actualizar estado');
      }
    } catch (err) {
      alert('Error de conexión al actualizar estado.');
    }
  };

  refreshOrdersBtn.addEventListener('click', loadOrders);
  orderStatusFilter.addEventListener('change', loadOrders);
  let orderSearchDebounce;
  orderSearchInput.addEventListener('input', () => {
    clearTimeout(orderSearchDebounce);
    orderSearchDebounce = setTimeout(loadOrders, 300);
  });

  // 3. Catálogo & Productos Tab
  async function loadProducts() {
    productsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-slate-500">
          <i class="fa-solid fa-spinner fa-spin text-lg mb-2"></i>
          <div>Cargando productos...</div>
        </td>
      </tr>
    `;

    try {
      const params = new URLSearchParams();
      const cat = productCategoryFilter.value;
      const stock = productStockFilter.value;
      const search = productSearchInput.value.trim();

      if (cat !== 'ALL') params.append('category', cat);
      if (stock !== 'ALL') params.append('inStock', stock);
      if (search) params.append('search', search);

      const res = await apiFetch(`/api/admin/products?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        renderProductsTable(json.data);
      }
    } catch (err) {
      console.error('Error cargando productos:', err);
      productsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400">Error al cargar productos</td></tr>`;
    }
  }

  function renderProductsTable(products) {
    if (!products || products.length === 0) {
      productsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500">No hay productos que coincidan.</td></tr>`;
      return;
    }

    productsTableBody.innerHTML = products
      .map((p) => {
        return `
        <tr class="hover:bg-slate-700/30 transition">
          <td class="py-3 px-4">
            <div class="flex items-center gap-3">
              <img src="${p.imageUrl}" alt="${escapeHtml(p.title)}" class="w-10 h-10 object-cover rounded-lg bg-slate-800 border border-slate-700 flex-shrink-0" onerror="this.src='https://sv5-cdn.stylevana.com/media/catalog/product/cache/149ac48e39a2c39d615e80655541abf2/b/e/beauty-of-joseon-relief-sun-rice-probiotics-niacinamide-set-spf50-pa-50ml-2-648.png'">
              <div class="font-bold text-white line-clamp-1 max-w-sm" title="${escapeHtml(p.title)}">
                ${escapeHtml(p.title)}
              </div>
            </div>
          </td>
          <td class="py-3 px-4">
            <div class="font-semibold text-slate-200">${escapeHtml(p.brand)}</div>
            <div class="text-[10px] text-rose-400">${escapeHtml(p.category)}</div>
          </td>
          <td class="py-3 px-4 font-mono text-[10px] text-slate-400">${escapeHtml(p.externalId)}</td>
          <td class="py-3 px-4 font-mono text-slate-300">$${p.basePrice.toFixed(2)} MXN</td>
          <td class="py-3 px-4 font-mono font-bold text-emerald-400">$${p.calculatedPrice.toFixed(2)} MXN</td>
          <td class="py-3 px-4 text-center">
            <label class="inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                ${p.inStock ? 'checked' : ''} 
                onchange="toggleProductStock('${p.id}', this.checked)"
                class="sr-only peer"
              >
              <div class="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </td>
          <td class="py-3 px-4 text-center">
            <a href="${p.stylevanaUrl}" target="_blank" class="text-slate-400 hover:text-rose-400 transition" title="Ver en Stylevana México">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  window.toggleProductStock = async function (productId, inStock) {
    try {
      const res = await apiFetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inStock }),
      });
      const json = await res.json();
      if (json.success) {
        loadMetrics();
      } else {
        alert(json.error || 'Error al cambiar stock');
      }
    } catch {
      alert('Error de conexión al actualizar stock');
    }
  };

  productCategoryFilter.addEventListener('change', loadProducts);
  productStockFilter.addEventListener('change', loadProducts);
  let productSearchDebounce;
  productSearchInput.addEventListener('input', () => {
    clearTimeout(productSearchDebounce);
    productSearchDebounce = setTimeout(loadProducts, 300);
  });

  // 4. Configuración & Motor de Margen
  async function loadConfig() {
    try {
      const res = await apiFetch('/api/admin/config');
      const json = await res.json();
      if (json.success) {
        marginInput.value = json.data.profitMargin;
        storePhoneInput.value = json.data.storePhone;
      }
    } catch (err) {
      console.error('Error cargando configuración:', err);
    }
  }

  marginConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    configSuccessAlert.classList.add('hidden');
    saveMarginBtn.disabled = true;
    saveMarginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Guardando y recalculando...</span>';

    try {
      const marginVal = parseFloat(marginInput.value);
      const phoneVal = storePhoneInput.value.trim();
      const recalc = recalcAllPricesCheck.checked;

      const res = await apiFetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profitMargin: marginVal,
          recalculateAllPrices: recalc,
          storePhone: phoneVal,
        }),
      });

      const json = await res.json();
      if (json.success) {
        const count = json.data.marginResult?.updatedProductsCount ?? 0;
        configSuccessMsg.textContent = `Configuración guardada exitosamente. Se recalculó el precio de ${count} productos.`;
        configSuccessAlert.classList.remove('hidden');

        loadMetrics();
        loadProducts();
      } else {
        alert(json.error || 'Error al guardar configuración');
      }
    } catch (err) {
      alert('Error de conexión al guardar configuración.');
    } finally {
      saveMarginBtn.disabled = false;
      saveMarginBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Guardar y Aplicar Cambios</span>';
    }
  });

  // 5. Scraper Manual Trigger & Logs
  // Toast Helper
  let toastTimeout = null;
  function showToast(title, message, isSuccess = true) {
    const toast = document.getElementById('adminToast');
    const toastCard = document.getElementById('adminToastCard');
    const toastIcon = document.getElementById('adminToastIcon');
    const toastTitle = document.getElementById('adminToastTitle');
    const toastMessage = document.getElementById('adminToastMessage');

    if (!toast || !toastCard) return;

    toastTitle.textContent = title;
    toastMessage.textContent = message;

    if (isSuccess) {
      toastCard.className = 'p-4 rounded-2xl border shadow-2xl flex items-start gap-3 bg-slate-900 border-emerald-500/50 shadow-emerald-950/40';
      toastIcon.className = 'fa-solid fa-circle-check text-emerald-400 text-lg mt-0.5';
    } else {
      toastCard.className = 'p-4 rounded-2xl border shadow-2xl flex items-start gap-3 bg-slate-900 border-rose-500/50 shadow-rose-950/40';
      toastIcon.className = 'fa-solid fa-triangle-exclamation text-rose-400 text-lg mt-0.5';
    }

    toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    }, 6000);
  }

  // 5. Scraper Manual Trigger & Logs (Accionable desde Navbar, Catálogo o Pestaña de Scraper)
  async function executeScraperSync() {
    const buttons = [
      triggerScraperBtn,
      navbarSyncScraperBtn,
      productsTabSyncBtn
    ].filter(Boolean);

    buttons.forEach((btn) => {
      btn.disabled = true;
      btn.dataset.prevHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Sincronizando...</span>';
    });

    if (syncFeedbackAlert) syncFeedbackAlert.classList.add('hidden');

    try {
      const res = await apiFetch('/api/admin/scraper/run', {
        method: 'POST',
      });
      const json = await res.json();

      if (json.success) {
        if (syncFeedbackAlert) {
          syncFeedbackAlert.className = 'text-xs p-4 rounded-2xl border bg-emerald-950/40 border-emerald-800 text-emerald-300 flex items-center gap-2.5';
          syncFeedbackIcon.className = 'fa-solid fa-circle-check text-emerald-400 text-base';
          syncFeedbackText.textContent = json.message || 'Sincronización finalizada exitosamente.';
          syncFeedbackAlert.classList.remove('hidden');
        }
        showToast('Sincronización Exitosa', json.message || 'Catálogo actualizado correctamente.', true);
      } else {
        if (syncFeedbackAlert) {
          syncFeedbackAlert.className = 'text-xs p-4 rounded-2xl border bg-rose-950/40 border-rose-800 text-rose-300 flex items-center gap-2.5';
          syncFeedbackIcon.className = 'fa-solid fa-triangle-exclamation text-rose-400 text-base';
          syncFeedbackText.textContent = json.message || 'Error durante la sincronización.';
          syncFeedbackAlert.classList.remove('hidden');
        }
        showToast('Atención en Sincronización', json.message || 'Error durante la sincronización.', false);
      }

      await loadMetrics();
      await loadProducts();
      await loadScraperLogs();
    } catch (err) {
      if (syncFeedbackAlert) {
        syncFeedbackAlert.className = 'text-xs p-4 rounded-2xl border bg-rose-950/40 border-rose-800 text-rose-300 flex items-center gap-2.5';
        syncFeedbackIcon.className = 'fa-solid fa-circle-xmark text-rose-400 text-base';
        syncFeedbackText.textContent = 'Error de conexión al disparar el scraper.';
        syncFeedbackAlert.classList.remove('hidden');
      }
      showToast('Error de Conexión', 'No se pudo conectar con el servidor para ejecutar el scraper.', false);
    } finally {
      buttons.forEach((btn) => {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.prevHtml || '<i class="fa-solid fa-arrows-rotate text-sm"></i><span>Sincronizar Catálogo Ahora</span>';
      });
    }
  }

  if (triggerScraperBtn) triggerScraperBtn.addEventListener('click', executeScraperSync);
  if (navbarSyncScraperBtn) navbarSyncScraperBtn.addEventListener('click', executeScraperSync);
  if (productsTabSyncBtn) productsTabSyncBtn.addEventListener('click', executeScraperSync);

  async function loadScraperLogs() {
    scraperLogsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-6 text-slate-500">
          <i class="fa-solid fa-spinner fa-spin text-base mb-1"></i>
          <div>Cargando historial de sincronizaciones...</div>
        </td>
      </tr>
    `;

    try {
      const res = await apiFetch('/api/admin/scraper/logs');
      const json = await res.json();

      if (json.success) {
        renderScraperLogs(json.data);
      }
    } catch (err) {
      console.error('Error cargando logs de scraping:', err);
      scraperLogsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-rose-400">Error al cargar historial</td></tr>`;
    }
  }

  function renderScraperLogs(logs) {
    if (!logs || logs.length === 0) {
      scraperLogsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500">Aún no hay ejecuciones registradas.</td></tr>`;
      return;
    }

    scraperLogsTableBody.innerHTML = logs
      .map((log) => {
        const start = new Date(log.startedAt);
        const dateStr = start.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        let durationStr = 'En ejecución';
        if (log.completedAt) {
          const diffMs = new Date(log.completedAt).getTime() - start.getTime();
          durationStr = `${(diffMs / 1000).toFixed(1)}s`;
        }

        let statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">EJECUTANDO</span>';
        if (log.status === 'SUCCESS') {
          statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">EXITOSO</span>';
        } else if (log.status === 'FAILED') {
          statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">FALLIDO</span>';
        }

        return `
        <tr class="hover:bg-slate-700/30 transition text-[11px]">
          <td class="py-2.5 px-4 font-mono text-slate-400">${log.id.slice(0, 8)}...</td>
          <td class="py-2.5 px-4 font-mono text-slate-300">${dateStr}</td>
          <td class="py-2.5 px-4 font-mono text-slate-400">${durationStr}</td>
          <td class="py-2.5 px-4">${statusBadge}</td>
          <td class="py-2.5 px-4 font-bold text-white">${log.productsUpserted} productos</td>
          <td class="py-2.5 px-4 text-slate-400">${log.errorMessage ? `<span class="text-rose-400">${escapeHtml(log.errorMessage)}</span>` : '<span class="text-emerald-400/80">Sincronización correcta</span>'}</td>
        </tr>
      `;
      })
      .join('');
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Comprobar autenticación inicial
  checkAuth();
});

