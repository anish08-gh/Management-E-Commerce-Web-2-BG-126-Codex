(() => {
  const API_BASE = "";

  const getToken = () => localStorage.getItem("forgecart_token") || "";
  const setToken = (token) => localStorage.setItem("forgecart_token", token);
  const clearToken = () => localStorage.removeItem("forgecart_token");

  const request = async (path, options = {}) => {
    const token = getToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        clearToken();
      }

      const message = data.message || "Request failed.";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return data;
  };

  window.ForgeApi = {
    getToken,
    setToken,
    clearToken,
    request,
  };
})();
