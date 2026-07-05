const API_BASE = '/api';

async function apiRequest(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    const error = new Error((data && data.error) || '요청 처리 중 오류가 발생했습니다.');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

const api = {
  getMe: () => apiRequest('/auth/me'),
  login: (userId, password) => apiRequest('/auth/login', { method: 'POST', body: { userId, password } }),
  signup: (payload) => apiRequest('/auth/signup', { method: 'POST', body: payload }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  getProducts: () => apiRequest('/products'),
  createOrder: (payload) => apiRequest('/orders', { method: 'POST', body: payload }),
  getOrders: () => apiRequest('/orders'),
};
