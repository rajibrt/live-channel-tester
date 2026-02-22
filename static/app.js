const form = document.getElementById("test-form");
const testBtn = document.getElementById("test-btn");
const pauseBtn = document.getElementById("pause-btn");
const stopBtn = document.getElementById("stop-btn");
const summaryPanel = document.getElementById("summary-panel");
const summaryText = document.getElementById("summary-text");
const normalDownloadLink = document.getElementById("download-normal-link");
const curatedDownloadLink = document.getElementById("download-curated-link");
const clearAllBtn = document.getElementById("clear-all-btn");
const progressPanel = document.getElementById("progress-panel");
const currentText = document.getElementById("current-text");
const counterText = document.getElementById("counter-text");
const liveBox = document.getElementById("live-box");
const deadBox = document.getElementById("dead-box");
const curatedBox = document.getElementById("curated-box");
const channelForm = document.getElementById("channel-form");
const metaStreamUrl = document.getElementById("meta-stream-url");
const metaName = document.getElementById("meta-name");
const metaCategory = document.getElementById("meta-category");
const metaLogoUrl = document.getElementById("meta-logo-url");
const metaMessage = document.getElementById("meta-message");
const selectedStreamText = document.getElementById("selected-stream-text");
const previewPlayer = document.getElementById("preview-player");
const mergeForm = document.getElementById("merge-form");
const mergeBtn = document.getElementById("merge-btn");
const mergeSummary = document.getElementById("merge-summary");
const mergeDownloadLink = document.getElementById("merge-download-link");
const backendMode = document.getElementById("backend-mode");
const agentBaseUrlInput = document.getElementById("agent-base-url");
const playlistFileInput = document.getElementById("playlist");
const playlistUrlInput = document.getElementById("playlist-url");
const publishForm = document.getElementById("publish-form");
const publishBtn = document.getElementById("publish-btn");
const publishSlug = document.getElementById("publish-slug");
const publishName = document.getElementById("publish-name");
const publishProvider = document.getElementById("publish-provider");
const publishAllLive = document.getElementById("publish-all-live");
const mergeWithExisting = document.getElementById("merge-with-existing");
const mergeTargetPlaylist = document.getElementById("merge-target-playlist");
const refreshPlaylistsBtn = document.getElementById("refresh-playlists-btn");
const autoPublishAfterTest = document.getElementById("auto-publish-after-test");
const publishSummary = document.getElementById("publish-summary");
const publishDuplicates = document.getElementById("publish-duplicates");
const publishLink = document.getElementById("publish-link");

const STORAGE_KEY = "m3u_checker_state_v1";
const COOKIE_PREFIX = "m3u_checker_state_";
const COOKIE_MAX_CHUNKS = 16;
const COOKIE_CHUNK_SIZE = 3400;

let currentJobId = null;
let runController = null;
let runPaused = false;
let runInProgress = false;

function initialState() {
  return {
    jobId: null,
    total: 0,
    liveCount: 0,
    deadCount: 0,
    summary: "",
    current: "Waiting to start...",
    counter: "",
    normalDownloadUrl: "",
    curatedDownloadUrl: "",
    liveItems: [],
    deadItems: [],
    curatedItems: [],
    selectedStream: null,
    backendMode: "builtin",
    agentBaseUrl: "http://127.0.0.1:8787",
    publishSlug: "",
    publishName: "",
    publishProvider: "supabase",
    publishAllLive: true,
    mergeWithExisting: true,
    mergeTargetSlug: "",
    availablePlaylists: [],
    autoPublishAfterTest: false,
    publishedUrl: "",
    publishSummary: "",
    duplicateUrls: [],
    completed: false,
    updatedAt: Date.now(),
  };
}

let state = initialState();

function setCookie(name, value, maxAgeSeconds = 60 * 60 * 24 * 30) {
  document.cookie = `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

function getCookie(name) {
  const parts = document.cookie.split(";").map((x) => x.trim());
  const key = `${name}=`;
  for (const p of parts) {
    if (p.startsWith(key)) {
      return p.slice(key.length);
    }
  }
  return null;
}

function clearCookieState() {
  setCookie(`${COOKIE_PREFIX}count`, "", 0);
  for (let i = 0; i < COOKIE_MAX_CHUNKS; i += 1) {
    setCookie(`${COOKIE_PREFIX}${i}`, "", 0);
  }
}

function saveStateToCookie(raw) {
  clearCookieState();
  const chunks = Math.ceil(raw.length / COOKIE_CHUNK_SIZE);
  if (chunks > COOKIE_MAX_CHUNKS) {
    return;
  }
  setCookie(`${COOKIE_PREFIX}count`, String(chunks));
  for (let i = 0; i < chunks; i += 1) {
    const part = raw.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE);
    setCookie(`${COOKIE_PREFIX}${i}`, encodeURIComponent(part));
  }
}

function loadStateFromCookie() {
  const countRaw = getCookie(`${COOKIE_PREFIX}count`);
  if (!countRaw) {
    return null;
  }
  const count = Number(countRaw);
  if (!Number.isInteger(count) || count < 1 || count > COOKIE_MAX_CHUNKS) {
    return null;
  }
  let joined = "";
  for (let i = 0; i < count; i += 1) {
    const part = getCookie(`${COOKIE_PREFIX}${i}`);
    if (!part) {
      return null;
    }
    joined += decodeURIComponent(part);
  }
  return joined;
}

function persistState() {
  state.updatedAt = Date.now();
  const raw = JSON.stringify(state);
  localStorage.setItem(STORAGE_KEY, raw);
  saveStateToCookie(raw);
}

function clearPersistedState() {
  localStorage.removeItem(STORAGE_KEY);
  clearCookieState();
}

function loadPersistedState() {
  const rawLocal = localStorage.getItem(STORAGE_KEY);
  const rawCookie = loadStateFromCookie();
  const raw = rawLocal || rawCookie;
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    state = { ...initialState(), ...parsed };
    currentJobId = state.jobId || null;
  } catch (_e) {
    clearPersistedState();
  }
}

function createEntryElement(item, type) {
  const wrapper = document.createElement("div");
  wrapper.className = "entry";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = item.title || item.name || "Stream";
  wrapper.appendChild(title);

  if (type === "LIVE") {
    const meta = document.createElement("div");
    meta.className = "meta-line";
    const category = item.category ? `Category: ${item.category}` : "Category: -";
    const logo = item.logo_url ? `Logo: ${item.logo_url}` : "Logo: -";
    meta.textContent = `${category} | ${logo}`;
    wrapper.appendChild(meta);
  }

  if (type === "CURATED") {
    const category = document.createElement("div");
    category.textContent = `Category: ${item.category || "-"}`;
    wrapper.appendChild(category);

    const logo = document.createElement("div");
    logo.textContent = `Logo: ${item.logo_url || "-"}`;
    wrapper.appendChild(logo);
  }

  const linkWrap = document.createElement("div");
  if (type === "LIVE") {
    const previewBtn = document.createElement("button");
    previewBtn.type = "button";
    previewBtn.className = "mini-btn";
    previewBtn.textContent = "Preview + Select";
    previewBtn.dataset.streamUrl = item.url;
    previewBtn.dataset.streamTitle = item.title || "Stream";
    previewBtn.dataset.streamCategory = item.category || "";
    previewBtn.dataset.streamLogo = item.logo_url || "";
    linkWrap.appendChild(previewBtn);
  }

  const link = document.createElement("a");
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.url;
  linkWrap.appendChild(link);
  wrapper.appendChild(linkWrap);

  if (type === "DEAD") {
    const reason = document.createElement("div");
    reason.className = "reason";
    reason.textContent = item.reason || "unknown";
    wrapper.appendChild(reason);
  }

  return wrapper;
}

function renderList(container, items, type, emptyText) {
  if (!items.length) {
    container.classList.add("empty");
    container.textContent = emptyText;
    return;
  }
  container.classList.remove("empty");
  container.innerHTML = "";
  for (const item of items) {
    container.appendChild(createEntryElement(item, type));
  }
}

function renderDownloadLinks() {
  if (state.normalDownloadUrl) {
    normalDownloadLink.hidden = false;
    normalDownloadLink.href = resolveApiLink(state.normalDownloadUrl);
  } else {
    normalDownloadLink.hidden = true;
    normalDownloadLink.href = "#";
  }

  if (state.curatedDownloadUrl) {
    curatedDownloadLink.hidden = false;
    curatedDownloadLink.href = resolveApiLink(state.curatedDownloadUrl);
  } else {
    curatedDownloadLink.hidden = true;
    curatedDownloadLink.href = "#";
  }
}

function renderState() {
  const hasAny = state.summary || state.liveItems.length || state.deadItems.length || state.curatedItems.length;
  summaryPanel.hidden = !hasAny;
  progressPanel.hidden = !hasAny;

  summaryText.textContent = state.summary || "No test run yet.";
  currentText.textContent = state.current || "Waiting to start...";
  counterText.textContent = state.counter || "";

  renderList(liveBox, state.liveItems, "LIVE", "No entries.");
  renderList(deadBox, state.deadItems, "DEAD", "No entries.");
  renderList(curatedBox, state.curatedItems, "CURATED", "No saved channels yet.");
  renderDownloadLinks();
  backendMode.value = state.backendMode || "builtin";
  agentBaseUrlInput.value = state.agentBaseUrl || "http://127.0.0.1:8787";
  publishSlug.value = state.publishSlug || "";
  publishName.value = state.publishName || "";
  publishProvider.value = state.publishProvider || "supabase";
  publishAllLive.checked = state.publishAllLive !== false;
  mergeWithExisting.checked = state.mergeWithExisting !== false;
  renderMergeTargetOptions();
  mergeTargetPlaylist.disabled = !mergeWithExisting.checked;
  refreshPlaylistsBtn.disabled = runInProgress && !runPaused;
  autoPublishAfterTest.checked = state.autoPublishAfterTest === true;
  publishSummary.textContent = state.publishSummary || "";
  if (state.duplicateUrls && state.duplicateUrls.length) {
    publishDuplicates.textContent = `Duplicate URLs skipped (${state.duplicateUrls.length}): ${state.duplicateUrls.join(" | ")}`;
  } else {
    publishDuplicates.textContent = "";
  }
  if (state.publishedUrl) {
    publishLink.hidden = false;
    publishLink.href = state.publishedUrl;
  } else {
    publishLink.hidden = true;
    publishLink.href = "#";
  }

  if (state.selectedStream && state.selectedStream.url) {
    selectedStreamText.textContent = `Selected: ${state.selectedStream.title || "Stream"}`;
    metaStreamUrl.value = state.selectedStream.url;
    metaName.value = state.selectedStream.title || "";
    metaCategory.value = state.selectedStream.category || "";
    metaLogoUrl.value = state.selectedStream.logo_url || "";
    previewPlayer.src = state.selectedStream.url;
    previewPlayer.load();
  } else {
    selectedStreamText.textContent = "Select a LIVE stream to preview.";
    metaStreamUrl.value = "";
    previewPlayer.removeAttribute("src");
    previewPlayer.load();
  }

  setSaveMergeControlsDisabled(runInProgress && !runPaused);
}

function renderMergeTargetOptions() {
  const items = Array.isArray(state.availablePlaylists) ? state.availablePlaylists : [];
  const selected = state.mergeTargetSlug || "";
  mergeTargetPlaylist.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = "Select existing playlist";
  mergeTargetPlaylist.appendChild(first);
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item.slug || "";
    const c = Number(item.channel_count || 0);
    opt.textContent = `${item.name || item.slug} (${item.slug})${c ? ` - ${c}` : ""}`;
    if (opt.value === selected) opt.selected = true;
    mergeTargetPlaylist.appendChild(opt);
  }
}

function setSaveMergeControlsDisabled(disabled) {
  publishBtn.disabled = disabled;
  publishAllLive.disabled = disabled;
  mergeWithExisting.disabled = disabled;
  mergeTargetPlaylist.disabled = disabled || !mergeWithExisting.checked;
}

function resetStateForRun() {
  state = {
    ...initialState(),
    backendMode: backendMode.value,
    agentBaseUrl: agentBaseUrlInput.value.trim() || "http://127.0.0.1:8787",
    publishSlug: publishSlug.value.trim(),
    publishName: publishName.value.trim(),
    publishProvider: publishProvider.value || "supabase",
    mergeWithExisting: mergeWithExisting.checked !== false,
    mergeTargetSlug: state.mergeTargetSlug || "",
    availablePlaylists: state.availablePlaylists || [],
    current: "Preparing playlist...",
    summary: "Starting test...",
  };
  currentJobId = null;
  metaMessage.textContent = "";
  renderState();
  persistState();
}

function handleStreamMessage(msg) {
  if (msg.type === "start") {
    state.total = msg.total;
    state.liveCount = 0;
    state.deadCount = 0;
    state.summary = `Total: ${msg.total} | LIVE: 0 | DEAD: 0`;
    state.counter = `0 / ${msg.total} completed`;
  } else if (msg.type === "current") {
    state.current = `Testing now (${msg.index}/${msg.total}): ${msg.title || "Stream"}`;
  } else if (msg.type === "item") {
    state.liveCount = msg.live_count;
    state.deadCount = msg.dead_count;
    state.summary = `Total: ${msg.total} | LIVE: ${msg.live_count} | DEAD: ${msg.dead_count}`;
    state.counter = `${msg.index} / ${msg.total} completed`;
    if (msg.status === "LIVE") {
      state.liveItems.push({
        title: msg.title,
        url: msg.url,
        category: msg.category || "",
        logo_url: msg.logo_url || "",
      });
    } else {
      state.deadItems.push({
        title: msg.title,
        url: msg.url,
        reason: msg.reason,
      });
    }
  } else if (msg.type === "complete") {
    currentJobId = msg.job_id;
    state.jobId = msg.job_id;
    state.completed = true;
    state.current = "Completed.";
    state.counter = `${msg.total} / ${msg.total} completed`;
    state.summary = `Total: ${msg.total} | LIVE: ${msg.live_count} | DEAD: ${msg.dead_count}`;
    state.normalDownloadUrl = msg.download_url || "";
    state.curatedDownloadUrl = msg.curated_download_url || "";
  }

  renderState();
  persistState();

  if (msg.type === "complete" && autoPublishAfterTest.checked) {
    if (publishSlug.value.trim()) {
      publishOnline({ silent: true });
    } else {
      state.publishSummary = "Auto publish skipped: playlist slug is required.";
      persistState();
      renderState();
    }
  }
}

function getApiBase() {
  const mode = backendMode.value;
  const agentBase = (agentBaseUrlInput.value || "http://127.0.0.1:8787").trim().replace(/\/+$/, "");
  if (mode === "local-agent") {
    return agentBase;
  }
  return "";
}

function resolveApiLink(pathOrUrl) {
  if (!pathOrUrl) {
    return "#";
  }
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  return `${getApiBase()}${pathOrUrl}`;
}

function getErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  return payload.error || payload.detail || fallback;
}

async function runStreamTest(data) {
  runController = new AbortController();
  const res = await fetch(`${getApiBase()}/api/test-stream`, {
    method: "POST",
    body: data,
    signal: runController.signal,
  });

  if (!res.ok) {
    const payload = await res.json();
    throw new Error(getErrorMessage(payload, "Request failed"));
  }

  if (!res.body) {
    throw new Error("Streaming not supported in this browser.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    while (runPaused) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      handleStreamMessage(JSON.parse(line));
    }
  }

  if (buffer.trim()) {
    handleStreamMessage(JSON.parse(buffer));
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const hasFile = !!(playlistFileInput && playlistFileInput.files && playlistFileInput.files.length > 0);
  const playlistUrl = (playlistUrlInput?.value || "").trim();
  if (!hasFile && !playlistUrl) {
    state.current = "Stopped due to error.";
    state.counter = "";
    state.summary = "Error: Please upload an .m3u file or provide a playlist URL.";
    renderState();
    persistState();
    return;
  }
  if (!hasFile && playlistUrl && !/^https?:\/\//i.test(playlistUrl)) {
    state.current = "Stopped due to error.";
    state.counter = "";
    state.summary = "Error: Playlist URL must start with http:// or https://";
    renderState();
    persistState();
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = "Testing...";
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
  runInProgress = true;
  runPaused = false;
  pauseBtn.textContent = "Pause";
  resetStateForRun();

  try {
    const data = new FormData(form);
    data.set("verify_segment", data.get("verify_segment") ? "true" : "false");
    await runStreamTest(data);
  } catch (err) {
    if (err?.name === "AbortError") {
      state.current = "Stopped by user.";
      state.summary = state.summary || "Stopped by user.";
    } else {
      state.current = "Stopped due to error.";
      state.summary = `Error: ${err.message}`;
      state.normalDownloadUrl = "";
      state.curatedDownloadUrl = "";
    }
    state.counter = "";
    renderState();
    persistState();
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = "Test Streams";
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    pauseBtn.textContent = "Pause";
    runInProgress = false;
    runPaused = false;
    runController = null;
    renderState();
  }
});

pauseBtn.addEventListener("click", () => {
  if (!runInProgress) return;
  runPaused = !runPaused;
  pauseBtn.textContent = runPaused ? "Resume" : "Pause";
  state.current = runPaused ? "Paused. You can Save/Merge current checked result." : state.current;
  renderState();
  persistState();
});

stopBtn.addEventListener("click", () => {
  if (!runInProgress) return;
  if (runController) {
    runController.abort();
  }
});

liveBox.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains("mini-btn")) {
    return;
  }

  const selected = {
    url: target.dataset.streamUrl || "",
    title: target.dataset.streamTitle || "Stream",
    category: target.dataset.streamCategory || "",
    logo_url: target.dataset.streamLogo || "",
  };

  state.selectedStream = selected;
  selectedStreamText.textContent = `Selected: ${selected.title}`;
  metaStreamUrl.value = selected.url;
  metaName.value = selected.title;
  metaCategory.value = selected.category;
  metaLogoUrl.value = selected.logo_url;

  previewPlayer.src = selected.url;
  previewPlayer.load();
  previewPlayer.play().catch(() => {});

  persistState();
});

channelForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  metaMessage.classList.remove("error-text", "ok-text");

  if (!currentJobId) {
    metaMessage.textContent = "Run test first.";
    metaMessage.classList.add("error-text");
    return;
  }

  const streamUrl = metaStreamUrl.value.trim();
  const name = metaName.value.trim();
  const category = metaCategory.value.trim();
  const logoUrl = metaLogoUrl.value.trim();

  if (!streamUrl) {
    metaMessage.textContent = "Please select a LIVE stream first.";
    metaMessage.classList.add("error-text");
    return;
  }

  try {
    const res = await fetch(`${getApiBase()}/api/job/${encodeURIComponent(currentJobId)}/add-channel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stream_url: streamUrl,
        name,
        category,
        logo_url: logoUrl,
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(payload, "Save failed"));
    }

    state.curatedItems.push(payload.channel);
    state.curatedDownloadUrl = payload.curated_download_url || state.curatedDownloadUrl;
    renderState();
    persistState();

    metaMessage.textContent = "Channel saved.";
    metaMessage.classList.add("ok-text");
    metaName.value = "";
    metaCategory.value = "";
    metaLogoUrl.value = "";
  } catch (err) {
    metaMessage.textContent = err.message;
    metaMessage.classList.add("error-text");
  }
});

clearAllBtn.addEventListener("click", async () => {
  const jobId = currentJobId || state.jobId;
  if (jobId) {
    try {
      await fetch(`${getApiBase()}/api/job/${encodeURIComponent(jobId)}`, { method: "DELETE" });
    } catch (_e) {
      // ignore network errors for clear action
    }
  }

  state = initialState();
  currentJobId = null;
  metaMessage.textContent = "";
  clearPersistedState();
  renderState();
});

loadPersistedState();
renderState();
loadExistingPlaylists().then(() => {
  persistState();
  renderState();
});

mergeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  mergeBtn.disabled = true;
  mergeBtn.textContent = "Merging...";
  mergeSummary.textContent = "";
  mergeDownloadLink.hidden = true;
  mergeDownloadLink.href = "#";

  try {
    const data = new FormData(mergeForm);
    const res = await fetch(`${getApiBase()}/api/merge-playlists`, {
      method: "POST",
      body: data,
    });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(payload, "Merge failed"));
    }

    mergeSummary.textContent =
      `Files: ${payload.files_uploaded} | Total: ${payload.total_entries} | Merged: ${payload.merged_entries} | ` +
      `URL Duplicates Skipped: ${payload.duplicate_urls_skipped} | Names Renamed: ${payload.duplicate_names_renamed}`;
    mergeDownloadLink.hidden = false;
    mergeDownloadLink.href = resolveApiLink(payload.download_url);
  } catch (err) {
    mergeSummary.textContent = `Error: ${err.message}`;
    mergeDownloadLink.hidden = true;
  } finally {
    mergeBtn.disabled = false;
    mergeBtn.textContent = "Merge Playlists";
  }
});

backendMode.addEventListener("change", () => {
  state.backendMode = backendMode.value;
  persistState();
  renderDownloadLinks();
});

agentBaseUrlInput.addEventListener("change", () => {
  state.agentBaseUrl = agentBaseUrlInput.value.trim() || "http://127.0.0.1:8787";
  persistState();
  renderDownloadLinks();
});

publishForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  publishOnline({ silent: false });
});

async function publishOnline({ silent }) {
  publishBtn.disabled = true;
  publishBtn.textContent = "Saving...";
  if (!silent) {
    publishSummary.textContent = "";
    publishDuplicates.textContent = "";
    publishLink.hidden = true;
    publishLink.href = "#";
  }

  try {
    const jobId = currentJobId || state.jobId;

    const slug = publishSlug.value.trim();
    const name = publishName.value.trim();
    const provider = (publishProvider.value || "supabase").trim().toLowerCase();
    const publishAll = publishAllLive.checked;
    const mergeExisting = mergeWithExisting.checked;
    if (!slug) {
      throw new Error("Playlist slug is required.");
    }

    let fallbackChannels = [];
    if (!jobId) {
      fallbackChannels = publishAll
        ? (state.liveItems || []).map((x) => ({
            name: x.title || "Stream",
            category: x.category || "",
            logo_url: x.logo_url || "",
            url: x.url || "",
          }))
        : (state.curatedItems || []).map((x) => ({
            name: x.name || x.title || "Stream",
            category: x.category || "",
            logo_url: x.logo_url || "",
            url: x.url || "",
          }));
      if (!fallbackChannels.length) {
        throw new Error("No checked streams yet. Run test first, then Save.");
      }
    }

    const res = await fetch(`${getApiBase()}/api/publish-online`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: jobId,
        playlist_slug: slug,
        playlist_name: name || slug,
        provider,
        publish_all_live: publishAll,
        merge_with_existing: mergeExisting,
        channels: fallbackChannels,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(payload, "Publish failed"));
    }

    const result = payload.result || {};
    state.publishSlug = slug;
    state.publishName = name;
    state.publishProvider = provider;
    state.publishAllLive = publishAll;
    state.mergeWithExisting = mergeExisting;
    state.autoPublishAfterTest = autoPublishAfterTest.checked;
    state.publishedUrl = result.playlist_url || "";
    state.duplicateUrls = Array.isArray(result.duplicate_urls) ? result.duplicate_urls : [];
    state.publishSummary =
      `Published (${provider}): ${result.slug} | Channels: ${result.channel_count} | URL dedupe: ${result.duplicate_urls_skipped} | Name rename: ${result.duplicate_names_renamed} | Merge: ${result.merge_with_existing ? "ON" : "OFF"}`;
    await loadExistingPlaylists();
    persistState();
    renderState();
  } catch (err) {
    state.publishSummary = `Error: ${err.message}`;
    persistState();
    renderState();
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = "Save";
  }
}

publishProvider.addEventListener("change", () => {
  state.publishProvider = publishProvider.value || "supabase";
  persistState();
});

publishAllLive.addEventListener("change", () => {
  state.publishAllLive = publishAllLive.checked;
  persistState();
});

mergeWithExisting.addEventListener("change", () => {
  state.mergeWithExisting = mergeWithExisting.checked;
  if (!mergeWithExisting.checked) {
    state.mergeTargetSlug = "";
  }
  persistState();
  renderState();
});

autoPublishAfterTest.addEventListener("change", () => {
  state.autoPublishAfterTest = autoPublishAfterTest.checked;
  persistState();
});

mergeTargetPlaylist.addEventListener("change", () => {
  const slug = mergeTargetPlaylist.value || "";
  state.mergeTargetSlug = slug;
  if (slug) {
    const found = (state.availablePlaylists || []).find((x) => x.slug === slug);
    if (found) {
      publishSlug.value = found.slug || "";
      publishName.value = found.name || found.slug || "";
      state.publishSlug = publishSlug.value;
      state.publishName = publishName.value;
    }
  }
  persistState();
});

refreshPlaylistsBtn.addEventListener("click", async () => {
  await loadExistingPlaylists();
  persistState();
  renderState();
});

async function loadExistingPlaylists() {
  try {
    const res = await fetch(`${getApiBase()}/api/playlists-existing`);
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(getErrorMessage(payload, "Failed to load playlists"));
    }
    state.availablePlaylists = Array.isArray(payload.items) ? payload.items : [];
    if (
      state.mergeTargetSlug &&
      !state.availablePlaylists.some((x) => x.slug === state.mergeTargetSlug)
    ) {
      state.mergeTargetSlug = "";
    }
  } catch (_e) {
    state.availablePlaylists = state.availablePlaylists || [];
  }
}
