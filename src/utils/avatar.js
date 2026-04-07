export function getAvatarUrl(profile) {
  const raw = profile?.avatar || profile?.default_avatar || null;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.pathname.startsWith("/media/")) return url.pathname;
  } catch {
  }
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
