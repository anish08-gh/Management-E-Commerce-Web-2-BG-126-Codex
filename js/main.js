(() => {
  const api = window.ForgeApi;
  if (!api) return;

  const formatCurrency = (value) => `$${Number(value).toFixed(2)}`;
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  const authUser = async () => {
    try {
      return await api.request("/api/auth/me");
    } catch {
      return null;
    }
  };

  const showMessage = (container, text, isError = false) => {
    if (!container) return;
    container.textContent = text;
    container.style.color = isError ? "#ff7b7b" : "#6dffba";
  };

  const updateNav = async () => {
    const user = await authUser();
    const nav = document.querySelector("#auth-links") || document.querySelector(".nav-links");
    if (!nav) return user;

    if (!user) return null;

    nav.innerHTML = `
      <a href="orders.html" class="nav-link" style="margin-right: 15px;" title="Order History"><i class="fas fa-box-open"></i></a>
      <a href="cart.html" class="nav-link" style="margin-right: 15px;" title="View Cart"><i class="fas fa-shopping-cart"></i></a>
      <span class="nav-link" style="opacity:0.9;">${user.name}</span>
      <a href="#" id="logout-link" class="btn">Logout</a>
    `;

    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
      logoutLink.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await api.request("/api/auth/logout", { method: "POST" });
        } catch {
          // ignore
        }
        api.clearToken();
        window.location.href = "login.html";
      });
    }

    return user;
  };

  const requireAuth = async () => {
    const user = await authUser();
    if (!user) {
      window.location.href = "login.html";
      return null;
    }
    return user;
  };

  const renderProducts = (products) => {
    const grid = document.getElementById("product-grid");
    if (!grid) return;

    grid.innerHTML = products
      .map(
        (product) => `
      <div class="glass product-card">
        <a href="product.html?id=${product.id}" style="text-decoration: none;">
          <div class="product-img-wrapper">
            <img src="${product.image}" alt="${product.name}" class="product-img">
          </div>
        </a>
        <div class="product-category"><i class="fas fa-tag" style="font-size:0.7rem; margin-right:4px;"></i> ${product.category}</div>
        <a href="product.html?id=${product.id}" style="text-decoration: none;">
          <h3 class="product-title">${product.name}</h3>
        </a>
        <div class="product-footer">
          <div class="product-price">${formatCurrency(product.price)}</div>
          <button class="btn-add-circle add-to-cart" data-id="${product.id}" title="Deploy to Cart">
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>
    `
      )
      .join("");

    grid.querySelectorAll(".add-to-cart").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!api.getToken()) {
          window.location.href = "login.html";
          return;
        }

        try {
          await api.request("/api/cart/items", {
            method: "POST",
            body: JSON.stringify({ productId: button.dataset.id, quantity: 1 }),
          });
          button.innerHTML = '<i class="fas fa-check"></i>';
        } catch (error) {
          alert(error.message);
        }
      });
    });
  };

  const initIndex = async () => {
    const searchInput = document.getElementById("search-input");
    const categoryFilter = document.getElementById("category-filter");

    const load = async () => {
      const params = new URLSearchParams({
        search: searchInput ? searchInput.value : "",
        category: categoryFilter ? categoryFilter.value : "all",
      });
      const products = await api.request(`/api/products?${params.toString()}`);
      renderProducts(products);
    };

    if (searchInput) searchInput.addEventListener("input", load);
    if (categoryFilter) categoryFilter.addEventListener("change", load);

    await load();
  };

  const initProduct = async () => {
    const container = document.getElementById("product-details-container");
    if (!container) return;

    const productId = new URLSearchParams(window.location.search).get("id") || "hoodie-2026";

    try {
      const product = await api.request(`/api/products/${productId}`);
      container.innerHTML = `
        <div class="product-details">
          <div class="product-img-wrapper flex items-center justify-center">
            <img src="${product.image}" alt="${product.name}" class="product-img" style="width: 100%; border-radius:16px;">
          </div>
          <div class="product-info glass" style="padding: 40px; text-align: left; height: 100%; display: flex; flex-direction: column; justify-content: center;">
            <div class="product-category" style="margin-bottom: 15px;"><i class="fas fa-fingerprint"></i> ${product.category}</div>
            <h1>${product.name}</h1>
            <div class="price">
              ${formatCurrency(product.price)}
              <span class="badge"><i class="fas fa-check-circle"></i> ${product.inStock ? "In Stock" : "Out of Stock"}</span>
            </div>
            <p class="desc">${product.description}</p>
            <ul class="feature-list">
              <li><i class="fas fa-shield-alt"></i> Official BackForge Merchandise</li>
              <li><i class="fas fa-shipping-fast"></i> Instant or Expedited Delivery</li>
              <li><i class="fas fa-undo"></i> 30-Day Developer Satisfaction</li>
            </ul>
            <div class="action-row">
              <button id="product-add-btn" class="btn" style="flex: 1; padding: 16px; font-size: 1.1rem;">
                <i class="fas fa-cart-arrow-down"></i> Initialize Payload
              </button>
            </div>
          </div>
        </div>
      `;

      const addBtn = document.getElementById("product-add-btn");
      if (!addBtn) return;

      addBtn.addEventListener("click", async () => {
        if (!api.getToken()) {
          window.location.href = "login.html";
          return;
        }

        try {
          await api.request("/api/cart/items", {
            method: "POST",
            body: JSON.stringify({ productId: product.id, quantity: 1 }),
          });
          addBtn.innerHTML = '<i class="fas fa-check"></i> Added';
        } catch (error) {
          alert(error.message);
        }
      });
    } catch {
      container.innerHTML = "<p>Product not found.</p>";
    }
  };

  const initCart = async () => {
    const list = document.getElementById("cart-items-list");
    const total = document.getElementById("summary-total-amt");
    const checkoutBtn = document.getElementById("checkout-btn");
    if (!list || !total) return;

    await requireAuth();

    const load = async () => {
      const cart = await api.request("/api/cart");

      if (cart.items.length === 0) {
        list.innerHTML = '<div class="glass cart-item" style="justify-content:center;">Your cart is empty.</div>';
      } else {
        list.innerHTML = cart.items
          .map(
            (item) => `
          <div class="glass cart-item" data-id="${item.productId}">
            <img src="${item.image}" alt="${item.name}" class="cart-item-img">
            <div class="cart-item-info">
              <div class="cart-item-title">${item.name}</div>
              <div class="cart-item-price">${formatCurrency(item.price)}</div>
            </div>
            <div class="cart-qty-ctrl">
              <button class="qty-btn qty-minus"><i class="fas fa-minus"></i></button>
              <span class="qty-val">${item.quantity}</span>
              <button class="qty-btn qty-plus"><i class="fas fa-plus"></i></button>
            </div>
            <div class="cart-item-total">${formatCurrency(item.lineTotal)}</div>
            <button class="icon-btn remove-item">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `
          )
          .join("");
      }

      total.textContent = formatCurrency(cart.subtotal);

      list.querySelectorAll(".cart-item").forEach((row) => {
        const id = row.dataset.id;
        const qtyVal = Number(row.querySelector(".qty-val")?.textContent || "1");

        row.querySelector(".qty-plus")?.addEventListener("click", async () => {
          await api.request(`/api/cart/items/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ quantity: qtyVal + 1 }),
          });
          await load();
        });

        row.querySelector(".qty-minus")?.addEventListener("click", async () => {
          await api.request(`/api/cart/items/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ quantity: qtyVal - 1 }),
          });
          await load();
        });

        row.querySelector(".remove-item")?.addEventListener("click", async () => {
          await api.request(`/api/cart/items/${id}`, { method: "DELETE" });
          await load();
        });
      });
    };

    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", () => {
        window.location.href = "checkout.html";
      });
    }

    await load();
  };

  const initCheckout = async () => {
    const form = document.getElementById("checkout-form");
    const itemsSummary = document.getElementById("checkout-items-summary");
    const total = document.getElementById("checkout-total");
    if (!form || !itemsSummary || !total) return;

    await requireAuth();

    const actionButton = form.querySelector("button");
    const msg = document.createElement("p");
    msg.style.marginTop = "15px";
    form.appendChild(msg);

    const cart = await api.request("/api/cart");
    if (cart.items.length === 0) {
      itemsSummary.innerHTML = "<p>Your cart is empty.</p>";
      total.textContent = formatCurrency(0);
      if (actionButton) actionButton.disabled = true;
      return;
    }

    itemsSummary.innerHTML = cart.items
      .map(
        (item) => `
      <div class="flex justify-between items-center mb-2" style="font-size: 0.95rem;">
        <span class="text-muted"><i class="fas fa-layer-group" style="font-size: 0.8rem; margin-right: 5px; color: var(--primary);"></i> ${item.name} <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-left: 5px;">x${item.quantity}</span></span>
        <span>${formatCurrency(item.lineTotal)}</span>
      </div>
    `
      )
      .join("");

    total.textContent = formatCurrency(cart.subtotal);

    if (actionButton) {
      actionButton.addEventListener("click", async () => {
        const fullName = document.getElementById("fullname")?.value.trim() || "";
        const email = document.getElementById("email")?.value.trim() || "";
        const address = document.getElementById("address")?.value.trim() || "";

        try {
          await api.request("/api/orders", {
            method: "POST",
            body: JSON.stringify({ fullName, email, address }),
          });
          showMessage(msg, "Order placed successfully.");
          setTimeout(() => {
            window.location.href = "orders.html";
          }, 700);
        } catch (error) {
          showMessage(msg, error.message, true);
        }
      });
    }
  };

  const initOrders = async () => {
    await requireAuth();

    const tableBody = document.querySelector("#order-history-container tbody");
    if (!tableBody) return;

    const orders = await api.request("/api/orders");

    if (orders.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No orders yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = orders
      .map((order) => {
        const date = new Date(order.timestamp).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        return `
          <tr>
            <td style="font-family: monospace; font-size: 0.95rem; color: var(--text-main);"><strong>${order.id}</strong></td>
            <td style="color: var(--text-muted);">${date}</td>
            <td><span style="background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 20px; font-size: 0.85rem;">${order.items.length} item(s)</span></td>
            <td style="color: var(--primary); font-weight:700;">${formatCurrency(order.total)}</td>
            <td><span class="status-badge"><i class="fas fa-check-circle"></i> ${order.status}</span></td>
          </tr>
        `;
      })
      .join("");
  };

  const initLogin = () => {
    const form = document.querySelector("form");
    if (!form) return;

    const msg = document.createElement("p");
    msg.style.marginTop = "12px";
    form.parentElement.appendChild(msg);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("email")?.value.trim() || "";
      const password = document.getElementById("password")?.value || "";

      try {
        const result = await api.request("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        api.setToken(result.token);
        window.location.href = "index.html";
      } catch (error) {
        showMessage(msg, error.message, true);
      }
    });
  };

  const initRegister = () => {
    const form = document.querySelector("form");
    if (!form) return;

    const msg = document.createElement("p");
    msg.style.marginTop = "12px";
    form.parentElement.appendChild(msg);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = document.getElementById("name")?.value.trim() || "";
      const email = document.getElementById("email")?.value.trim() || "";
      const password = document.getElementById("password")?.value || "";
      const confirmPassword = document.getElementById("confirm_password")?.value || "";

      if (password !== confirmPassword) {
        showMessage(msg, "Passwords do not match.", true);
        return;
      }

      try {
        await api.request("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
        showMessage(msg, "Account created. Redirecting to login...");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 700);
      } catch (error) {
        showMessage(msg, error.message, true);
      }
    });
  };

  const boot = async () => {
    await updateNav();

    if (currentPage === "index.html" || currentPage === "") {
      await initIndex();
    } else if (currentPage === "product.html") {
      await initProduct();
    } else if (currentPage === "cart.html") {
      await initCart();
    } else if (currentPage === "checkout.html") {
      await initCheckout();
    } else if (currentPage === "orders.html") {
      await initOrders();
    } else if (currentPage === "login.html") {
      initLogin();
    } else if (currentPage === "register.html") {
      initRegister();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((error) => {
      console.error(error);
    });
  });
})();
