import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  return {
    id: raw.id ?? `${senderId}-${raw.created_at}-${raw.body}`,
    senderId,
    senderUsername,
    body: raw.body || "",
    createdAt: raw.created_at,
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

export default function MessagingPage() {
  const { user } = useAuth();
  const { refreshUnreadCount } = useUnreadMessages();
  const socketRef = useRef(null);
  const messageEndRef = useRef(null);

  const [mode, setMode] = useState("direct");
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

  const selectedTargetLabel = useMemo(() => {
    if (mode === "direct") return selectedDirectUser?.username || "Select a user";
    return selectedGroup?.group_name || "Select a group";
  }, [mode, selectedDirectUser, selectedGroup]);

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
      await Promise.all([
        loadDirectConversations(),
        loadGroupConversations(),
        loadReachableUsers(),
      ]);
    } catch {
      toast.error("Failed to load messaging data.");
    } finally {
      setLoading(false);
    }
  }, [loadDirectConversations, loadGroupConversations, loadReachableUsers]);

  useEffect(() => {
    bootstrapData();
  }, [bootstrapData]);

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
      oscillator.type = 'sine';
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
        playNotificationSound();
        toast.info(`New message from ${normalized.senderUsername}`, {
          autoClose: 2000,
          position: 'top-right',
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
    if (!access) {
      console.warn("No access token found for WebSocket");
      return;
    }

    let path = null;
    if (mode === "direct" && selectedDirectUser?.id) {
      path = `/ws/messages/direct/${selectedDirectUser.id}/`;
    }
    if (mode === "group" && selectedGroup?.group) {
      path = `/ws/messages/groups/${selectedGroup.group}/`;
    }
    if (!path) return;

    const wsUrl = buildWsUrl(path, access);
    console.log("🔌 Connecting WebSocket:", wsUrl);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      setSocketState("connected");
    };

    ws.onclose = (event) => {
      console.log("🔴 WebSocket closed", event.code, event.reason);
      setSocketState("disconnected");
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      setSocketState("error");
    };

    ws.onmessage = (event) => {
      console.log("📨 WebSocket message received:", event.data);
      try {
        const payload = JSON.parse(event.data);
        handleIncomingMessage(payload);
      } catch (parseError) {
        console.error("Failed to parse WebSocket message:", parseError);
      }
    };

    return () => {
      console.log("🔌 Closing WebSocket");
      ws.close();
    };
  }, [mode, selectedDirectUser, selectedGroup, handleIncomingMessage, closeSocket]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const selectDirectUser = async (targetUser) => {
    setMode("direct");
    setSelectedDirectUser(targetUser);
    setSelectedGroup(null);
    setMessages([]);
    await loadDirectMessages(targetUser.id);

    try {
      await api.post(`/messages/direct/${targetUser.id}/read/`);
      await loadDirectConversations();
      refreshUnreadCount();
    } catch (error) {}
  };
  const selectGroupConversation = async (conversation) => {
    setMode("group");
    setSelectedGroup(conversation);
    setSelectedDirectUser(null);
    setMessages([]);
    await loadGroupMessages(conversation.group);

    try {
      await api.post(`/messages/groups/${conversation.group}/read/`);
      await loadGroupConversations();
      refreshUnreadCount();
    } catch (error) {}
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

    console.log("📤 Sending message:", { text, socketState: socket?.readyState });

    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        console.log("📡 Sending via WebSocket");
        socket.send(JSON.stringify({ message: text }));
        return;
      } catch (socketError) {
        console.error("WebSocket send failed:", socketError);
      }
    }

    console.log("📮 Sending via API (fallback)");
    try {
      await sendMessageFallback(text);
      await Promise.all([loadDirectConversations(), loadGroupConversations()]);
      console.log("✅ Message sent via API");
    } catch (error) {
      console.error("❌ API send failed:", error);
      toast.error("Failed to send message.");
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="messages-page">
          <div className="messages-loading">Loading messaging...</div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="messages-page">
        <div className="messages-header">
          <div>
            <h1>Messages</h1>
            <p>Real-time direct and group messaging.</p>
          </div>
          <span className={`messages-socket ${socketState}`}>
            {socketState === "connected" ? "Live" : "Offline"}
          </span>
        </div>

        <div className="messages-layout">
          <aside className="messages-sidebar">
            <div className="messages-tabs">
              <button
                className={`messages-tab ${mode === "direct" ? "active" : ""}`}
                onClick={() => setMode("direct")}
              >
                Direct
              </button>
              <button
                className={`messages-tab ${mode === "group" ? "active" : ""}`}
                onClick={() => setMode("group")}
              >
                Groups
              </button>
            </div>

            {mode === "direct" ? (
              <>
                <div className="messages-search-box">
                  <input
                    type="text"
                    placeholder="Find anyone by name"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <div className="messages-sidebar-scroll">
                  <div className="messages-section-label">Start new chat</div>
                  <div className="messages-list">
                    {reachableUsers.map((person) => (
                      <button
                        key={`reachable-${person.id}`}
                        className={`messages-item ${
                          selectedDirectUser?.id === person.id ? "active" : ""
                        }`}
                        onClick={() => selectDirectUser(person)}
                      >
                        <span>{person.username}</span>
                        <small>{person.role}</small>
                      </button>
                    ))}
                  </div>

                  <div className="messages-section-label">Recent chats</div>
                  <div className="messages-list">
                    {directConversations.map((conversation) => (
                      <button
                        key={`direct-${conversation.id}`}
                        className={`messages-item ${
                          selectedDirectUser?.id === conversation.other_user?.id ? "active" : ""
                        }`}
                        onClick={() => selectDirectUser(conversation.other_user)}
                      >
                        <div className="messages-item-content">
                          <span>{conversation.other_user?.username || "Unknown"}</span>
                          <small>{conversation.last_message?.body || "No messages yet"}</small>
                        </div>
                        {conversation.unread_count > 0 && (
                          <span className="messages-unread-badge">{conversation.unread_count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="messages-list group-only">
                {groupConversations.map((conversation) => (
                  <button
                    key={`group-${conversation.id}`}
                    className={`messages-item ${
                      selectedGroup?.id === conversation.id ? "active" : ""
                    }`}
                    onClick={() => selectGroupConversation(conversation)}
                  >
                    <div className="messages-item-content">
                      <span>{conversation.group_name}</span>
                      <small>{conversation.last_message?.body || "No messages yet"}</small>
                    </div>
                    {conversation.unread_count > 0 && (
                      <span className="messages-unread-badge">{conversation.unread_count}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="messages-chat">
            <div className="messages-chat-header">{selectedTargetLabel}</div>
            <div className="messages-thread">
              {loadingMessages ? (
                <div className="messages-empty">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="messages-empty">No messages yet. Start the conversation.</div>
              ) : (
                messages.map((message) => {
                  const mine = message.senderId === user?.id;
                  return (
                    <div key={message.id} className={`bubble-row ${mine ? "mine" : ""}`}>
                      <div className="bubble">
                        <div className="bubble-meta">
                          <strong>{message.senderUsername}</strong>
                          <span>{new Date(message.createdAt).toLocaleString()}</span>
                        </div>
                        <p>{message.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messageEndRef} />
            </div>

            <div className="messages-compose">
              <input
                type="text"
                placeholder="Write your message..."
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={
                  (mode === "direct" && !selectedDirectUser?.id) ||
                  (mode === "group" && !selectedGroup?.group)
                }
              />
              <button
                onClick={sendMessage}
                disabled={
                  !messageText.trim() ||
                  ((mode === "direct" && !selectedDirectUser?.id) ||
                    (mode === "group" && !selectedGroup?.group))
                }
              >
                Send
              </button>
            </div>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
