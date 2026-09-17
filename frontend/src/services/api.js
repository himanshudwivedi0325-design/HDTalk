// API Client for ChatZ Ultra Backend

const getHeaders = (isFormData = false) => {
  const token = sessionStorage.getItem('chatz_token') || localStorage.getItem('chatz_token');
  const headers = {
    'Bypass-Tunnel-Reminder': 'true'
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function request(url, options = {}, retries = 2) {
  const isFormData = options.body instanceof FormData;
  const isUpload = isFormData; // Don't retry uploads — they aren't idempotent

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

  try {
    const config = {
      ...options,
      signal: controller.signal,
      headers: {
        ...getHeaders(isFormData),
        ...options.headers
      }
    };

    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    // Retry on network errors (not on AbortError / client errors)
    if (!isUpload && retries > 0 && err.name !== 'AbortError') {
      console.warn(`[API] Retrying ${url} (${retries} retries left)...`);
      await new Promise(r => setTimeout(r, 800)); // brief back-off
      return request(url, options, retries - 1);
    }

    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  }
}


export const api = {
  // Auth
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  quickLogin: (userId) => request('/api/auth/quick-login', { method: 'POST', body: JSON.stringify({ userId }) }),
  getDemoUsers: () => request('/api/auth/demo-users'),
  getMe: () => request('/api/auth/me'),

  // Users & Matchmaking
  getUsers: () => request('/api/users'),
  getUserProfile: (id) => request(`/api/users/${id}`),
  updateProfile: (body) => request('/api/users/profile', { method: 'PUT', body: JSON.stringify(body) }),
  getConnectionRequests: () => request('/api/users/connections/requests'),
  sendConnectionRequest: (toUserId, note) => request('/api/users/connections/request', { method: 'POST', body: JSON.stringify({ toUserId, note }) }),
  respondConnectionRequest: (requestId, status) => request(`/api/users/connections/requests/${requestId}`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Chat & Messages
  getConversations: () => request('/api/chat/conversations'),
  createConversation: (targetUserId) => request('/api/chat/conversations', { method: 'POST', body: JSON.stringify({ targetUserId }) }),
  getOrCreateConversation: (targetUserId) => request('/api/chat/conversations', { method: 'POST', body: JSON.stringify({ targetUserId }) }),
  getMessages: (conversationId, params = {}) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', params.limit);
    if (params.before) query.set('before', params.before);
    const qStr = query.toString();
    return request(`/api/chat/conversations/${conversationId}/messages${qStr ? `?${qStr}` : ''}`);
  },
  addReaction: (messageId, emoji) => request(`/api/chat/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  editMessage: (messageId, text) => request(`/api/chat/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ text }) }),
  deleteMessage: (messageId, deleteForEveryone = true) => request(`/api/chat/messages/${messageId}`, { method: 'DELETE', body: JSON.stringify({ deleteForEveryone }) }),
  deleteConversation: (conversationId, alsoRemoveFriend = false) => request(`/api/chat/conversations/${conversationId}`, { method: 'DELETE', body: JSON.stringify({ alsoRemoveFriend }) }),
  removeFriend: (friendUserId) => request(`/api/users/friends/${friendUserId}`, { method: 'DELETE' }),
  markRead: (conversationId) => request(`/api/chat/conversations/${conversationId}/read`, { method: 'POST' }),

  // File / Voice Upload
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/chat/upload', {
      method: 'POST',
      body: formData
    });
  },

  // Direct DP / Avatar Upload (Authenticated)
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return request('/api/users/avatar', {
      method: 'POST',
      body: formData
    });
  },

  // Registration Avatar Upload (Unauthenticated for new users)
  uploadRegistrationAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return request('/api/auth/upload-avatar', {
      method: 'POST',
      body: formData
    });
  },

  // ─── Admin User Management APIs ─────────────────────────────────────────────
  adminGetUsers: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.append('search', params.search);
    if (params.filter) q.append('filter', params.filter);
    if (params.sort) q.append('sort', params.sort);
    const qStr = q.toString();
    return request(`/api/admin/users${qStr ? `?${qStr}` : ''}`);
  },
  adminGetStats: () => request('/api/admin/stats'),
  adminUpdateUserRole: (userId, role) => request(`/api/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role })
  }),
  adminToggleBan: (userId, isBanned, reason) => request(`/api/admin/users/${userId}/ban`, {
    method: 'PUT',
    body: JSON.stringify({ isBanned, reason })
  }),
  adminUpdateUser: (userId, data) => request(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  adminDeleteUser: (userId) => request(`/api/admin/users/${userId}`, {
    method: 'DELETE'
  }),
  adminCreateUser: (data) => request('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Help & n8n AI Assistant
  getN8nStatus: () => request('/api/n8n/status'),
  askN8nAssistant: (question, senderName) => request('/api/n8n/ask', {
    method: 'POST',
    body: JSON.stringify({ question, senderName })
  })
};
