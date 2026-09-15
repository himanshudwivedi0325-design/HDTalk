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

function MainLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { activeConversation } = useChat();
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'discover'
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [isConversationListVisible, setIsConversationListVisible] = useState(true);

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
    return <AuthModal />;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Navbar */}
      <GlassNavbar
        onOpenThemeModal={() => setShowThemeModal(true)}
        onOpenProfileModal={() => setShowProfileModal(true)}
      />

      {/* Main Apphitect 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Leftmost Activity Rail: Always visible on desktop, hides on mobile during active chat to maximize screen */}
        <div className={`transition-all duration-300 ${
          activeTab === 'chats' && !isConversationListVisible ? 'hidden md:flex' : 'flex'
        }`}>
          <ApphitectSidebar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              if (tab === 'chats') setIsConversationListVisible(true);
            }}
            onOpenThemeModal={() => setShowThemeModal(true)}
            onOpenProfileModal={() => setShowProfileModal(true)}
          />
        </div>

        {/* Dynamic Center Workspaces */}
        {activeTab === 'chats' ? (
          <div className="flex-1 flex overflow-hidden relative">
            {/* Conversation List with Collapsible Animation */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 flex h-full ${
              isConversationListVisible 
                ? 'w-full md:w-80 lg:w-[340px] opacity-100' 
                : 'w-0 opacity-0 pointer-events-none'
            }`}>
              <ConversationList 
                onNewChatClick={() => setActiveTab('discover')} 
                onCollapse={() => setIsConversationListVisible(false)}
                onSelectChat={() => {
                  if (window.innerWidth < 768) {
                    setIsConversationListVisible(false);
                  }
                }}
              />
            </div>

            {/* Chat Workspace */}
            <div className={`flex-1 h-full overflow-hidden ${
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
              <ContactDetailsDrawer
                user={activeConversation?.otherUser}
                onClose={() => setIsInfoDrawerOpen(false)}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            <PartnerDiscovery onNavigateToChat={() => setActiveTab('chats')} />
          </div>
        )}
      </div>

      {/* Fullscreen Video Calling Stage & Modals */}
      <CallModal />
      <ThemeSelector isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} />
      <UserProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
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
              <MainLayout />
            </ChatProvider>
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
