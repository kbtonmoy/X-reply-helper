(() => {
  let panel = null;
  let activeComposer = null;
  let lastTweetText = "";
  let lastThread = [];
  let lastTarget = null;
  let pointerInPanel = false;

  const TWEET_SEL = 'article[data-testid="tweet"], article[role="article"]';
  const MAX_CONTEXT_TWEETS = 4;
  const MAX_CONTEXT_CHARS = 1200;

  function textOf(el) {
    return (el?.innerText || "").replace(/\s+\n/g, "\n").trim();
  }

  // A quoted tweet sits in a nested role="link" block and has its own
  // tweetText; that is not the post being replied to.
  function mainTextOf(article) {
    for (const node of article.querySelectorAll('[data-testid="tweetText"]')) {
      if (node.closest('div[role="link"]')) continue;
      return textOf(node);
    }
    return "";
  }

  function quotedTextOf(article) {
    const q = article.querySelector('div[role="link"] [data-testid="tweetText"]');
    return q ? textOf(q) : "";
  }

  // Site routes that look like a profile link but are not one.
  const RESERVED_PATHS = new Set([
    "home", "explore", "notifications", "messages", "search", "settings",
    "compose", "i", "intent", "hashtag", "login", "signup", "tos", "privacy",
  ]);

  function isTimestampish(t) {
    return (
      /^\d+[smhdwy]$/i.test(t) ||
      /^[A-Za-z]{3}\s+\d{1,2}(,\s*\d{4})?$/.test(t) ||
      /^\d{1,2}\s+[A-Za-z]{3}$/.test(t)
    );
  }

  function authorOf(article) {
    const box = article.querySelector('[data-testid="User-Name"]') || article;

    // The handle comes from the profile link, not the text: name and handle sit
    // in inline spans, so innerText runs them together as "Alice@alice2h".
    // Search the whole article if the name block has no profile link, which
    // happens in some of the dialog layouts.
    const handleFrom = (root) => {
      for (const a of root.querySelectorAll("a[href]")) {
        const m = (a.getAttribute("href") || "").match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
        if (m && !RESERVED_PATHS.has(m[1].toLowerCase())) return "@" + m[1];
      }
      return "";
    };
    const handle = handleFrom(box) || handleFrom(article);

    // The display name is the first leaf span/div with real text. Reading
    // anchors instead picks up the timestamp link ("2h") on layouts where the
    // name is not itself a link.
    let name = "";
    for (const el of box.querySelectorAll("span, div")) {
      if (el.querySelector("span, div")) continue;
      const t = textOf(el).split("\n")[0].trim();
      if (!t || t.startsWith("@") || t === "\u00b7" || isTimestampish(t)) continue;
      name = t;
      break;
    }
    return { name, handle };
  }

  function hasMedia(article) {
    return !!article.querySelector(
      '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], video, [data-testid="card.wrapper"]',
    );
  }

  function readTweet(article) {
    return {
      ...authorOf(article),
      text: mainTextOf(article),
      quoted: quotedTextOf(article),
      media: hasMedia(article),
    };
  }

  // The tweet being replied to is the last one *before* the composer in
  // document order, and everything before that is the thread it sits in.
  // Document order beats comparing screen positions: when the reply dialog is
  // open the timeline behind it is still in the DOM and still sits above the
  // composer on screen, which is how the wrong tweet used to get picked.
  function collectConversation(composer) {
    const scope = composer.closest('[role="dialog"]') || document;
    const articles = Array.from(scope.querySelectorAll(TWEET_SEL)).filter(
      (a) =>
        !a.contains(composer) &&
        a.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING,
    );

    if (!articles.length) return legacyFallback(composer);

    // Text-less posts (image or video only) stay in the list. Dropping them
    // would silently promote the tweet above to the reply target, which is
    // exactly the kind of wrong answer this is meant to prevent.
    const tweets = articles.map(readTweet);
    const target = tweets[tweets.length - 1];
    const context = [];
    let budget = MAX_CONTEXT_CHARS;
    // Nearest context first, so if the budget runs out it is the oldest tweet
    // that gets dropped.
    for (let i = tweets.length - 2; i >= 0 && context.length < MAX_CONTEXT_TWEETS; i--) {
      const t = tweets[i];
      if (!t.text && !t.quoted) continue;
      const cost = (t.text || "").length + 40;
      if (cost > budget) break;
      budget -= cost;
      context.unshift(t);
    }
    return { target, context };
  }

  // If X changes its markup enough that no article matches, fall back to the
  // old nearest-text-above heuristic rather than failing outright.
  function legacyFallback(composer) {
    const nodes = document.querySelectorAll('[data-testid="tweetText"]');
    const cRect = composer.getBoundingClientRect();
    let best = null;
    let bestDist = Infinity;
    nodes.forEach((t) => {
      const tRect = t.getBoundingClientRect();
      if (tRect.top >= cRect.top) return;
      const dist = cRect.top - tRect.bottom;
      if (dist >= 0 && dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    });
    if (!best) return { target: null, context: [] };
    return {
      target: { name: "", handle: "", text: textOf(best), quoted: "" },
      context: [],
    };
  }

  const ICON_REGEN =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>';
  const ICON_COPY =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>';

  // Match whichever theme X is in rather than guessing from the OS: the user
  // can run Lights Out on a light system and vice versa.
  function pageBackground() {
    for (const el of [document.body, document.documentElement]) {
      const parts = (getComputedStyle(el).backgroundColor || "").match(/[\d.]+/g);
      if (!parts) continue;
      const [r, g, b, a] = parts.map(Number);
      if (a === 0) continue; // transparent, keep looking up the tree
      return [r, g, b];
    }
    return null;
  }

  function applyTheme() {
    if (!panel) return;
    const rgb = pageBackground();
    if (!rgb) {
      panel.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches
        ? "dim"
        : "light";
      return;
    }
    const luma = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    panel.dataset.theme = luma > 140 ? "light" : luma < 12 ? "black" : "dim";
  }

  // A theme switch is animated, so reading the background the instant the
  // attribute changes returns the colour it is fading *from*. Read now for the
  // instant case and again once any transition has settled.
  let themeTimer = null;
  function scheduleTheme() {
    applyTheme();
    clearTimeout(themeTimer);
    themeTimer = setTimeout(applyTheme, 400);
  }

  // X switches theme in place, so follow it instead of reading once.
  function watchTheme() {
    try {
      new MutationObserver(scheduleTheme).observe(document.body, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
      new MutationObserver(scheduleTheme).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", scheduleTheme);
    } catch (e) {
      console.warn("[TRH] theme watch failed:", e);
    }
  }

  // X dismisses its reply dialog when a pointer event lands outside it, and
  // this panel is outside it — so clicking the intent box used to close the
  // reply box underneath, and the next focus then started a fresh generation.
  // The listener has to run before X's own: capture on window fires ahead of
  // capture on document, which is the earliest hook available to us.
  // Only the events a dismiss-on-outside-click handler keys off. Stopping a
  // capture-phase event also stops it reaching our own cards, so "click" must
  // not be in here — it is handled on the bubble side below.
  const DISMISS_EVENTS = ["pointerdown", "mousedown", "touchstart"];

  function guardPointerEvents() {
    const swallow = (e) => {
      if (panel && panel.contains(e.target)) e.stopPropagation();
    };
    for (const type of DISMISS_EVENTS) {
      window.addEventListener(type, swallow, true);
      document.addEventListener(type, swallow, true);
    }
    // Everything else is stopped once it has bubbled through the panel, so our
    // own handlers have already run by then but X never sees it.
    for (const type of ["click", "pointerup", "mouseup", "touchend"]) {
      panel.addEventListener(type, (e) => e.stopPropagation());
    }
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.className = "trh-panel";
    panel.setAttribute("role", "complementary");
    panel.setAttribute("aria-label", "Reply ideas");
    panel.innerHTML = `
      <div class="trh-header">
        <span class="trh-title">Reply ideas<span class="trh-count"></span></span>
        <button class="trh-iconbtn trh-btn-regen" type="button" title="Regenerate (\u2318\u21a9)">
          ${ICON_REGEN}<span>Regenerate</span>
        </button>
        <button class="trh-iconbtn trh-btn-close" type="button" aria-label="Close">\u00d7</button>
      </div>
      <div class="trh-target"></div>
      <div class="trh-intent">
        <textarea
          class="trh-intent-input"
          rows="2"
          placeholder="What do you want to say? (optional)"
        ></textarea>
        <div class="trh-hint">
          <span><span class="trh-kbd">\u21a9</span> rewrite in your words</span>
          <span><span class="trh-kbd">1</span>\u2013<span class="trh-kbd trh-kbd-max">5</span> insert</span>
        </div>
      </div>
      <div class="trh-body"></div>
      <div class="trh-credit">
        Made by <a href="https://x.com/kbtonmoy" target="_blank" rel="noopener">@kbtonmoy</a>
      </div>
    `;
    document.body.appendChild(panel);
    applyTheme();
    watchTheme();
    panel.addEventListener("pointerenter", () => (pointerInPanel = true));
    panel.addEventListener("pointerleave", () => (pointerInPanel = false));

    guardPointerEvents();
    panel.querySelector(".trh-btn-close").addEventListener("click", hidePanel);
    panel.querySelector(".trh-btn-regen").addEventListener("click", regenerate);
    const intentEl = panel.querySelector(".trh-intent-input");


    intentEl.addEventListener("keydown", (e) => {
      // Enter submits, Shift+Enter inserts newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        regenerate();
      }
    });
    return panel;
  }

  function regenerate() {
    if (activeComposer && lastTweetText) {
      requestReplies(lastTweetText, getIntent(), lastThread, lastTarget);
    }
  }

  function setBusy(busy) {
    const btn = panel?.querySelector(".trh-btn-regen");
    if (btn) btn.disabled = !!busy;
  }

  function setCount(n) {
    const el = panel?.querySelector(".trh-count");
    if (el) el.textContent = n ? ` \u00b7 ${n}` : "";
    // Reply count varies by mode (6 normally, 5 for rewrites and connect
    // posts), so the shortcut hint follows what is actually on screen.
    const max = panel?.querySelector(".trh-kbd-max");
    if (max && n) max.textContent = String(Math.min(n, 9));
  }

  function renderTarget(target, context) {
    const el = ensurePanel().querySelector(".trh-target");
    if (!target || !(target.text || target.quoted)) {
      el.style.display = "none";
      return;
    }
    panel.dataset.open = "1";
    const who = target.handle || target.name || "this post";
    const body = target.text || target.quoted;
    const snippet = body.length > 110 ? body.slice(0, 110) + "\u2026" : body;
    const ctx = context.length
      ? `<span class="trh-target-ctx">+${context.length} in thread</span>`
      : "";
    const media = target.media
      ? `<span class="trh-target-media">has an image or video</span>`
      : "";
    el.innerHTML =
      `<div class="trh-target-head"><span class="trh-target-label">Replying to</span> ` +
      `<span class="trh-target-who">${escapeHtml(who)}</span>${ctx}</div>` +
      `<div class="trh-target-text">${escapeHtml(snippet)}</div>${media}`;
    el.style.display = "block";
  }

  function getIntent() {
    const el = panel?.querySelector(".trh-intent-input");
    return el ? el.value.trim() : "";
  }

  function clearIntent() {
    const el = panel?.querySelector(".trh-intent-input");
    if (el) el.value = "";
  }

  function hidePanel() {
    if (panel) delete panel.dataset.open;
    activeComposer = null;
  }

  function showPanel() {
    const el = ensurePanel();
    applyTheme();
    el.dataset.open = "1";
  }

  function isPanelVisible() {
    return !!panel && panel.dataset.open === "1";
  }

  function shouldKeepPanelVisible(target) {
    if (!target) return false;
    if (panel?.contains(target)) return true;
    if (target.closest?.('div[data-testid^="tweetTextarea_"]')) return true;
    return false;
  }

  function setBody(html) {
    ensurePanel();
    panel.querySelector(".trh-body").innerHTML = html;
  }

  function renderLoading() {
    setBusy(true);
    setCount(0);
    const row = `
      <div class="trh-skeleton">
        <div class="trh-sk-line trh-sk-short"></div>
        <div class="trh-sk-line"></div>
        <div class="trh-sk-line trh-sk-mid"></div>
      </div>`;
    setBody(row.repeat(3));
  }

  function renderError(msg) {
    setBusy(false);
    setCount(0);
    setBody(
      `<div class="trh-error"><div class="trh-error-title">Couldn\u2019t generate replies</div>${escapeHtml(msg)}</div>`,
    );
  }

  let currentReplies = [];

  function renderReplies(replies) {
    setBusy(false);
    currentReplies = replies;
    setCount(replies.length);
    const cards = replies
      .map(
        (r, i) => `
      <div class="trh-card" data-idx="${i}" role="button" tabindex="0"
           aria-label="Insert reply ${i + 1}">
        <span class="trh-num">${i + 1}</span>
        <div class="trh-style">${escapeHtml(r.style || "Reply")}</div>
        <div class="trh-text">${escapeHtml(r.text || "")}</div>
        <button class="trh-copy" type="button" aria-label="Copy reply ${i + 1}">${ICON_COPY}</button>
      </div>`,
      )
      .join("");
    setBody(cards);

    panel.querySelectorAll(".trh-card").forEach((el) => {
      const idx = Number(el.dataset.idx);
      el.addEventListener("click", (e) => {
        if (e.target.closest(".trh-copy")) return;
        useReply(idx);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          useReply(idx);
        }
      });
      el.querySelector(".trh-copy").addEventListener("click", (e) => {
        e.stopPropagation();
        copyReply(idx);
      });
    });
  }

  function flash(idx, label) {
    const el = panel?.querySelector(`.trh-card[data-idx="${idx}"]`);
    if (!el) return;
    el.dataset.flash = label;
    setTimeout(() => el.removeAttribute("data-flash"), 900);
  }

  function useReply(idx) {
    const reply = currentReplies[idx];
    if (!reply) return;
    insertIntoComposer(reply.text || "");
    recordPick(reply);
    flash(idx, "Inserted");
  }

  // navigator.clipboard is unavailable when the document isn't focused or the
  // permission is denied, so keep the old textarea trick as a fallback.
  function legacyCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  function copyReply(idx) {
    const reply = currentReplies[idx];
    if (!reply) return;
    const text = reply.text || "";
    const fallback = () => flash(idx, legacyCopy(text) ? "Copied" : "Copy failed");
    if (!navigator.clipboard?.writeText) return fallback();
    navigator.clipboard.writeText(text).then(() => flash(idx, "Copied"), fallback);
  }

  function recordPick(reply) {
    if (!chrome?.runtime?.id) return;
    try {
      chrome.runtime.sendMessage(
        {
          type: "replyPicked",
          tweetText: lastTweetText,
          pickedText: reply.text || "",
          pickedStyle: reply.style || "",
        },
        () => {
          // Swallow runtime.lastError silently — pick recording is best-effort.
          void chrome.runtime.lastError;
        },
      );
    } catch (e) {
      console.warn("[TRH] recordPick send failed:", e);
    }
  }

  function editableOf(composer) {
    if (composer.matches?.('[contenteditable="true"]')) return composer;
    return composer.querySelector?.('[contenteditable="true"]') || composer;
  }

  // The composer is torn down and rebuilt when it collapses, so the reference
  // taken on focus can be pointing at a detached node by the time a reply is
  // picked. Re-resolve it instead of inserting into nothing.
  function liveComposer() {
    if (activeComposer?.isConnected) return activeComposer;
    const scope = document.querySelector('[role="dialog"]') || document;
    const fresh = scope.querySelector('div[data-testid^="tweetTextarea_"]');
    if (fresh) activeComposer = fresh;
    return activeComposer?.isConnected ? activeComposer : null;
  }

  function insertIntoComposer(text) {
    const composer = liveComposer();
    if (!composer || !text) return;
    const target = editableOf(composer);
    target.focus();

    // X's composer is Draft.js, so React owns every node inside it.
    // document.execCommand("insertText") writes to that DOM directly, which
    // leaves React reconciling against a tree it no longer recognises — it
    // throws NotFoundError on removeChild and then re-applies the stray text on
    // every later keystroke. Dispatching a paste event instead routes the text
    // through Draft's own handler, so React stays the only thing touching the
    // DOM.
    let handled = false;
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      const evt = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      // dispatchEvent returns false when the editor called preventDefault,
      // which is how Draft signals it took the text.
      handled = !target.dispatchEvent(evt);
    } catch (e) {
      console.warn("[TRH] paste insert failed:", e);
    }

    // Plain textareas and anything that ignores the paste event.
    if (!handled) {
      try {
        document.execCommand("insertText", false, text);
      } catch (e) {
        console.warn("[TRH] insertText failed:", e);
      }
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isExtensionContextLost(e) {
    const msg = String(e?.message || e || "");
    return (
      !chrome?.runtime?.id ||
      msg.includes("Extension context invalidated") ||
      msg.includes("reading 'sendMessage'") ||
      msg.includes("reading 'lastError'")
    );
  }

  function requestReplies(tweetText, userIntent = "", thread = [], target = null) {
    showPanel();
    renderTarget(target, thread);
    renderLoading();
    if (!chrome?.runtime?.id) {
      renderError("Extension was reloaded. Please refresh this page (Cmd+R).");
      return;
    }
    try {
      chrome.runtime.sendMessage(
        { type: "generateReplies", tweetText, userIntent, thread, target },
        (resp) => {
          if (chrome.runtime.lastError) {
            renderError(chrome.runtime.lastError.message);
            return;
          }
          if (!resp?.ok) {
            renderError(resp?.error || "Unknown error");
            return;
          }
          renderReplies(resp.replies);
        },
      );
    } catch (e) {
      if (isExtensionContextLost(e)) {
        renderError("Extension was reloaded. Please refresh this page (Cmd+R).");
      } else {
        renderError(e?.message || String(e));
      }
    }
  }

  document.addEventListener("focusin", (e) => {
    try {
      const composer = e.target.closest?.('div[data-testid^="tweetTextarea_"]');
      if (!composer) return;
      if (composer === activeComposer) return;

      const { target, context } = collectConversation(composer);
      const sameTweet =
        target &&
        (target.text || target.quoted) === lastTweetText &&
        currentReplies.length > 0;

      // The composer is torn down and rebuilt when it collapses, so a rebuilt
      // one is not a new post. Show what we already have instead of paying for
      // another round trip.
      if (sameTweet) {
        activeComposer = composer;
        lastThread = context;
        lastTarget = target;
        showPanel();
        renderTarget(target, context);
        return;
      }

      activeComposer = composer;
      // New tweet → fresh intent. (Don't carry the previous tweet's angle over.)
      clearIntent();
      const tweetText = target ? target.text || target.quoted : "";
      if (!tweetText) {
        showPanel();
        renderTarget(null, []);
        renderError(
          target && target.media
            ? `${target.handle || "This post"} posted an image or video with no text, so there's nothing to read. Type what you want to say above and press Enter.`
            : "Couldn't find the tweet text. Try clicking on the tweet first.",
        );
        // Keep the target so an intent-driven rewrite still has its context.
        lastTweetText = "";
        lastThread = context;
        lastTarget = target;
        return;
      }
      lastTweetText = tweetText;
      lastThread = context;
      lastTarget = target;
      requestReplies(tweetText, "", context, target);
    } catch (err) {
      console.warn("[TRH] focusin handler error:", err);
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (!isPanelVisible()) return;
    if (shouldKeepPanelVisible(e.target)) return;
    hidePanel();
  });

  document.addEventListener("focusout", () => {
    if (!isPanelVisible()) return;
    setTimeout(() => {
      if (!isPanelVisible()) return;
      if (shouldKeepPanelVisible(document.activeElement)) return;
      if (pointerInPanel) return;
      // Losing focus is not reason enough to close: X moves focus around on its
      // own, and the composer collapses and re-renders when you click away.
      // Clicking somewhere else is handled by the mousedown listener below.
      if (!activeComposer || !activeComposer.isConnected) hidePanel();
    }, 250);
  });

  document.addEventListener("keydown", (e) => {
    if (!isPanelVisible()) return;

    if (e.key === "Escape") {
      hidePanel();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      regenerate();
      return;
    }

    // Number keys insert a reply, but only from an empty composer: typing a
    // digit into a draft, or into the intent box, must still type a digit.
    if (!/^[1-9]$/.test(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    const onComposer = document.activeElement?.closest?.(
      'div[data-testid^="tweetTextarea_"]',
    );
    if (!onComposer || textOf(onComposer)) return;
    const idx = Number(e.key) - 1;
    if (idx >= currentReplies.length) return;
    e.preventDefault();
    useReply(idx);
  });
})();
