const { z } = require('zod');

// ─── 1. Auth Schemas ──────────────────────────────────────────────────────────
const authSchemas = {
  register: {
    body: z.object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name must not exceed 50 characters'),
      email: z.string().trim().email('Invalid email address').max(100),
      password: z.string().min(6, 'Password must be at least 6 characters').max(128),
      avatar: z.string().optional().nullable(),
      profession: z.string().trim().max(100).optional().nullable(),
      bio: z.string().trim().max(500).optional().nullable(),
      interests: z.union([z.array(z.string()), z.string()]).optional().nullable()
    }).passthrough()
  },
  login: {
    body: z.object({
      email: z.string().trim().email('Invalid email address'),
      password: z.string().min(1, 'Password is required')
    })
  },
  quickLogin: {
    body: z.object({
      email: z.string().trim().email().optional(),
      userId: z.string().trim().optional()
    }).refine(data => data.email || data.userId, {
      message: 'Either email or userId must be provided'
    })
  }
};

// ─── 2. User Schemas ──────────────────────────────────────────────────────────
const userSchemas = {
  updateProfile: {
    body: z.object({
      name: z.string().trim().min(2).max(50).optional(),
      bio: z.string().trim().max(500).optional(),
      avatar: z.string().optional(),
      profession: z.string().trim().max(100).optional(),
      interests: z.union([z.array(z.string()), z.string()]).optional()
    }).passthrough()
  },
  sendConnectionRequest: {
    body: z.object({
      toUserId: z.string().min(1).optional(),
      targetUserId: z.string().min(1).optional(),
      note: z.string().max(200).optional().nullable()
    }).refine(data => data.toUserId || data.targetUserId, {
      message: 'Target user ID is required'
    })
  },
  respondConnectionRequest: {
    params: z.object({
      requestId: z.string().min(1, 'Request ID is required')
    }),
    body: z.object({
      status: z.enum(['accepted', 'rejected'], {
        errorMap: () => ({ message: 'Status must be accepted or rejected' })
      })
    })
  },
  removeFriend: {
    params: z.object({
      friendUserId: z.string().min(1, 'Friend user ID is required')
    })
  },
  getUserProfile: {
    params: z.object({
      id: z.string().min(1, 'User ID is required')
    })
  }
};

// ─── 3. Chat Schemas ──────────────────────────────────────────────────────────
const chatSchemas = {
  getOrCreateConversation: {
    body: z.object({
      targetUserId: z.string().min(1, 'Target user ID is required')
    })
  },
  getMessages: {
    params: z.object({
      conversationId: z.string().min(1, 'Conversation ID is required')
    }),
    query: z.object({
      limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
      before: z.string().optional()
    }).passthrough()
  },
  sendMessage: {
    params: z.object({
      conversationId: z.string().min(1, 'Conversation ID is required')
    }),
    body: z.object({
      text: z.string().max(10000).optional().nullable(),
      type: z.enum(['text', 'image', 'voice', 'file']).optional(),
      mediaUrl: z.string().optional().nullable(),
      fileName: z.string().optional().nullable(),
      fileSize: z.number().optional().nullable(),
      replyToId: z.string().optional().nullable()
    }).passthrough()
  },
  markRead: {
    params: z.object({
      conversationId: z.string().min(1, 'Conversation ID is required')
    })
  },
  addReaction: {
    params: z.object({
      messageId: z.string().min(1, 'Message ID is required')
    }),
    body: z.object({
      emoji: z.string().min(1, 'Emoji is required').max(10)
    })
  },
  editMessage: {
    params: z.object({
      messageId: z.string().min(1, 'Message ID is required')
    }),
    body: z.object({
      text: z.string().trim().min(1, 'Message text cannot be empty').max(10000)
    })
  },
  deleteMessage: {
    params: z.object({
      messageId: z.string().min(1, 'Message ID is required')
    }),
    body: z.object({
      deleteForEveryone: z.boolean().optional()
    }).optional()
  },
  deleteConversation: {
    params: z.object({
      conversationId: z.string().min(1, 'Conversation ID is required')
    }),
    body: z.object({
      alsoRemoveFriend: z.boolean().optional()
    }).optional()
  }
};

// ─── 4. Push Notification Schemas ─────────────────────────────────────────────
const pushSchemas = {
  subscribe: {
    body: z.object({
      subscription: z.object({
        endpoint: z.string().min(1, 'Endpoint is required')
      }).passthrough()
    })
  },
  unsubscribe: {
    body: z.object({
      endpoint: z.string().min(1, 'Endpoint is required')
    })
  }
};

// ─── 5. n8n Automation Schemas ────────────────────────────────────────────────
const n8nSchemas = {
  ask: {
    body: z.object({
      question: z.string().trim().min(1, 'Question cannot be empty').max(2000),
      senderName: z.string().trim().max(100).optional()
    })
  }
};

// ─── 6. Admin Schemas ─────────────────────────────────────────────────────────
const adminSchemas = {
  userIdParam: {
    params: z.object({
      userId: z.string().min(1, 'User ID is required')
    })
  },
  updateUserRole: {
    params: z.object({
      userId: z.string().min(1, 'User ID is required')
    }),
    body: z.object({
      role: z.enum(['admin', 'user'], {
        errorMap: () => ({ message: 'Role must be admin or user' })
      })
    })
  },
  toggleUserBan: {
    params: z.object({
      userId: z.string().min(1, 'User ID is required')
    }),
    body: z.object({
      isBanned: z.boolean({ required_error: 'isBanned boolean is required' }),
      reason: z.string().max(500).optional()
    })
  },
  createUser: {
    body: z.object({
      name: z.string().trim().min(2).max(50),
      email: z.string().trim().email(),
      password: z.string().min(6).max(128),
      role: z.enum(['admin', 'user']).optional(),
      profession: z.string().max(100).optional(),
      bio: z.string().max(500).optional()
    })
  },
  updateUser: {
    params: z.object({
      userId: z.string().min(1, 'User ID is required')
    }),
    body: z.object({
      name: z.string().trim().min(2).max(50).optional(),
      email: z.string().trim().email().optional(),
      password: z.string().min(6).max(128).optional(),
      role: z.enum(['admin', 'user']).optional(),
      profession: z.string().max(100).optional(),
      bio: z.string().max(500).optional(),
      interests: z.union([z.array(z.string()), z.string()]).optional()
    }).passthrough()
  }
};

module.exports = {
  authSchemas,
  userSchemas,
  chatSchemas,
  pushSchemas,
  n8nSchemas,
  adminSchemas
};
