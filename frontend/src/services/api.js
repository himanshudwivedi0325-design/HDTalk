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

async function request(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const config = {
    ...options,
    headers: {
      ...getHeaders(isFormData),
      ...options.headers
    }
  };

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
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
  getMessages: (conversationId) => request(`/api/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, body) => request(`/api/chat/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  addReaction: (messageId, emoji) => request(`/api/chat/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
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
  }
};
