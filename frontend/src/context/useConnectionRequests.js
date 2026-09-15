/**
 * useConnectionRequests — Extracted from ChatContext for better separation of concerns.
 * Handles sending, fetching, accepting, and rejecting connection requests.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useConnectionRequests({ userId, socket, onAccepted }) {
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Reset on logout
  useEffect(() => {
    if (!userId) {
      setConnectionRequests([]);
    }
  }, [userId]);

  const fetchConnectionRequests = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoadingRequests(true);
      const res = await api.getConnectionRequests();
      if (res.success) {
        setConnectionRequests(res.requests || []);
      }
    } catch (err) {
      console.warn('[useConnectionRequests] Error fetching requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConnectionRequests();
  }, [fetchConnectionRequests]);

  // Listen for real-time connection request events via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewRequest = (data) => {
      setConnectionRequests(prev => {
        const exists = prev.find(r => r.id === data.id);
        if (exists) return prev;
        return [data, ...prev];
      });
    };

    const handleRequestUpdated = (data) => {
      setConnectionRequests(prev =>
        prev.map(r => r.id === data.id ? { ...r, ...data } : r)
      );
    };

    socket.on('new_connection_request', handleNewRequest);
    socket.on('connection_request_updated', handleRequestUpdated);

    return () => {
      socket.off('new_connection_request', handleNewRequest);
      socket.off('connection_request_updated', handleRequestUpdated);
    };
  }, [socket]);

  const sendConnectionRequest = useCallback(async (toUserId, note = '') => {
    try {
      const res = await api.sendConnectionRequest(toUserId, note);
      if (res.success) {
        await fetchConnectionRequests();
      }
      return res;
    } catch (err) {
      console.warn('[useConnectionRequests] Error sending request:', err);
      throw err;
    }
  }, [fetchConnectionRequests]);

  const acceptConnectionRequest = useCallback(async (requestId) => {
    try {
      const res = await api.respondConnectionRequest(requestId, 'accepted');
      if (res.success) {
        setConnectionRequests(prev => prev.filter(r => r.id !== requestId));
        if (onAccepted) onAccepted(res);
      }
      return res;
    } catch (err) {
      console.warn('[useConnectionRequests] Error accepting request:', err);
      throw err;
    }
  }, [onAccepted]);

  const rejectConnectionRequest = useCallback(async (requestId) => {
    try {
      const res = await api.respondConnectionRequest(requestId, 'rejected');
      if (res.success) {
        setConnectionRequests(prev => prev.filter(r => r.id !== requestId));
      }
      return res;
    } catch (err) {
      console.warn('[useConnectionRequests] Error rejecting request:', err);
      throw err;
    }
  }, []);

  const pendingRequestsCount = connectionRequests.filter(
    r => r.status === 'pending' && r.toUserId === userId
  ).length;

  return {
    connectionRequests,
    isLoadingRequests,
    pendingRequestsCount,
    fetchConnectionRequests,
    sendConnectionRequest,
    acceptConnectionRequest,
    rejectConnectionRequest,
  };
}
