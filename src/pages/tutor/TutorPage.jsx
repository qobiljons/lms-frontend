import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import PageTransition from "../../components/PageTransition";
import "./Tutor.css";

const STORAGE_KEY = "tutor_ai_history_v1";

const WELCOME_MSG = {
  role: "assistant",
  content:
    "Hi! 👋 I'm your **Tutor AI** — here to help you learn.\n\nI know about your courses, lessons, and assignments. Ask me to:\n\n- Explain a concept from any of your lessons\n- Help with homework (without giving you the answer!)\n- Quiz you on a topic\n- Plan study time around your deadlines\n- Break down a hard idea step-by-step\n\nWhat would you like to learn today?",
};

const PROMPT_CATEGORIES = [
  {
    title: "Study Help",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    color: "#3b82f6",
    prompts: [
      "Explain my latest lesson in simple terms",
      "Quiz me on the key concepts from this week",
      "Summarize the main ideas of my current course",
    ],
  },
  {
    title: "Homework",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    color: "#f59e0b",
    prompts: [
      "What homework is due soonest?",
      "Help me plan my upcoming assignments",
      "Give me hints (not answers) for my hardest assignment",
    ],
  },
  {
    title: "My Progress",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    color: "#16a34a",
    prompts: [
      "How am I doing overall?",
      "What's my attendance like?",
      "Where can I improve?",
    ],
  },
  {
    title: "Concepts",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    color: "#8b5cf6",
    prompts: [
      "Explain a programming concept with examples",
      "What's the difference between X and Y?",
      "Walk me through a real-world example",
    ],
  },
];

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [WELCOME_MSG];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : [WELCOME_MSG];
  } catch {
    return [WELCOME_MSG];
  }
}

function saveHistory(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60)));
  } catch {}
}

function renderInline(text, baseKey) {
  return text.split("\n").map((line, i, arr) => {
    const segments = [];
    let remain = line;
    let segKey = 0;
    const tokenRe = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/;
    while (remain) {
      const m = remain.match(tokenRe);
      if (!m) {
        segments.push(remain);
        break;
      }
      if (m.index > 0) segments.push(remain.slice(0, m.index));
      const tok = m[0];
      if (tok.startsWith("`")) {
        segments.push(<code key={`c${segKey++}`} className="t-inline-code">{tok.slice(1, -1)}</code>);
      } else if (tok.startsWith("**")) {
        segments.push(<strong key={`b${segKey++}`}>{tok.slice(2, -2)}</strong>);
      } else if (tok.startsWith("*")) {
        segments.push(<em key={`i${segKey++}`}>{tok.slice(1, -1)}</em>);
      } else if (tok.startsWith("[")) {
        const lm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (lm) segments.push(<a key={`a${segKey++}`} href={lm[2]} target="_blank" rel="noopener noreferrer">{lm[1]}</a>);
      }
      remain = remain.slice(m.index + tok.length);
    }
    return (
      <span key={`${baseKey}-${i}`}>
        {segments}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

function renderMarkdown(text) {
  const parts = [];
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIdx = 0;
  let match;
  let key = 0;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(renderInline(text.slice(lastIdx, match.index), key++));
    parts.push(
      <pre key={key++} className="t-code">
        {match[1] && <span className="t-code-lang">{match[1]}</span>}
        <code>{match[2].trim()}</code>
      </pre>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(renderInline(text.slice(lastIdx), key++));
  return parts;
}

export default function TutorPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { saveHistory(messages); }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const send = async (overrideText) => {
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed || sending) return;
    const next = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const apiMessages = next
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role === "assistant" ? "model" : "user", content: m.content }));
      const { data } = await api.post("/auth/ai/chat/", { messages: apiMessages });
      setMessages([...next, { role: "assistant", content: data.reply || "(no reply)" }]);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to reach Tutor AI. Try again.";
      setMessages([...next, { role: "assistant", content: `⚠️ ${msg}`, error: true }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handlePromptClick = (prompt) => {
    send(prompt);
  };

  const newConversation = () => {
    if (!confirm("Start a new conversation? Your current chat will be cleared.")) return;
    setMessages([WELCOME_MSG]);
    setInput("");
    inputRef.current?.focus();
  };

  const messageCount = messages.filter(m => m.role === "user" || m.role === "assistant").length;

  return (
    <PageTransition>
      <div className="tutor-page">
                <div className="tutor-header">
          <div className="tutor-header-left">
            <button
              className="tutor-sidebar-toggle"
              onClick={() => setShowSidebar(!showSidebar)}
              title={showSidebar ? "Hide topics" : "Show topics"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showSidebar ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>}
              </svg>
            </button>
            <div className="tutor-brand">
              <div className="tutor-brand-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v2" />
                  <path d="M9 7a3 3 0 0 1 6 0v1H9V7z" />
                  <rect x="4" y="8" width="16" height="12" rx="3" />
                  <circle cx="9" cy="14" r="1" fill="currentColor" />
                  <circle cx="15" cy="14" r="1" fill="currentColor" />
                  <path d="M9 17h6" />
                </svg>
              </div>
              <div>
                <h1 className="tutor-title">Tutor AI</h1>
                <span className="tutor-subtitle">
                  <span className="tutor-online-dot" />
                  Personalized for {user?.first_name || user?.username}
                </span>
              </div>
            </div>
          </div>
          <button className="tutor-new-btn" onClick={newConversation} disabled={messageCount <= 1}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Chat
          </button>
        </div>

        <div className="tutor-body">
                    <AnimatePresence>
            {showSidebar && (
              <motion.aside
                className="tutor-sidebar"
                initial={{ x: -20, opacity: 0, width: 0 }}
                animate={{ x: 0, opacity: 1, width: 280 }}
                exit={{ x: -20, opacity: 0, width: 0 }}
                transition={{ duration: 0.22 }}
              >
                <div className="tutor-sidebar-inner">
                  <div className="tutor-sidebar-section">
                    <h3 className="tutor-sidebar-heading">Quick Prompts</h3>
                    {PROMPT_CATEGORIES.map((cat) => (
                      <div key={cat.title} className="tutor-cat">
                        <div className="tutor-cat-head" style={{ color: cat.color }}>
                          {cat.icon}
                          <span>{cat.title}</span>
                        </div>
                        {cat.prompts.map((p) => (
                          <button
                            key={p}
                            className="tutor-prompt"
                            onClick={() => handlePromptClick(p)}
                            disabled={sending}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="tutor-sidebar-tip">
                    <strong>💡 Tip:</strong> Tutor AI knows about your courses, lessons, and assignments. Ask it specific questions about your learning!
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

                    <main className="tutor-main">
            <div className="tutor-msgs" ref={scrollRef}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  className={`tutor-msg tutor-msg-${m.role} ${m.error ? "tutor-msg-error" : ""}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={`tutor-msg-avatar ${m.role === "user" ? "tutor-msg-avatar-user" : ""}`}>
                    {m.role === "user" ? (
                      (user?.first_name?.[0] || user?.username?.[0] || "S").toUpperCase()
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="8" width="16" height="12" rx="3" />
                        <circle cx="9" cy="14" r="1" fill="currentColor" />
                        <circle cx="15" cy="14" r="1" fill="currentColor" />
                        <path d="M9 17h6" />
                        <path d="M12 2v2" />
                        <path d="M9 7a3 3 0 0 1 6 0v1H9V7z" />
                      </svg>
                    )}
                  </div>
                  <div className="tutor-msg-content">
                    <div className="tutor-msg-name">
                      {m.role === "user" ? (user?.first_name || user?.username || "You") : "Tutor AI"}
                    </div>
                    <div className="tutor-msg-bubble">{renderMarkdown(m.content)}</div>
                  </div>
                </motion.div>
              ))}
              {sending && (
                <motion.div
                  className="tutor-msg tutor-msg-assistant"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="tutor-msg-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="8" width="16" height="12" rx="3" />
                      <circle cx="9" cy="14" r="1" fill="currentColor" />
                      <circle cx="15" cy="14" r="1" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="tutor-msg-content">
                    <div className="tutor-msg-name">Tutor AI</div>
                    <div className="tutor-msg-bubble tutor-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <form
              className="tutor-input-wrap"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <div className="tutor-input-row">
                <textarea
                  ref={(el) => { inputRef.current = el; taRef.current = el; }}
                  className="tutor-input"
                  placeholder="Ask anything... (Shift+Enter for newline)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={sending}
                  rows={1}
                />
                <button
                  type="submit"
                  className="tutor-send-btn"
                  disabled={sending || !input.trim()}
                  title="Send (Enter)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <div className="tutor-input-hint">
                Tutor AI is powered by Gemini · It can make mistakes — verify important information
              </div>
            </form>
          </main>
        </div>
      </div>
    </PageTransition>
  );
}
