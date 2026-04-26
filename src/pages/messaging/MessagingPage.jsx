import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useUnreadMessages } from "../../context/UnreadMessagesContext";
import PageTransition from "../../components/PageTransition";
import "./Messaging.css";


function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function normalizeMessage(raw) {
  const senderId = raw.sender_id ?? raw.sender?.id ?? raw.sender ?? null;
  const senderUsername =
    raw.sender_username ??
    raw.sender_detail?.username ??
    raw.sender?.username ??
    "Unknown";
  const senderFirst =
    raw.sender_detail?.first_name ?? raw.sender?.first_name ?? "";
  const senderLast =
    raw.sender_detail?.last_name ?? raw.sender?.last_name ?? "";
  return {
    id: raw.id ?? `${senderId}-${raw.created_at}-${raw.body}`,
    senderId,
    senderUsername,
    senderName: `${senderFirst} ${senderLast}`.trim() || senderUsername,
    body: raw.body || "",
    createdAt: raw.created_at,
    isRead: raw.is_read,
  };
}

function upsertById(items, nextItem) {
  if (!nextItem?.id) return items;
  if (items.some((item) => item.id === nextItem.id)) return items;
  return [...items, nextItem];
}

function getWsBaseUrl() {
  const fromEnv = import.meta.env.VITE_WS_BASE_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, "");
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}`;
}

function buildWsUrl(path, token) {
  const base = getWsBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}?token=${encodeURIComponent(token)}`;
}


/* ─────────────────────────────────────────
   PRESENTATIONAL COMPONENTS
   ───────────────────────────────────────── */

const AVATAR_COLORS = [
  ["#6366f1", "#8b5cf6"], ["#16a34a", "#059669"], ["#f59e0b", "#d97706"],
  ["#ef4444", "#dc2626"], ["#06b6d4", "#0891b2"], ["#ec4899", "#db2777"],
  ["#3b82f6", "#2563eb"], ["#14b8a6", "#0d9488"], ["#f97316", "#ea580c"],
];

function avatarColorForKey(key) {
  if (!key) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function Avatar({ name, username, size = 40, isGroup = false }) {
  const key = username || name || "";
  const [c1, c2] = avatarColorForKey(key);
  return (
    <div
      className={`msg-avatar ${isGroup ? "msg-avatar-group" : ""}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        fontSize: size * 0.38,
      }}
    >
      {isGroup ? (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-4-4h-4"/><circle cx="17" cy="7" r="3"/>
        </svg>
      ) : (
        getInitials(name || username)
      )}
    </div>
  );
}


function formatLastSeen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = diffMs / 60000;
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${Math.floor(diffMin)}m`;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDayLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  const diffDays = (today - d) / 86400000;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}


function ConversationRow({ kind, name, secondary, lastMessage, time, unread, active, onClick }) {
  return (
    <button className={`conv-row ${active ? "active" : ""}`} onClick={onClick}>
      <Avatar name={name} username={kind === "group" ? null : name} size={46} isGroup={kind === "group"} />
      <div className="conv-row-body">
        <div className="conv-row-top">
          <span className="conv-row-name">{name}</span>
          {time && <span className="conv-row-time">{formatLastSeen(time)}</span>}
        </div>
        <div className="conv-row-bottom">
          <span className="conv-row-preview">{lastMessage || secondary || (kind === "group" ? "No messages yet" : "Start a conversation")}</span>
          {unread > 0 && <span className="conv-unread">{unread > 99 ? "99+" : unread}</span>}
        </div>
      </div>
    </button>
  );
}


function MessageBubble({ message, mine, showAvatar, isLast, isGroup, isLastMine }) {
  return (
    <motion.div
      className={`msg-row ${mine ? "msg-row-mine" : ""}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      {!mine && (
        <div className="msg-row-avatar">
          {showAvatar ? <Avatar name={message.senderName} username={message.senderUsername} size={28} /> : <div style={{ width: 28 }} />}
        </div>
      )}
      <div className={`msg-bubble ${mine ? "msg-bubble-mine" : ""} ${isLast ? "msg-bubble-last" : ""}`}>
        {!mine && isGroup && showAvatar && (
          <div className="msg-bubble-sender">{message.senderName}</div>
        )}
        <div className="msg-bubble-body">{message.body}</div>
        <div className="msg-bubble-foot">
          <span className="msg-bubble-time">{formatMessageTime(message.createdAt)}</span>
          {mine && !isGroup && (
            <span className={`msg-tick ${message.isRead ? "read" : ""}`}>
              {message.isRead ? (
                <svg width="14" height="11" viewBox="0 0 18 14" fill="none">
                  <path d="M1 7L5 11L11 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 11L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M1 7L5 11L13 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}


function DaySeparator({ iso }) {
  return (
    <div className="msg-day-sep">
      <span>{formatDayLabel(iso)}</span>
    </div>
  );
}


function TypingIndicator() {
  return (
    <motion.div className="msg-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="msg-row-avatar"><div style={{ width: 28 }} /></div>
      <div className="msg-bubble msg-typing">
        <span /><span /><span />
      </div>
    </motion.div>
  );
}


/* ─────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────── */

export default function MessagingPage() {
  const { user } = useAuth();
  const { refreshUnreadCount } = useUnreadMessages();
  const socketRef = useRef(null);
  const messageEndRef = useRef(null);
  const composeRef = useRef(null);

  const [mode, setMode] = useState("direct");
  const [filterTab, setFilterTab] = useState("all");
  const [directConversations, setDirectConversations] = useState([]);
  const [groupConversations, setGroupConversations] = useState([]);
  const [reachableUsers, setReachableUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDirectUser, setSelectedDirectUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [socketState, setSocketState] = useState("disconnected");
  const [typing, setTyping] = useState(false);
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);

  const closeSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  const loadDirectConversations = useCallback(async () => {
    const { data } = await api.get("/messages/direct/conversations/?page_size=100");
    setDirectConversations(normalizeList(data));
  }, []);

  const loadGroupConversations = useCallback(async () => {
    const { data } = await api.get("/messages/groups/?page_size=100");
    setGroupConversations(normalizeList(data));
  }, []);

  const loadReachableUsers = useCallback(async (query = "") => {
    const suffix = query ? `?search=${encodeURIComponent(query)}` : "";
    const { data } = await api.get(`/messages/users/${suffix}`);
    setReachableUsers(normalizeList(data));
  }, []);

  const loadDirectMessages = useCallback(async (targetUserId) => {
    if (!targetUserId) return;
    setLoadingMessages(true);
    try {
      const { data } = await api.get(`/messages/direct/${targetUserId}/`);
      setMessages((data || []).map(normalizeMessage));
    } catch {
      toast.error("Failed to load direct messages.");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const loadGroupMessages = useCallback(async (groupId) => {
    if (!groupId) return;
    setLoadingMessages(true);
    try {
      const { data } = await api.get(`/messages/groups/${groupId}/`);
      setMessages((data || []).map(normalizeMessage));
    } catch {
      toast.error("Failed to load group messages.");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const bootstrapData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadDirectConversations(), loadGroupConversations(), loadReachableUsers()]);
    } catch {
      toast.error("Failed to load messaging data.");
    } finally {
      setLoading(false);
    }
  }, [loadDirectConversations, loadGroupConversations, loadReachableUsers]);

  useEffect(() => { bootstrapData(); }, [bootstrapData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadReachableUsers(searchTerm).catch(() => {});
    }, 220);
    return () => clearTimeout(timer);
  }, [searchTerm, loadReachableUsers]);

  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {}
  }, []);

  const handleIncomingMessage = useCallback(
    (payload) => {
      const normalized = normalizeMessage(payload);
      const isMyMessage = normalized.senderId === user?.id;

      setMessages((prev) => upsertById(prev, normalized));
      loadDirectConversations().catch(() => {});
      loadGroupConversations().catch(() => {});

      if (!isMyMessage) {
        setTyping(true);
        setTimeout(() => setTyping(false), 600);
        playNotificationSound();
        toast.info(`New message from ${normalized.senderName || normalized.senderUsername}`, {
          autoClose: 2000,
          position: "top-right",
          toastId: `msg-${normalized.id}`,
        });
        refreshUnreadCount();
      }
    },
    [loadDirectConversations, loadGroupConversations, user?.id, playNotificationSound, refreshUnreadCount]
  );

  useEffect(() => {
    closeSocket();
    setSocketState("disconnected");

    const tokens = JSON.parse(localStorage.getItem("tokens") || "{}");
    const access = tokens?.access;
    if (!access) return;

    let path = null;
    if (mode === "direct" && selectedDirectUser?.id) {
      path = `/ws/messages/direct/${selectedDirectUser.id}/`;
    }
    if (mode === "group" && selectedGroup?.group) {
      path = `/ws/messages/groups/${selectedGroup.group}/`;
    }
    if (!path) return;

    const wsUrl = buildWsUrl(path, access);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => setSocketState("connected");
    ws.onclose = () => setSocketState("disconnected");
    ws.onerror = () => setSocketState("error");
    ws.onmessage = (event) => {
      try {
        handleIncomingMessage(JSON.parse(event.data));
      } catch {}
    };

    return () => ws.close();
  }, [mode, selectedDirectUser, selectedGroup, handleIncomingMessage, closeSocket]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, typing]);

  const selectDirectUser = async (targetUser) => {
    setMode("direct");
    setSelectedDirectUser(targetUser);
    setSelectedGroup(null);
    setMessages([]);
    setShowSidebarMobile(false);
    await loadDirectMessages(targetUser.id);
    try {
      await api.post(`/messages/direct/${targetUser.id}/read/`);
      await loadDirectConversations();
      refreshUnreadCount();
    } catch {}
    setTimeout(() => composeRef.current?.focus(), 100);
  };

  const selectGroupConversation = async (conversation) => {
    setMode("group");
    setSelectedGroup(conversation);
    setSelectedDirectUser(null);
    setMessages([]);
    setShowSidebarMobile(false);
    await loadGroupMessages(conversation.group);
    try {
      await api.post(`/messages/groups/${conversation.group}/read/`);
      await loadGroupConversations();
      refreshUnreadCount();
    } catch {}
    setTimeout(() => composeRef.current?.focus(), 100);
  };

  const sendMessageFallback = async (text) => {
    if (mode === "direct" && selectedDirectUser?.id) {
      const { data } = await api.post(`/messages/direct/${selectedDirectUser.id}/`, { body: text });
      setMessages((prev) => upsertById(prev, normalizeMessage(data)));
      return;
    }
    if (mode === "group" && selectedGroup?.group) {
      const { data } = await api.post(`/messages/groups/${selectedGroup.group}/`, { body: text });
      setMessages((prev) => upsertById(prev, normalizeMessage(data)));
    }
  };

  const sendMessage = async () => {
    const text = messageText.trim();
    if (!text) return;
    if (mode === "direct" && !selectedDirectUser?.id) return;
    if (mode === "group" && !selectedGroup?.group) return;

    setMessageText("");
    const socket = socketRef.current;

    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ message: text }));
        return;
      } catch {}
    }

    try {
      await sendMessageFallback(text);
      await Promise.all([loadDirectConversations(), loadGroupConversations()]);
    } catch {
      toast.error("Failed to send message.");
    }
  };

  /* ─────────── COMBINED CONVERSATION LIST ─────────── */

  const allConversations = useMemo(() => {
    const items = [];

    directConversations.forEach((c) => {
      items.push({
        kind: "direct",
        id: `dm-${c.id}`,
        name: c.other_user?.first_name || c.other_user?.last_name
          ? `${c.other_user.first_name || ""} ${c.other_user.last_name || ""}`.trim()
          : c.other_user?.username || "Unknown",
        username: c.other_user?.username || "",
        lastMessage: c.last_message?.body || "",
        time: c.last_message?.created_at || c.updated_at,
        unread: c.unread_count || 0,
        raw: c,
      });
    });

    groupConversations.forEach((c) => {
      items.push({
        kind: "group",
        id: `g-${c.id}`,
        name: c.group_name || "Group",
        lastMessage: c.last_message?.body || "",
        time: c.last_message?.created_at || c.updated_at,
        unread: c.unread_count || 0,
        raw: c,
      });
    });

    items.sort((a, b) => {
      const at = a.time ? new Date(a.time).getTime() : 0;
      const bt = b.time ? new Date(b.time).getTime() : 0;
      return bt - at;
    });
    return items;
  }, [directConversations, groupConversations]);

  const filteredConversations = useMemo(() => {
    let list = allConversations;
    if (filterTab === "direct") list = list.filter((c) => c.kind === "direct");
    if (filterTab === "groups") list = list.filter((c) => c.kind === "group");
    if (filterTab === "unread") list = list.filter((c) => c.unread > 0);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.username || "").toLowerCase().includes(q) ||
          (c.lastMessage || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allConversations, filterTab, searchTerm]);

  const newChatUsers = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const existing = new Set(directConversations.map((c) => c.other_user?.id));
    return reachableUsers.filter((u) => !existing.has(u.id));
  }, [reachableUsers, directConversations, searchTerm]);

  const totalUnread = useMemo(
    () => allConversations.reduce((sum, c) => sum + (c.unread || 0), 0),
    [allConversations]
  );

  /* ─────────── DAY-GROUPED MESSAGE FEED ─────────── */

  const messageGroups = useMemo(() => {
    const groups = [];
    let currentDay = null;
    messages.forEach((msg) => {
      const d = msg.createdAt ? new Date(msg.createdAt).toDateString() : "";
      if (d !== currentDay) {
        groups.push({ kind: "day", iso: msg.createdAt, key: `day-${d}` });
        currentDay = d;
      }
      groups.push({ kind: "msg", message: msg, key: `m-${msg.id}` });
    });
    return groups;
  }, [messages]);

  /* ─────────── HEADER INFO FOR ACTIVE CHAT ─────────── */

  const activeHeader = useMemo(() => {
    if (mode === "direct" && selectedDirectUser) {
      const fullName = `${selectedDirectUser.first_name || ""} ${selectedDirectUser.last_name || ""}`.trim();
      return {
        title: fullName || selectedDirectUser.username,
        subtitle: socketState === "connected" ? "Online" : `@${selectedDirectUser.username}`,
        username: selectedDirectUser.username,
        isGroup: false,
        isOnline: socketState === "connected",
      };
    }
    if (mode === "group" && selectedGroup) {
      return {
        title: selectedGroup.group_name || "Group",
        subtitle: socketState === "connected" ? "Live · group chat" : "Group chat",
        username: null,
        isGroup: true,
        isOnline: socketState === "connected",
      };
    }
    return null;
  }, [mode, selectedDirectUser, selectedGroup, socketState]);

  if (loading) {
    return (
      <PageTransition>
        <div className="msg-page">
          <div className="msg-loading">
            <div className="msg-spinner" />
            <p>Loading messages...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className={`msg-page ${showSidebarMobile ? "" : "msg-page-chat-active"}`}>
        {/* SIDEBAR */}
        <aside className="msg-sidebar">
          <div className="msg-sidebar-head">
            <div className="msg-sidebar-title-row">
              <h1 className="msg-sidebar-title">Messages</h1>
              {totalUnread > 0 && <span className="msg-total-unread">{totalUnread}</span>}
            </div>

            <div className="msg-search-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                type="text"
                placeholder="Search chats or people..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="msg-search-clear" onClick={() => setSearchTerm("")} aria-label="Clear">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            <div className="msg-filter-tabs">
              {[
                { id: "all", label: "All" },
                { id: "direct", label: "DMs" },
                { id: "groups", label: "Groups" },
                { id: "unread", label: "Unread", count: totalUnread },
              ].map((t) => (
                <button
                  key={t.id}
                  className={`msg-filter-tab ${filterTab === t.id ? "active" : ""}`}
                  onClick={() => setFilterTab(t.id)}
                >
                  {t.label}
                  {t.count > 0 && <span className="msg-filter-count">{t.count}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="msg-sidebar-list">
            {newChatUsers.length > 0 && (
              <>
                <div className="msg-list-heading">Start a new chat</div>
                {newChatUsers.map((person) => (
                  <ConversationRow
                    key={`new-${person.id}`}
                    kind="direct"
                    name={person.first_name || person.last_name ? `${person.first_name || ""} ${person.last_name || ""}`.trim() : person.username}
                    secondary={`@${person.username} · ${person.role}`}
                    onClick={() => selectDirectUser(person)}
                  />
                ))}
                <div className="msg-list-heading">Conversations</div>
              </>
            )}

            {filteredConversations.length === 0 ? (
              <div className="msg-list-empty">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <p>{searchTerm ? "Nothing matches" : "No conversations yet"}</p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive =
                  (c.kind === "direct" && selectedDirectUser?.id === c.raw.other_user?.id) ||
                  (c.kind === "group" && selectedGroup?.id === c.raw.id);
                return (
                  <ConversationRow
                    key={c.id}
                    kind={c.kind}
                    name={c.name}
                    lastMessage={c.lastMessage}
                    time={c.time}
                    unread={c.unread}
                    active={isActive}
                    onClick={() => c.kind === "direct" ? selectDirectUser(c.raw.other_user) : selectGroupConversation(c.raw)}
                  />
                );
              })
            )}
          </div>
        </aside>

        {/* CHAT PANE */}
        <section className="msg-chat">
          {!activeHeader ? (
            <div className="msg-empty-chat">
              <div className="msg-empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h2>Select a conversation</h2>
              <p>Pick a chat from the left to start messaging.</p>
            </div>
          ) : (
            <>
              <header className="msg-chat-head">
                <button className="msg-back-btn" onClick={() => setShowSidebarMobile(true)} aria-label="Back">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <Avatar name={activeHeader.title} username={activeHeader.username} size={42} isGroup={activeHeader.isGroup} />
                <div className="msg-chat-info">
                  <div className="msg-chat-name">{activeHeader.title}</div>
                  <div className="msg-chat-status">
                    {activeHeader.isOnline && !activeHeader.isGroup && <span className="msg-online-dot" />}
                    {activeHeader.subtitle}
                  </div>
                </div>
                <span className={`msg-conn ${socketState}`}>
                  <span className="msg-conn-dot" />
                  {socketState === "connected" ? "Live" : socketState === "error" ? "Offline" : "Connecting"}
                </span>
              </header>

              <div className="msg-thread">
                {loadingMessages ? (
                  <div className="msg-thread-loading">
                    <div className="msg-spinner" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="msg-thread-empty">
                    <Avatar name={activeHeader.title} username={activeHeader.username} size={64} isGroup={activeHeader.isGroup} />
                    <h3>{activeHeader.title}</h3>
                    <p>No messages yet — say hello! 👋</p>
                  </div>
                ) : (
                  <>
                    {messageGroups.map((g, idx) => {
                      if (g.kind === "day") return <DaySeparator key={g.key} iso={g.iso} />;
                      const m = g.message;
                      const mine = m.senderId === user?.id;
                      const next = messageGroups[idx + 1];
                      const sameSenderNext = next?.kind === "msg" && next.message.senderId === m.senderId;
                      const isLast = !sameSenderNext;
                      const prev = messageGroups[idx - 1];
                      const showAvatar = !mine && (prev?.kind !== "msg" || prev.message.senderId !== m.senderId);
                      return (
                        <MessageBubble
                          key={g.key}
                          message={m}
                          mine={mine}
                          showAvatar={showAvatar}
                          isLast={isLast}
                          isGroup={mode === "group"}
                          isLastMine={mine && isLast}
                        />
                      );
                    })}
                    <AnimatePresence>
                      {typing && <TypingIndicator key="typing" />}
                    </AnimatePresence>
                  </>
                )}
                <div ref={messageEndRef} />
              </div>

              <form
                className="msg-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <button type="button" className="msg-compose-icon" title="Emoji" tabIndex={-1}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                <input
                  ref={composeRef}
                  type="text"
                  placeholder={`Message ${activeHeader.title}...`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  type="submit"
                  className="msg-send"
                  disabled={!messageText.trim()}
                  aria-label="Send"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
