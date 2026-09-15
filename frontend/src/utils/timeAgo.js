/**
 * Format user last active status and timestamp
 */
export function formatLastActive(lastSeen, isOnline) {
  if (isOnline) {
    return 'Active now';
  }
  if (!lastSeen) {
    return 'Offline';
  }

  const date = new Date(lastSeen);
  if (isNaN(date.getTime())) {
    return 'Offline';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) {
    return 'Active just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `Active ${diffMin}m ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `Active ${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Active yesterday at ${timeStr}`;
  }
  if (diffDays < 7) {
    return `Active ${diffDays}d ago`;
  }
  return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

/**
 * Format relative message time for conversation list
 */
export function formatChatTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
