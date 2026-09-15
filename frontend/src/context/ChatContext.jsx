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
  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: boolean }

  const typingTimeoutRef = useRef(null);
  const lastTypingSentAtRef = useRef(0);
  const typingClearTimeoutsRef = useRef({});

  // Reset when user logs out
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setActiveConversation(null);
      setMessages([]);
      setTypingUsers({});
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

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages when activeConversation changes
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    if (socket) {
      socket.emit('join_conversation', activeConversation.id);
    }

    api.getMessages(activeConversation.id)
      .then(res => {
        if (res.success) {
          setMessages(res.messages);
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

  // Socket Real-time listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming new message
    const handleReceiveMessage = (newMsg) => {
      if (activeConversation && newMsg.conversationId === activeConversation.id) {
        setMessages(prev => {
          // If message already exists by real id, ignore duplicate
          if (prev.some(m => m.id === newMsg.id)) return prev;

          // If there is an optimistic temp message matching this text & sender, replace it
          const tempIdx = prev.findIndex(m => m.id?.startsWith('temp_') && m.text === newMsg.text && m.senderId === newMsg.senderId);
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = newMsg;
            return next;
          }

          return [...prev, newMsg];
        });

        // Play chime if message from another user
        if (newMsg.senderId !== user?.id) {
          soundService.playMessageReceived();
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
    const handleMessagesMarkedRead = ({ conversationId }) => {
      if (activeConversation?.id === conversationId) {
        setMessages(prev => prev.map(m => ({ ...m, readBy: [...new Set([...m.readBy, user?.id])] })));
      }
    };

    // Socket delivery ack
    const handleMessageSentAck = ({ tempId, message }) => {
      if (tempId && message) {
        setMessages(prev => prev.map(m => m.id === tempId ? message : m));
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_sent_ack', handleMessageSentAck);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('messages_marked_read', handleMessagesMarkedRead);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent_ack', handleMessageSentAck);
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
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
  };

  const startDirectConversationWithUser = async (targetUserId) => {
    const res = await api.createConversation(targetUserId);
    if (res.success) {
      await fetchConversations();
      setActiveConversation(res.conversation);
      return res.conversation;
    }
  };

  const sendMessage = async ({ text, type = 'text', mediaUrl = null, replyToId = null }) => {
    if (!activeConversation) return;

    // Immediately stop typing indicator
    stopTyping();

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg = {
      id: tempId,
      conversationId: activeConversation.id,
      senderId: user?.id,
      text: text || '',
      type: type || 'text',
      mediaUrl: mediaUrl || null,
      replyToId: replyToId || null,
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
        replyToId,
        tempId,
        token: sessionStorage.getItem('chatz_token') || localStorage.getItem('chatz_token')
      }, (response) => {
        if (response?.success && response?.message) {
          setMessages(prev => prev.map(m => m.id === tempId ? response.message : m));
        }
      });
    } else {
      // 4. Fallback to REST API
      try {
        const res = await api.sendMessage(activeConversation.id, { text, type, mediaUrl, replyToId });
        if (res.success && res.message) {
          setMessages(prev => prev.map(m => m.id === tempId ? res.message : m));
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

  return (
    <ChatContext.Provider value={{
      conversations,
      activeConversation,
      messages,
      isLoadingMessages,
      typingUsers,
      selectConversation,
      startDirectConversationWithUser,
      sendMessage,
      sendVoiceMessage,
      sendFileMessage,
      addReaction,
      notifyTyping,
      stopTyping,
      refreshConversations: fetchConversations
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
