(() => {
  let panel = null;
  let activeComposer = null;
  let lastTweetText = "";
  let lastThread = [];
  let lastTarget = null;

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

  function authorOf(article) {
    const box = article.querySelector('[data-testid="User-Name"]') || article;

    // The handle comes from the profile link, not the text: name and handle sit
    // in inline spans, so innerText runs them together as "Alice@alice2h".
    let handle = "";
    for (const a of box.querySelectorAll("a[href]")) {
      const m = (a.getAttribute("href") || "").match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
      if (m) {
        handle = "@" + m[1];
        break;
      }
    }

    let name = "";
    for (const a of box.querySelectorAll("a[href]")) {
      const t = textOf(a);
      if (t && !t.startsWith("@")) {
        name = t.split("\n")[0].trim();
        break;
      }
    }
    if (!name) {
      name = textOf(box)
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("@") && l !== "\u00b7") || "";
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

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.className = "trh-panel";
    panel.innerHTML = `
      <div class="trh-header">
        <span class="trh-title">Reply ideas</span>
        <div class="trh-actions">
          <button class="trh-btn-regen" type="button">Regenerate</button>
          <button class="trh-btn-close" type="button" aria-label="Close">×</button>
        </div>
      </div>
      <div class="trh-target"></div>
      <div class="trh-intent">
        <textarea
          class="trh-intent-input"
          rows="2"
          placeholder="想表达什么？(可选, 中英文都行, 回车提交)"
        ></textarea>
      </div>
      <div class="trh-body"></div>
      <div class="trh-credit">
        Made by <a href="https://x.com/kellyyuweipeng" target="_blank" rel="noopener">@kellyyuweipeng</a>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector(".trh-btn-close").addEventListener("click", hidePanel);
    panel.querySelector(".trh-btn-regen").addEventListener("click", () => {
      if (activeComposer && lastTweetText) {
        requestReplies(lastTweetText, getIntent(), lastThread, lastTarget);
      }
    });
    const intentEl = panel.querySelector(".trh-intent-input");
    intentEl.addEventListener("keydown", (e) => {
      // Enter submits, Shift+Enter inserts newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (activeComposer && lastTweetText) {
          requestReplies(lastTweetText, intentEl.value.trim(), lastThread, lastTarget);
        }
      }
    });
    return panel;
  }

  function renderTarget(target, context) {
    const el = ensurePanel().querySelector(".trh-target");
    if (!target || !(target.text || target.quoted)) {
      el.style.display = "none";
      return;
    }
    const who = target.handle || target.name || "this post";
    const body = target.text || target.quoted;
    const snippet = body.length > 110 ? body.slice(0, 110) + "\u2026" : body;
    const ctx = context.length
      ? `<span class="trh-target-ctx">+${context.length} earlier in thread</span>`
      : "";
    el.innerHTML =
      `<div class="trh-target-head"><span class="trh-target-label">Replying to</span> ` +
      `<span class="trh-target-who">${escapeHtml(who)}</span>${ctx}</div>` +
      `<div class="trh-target-text">${escapeHtml(snippet)}</div>`;
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
    if (panel) panel.style.display = "none";
    activeComposer = null;
  }

  function showPanel() {
    ensurePanel().style.display = "block";
  }

  function isPanelVisible() {
    return panel && panel.style.display !== "none";
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
    setBody(`<div class="trh-loading">Generating replies…</div>`);
  }

  function renderError(msg) {
    setBody(`<div class="trh-error">${escapeHtml(msg)}</div>`);
  }

  function renderReplies(replies) {
    const cards = replies
      .map(
        (r, i) => `
      <div class="trh-card" data-idx="${i}">
        <div class="trh-style">${escapeHtml(r.style || "Reply")}</div>
        <div class="trh-text">${escapeHtml(r.text || "")}</div>
      </div>`,
      )
      .join("");
    setBody(cards);
    panel.querySelectorAll(".trh-card").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.idx);
        const reply = replies[idx];
        if (!reply) return;
        insertIntoComposer(reply.text || "");
        recordPick(reply);
      });
    });
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

  function insertIntoComposer(text) {
    if (!activeComposer || !text) return;
    const target = editableOf(activeComposer);
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

      activeComposer = composer;
      // New tweet → fresh intent. (Don't carry the previous tweet's angle over.)
      clearIntent();
      const { target, context } = collectConversation(composer);
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
      if (activeComposer && !activeComposer.isConnected) {
        hidePanel();
        return;
      }
      hidePanel();
    }, 250);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isPanelVisible()) {
      hidePanel();
    }
  });
})();
