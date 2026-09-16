import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { soundService } from '../services/soundService';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: boolean }
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  const typingTimeoutRef = useRef(null);
  const lastTypingSentAtRef = useRef(0);
  const typingClearTimeoutsRef = useRef({});

  // Reset when user logs out
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setActiveConversation(null);
      setMessages([]);
      setHasMoreMessages(false);
      setIsLoadingOlderMessages(false);
      setTypingUsers({});
      setConnectionRequests([]);
      setReplyingToMessage(null);
      setEditingMessage(null);
    }
  }, [user?.id]);

  // Load conversations on mount & user change
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getConversations();
      if (res.success) {
        setConversations(res.conversations);
        if (res.conversations.length > 0) {
          setActiveConversation(prev => {
            if (!prev) return res.conversations[0];
            const found = res.conversations.find(c => c.id === prev.id);
            return found || res.conversations[0];
          });
        } else {
          setActiveConversation(null);
        }
      }
    } catch (err) {
      console.warn('Error fetching conversations:', err);
    }
  }, [user?.id]);

  // Load connection requests on mount & user change
  const fetchConnectionRequests = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoadingRequests(true);
      const res = await api.getConnectionRequests();
      if (res.success) {
        setConnectionRequests(res.requests || []);
      }
    } catch (err) {
      console.warn('Error fetching connection requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchConversations();
    fetchConnectionRequests();
  }, [fetchConversations, fetchConnectionRequests]);

  useEffect(() => {
    const handleSync = () => {
      fetchConversations();
      fetchConnectionRequests();
    };
    window.addEventListener('hdtalk:user-updated', handleSync);
    window.addEventListener('hdtalk:user-deleted', handleSync);
    return () => {
      window.removeEventListener('hdtalk:user-updated', handleSync);
      window.removeEventListener('hdtalk:user-deleted', handleSync);
    };
  }, [fetchConversations, fetchConnectionRequests]);

  // Load messages when activeConversation changes
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      setHasMoreMessages(false);
      return;
    }

    setIsLoadingMessages(true);
    setHasMoreMessages(false);
    if (socket) {
      socket.emit('join_conversation', activeConversation.id);
    }

    api.getMessages(activeConversation.id, { limit: 50 })
      .then(res => {
        if (res.success) {
          setMessages(res.messages || []);
          setHasMoreMessages(Boolean(res.hasMore));
          if (socket) {
            socket.emit('mark_read', { conversationId: activeConversation.id });
          }
        }
      })
      .catch(console.warn)
      .finally(() => setIsLoadingMessages(false));

    return () => {
      if (socket) {
        socket.emit('leave_conversation', activeConversation.id);
      }
    };
  }, [activeConversation?.id, socket]);

  // Load earlier/older messages (pagination cursor)
  const loadOlderMessages = useCallback(async () => {
    if (!activeConversation || isLoadingOlderMessages || !hasMoreMessages) return false;
    if (messages.length === 0) return false;

    const oldestMsg = messages[0];
    if (!oldestMsg?.timestamp) return false;

    setIsLoadingOlderMessages(true);
    try {
      const res = await api.getMessages(activeConversation.id, {
        limit: 50,
        before: oldestMsg.timestamp
      });
      if (res.success && Array.isArray(res.messages)) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const olderOnly = res.messages.filter(m => !existingIds.has(m.id));
          return [...olderOnly, ...prev];
        });
        setHasMoreMessages(Boolean(res.hasMore));
        return true;
      }
    } catch (err) {
      console.warn('Error loading older messages:', err);
    } finally {
      setIsLoadingOlderMessages(false);
    }
    return false;
  }, [activeConversation?.id, isLoadingOlderMessages, hasMoreMessages, messages]);

  // Socket Real-time listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming new message
    const handleReceiveMessage = (newMsg) => {
      if (activeConversation && newMsg.conversationId === activeConversation.id) {
        setMessages(prev => {
          // If message already exists by real id, ignore duplicate
          if (prev.some(m => m.id === newMsg.id)) return prev;

          // If there is an optimistic temp message matching this text & sender, replace it while preserving replyTo
          const tempIdx = prev.findIndex(m => m.id?.startsWith('temp_') && m.text === newMsg.text && m.senderId === newMsg.senderId);
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = {
              ...newMsg,
              replyTo: newMsg.replyTo || prev[tempIdx].replyTo
            };
            return next;
          }

          return [...prev, newMsg];
        });

        // Play chime if message from another user
        if (newMsg.senderId !== user?.id) {
          soundService.playMessageReceived();
        }
      }

      // Acknowledge delivery immediately to server/sender since this client received it
      if (newMsg.senderId !== user?.id) {
        socket.emit('message_ack_delivered', { messageId: newMsg.id, conversationId: newMsg.conversationId });
        if (activeConversation?.id === newMsg.conversationId) {
          socket.emit('mark_read', { conversationId: activeConversation.id });
        }
      }

      // Immediately clear typing state for this sender
      if (newMsg.senderId) {
        if (typingClearTimeoutsRef.current[newMsg.senderId]) {
          clearTimeout(typingClearTimeoutsRef.current[newMsg.senderId]);
        }
        setTypingUsers(prev => {
          const next = { ...prev };
          delete next[newMsg.senderId];
          delete next[newMsg.conversationId];
          return next;
        });
      }

      // Update conversations list preview
      setConversations(prev => {
        return prev.map(c => {
          if (c.id === newMsg.conversationId) {
            return {
              ...c,
              lastMessage: {
                text: newMsg.text || (newMsg.type === 'voice' ? '🎤 Voice message' : '📎 Attachment'),
                senderId: newMsg.senderId,
                timestamp: newMsg.timestamp
              },
              updatedAt: newMsg.timestamp,
              unreadCount: (activeConversation?.id === c.id || newMsg.senderId === user?.id)
                ? 0
                : (c.unreadCount || 0) + 1
            };
          }
          return c;
        }).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      });
    };

    // Real-time typing indicators
    const handleUserTyping = ({ conversationId, userId }) => {
      if (!userId || userId === user?.id) return;

      setTypingUsers(prev => ({
        ...prev,
        [userId]: true,
        [conversationId]: true
      }));

      // Auto-clear typing indicator after 3 seconds of inactivity
      if (typingClearTimeoutsRef.current[userId]) {
        clearTimeout(typingClearTimeoutsRef.current[userId]);
      }
      typingClearTimeoutsRef.current[userId] = setTimeout(() => {
        setTypingUsers(prev => {
          const next = { ...prev };
          delete next[userId];
          delete next[conversationId];
          return next;
        });
      }, 3000);
    };

    const handleUserStopTyping = ({ conversationId, userId }) => {
      if (!userId) return;
      if (typingClearTimeoutsRef.current[userId]) {
        clearTimeout(typingClearTimeoutsRef.current[userId]);
      }
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[userId];
        delete next[conversationId];
        return next;
      });
    };

    // Reaction update
    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    };

    // Messages marked read
    const handleMessagesMarkedRead = ({ conversationId, readBy, messageIds }) => {
      if (activeConversation?.id === conversationId) {
        setMessages(prev => prev.map(m => {
          if (!messageIds || messageIds.includes(m.id)) {
            const existingReadBy = Array.isArray(m.readBy) ? m.readBy : [];
            const updatedReadBy = readBy && !existingReadBy.includes(readBy) ? [...existingReadBy, readBy] : existingReadBy;
            return {
              ...m,
              status: 'read',
              readBy: updatedReadBy
            };
          }
          return m;
        }));
      }
    };

    // Single message delivered to recipient
    const handleMessageDelivered = ({ messageId, conversationId, deliveredTo }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          const list = Array.isArray(m.deliveredTo) ? m.deliveredTo : [];
          return {
            ...m,
            status: m.status === 'read' ? 'read' : 'delivered',
            deliveredTo: deliveredTo && !list.includes(deliveredTo) ? [...list, deliveredTo] : list
          };
        }
        return m;
      }));
    };

    // Batch messages delivered (e.g. when recipient connects)
    const handleMessagesDelivered = ({ messageIds, deliveredTo }) => {
      if (!Array.isArray(messageIds) || messageIds.length === 0) return;
      const idSet = new Set(messageIds);
      setMessages(prev => prev.map(m => {
        if (idSet.has(m.id)) {
          const list = Array.isArray(m.deliveredTo) ? m.deliveredTo : [];
          return {
            ...m,
            status: m.status === 'read' ? 'read' : 'delivered',
            deliveredTo: deliveredTo && !list.includes(deliveredTo) ? [...list, deliveredTo] : list
          };
        }
        return m;
      }));
    };

    // Socket delivery ack for optimistic message
    const handleMessageSentAck = ({ tempId, message }) => {
      if (tempId && message) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...message, replyTo: message.replyTo || m.replyTo } : m));
      }
    };

    // Message deleted event
    const handleMessageDeleted = ({ messageId, conversationId, deleteForEveryone, message, deletedForUserId }) => {
      setMessages(prev => {
        if (deleteForEveryone) {
          return prev.map(m => m.id === messageId ? (message || { ...m, isDeleted: true, text: 'This message was deleted', mediaUrl: null, reactions: {} }) : m);
        } else {
          return prev.filter(m => m.id !== messageId);
        }
      });

      if (deleteForEveryone) {
        setConversations(prev => prev.map(c => {
          if (c.id === conversationId) {
            return {
              ...c,
              lastMessage: c.lastMessage ? { ...c.lastMessage, text: '🚫 This message was deleted' } : c.lastMessage
            };
          }
          return c;
        }));
      }
    };

    // Conversation deleted event
    const handleConversationDeleted = ({ conversationId, deletedBy, alsoRemoveFriend }) => {
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      setActiveConversation(prev => {
        if (prev?.id === conversationId) {
          setMessages([]);
          return null;
        }
        return prev;
      });
      if (alsoRemoveFriend) {
        fetchConnectionRequests();
      }
    };

    // Friend removed event
    const handleFriendRemoved = ({ friendUserId }) => {
      setConnectionRequests(prev => prev.filter(r => 
        !( (r.senderId === friendUserId && r.receiverId === user?.id) || 
           (r.receiverId === friendUserId && r.senderId === user?.id) )
      ));
      fetchConversations();
    };

    // New connection request incoming
    const handleNewConnectionRequest = (req) => {
      setConnectionRequests(prev => {
        if (prev.some(r => r.id === req.id)) return prev;
        return [req, ...prev];
      });
      soundService.playMessageReceived();
    };

    // Connection request status updated (accepted/rejected)
    const handleConnectionRequestUpdated = ({ requestId, status, conversation, updated }) => {
      setConnectionRequests(prev => prev.map(r => r.id === requestId ? { ...r, status, ...updated } : r));
      if (status === 'accepted') {
        fetchConversations();
        setActiveConversation(prev => {
          if (prev && (conversation?.id === prev.id || prev.isPending)) {
            return { ...(conversation || prev), isPending: false };
          }
          return prev;
        });
      }
    };

    // Message edited event
    const handleMessageEdited = ({ messageId, conversationId, text, editedAt, isEdited, message }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text, isEdited: true, editedAt: editedAt || new Date().toISOString() } : m));

      setConversations(prev => prev.map(c => {
        if (c.id === conversationId && c.lastMessage) {
          return {
            ...c,
            lastMessage: {
              ...c.lastMessage,
              text
            }
          };
        }
        return c;
      }));
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_sent_ack', handleMessageSentAck);
    socket.on('message_delivered', handleMessageDelivered);
    socket.on('messages_delivered', handleMessagesDelivered);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_edited', handleMessageEdited);
    socket.on('conversation_deleted', handleConversationDeleted);
    socket.on('friend_removed', handleFriendRemoved);
    socket.on('new_connection_request', handleNewConnectionRequest);
    socket.on('connection_request_status_updated', handleConnectionRequestUpdated);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('messages_marked_read', handleMessagesMarkedRead);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent_ack', handleMessageSentAck);
      socket.off('message_delivered', handleMessageDelivered);
      socket.off('messages_delivered', handleMessagesDelivered);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_edited', handleMessageEdited);
      socket.off('conversation_deleted', handleConversationDeleted);
      socket.off('friend_removed', handleFriendRemoved);
      socket.off('new_connection_request', handleNewConnectionRequest);
      socket.off('connection_request_status_updated', handleConnectionRequestUpdated);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('messages_marked_read', handleMessagesMarkedRead);
    };
  }, [socket, activeConversation, user?.id]);

  // Actions
  const selectConversation = (conv) => {
    setActiveConversation(conv);
    // Clear unread count locally
    setConversations(prev => prev.map(c => c.id === conv?.id ? { ...c, unreadCount: 0 } : c));
    if (conv && socket) {
      socket.emit('mark_read', { conversationId: conv.id });
    }
  };

  const startDirectConversationWithUser = async (targetUserId) => {
    const res = await api.createConversation(targetUserId);
    if (res.success) {
      await fetchConversations();
      setActiveConversation(res.conversation);
      return res.conversation;
    }
  };

  const sendMessage = async ({ text, type = 'text', mediaUrl = null, replyToId = null, replyTo = null }) => {
    if (!activeConversation) return;

    // Immediately stop typing indicator
    stopTyping();

    const actualReplyToId = replyToId || replyingToMessage?.id || null;
    const actualReplyTo = replyTo || (replyingToMessage ? {
      id: replyingToMessage.id,
      senderId: replyingToMessage.senderId,
      senderName: replyingToMessage.senderName,
      text: replyingToMessage.text,
      type: replyingToMessage.type,
      mediaUrl: replyingToMessage.mediaUrl,
      isDeleted: replyingToMessage.isDeleted || false
    } : null);

    // Clear replying state after sending
    setReplyingToMessage(null);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg = {
      id: tempId,
      conversationId: activeConversation.id,
      senderId: user?.id,
      text: text || '',
      type: type || 'text',
      mediaUrl: mediaUrl || null,
      replyToId: actualReplyToId,
      replyTo: actualReplyTo,
      timestamp: new Date().toISOString(),
      reactions: {},
      readBy: [user?.id],
      isOptimistic: true
    };

    // 1. Optimistically display message in chat area immediately
    setMessages(prev => [...prev, optimisticMsg]);
    soundService.playMessageSent();

    // 2. Optimistically update preview in conversation list
    setConversations(prev => {
      return prev.map(c => {
        if (c.id === activeConversation.id) {
          return {
            ...c,
            lastMessage: {
              text: text || (type === 'voice' ? '🎤 Voice message' : '📎 Attachment'),
              senderId: user?.id,
              timestamp: optimisticMsg.timestamp
            },
            updatedAt: optimisticMsg.timestamp
          };
        }
        return c;
      }).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    });

    // 3. Emit via real-time WebSocket if connected
    if (socket && socket.connected) {
      socket.emit('send_message', {
        conversationId: activeConversation.id,
        text,
        type,
        mediaUrl,
        replyToId: actualReplyToId,
        tempId,
        token: sessionStorage.getItem('chatz_token') || localStorage.getItem('chatz_token')
      }, (response) => {
        if (response?.success && response?.message) {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...response.message, replyTo: response.message.replyTo || actualReplyTo } : m));
        }
      });
    } else {
      // 4. Fallback to REST API
      try {
        const res = await api.sendMessage(activeConversation.id, { text, type, mediaUrl, replyToId: actualReplyToId });
        if (res.success && res.message) {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...res.message, replyTo: res.message.replyTo || actualReplyTo } : m));
        }
      } catch (err) {
        console.error('REST sendMessage fallback failed:', err);
      }
    }
  };

  const sendVoiceMessage = async (audioBlob) => {
    if (!activeConversation || !audioBlob) return;
    try {
      const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      const uploadRes = await api.uploadFile(file);
      if (uploadRes.success) {
        await sendMessage({
          text: '',
          type: 'voice',
          mediaUrl: uploadRes.fileUrl
        });
      }
    } catch (err) {
      console.error('Error uploading voice message:', err);
    }
  };

  const sendFileMessage = async (file) => {
    if (!activeConversation || !file) return;
    try {
      const uploadRes = await api.uploadFile(file);
      if (uploadRes.success) {
        const isImg = file.type.startsWith('image/');
        await sendMessage({
          text: file.name,
          type: isImg ? 'image' : 'file',
          mediaUrl: uploadRes.fileUrl
        });
      }
    } catch (err) {
      console.error('Error uploading file message:', err);
    }
  };

  const addReaction = (messageId, emoji) => {
    if (!activeConversation) return;
    if (socket && socket.connected) {
      socket.emit('add_reaction', {
        messageId,
        conversationId: activeConversation.id,
        emoji
      });
    } else {
      api.addReaction(messageId, emoji).then(res => {
        if (res.success) {
          setMessages(prev => prev.map(m => m.id === messageId ? res.message : m));
        }
      });
    }
  };

  const stopTyping = () => {
    if (!activeConversation || !socket) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    lastTypingSentAtRef.current = 0;

    const other = activeConversation.otherUser || 
      activeConversation.participants?.find(p => (typeof p === 'object' ? p.id : p) !== user?.id);
    const targetUserId = typeof other === 'object' ? other?.id : other;

    socket.emit('typing_stop', {
      conversationId: activeConversation.id,
      targetUserId
    });
  };

  const notifyTyping = () => {
    if (!activeConversation || !socket) return;

    const now = Date.now();
    const other = activeConversation.otherUser || 
      activeConversation.participants?.find(p => (typeof p === 'object' ? p.id : p) !== user?.id);
    const targetUserId = typeof other === 'object' ? other?.id : other;

    // Send typing_start immediately on first keystroke or every 1200ms while user continues typing
    if (now - lastTypingSentAtRef.current > 1200) {
      lastTypingSentAtRef.current = now;
      socket.emit('typing_start', {
        conversationId: activeConversation.id,
        targetUserId
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2200);
  };

  // Delete message with instant optimistic update and socket/REST sync
  const deleteMessage = async (messageId, deleteForEveryone = true) => {
    if (!activeConversation) return;

    // Optimistically update local message list
    setMessages(prev => {
      if (deleteForEveryone) {
        return prev.map(m => m.id === messageId ? { ...m, isDeleted: true, text: 'This message was deleted', mediaUrl: null, reactions: {} } : m);
      } else {
        return prev.filter(m => m.id !== messageId);
      }
    });

    // Optimistically update conversation list preview
    if (deleteForEveryone) {
      setConversations(prev => prev.map(c => {
        if (c.id === activeConversation.id && c.lastMessage) {
          return {
            ...c,
            lastMessage: { ...c.lastMessage, text: '🚫 This message was deleted' }
          };
        }
        return c;
      }));
    }

    if (socket && socket.connected) {
      socket.emit('delete_message', {
        messageId,
        conversationId: activeConversation.id,
        deleteForEveryone
      });
    } else {
      try {
        await api.deleteMessage(messageId, deleteForEveryone);
      } catch (err) {
        console.error('REST deleteMessage fallback failed:', err);
      }
    }
  };

  // Connection request helpers
  const pendingIncomingRequests = (connectionRequests || []).filter(
    r => r.toUserId === user?.id && r.status === 'pending'
  );
  const pendingRequestsCount = pendingIncomingRequests.length;

  const acceptConnectionRequest = async (requestId) => {
    try {
      const res = await api.respondConnectionRequest(requestId, 'accepted');
      if (res.success) {
        setConnectionRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'accepted' } : r));
        await fetchConversations();
        if (res.conversation) {
          setActiveConversation(res.conversation);
        } else {
          setActiveConversation(prev => prev ? { ...prev, isPending: false } : prev);
        }
        return res;
      }
    } catch (err) {
      console.error('Error accepting connection request:', err);
      throw err;
    }
  };

  const rejectConnectionRequest = async (requestId) => {
    try {
      const res = await api.respondConnectionRequest(requestId, 'rejected');
      if (res.success) {
        setConnectionRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r));
        return res;
      }
    } catch (err) {
      console.error('Error rejecting connection request:', err);
      throw err;
    }
  };

  const sendConnectionRequest = async (toUserId, note = "Hey, let's connect on HDTalk!") => {
    try {
      const res = await api.sendConnectionRequest(toUserId, note);
      if (res.success) {
        setConnectionRequests(prev => {
          if (prev.some(r => r.id === res.request.id)) return prev;
          return [...prev, res.request];
        });
        return res;
      }
    } catch (err) {
      console.error('Error sending connection request:', err);
      throw err;
    }
  };

  const deleteConversation = async (conversationId, alsoRemoveFriend = false) => {
    try {
      if (socket) {
        socket.emit('delete_conversation', { conversationId, alsoRemoveFriend });
      }
      const res = await api.deleteConversation(conversationId, alsoRemoveFriend);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
      if (alsoRemoveFriend) {
        fetchConnectionRequests();
      }
      return res;
    } catch (err) {
      console.error('Error deleting conversation:', err);
      throw err;
    }
  };

  const removeFriend = async (friendUserId) => {
    try {
      if (socket) {
        socket.emit('remove_friend', { friendUserId });
      }
      const res = await api.removeFriend(friendUserId);
      setConnectionRequests(prev => prev.filter(r => 
        !( (r.senderId === friendUserId && r.receiverId === user?.id) || 
           (r.receiverId === friendUserId && r.senderId === user?.id) )
      ));
      await fetchConversations();
      return res;
    } catch (err) {
      console.error('Error removing friend:', err);
      throw err;
    }
  };

  const editMessage = async (messageId, newText) => {
    const trimmed = (newText || '').trim();
    if (!trimmed) return;

    // Optimistic update
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: trimmed, isEdited: true, editedAt: new Date().toISOString() } : m));
    if (activeConversation) {
      setConversations(prev => prev.map(c => {
        if (c.id === activeConversation.id && c.lastMessage) {
          return {
            ...c,
            lastMessage: { ...c.lastMessage, text: trimmed }
          };
        }
        return c;
      }));
    }

    if (socket && socket.connected) {
      socket.emit('edit_message', {
        messageId,
        conversationId: activeConversation?.id,
        text: trimmed
      });
    } else {
      try {
        await api.editMessage(messageId, trimmed);
      } catch (err) {
        console.error('REST editMessage fallback failed:', err);
      }
    }
  };

  return (
    <ChatContext.Provider value={{
      conversations,
      activeConversation,
      messages,
      isLoadingMessages,
      hasMoreMessages,
      isLoadingOlderMessages,
      loadOlderMessages,
      typingUsers,
      connectionRequests,
      pendingIncomingRequests,
      pendingRequestsCount,
      isLoadingRequests,
      selectConversation,
      startDirectConversationWithUser,
      replyingToMessage,
      setReplyingToMessage,
      editingMessage,
      setEditingMessage,
      sendMessage,
      editMessage,
      sendVoiceMessage,
      sendFileMessage,
      deleteMessage,
      deleteConversation,
      removeFriend,
      addReaction,
      notifyTyping,
      stopTyping,
      fetchConnectionRequests,
      acceptConnectionRequest,
      rejectConnectionRequest,
      sendConnectionRequest,
      refreshConversations: fetchConversations
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
