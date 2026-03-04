function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeSeconds(value, max = 60 * 60 * 24 * 12) {
  const n = Math.floor(toFiniteNumber(value, 0));
  if (n <= 0) return 0;
  return Math.min(n, max);
}

export function computeProgressPercent(positionSeconds, durationSeconds) {
  const position = normalizeSeconds(positionSeconds);
  const duration = normalizeSeconds(durationSeconds);
  if (duration <= 0 || position <= 0) return 0;
  const raw = (position / duration) * 100;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped * 100) / 100;
}

export function isContinuePosition(positionSeconds) {
  return normalizeSeconds(positionSeconds) >= 30;
}

export function isWatchedProgress(progressPercent) {
  return toFiniteNumber(progressPercent, 0) >= 95;
}

export function normalizeMovieId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return 0;
  return id;
}

export function normalizeProgressInput(payload = {}) {
  const positionSeconds = normalizeSeconds(payload?.position_seconds);
  const durationSeconds = normalizeSeconds(payload?.duration_seconds);
  const progressPercent = computeProgressPercent(positionSeconds, durationSeconds);
  return {
    positionSeconds,
    durationSeconds,
    progressPercent,
    isCompleted: isWatchedProgress(progressPercent),
  };
}

export function deriveWatchState(progress = {}) {
  if (isWatchedProgress(progress?.progressPercent)) return "watched";
  if (isContinuePosition(progress?.positionSeconds)) return "continue";
  return "new";
}
