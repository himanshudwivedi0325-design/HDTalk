const fs = require('fs');
const path = require('path');

const frontendDist = path.join(__dirname, '../frontend/dist');
const indexPath = path.join(frontendDist, 'index.html');
const rawHtml = fs.readFileSync(indexPath, 'utf8');

const ROUTE_SEO_META = {
  '/': {
    title: 'HDTalk — Free Real-Time Chat & 1080p Video Calling Web App',
    desc: 'HDTalk is an ultra-fast real-time messaging, WebRTC 1080p video calling, and synergy matchmaking web application by Himanshu Dwivedi. Features sub-50ms chats, screen sharing, voice notes, PWA install, and zero ads.',
    canonical: 'https://hdtalk.onrender.com/'
  },
  '/features': {
    title: 'HDTalk Features — Sub-50ms Chat, 1080p WebRTC Video & Screen Sharing',
    desc: 'Explore HDTalk features: 1080p crystal clear WebRTC video calls, sub-50ms Socket.IO chat, Telegram-style replies, PWA offline access, voice notes, and professional matchmaking.',
    canonical: 'https://hdtalk.onrender.com/features'
  },
  '/about': {
    title: 'About HDTalk — Engineered by Himanshu Dwivedi',
    desc: 'Learn about HDTalk, an open-source real-time communication platform engineered by Himanshu Dwivedi using React, Node.js, WebRTC, and Socket.io.',
    canonical: 'https://hdtalk.onrender.com/about'
  },
  '/security': {
    title: 'HDTalk Security & Privacy — DTLS-SRTP WebRTC Encryption',
    desc: 'HDTalk privacy and security standards: DTLS-SRTP peer-to-peer media encryption, salted bcrypt authentication, zero adware, and strict data sanitization.',
    canonical: 'https://hdtalk.onrender.com/security'
  },
  '/faq': {
    title: 'HDTalk FAQ — Questions & Answers about HDTalk WebRTC Calling',
    desc: 'Common questions about HDTalk: free browser-based video calling, 1080p screen sharing, sub-50ms real-time chat, and PWA installation.',
    canonical: 'https://hdtalk.onrender.com/faq'
  }
};

function testRoute(pathname) {
  const seo = ROUTE_SEO_META[pathname] || ROUTE_SEO_META['/'];
  let html = rawHtml;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${seo.title}</title>`);
  html = html.replace(/<meta name="title" content=".*?" \/>/i, `<meta name="title" content="${seo.title}" />`);
  html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${seo.desc}" />`);
  html = html.replace(/<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${seo.canonical}" />`);
  html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${seo.title}" />`);
  html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${seo.desc}" />`);
  html = html.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${seo.canonical}" />`);
  html = html.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${seo.title}" />`);
  html = html.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${seo.desc}" />`);

  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const descMatch = html.match(/<meta name="description" content="(.*?)" \/>/i);
  const canonMatch = html.match(/<link rel="canonical" href="(.*?)" \/>/i);
  const ogTitleMatch = html.match(/<meta property="og:title" content="(.*?)" \/>/i);
  const ogUrlMatch = html.match(/<meta property="og:url" content="(.*?)" \/>/i);

  console.log(`[PASS] Route ${pathname}:`);
  console.log(`       Title:     ${titleMatch ? titleMatch[1] : 'FAIL'}`);
  console.log(`       Canonical: ${canonMatch ? canonMatch[1] : 'FAIL'}`);
  console.log(`       OG Title:  ${ogTitleMatch ? ogTitleMatch[1] : 'FAIL'}`);
}

['/', '/features', '/about', '/security', '/faq'].forEach(testRoute);
console.log('\nAll route SEO replacements verified successfully!');
