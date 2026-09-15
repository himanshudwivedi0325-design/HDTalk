import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [lastSeenMap, setLastSeenMap] = useState({});

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const currentToken = token || sessionStorage.getItem('chatz_token') || localStorage.getItem('chatz_token');

    const socketInstance = io(window.location.origin, {
      auth: { token: currentToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected as', user.id);
      setIsConnected(true);
      socketInstance.emit('register_user', { userId: user.id, token: currentToken });
    });

    socketInstance.on('online_users_list', (userIds) => {
      setOnlineUserIds(new Set(userIds));
    });

    socketInstance.on('user_status_changed', ({ userId, status, lastSeen }) => {
      setOnlineUserIds(prev => {
        const next = new Set(prev);
        if (status === 'online') next.add(userId);
        else next.delete(userId);
        return next;
      });
      if (lastSeen) {
        setLastSeenMap(prev => ({ ...prev, [userId]: lastSeen }));
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user?.id]);

  const isUserOnline = (userId) => {
    return onlineUserIds.has(userId);
  };

  const getUserLastSeen = (userId, fallback) => {
    return lastSeenMap[userId] || fallback || null;
  };

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      onlineUserIds,
      lastSeenMap,
      isUserOnline,
      getUserLastSeen
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
