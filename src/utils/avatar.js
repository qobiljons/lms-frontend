const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export function getAvatarUrl(profile) {
  const raw = profile?.avatar || profile?.default_avatar || null;
  if (!raw || typeof raw !== "string") return null;

  if (/^https?:\/\//i.test(raw)) return raw;

  if (raw.startsWith("/")) return `${API_BASE}${raw}`;

  if (API_BASE) return `${API_BASE}/${raw}`;

  return raw;
}

export function avatarErrorHandler(profile) {
  return (e) => {
    const fallback = getAvatarUrl({ avatar: profile?.default_avatar });
    if (fallback && e.target.src !== fallback) {
      e.target.src = fallback;
      return;
    }
    e.currentTarget.removeAttribute("src");
  };
}
