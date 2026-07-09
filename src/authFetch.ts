// SECURITY FIX (2026-07-09): every /api/* route now requires authentication
// (see server.ts). Previously the frontend never sent any credential for
// human users at all — there was nothing to send, since login just
// returned the user object with no token. Login and Google SSO now return
// a `session_token` alongside the user record, and App.tsx already stores
// the full login response under localStorage['roots_logged_in_user']
// unchanged. This file's only job is reading that token back out and
// attaching it as `Authorization: Bearer <token>` to every same-origin
// /api/ request, so the ~20 existing fetch() call sites scattered through
// App.tsx don't each need to be touched individually.
const ORIGINAL_FETCH = window.fetch.bind(window);

function getStoredSessionToken(): string | null {
  try {
    const raw = localStorage.getItem("roots_logged_in_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.session_token ?? null;
  } catch {
    return null;
  }
}

function isApiPath(input: RequestInfo | URL): boolean {
  let raw: string;
  if (typeof input === "string") raw = input;
  else if (input instanceof URL) raw = input.pathname;
  else raw = (input as Request).url;

  try {
    return new URL(raw, window.location.origin).pathname.startsWith("/api/");
  } catch {
    return raw.startsWith("/api/");
  }
}

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const token = getStoredSessionToken();
  if (token && isApiPath(input)) {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    headers.set("Authorization", `Bearer ${token}`);
    init = { ...init, headers };
  }
  return ORIGINAL_FETCH(input, init);
};
