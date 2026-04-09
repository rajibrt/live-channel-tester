const SESSION_TTL_MS = 1000 * 60 * 30;

function getStore() {
  if (!globalThis.__movieImportScanSessions) {
    globalThis.__movieImportScanSessions = new Map();
  }
  return globalThis.__movieImportScanSessions;
}

function touchSession(session) {
  if (!session) return;
  session.updatedAt = Date.now();
}

function scheduleCleanup(sessionId) {
  const store = getStore();
  const session = store.get(sessionId);
  if (!session) return;
  if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
  session.cleanupTimer = setTimeout(() => {
    const current = store.get(sessionId);
    if (!current) return;
    if (current.ended || Date.now() - Number(current.updatedAt || 0) >= SESSION_TTL_MS) {
      store.delete(sessionId);
    }
  }, SESSION_TTL_MS);
}

function resolveWaiters(session) {
  const waiters = Array.isArray(session?.resumeWaiters) ? session.resumeWaiters.splice(0) : [];
  for (const resolve of waiters) {
    try {
      resolve();
    } catch {
      // ignore waiter resolution failures
    }
  }
}

export function createMovieImportScanSession() {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const session = {
    id,
    paused: false,
    stopped: false,
    ended: false,
    updatedAt: Date.now(),
    resumeWaiters: [],
    cleanupTimer: null,
  };
  getStore().set(id, session);
  scheduleCleanup(id);
  return session;
}

export function getMovieImportScanSession(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) return null;
  const session = getStore().get(id) || null;
  if (session) touchSession(session);
  return session;
}

export function pauseMovieImportScanSession(sessionId) {
  const session = getMovieImportScanSession(sessionId);
  if (!session || session.ended || session.stopped) return null;
  session.paused = true;
  touchSession(session);
  scheduleCleanup(session.id);
  return session;
}

export function resumeMovieImportScanSession(sessionId) {
  const session = getMovieImportScanSession(sessionId);
  if (!session || session.ended || session.stopped) return null;
  session.paused = false;
  touchSession(session);
  resolveWaiters(session);
  scheduleCleanup(session.id);
  return session;
}

export function stopMovieImportScanSession(sessionId) {
  const session = getMovieImportScanSession(sessionId);
  if (!session || session.ended) return null;
  session.stopped = true;
  session.paused = false;
  touchSession(session);
  resolveWaiters(session);
  scheduleCleanup(session.id);
  return session;
}

export async function waitForMovieImportScanResume(session) {
  if (!session) return true;
  while (session.paused && !session.stopped && !session.ended) {
    await new Promise((resolve) => {
      session.resumeWaiters.push(resolve);
    });
  }
  touchSession(session);
  return !session.stopped && !session.ended;
}

export function finishMovieImportScanSession(sessionId) {
  const session = getMovieImportScanSession(sessionId);
  if (!session) return null;
  session.ended = true;
  session.paused = false;
  resolveWaiters(session);
  touchSession(session);
  scheduleCleanup(session.id);
  return session;
}
