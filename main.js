let gameTitles = ['Evil Dead: The Game']; // ← fill this with your list of game titles

const DEFAULT_ACTION_DELAY_MS = 4000;
const SEARCH_DELAY_MS = DEFAULT_ACTION_DELAY_MS;
const PANEL_POLL_INTERVAL_MS = 500;
const DIALOG_STEP_DELAY_MS = 2000;

let stopFlag = false;

const syncedGames    = [];
const skippedGames   = [];

const isVisible = (el) => el && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);

document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key.toLowerCase() === "c") {
    stopFlag = true;
    console.warn("[GFN] Cancelled by user");
  }
});

// ─── NETWORK HOOK (XHR + FETCH) ──────────────────────────────────────────
window.latestSearchResult = null;

(function(open) {
  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return open.apply(this, arguments);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    this.addEventListener("load", () => {
      if (this._url?.includes("graphql") && this.responseText.includes('"apps"')) {
        try {
          const json = JSON.parse(this.responseText);
          if (json.data?.apps?.items) window.latestSearchResult = json.data.apps.items;
        } catch {}
      }
    });
    return origSend.apply(this, arguments);
  };
})(XMLHttpRequest.prototype.open);

const origFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await origFetch.apply(this, args);
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  if (url.includes("graphql")) {
    response.clone().text().then(text => {
      if (text.includes('"apps"')) {
        try {
          const json = JSON.parse(text);
          if (json.data?.apps?.items) window.latestSearchResult = json.data.apps.items;
        } catch {}
      }
    });
  }
  return response;
};

// ─── HELPERS ──────────────────────────────────────────────────────────────
const norm = s => s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

function pollFor(predicate, intervalMs = PANEL_POLL_INTERVAL_MS, maxAttempts = 20) {
  return new Promise(resolve => {
    let attempts = 0;
    const check = () => {
      if (stopFlag) return resolve(null);
      const result = predicate();
      if (result) return resolve(result);
      if (++attempts >= maxAttempts) return resolve(null);
      setTimeout(check, intervalMs);
    };
    check();
  });
}

// ─── MAIN LOGIC ───────────────────────────────────────────────────────────
let gfn = {
  total: 0,
  searchInput: null,

  async run() {
    this.total = gameTitles.length;
    if (this.total === 0) return;

    this.searchInput = document.querySelector("input.search-input");
    if (!this.searchInput) {
      console.error("[GFN] Search input not found. Make sure you are on the games grid.");
      return;
    }

    console.log(`[GFN] Starting sync of ${this.total} game(s)...`);
    await this.processAll();
  },

  async processAll() {
    for (let i = 0; i < gameTitles.length; i++) {
      if (stopFlag) break;
      const title = gameTitles[i];
      const prefix = `[${i + 1}/${this.total}]`;
      try {
        await this.processGame(title, prefix);
      } catch (e) {
        console.error(`${prefix} Exception on "${title}": ${e.message}`);
        skippedGames.push(title);
      }
    }
    this.reportSummary();
  },

  async processGame(title, prefix) {
    // Close any open panel/dialog
    const closeBtn = document.querySelector('.evidence-panel-close-button button, .close-button');
    if (closeBtn) closeBtn.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    // Search
    window.latestSearchResult = null;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeInputValueSetter.call(this.searchInput, title);
    this.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    this.searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    this.searchInput.click();

    await new Promise(r => setTimeout(r, SEARCH_DELAY_MS));

    // Match via GraphQL or DOM
    const searchTitle = norm(title);
    const items = window.latestSearchResult || [];
    const cards = Array.from(document.querySelectorAll("gfn-game-tile"));

    // GraphQL match (with Epic variant check)
    if (items.length > 0) {
      const match = items.find(i => norm(i.title) === searchTitle && i.variants?.some(v => v.appStore === "EPIC"));
      if (match) {
        const epicVariant = match.variants.find(v => v.appStore === "EPIC");
        if (epicVariant?.gfn?.library?.status !== "NOT_OWNED") {
          console.log(`${prefix} Already owned: "${match.title}"`);
          syncedGames.push(title);
          return;
        }
        const idx = items.indexOf(match);
        if (cards[idx]) {
          (cards[idx].querySelector('img') || cards[idx]).click();
          console.log(`${prefix} Opened: "${match.title}"`);
          return this.handlePanel(title, prefix);
        }
      }
    }

    // DOM text fallback
    for (const card of cards) {
      const domText = card.getAttribute('aria-label') || card.querySelector('img')?.alt || card.textContent || "";
      if (norm(domText).includes(searchTitle)) {
        (card.querySelector('img') || card).click();
        console.log(`${prefix} Opened: "${domText.trim()}"`);
        return this.handlePanel(title, prefix);
      }
    }

    console.log(`${prefix} Not found on GFN: "${title}"`);
    skippedGames.push(title);
  },

  async handlePanel(title, prefix) {
    // Wait for panel to open
    const panel = await pollFor(() => document.querySelector('.evidence-panel-container.evidence-slide-open'));
    if (!panel) {
      console.error(`${prefix} Panel didn't open for "${title}"`);
      skippedGames.push(title);
      return;
    }

    await new Promise(r => setTimeout(r, 1000));

    // Check if already owned (PLAY button visible or Epic store details showing owned)
    const btns = Array.from(panel.querySelectorAll('button')).filter(isVisible);
    const playBtn = btns.find(b => /^PLAY$/i.test(b.textContent.trim()));
    if (playBtn) {
      console.log(`${prefix} Already owned: "${title}"`);
      syncedGames.push(title);
      return;
    }

    const storeText = panel.querySelector('.selected-store-details-container')?.innerText || '';
    if (/epic/i.test(storeText) && /owned|play/i.test(storeText)) {
      console.log(`${prefix} Already owned: "${title}"`);
      syncedGames.push(title);
      return;
    }

    // Click MARK AS OWNED
    const markBtn = btns.find(b => /mark as owned/i.test(b.textContent));
    if (!markBtn) {
      console.log(`${prefix} No "Mark as Owned" button for "${title}" (buttons: ${btns.map(b => b.textContent.trim()).filter(t => t.length < 40).join(', ')})`);
      skippedGames.push(title);
      return;
    }
    if (markBtn.disabled) {
      console.log(`${prefix} Already owned (button disabled): "${title}"`);
      syncedGames.push(title);
      return;
    }
    markBtn.click();

    // ─── OWNERSHIP DIALOG (3-step wizard) ─────────────────────────────
    // GFN uses <gfn-ownership-dialog> with stages:
    //   1. Platform selection (choose Epic Games Store)
    //   2. Confirmation (CONTINUE)
    //   3. Completion (DONE)

    // Wait for ownership dialog
    const dialog = await pollFor(() => {
      const d = document.querySelector('gfn-ownership-dialog, .ownership-dialog-container');
      return d && isVisible(d) ? d : null;
    });

    if (!dialog) {
      console.error(`${prefix} Ownership dialog didn't appear for "${title}"`);
      skippedGames.push(title);
      return;
    }

    await new Promise(r => setTimeout(r, DIALOG_STEP_DELAY_MS));

    // Step 1: Select Epic Games Store platform
    const platformBtns = Array.from(dialog.querySelectorAll('button.platform-option, button[class*="platform-option"]')).filter(isVisible);
    const epicBtn = platformBtns.find(b => /epic/i.test(b.textContent));

    if (!epicBtn) {
      // Check if dialog skipped to confirmation (single store) or Epic isn't available
      const dialogText = dialog.innerText || '';
      if (!/continue/i.test(dialogText)) {
        console.log(`${prefix} No Epic option in store list: "${title}" (stores: ${platformBtns.map(b => b.textContent.trim()).join(', ')})`);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        skippedGames.push(title);
        return;
      }
      // else: already at continue step
    } else {
      epicBtn.click();
      await new Promise(r => setTimeout(r, DIALOG_STEP_DELAY_MS));
    }

    // Step 2: Click CONTINUE
    const continueBtn = await pollFor(() => {
      const d = document.querySelector('gfn-ownership-dialog, .ownership-dialog-container');
      if (!d) return null;
      const btns = Array.from(d.querySelectorAll('button')).filter(isVisible);
      return btns.find(b => /continue/i.test(b.textContent));
    }, PANEL_POLL_INTERVAL_MS, 10);

    if (continueBtn) {
      continueBtn.click();
      await new Promise(r => setTimeout(r, DIALOG_STEP_DELAY_MS));
    }

    // Step 3: Click DONE
    const doneBtn = await pollFor(() => {
      const d = document.querySelector('gfn-ownership-dialog, .ownership-dialog-container');
      if (!d) return null;
      const btns = Array.from(d.querySelectorAll('button')).filter(isVisible);
      return btns.find(b => /done/i.test(b.textContent));
    }, PANEL_POLL_INTERVAL_MS, 10);

    if (doneBtn) {
      doneBtn.click();
    }

    console.log(`${prefix} Synced: "${title}"`);
    syncedGames.push(title);
    await new Promise(r => setTimeout(r, DEFAULT_ACTION_DELAY_MS));
  },

  reportSummary() {
    console.log("\n[GFN] ═══════════════════════════════════");
    console.log("[GFN] SYNC COMPLETE");
    console.log("[GFN] ═══════════════════════════════════");
    console.log(`[GFN] Synced/owned: ${syncedGames.length}`);
    console.log(`[GFN] Skipped:      ${skippedGames.length}`);
    if (syncedGames.length) {
      console.log("[GFN] Synced:", syncedGames);
    }
    if (skippedGames.length) {
      console.log("[GFN] Skipped:", skippedGames);
    }
  }
};

gfn.run();
