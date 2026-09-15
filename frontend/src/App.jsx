import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import { ChatProvider, useChat } from './context/ChatContext';

import { GlassNavbar } from './components/layout/GlassNavbar';
import { ApphitectSidebar } from './components/layout/ApphitectSidebar';
import { ThemeSelector } from './components/layout/ThemeSelector';
import { UserProfileModal } from './components/layout/UserProfileModal';
import { ConversationList } from './components/chat/ConversationList';
import { ChatArea } from './components/chat/ChatArea';
import { ContactDetailsDrawer } from './components/chat/ContactDetailsDrawer';
import { PartnerDiscovery } from './components/discover/PartnerDiscovery';
import { CallModal } from './components/call/CallModal';
import { AuthModal } from './components/auth/AuthModal';

import { HDTalkLogo } from './components/ui/HDTalkLogo';
import { FriendRequestsModal } from './components/modals/FriendRequestsModal';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { NotificationManagerModal } from './components/notifications/NotificationManagerModal';
import { NotificationBanner } from './components/notifications/NotificationBanner';
import { PwaProvider, usePwa } from './context/PwaContext';
import { PwaInstallBanner } from './components/pwa/PwaInstallBanner';
import { PwaInstallModal } from './components/pwa/PwaInstallModal';
import { registerServiceWorker } from './services/pushService';

function MainLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { activeConversation, conversations, pendingRequestsCount, selectConversation, startDirectConversationWithUser } = useChat();
  const { showInstallModal, setShowInstallModal } = usePwa();
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'discover'
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [isConversationListVisible, setIsConversationListVisible] = useState(true);

  // 1. Initial Deep Link / URL Handling
  const handledInitialUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      registerServiceWorker();
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (!isAuthenticated || isLoading || handledInitialUrlRef.current) return;

    // Check if there was a saved redirect from before login
    const savedRedirect = sessionStorage.getItem('hdtalk_redirect');
    if (savedRedirect) {
      sessionStorage.removeItem('hdtalk_redirect');
      window.history.replaceState({}, '', savedRedirect);
    }

    const params = new URLSearchParams(window.location.search);
    const targetTab = params.get('tab');
    const targetChat = params.get('chat');
    const targetUser = params.get('u');

    if (targetTab === 'discover') {
      setActiveTab('discover');
      handledInitialUrlRef.current = true;
    } else if (targetChat && conversations.length > 0) {
      const found = conversations.find(c => c.id === targetChat);
      if (found) {
        selectConversation(found);
        setActiveTab('chats');
        setIsConversationListVisible(false);
        handledInitialUrlRef.current = true;
      }
    } else if (targetUser && targetUser !== user?.id) {
      const existing = (conversations || []).find(c => !c.isGroup && c.participants?.includes(targetUser));
      if (existing) {
        selectConversation(existing);
        setActiveTab('chats');
        setIsConversationListVisible(false);
        handledInitialUrlRef.current = true;
      } else if (startDirectConversationWithUser) {
        startDirectConversationWithUser(targetUser).then(newConv => {
          if (newConv) {
            selectConversation(newConv);
            setActiveTab('chats');
            setIsConversationListVisible(false);
          }
        }).catch(console.warn);
        handledInitialUrlRef.current = true;
      }
    }
  }, [isAuthenticated, isLoading, conversations, user?.id]);

  // 2. Keep browser URL bar dynamically in sync with state
  React.useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    let search = '';
    if (activeTab === 'discover') {
      search = '?tab=discover';
    } else if (activeTab === 'chats') {
      if (activeConversation?.id) {
        search = `?chat=${activeConversation.id}`;
      }
    }

    const newUrl = window.location.pathname + search;
    if (window.location.search !== search) {
      window.history.replaceState({ tab: activeTab, chat: activeConversation?.id }, '', newUrl);
    }
  }, [activeTab, activeConversation?.id, isAuthenticated, isLoading]);

  const totalUnread = (conversations || []).reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-[#070c18] transition-colors duration-200">
        <div className="flex flex-col items-center gap-3">
          <HDTalkLogo size="lg" showText={true} showCreator={false} />
          <div className="w-8 h-8 border-2 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin my-1"></div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 animate-pulse tracking-wider">
            INITIALIZING HDTALK GATEWAY...
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Created by <span className="text-slate-900 dark:text-white font-medium">Himanshu Dwivedi</span>
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (window.location.search) {
      sessionStorage.setItem('hdtalk_redirect', window.location.search);
    }
    return <AuthModal />;
  }

  const isChatOpenOnMobile = activeTab === 'chats' && !isConversationListVisible;

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Background Push Notification Reminder Banner */}
      <NotificationBanner onOpenModal={() => setShowNotificationModal(true)} />

      {/* Top Navbar: On desktop always shown; on mobile hidden during active chat */}
      <div className={`flex-shrink-0 ${isChatOpenOnMobile ? 'hidden md:block' : 'block'}`}>
        <GlassNavbar
          onOpenThemeModal={() => setShowThemeModal(true)}
          onOpenProfileModal={() => setShowProfileModal(true)}
          onOpenRequestsModal={() => setShowRequestsModal(true)}
          onOpenNotificationModal={() => setShowNotificationModal(true)}
        />
      </div>

      {/* Main Apphitect Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Leftmost Activity Rail: Desktop only (hidden on mobile) */}
        <div className="hidden md:flex flex-shrink-0 h-full">
          <ApphitectSidebar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              if (tab === 'chats') setIsConversationListVisible(true);
            }}
            onOpenThemeModal={() => setShowThemeModal(true)}
            onOpenProfileModal={() => setShowProfileModal(true)}
            onOpenRequestsModal={() => setShowRequestsModal(true)}
          />
        </div>

        {/* Dynamic Center Workspaces */}
        {activeTab === 'chats' ? (
          <div className="flex-1 flex overflow-hidden relative min-h-0 h-full">
            {/* Conversation List with Collapsible Animation */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 flex h-full ${
              isConversationListVisible 
                ? 'w-full md:w-80 lg:w-[340px] opacity-100' 
                : 'w-0 opacity-0 pointer-events-none'
            }`}>
              <ConversationList 
                onNewChatClick={() => setActiveTab('discover')} 
                onCollapse={() => setIsConversationListVisible(false)}
                onOpenRequestsModal={() => setShowRequestsModal(true)}
                onSelectChat={() => {
                  if (window.innerWidth < 768) {
                    setIsConversationListVisible(false);
                  }
                }}
              />
            </div>

            {/* Chat Workspace */}
            <div className={`flex-1 h-full overflow-hidden min-h-0 flex flex-col w-full ${
              !isConversationListVisible ? 'flex' : 'hidden md:flex'
            }`}>
              <ChatArea 
                onToggleInfoDrawer={() => setIsInfoDrawerOpen(prev => !prev)}
                isInfoDrawerOpen={isInfoDrawerOpen}
                isConversationListVisible={isConversationListVisible}
                onToggleConversationList={(forceShow) => {
                  if (typeof forceShow === 'boolean') {
                    setIsConversationListVisible(forceShow);
                  } else {
                    setIsConversationListVisible(prev => !prev);
                  }
                }}
              />
            </div>

            {/* Right Contact Info Drawer (Apphitect feature) */}
            {isInfoDrawerOpen && (
              <div className="fixed inset-0 z-50 md:static md:z-auto flex justify-end bg-slate-900/40 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none animate-in fade-in">
                <ContactDetailsDrawer
                  user={activeConversation?.otherUser}
                  conversationId={activeConversation?.id}
                  onClose={() => setIsInfoDrawerOpen(false)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <PartnerDiscovery onNavigateToChat={() => setActiveTab('chats')} />
          </div>
        )}
      </div>

      {/* Mobile Native Bottom Navigation Bar (Hidden when inside active chat on mobile) */}
      {!isChatOpenOnMobile && (
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'chats') setIsConversationListVisible(true);
          }}
          onOpenThemeModal={() => setShowThemeModal(true)}
          onOpenProfileModal={() => setShowProfileModal(true)}
          onOpenRequestsModal={() => setShowRequestsModal(true)}
          unreadCount={totalUnread}
          pendingRequestsCount={pendingRequestsCount}
          user={user}
        />
      )}

      {/* Fullscreen Video Calling Stage & Modals */}
      <CallModal />
      <ThemeSelector isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} />
      <UserProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
      <FriendRequestsModal 
        isOpen={showRequestsModal} 
        onClose={() => setShowRequestsModal(false)}
        onOpenChat={(conv) => {
          setActiveTab('chats');
          setIsConversationListVisible(false);
          selectConversation(conv);
        }}
      />
      <NotificationManagerModal 
        isOpen={showNotificationModal} 
        onClose={() => setShowNotificationModal(false)} 
      />

      {/* PWA Download Banner (Floating at bottom, dismissible) */}
      <PwaInstallBanner />

      {/* PWA Install Step-by-Step Guide Modal */}
      <PwaInstallModal 
        isOpen={showInstallModal} 
        onClose={() => setShowInstallModal(false)} 
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <ChatProvider>
              <PwaProvider>
                <MainLayout />
              </PwaProvider>
            </ChatProvider>
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
