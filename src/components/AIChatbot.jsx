import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "./AIChatbot.css";

const STORAGE_KEY = "ai_chat_history_v1";
const WELCOME_MSG = {
  role: "assistant",
  content:
    "Hi! 👋 I'm your AI tutor. Ask me anything about your courses, lessons, upcoming homework, or any concept you'd like explained.",
};

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [WELCOME_MSG];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
    return [WELCOME_MSG];
  } catch {
    return [WELCOME_MSG];
  }
}

function saveHistory(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  } catch {}
}

function renderMarkdown(text) {
  const parts = [];
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIdx = 0;
  let match;
  let key = 0;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(renderInline(text.slice(lastIdx, match.index), key++));
    }
    parts.push(
      <pre key={key++} className="ai-code">
        <code>{match[2].trim()}</code>
      </pre>
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(renderInline(text.slice(lastIdx), key++));
  }
  return parts;
}

function renderInline(text, baseKey) {

  return text.split("\n").map((line, i) => {
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
      if (tok.startsWith("```")) {
        segments.push(tok);
      } else if (tok.startsWith("`")) {
        segments.push(<code key={`c${segKey++}`} className="ai-inline-code">{tok.slice(1, -1)}</code>);
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
        {i < text.split("\n").length - 1 && <br />}
      </span>
    );
  });
}

export default function AIChatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, messages]);

  if (!user || user.role !== "student") return null;

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setError(null);
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
      const msg = err?.response?.data?.detail || "Failed to reach the AI tutor. Try again.";
      setError(msg);
      setMessages([...next, { role: "assistant", content: `⚠️ ${msg}`, error: true }]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearHistory = () => {
    setMessages([WELCOME_MSG]);
  };

  return (
    <>
            <motion.button
        className={`ai-fab ${open ? "ai-fab-open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close AI tutor" : "Open AI tutor"}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", damping: 14 }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.svg
              key="close"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </motion.svg>
          ) : (
            <motion.div
              key="ai"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: "flex" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v2" />
                <path d="M9 7a3 3 0 0 1 6 0v1H9V7z" />
                <rect x="4" y="8" width="16" height="12" rx="3" />
                <circle cx="9" cy="14" r="1" fill="currentColor" />
                <circle cx="15" cy="14" r="1" fill="currentColor" />
                <path d="M9 17h6" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
        {!open && <span className="ai-fab-pulse" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="ai-panel"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
          >
            <div className="ai-panel-head">
              <div className="ai-head-info">
                <div className="ai-avatar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="8" width="16" height="12" rx="3" />
                    <circle cx="9" cy="14" r="1" fill="currentColor" />
                    <circle cx="15" cy="14" r="1" fill="currentColor" />
                    <path d="M9 17h6" />
                    <path d="M12 2v2" />
                    <path d="M9 7a3 3 0 0 1 6 0v1H9V7z" />
                  </svg>
                </div>
                <div>
                  <div className="ai-head-title">AI Tutor</div>
                  <div className="ai-head-sub">
                    <span className="ai-online-dot" />
                    Powered by Gemini
                  </div>
                </div>
              </div>
              <div className="ai-head-actions">
                <button className="ai-icon-btn" title="Clear chat" onClick={clearHistory}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
                <button className="ai-icon-btn" title="Close" onClick={() => setOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="ai-msgs" ref={scrollRef}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  className={`ai-msg ai-msg-${m.role} ${m.error ? "ai-msg-error" : ""}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {m.role === "assistant" && (
                    <div className="ai-msg-avatar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="8" width="16" height="12" rx="3" />
                        <circle cx="9" cy="14" r="1" fill="currentColor" />
                        <circle cx="15" cy="14" r="1" fill="currentColor" />
                      </svg>
                    </div>
                  )}
                  <div className="ai-msg-bubble">{renderMarkdown(m.content)}</div>
                </motion.div>
              ))}
              {sending && (
                <motion.div
                  className="ai-msg ai-msg-assistant"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="ai-msg-avatar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="8" width="16" height="12" rx="3" />
                      <circle cx="9" cy="14" r="1" fill="currentColor" />
                      <circle cx="15" cy="14" r="1" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="ai-msg-bubble ai-typing">
                    <span /><span /><span />
                  </div>
                </motion.div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="ai-suggestions">
                {[
                  "What homework is due next?",
                  "Explain my latest lesson",
                  "How is my attendance?",
                ].map((s) => (
                  <button key={s} className="ai-suggestion" onClick={() => setInput(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="ai-input-row">
              <textarea
                ref={inputRef}
                className="ai-input"
                placeholder="Ask anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                disabled={sending}
              />
              <button
                className="ai-send-btn"
                onClick={send}
                disabled={sending || !input.trim()}
                title="Send"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
