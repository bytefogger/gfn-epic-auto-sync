let gameTitles = ['Evil Dead: The Game']; // ← fill this with your list of game titles

let SEARCH_DELAY  = 4000;
let CONFIRM_DELAY = 4000;

let stopFlag = false;

const syncedGames    = [];
const skippedGames   = [];
const nameMismatches = [];

// Helper: robust visibility check for animated elements
const isVisible = (el) => el && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);

// Ctrl+C to cancel mid-run
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key.toLowerCase() === "c") {
    stopFlag = true;
    console.warn("[GFN] 🛑 Cancelled by user");
  }
});

// ─── ➋ NETWORK HOOK (XHR + FETCH) ────────────────────────────────────────
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

// ─── ➌ MAIN LOGIC ─────────────────────────────────────────────────────────
let gfn = {
  total: 0,
  searchInput: null,

  async run() {
    this.total = gameTitles.length;
    if (this.total === 0) return;

    this.searchInput = document.querySelector("input.search-input");
    if (!this.searchInput) {
      console.error("[GFN] ❌ Search input not found. Make sure you are on the games grid.");
      return;
    }

    console.log(`[GFN] Starting sync of ${this.total} game(s)…`);
    await this.searchNext();
  },

  async searchNext() {
    if (stopFlag) return;

    if (gameTitles.length === 0) {
      console.log("[GFN] ✅ All done.");
      return this.reportSummary();
    }

    const title = gameTitles.shift();
    this.currentTitle = title;
    
    window.latestSearchResult = null;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeInputValueSetter.call(this.searchInput, title);
    
    this.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    this.searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    this.searchInput.click();

    setTimeout(() => this.openFirstTile(title), SEARCH_DELAY);
  },

  openFirstTile(title) {
    if (stopFlag) return;
    
    const norm = s => s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
    const searchTitle = norm(title);
    
    const items = window.latestSearchResult || [];
    const cards = Array.from(document.querySelectorAll("gfn-game-tile"));
    
    let targetCard = null;
    let usedMatchTitle = null;

    if (items.length > 0) {
      const match = items.find(i => norm(i.title) === searchTitle && i.variants.some(v => v.appStore === "EPIC"));
      if (match) {
        const epicVariant = match.variants.find(v => v.appStore === "EPIC");
        if (epicVariant.gfn.library.status !== "NOT_OWNED") {
          console.log(`[GFN] ℹ️ "${match.title}" is already owned/synced`);
          syncedGames.push(match.title);
          return this.searchNext();
        }
        const idx = items.indexOf(match);
        targetCard = cards[idx];
        usedMatchTitle = match.title;
      }
    }

    if (!targetCard) {
      for (let card of cards) {
        let domText = card.getAttribute('aria-label') || card.querySelector('img')?.alt || card.textContent || "";
        if (norm(domText).includes(searchTitle)) {
          targetCard = card;
          usedMatchTitle = domText.trim();
          break;
        }
      }
    }

    if (!targetCard) {
      console.warn(`[GFN] ❌ Could not find a UI card matching "${title}"`);
      skippedGames.push(title);
      return this.searchNext();
    }

    const clickTarget = targetCard.querySelector('img') || targetCard.querySelector('button, a') || targetCard;
    clickTarget.click();
    console.log(`[GFN] 📂 Opened tile for: "${usedMatchTitle || title}"`);
    
    this.clickEpicTagAndAdd();
  },

  async clickEpicTagAndAdd() {
    if (stopFlag) return;
    const title = this.currentTitle;

    console.log(`[GFN] ⏳ Waiting for game panel to load...`);
    
    let moreBtn = null;
    let epicChipEl = null;
    
    // 1. Wait for panel elements to physically render
    for (let i = 0; i < 20; i++) {
        if (stopFlag) return;
        
        const possibleElements = Array.from(document.querySelectorAll("[class*='chip'], button, a"));
        
        epicChipEl = possibleElements.find(c => /epic/i.test(c.textContent) && isVisible(c) && !c.classList.contains('more-actions-button'));
        
        moreBtn = document.querySelector("gfn-game-details-actions button.more-actions-button") || 
                  possibleElements.find(b => ["⋮", "MORE", "ACTIONS"].some(k => (b.innerText || b.textContent).toUpperCase().includes(k)) && isVisible(b));
        
        if (epicChipEl || moreBtn) break;
        await new Promise(r => setTimeout(r, 500));
    }

    if (!epicChipEl && !moreBtn) {
        console.error(`[GFN] ❌ Panel didn't open or couldn't find store controls for "${title}"`);
        skippedGames.push(title);
        return this.searchNext();
    }

    // 2. Switch Store if needed
    if (epicChipEl) {
        console.log(`[GFN] ▶️ Found Epic chip. Ensuring it is selected...`);
        // get the actual chips inside the parent, in case it has multiple stores listed
        const actualChips = Array.from(epicChipEl.querySelectorAll('mat-chip'));
        // Find the one that actually says "Epic" to click else fallback to previous logic 
        const exactTarget = actualChips.find(c => /epic/i.test(c.textContent)) || epicChipEl;
        
        // Click the true target
        exactTarget.click();
        await new Promise(r => setTimeout(r, 3500)); 
    } else if (moreBtn) {
        console.warn(`[GFN] ⚠ Switching store via ⋮ menu...`);
        moreBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        
        let menus = Array.from(document.querySelectorAll("button, mat-mdc-menu-item, [role='menuitem'], span"));
        
        // Scenario A: "Epic" is immediately visible in the dropdown
        let epicOption = menus.find(b => /epic/i.test((b.innerText || b.textContent)) && isVisible(b));
        
        if (epicOption) {
             // Find the actual clickable parent if it grabbed a span
             const clickable = epicOption.closest('button, [role="menuitem"]') || epicOption;
             clickable.click();
             console.log(`[GFN] ▶️ Switched "${title}" to Epic Store directly`);
             await new Promise(r => setTimeout(r, 2000));
        } else {
             // Scenario B: We have to click "Change game store" first
             const changeItem = menus.find(b => /(change|switch).*(store|platform)/i.test((b.innerText || b.textContent)) && isVisible(b));
             
             if (changeItem) {
                 const clickableChange = changeItem.closest('button, [role="menuitem"]') || changeItem;
                 clickableChange.click();
                 await new Promise(r => setTimeout(r, 1000));
                 
                 // Re-query the DOM for the new submenu
                 menus = Array.from(document.querySelectorAll("button, mat-mdc-menu-item, [role='menuitem'], span"));
                 epicOption = menus.find(b => /epic/i.test((b.innerText || b.textContent)) && isVisible(b));
                 
                 if (epicOption) {
                     const clickableEpic = epicOption.closest('button, [role="menuitem"]') || epicOption;
                     clickableEpic.click();
                     console.log(`[GFN] ▶️ Switched "${title}" to Epic Store via submenu`);
                     await new Promise(r => setTimeout(r, 2000));
                 } else {
                     console.error(`[GFN] ❌ Epic entry missing in sub-menu list`);
                     skippedGames.push(title);
                     return this.searchNext();
                 }
             } else {
                 console.error(`[GFN] ❌ "Change game store" menu missing and Epic not found.`);
                 skippedGames.push(title);
                 return this.searchNext();
             }
        }
    }

    console.log(`[GFN] ⏳ Waiting for "MARK AS OWNED" button...`);
    let addBtn = null;
    
    // 3. Poll for the Add Button
    for(let i=0; i<20; i++){ 
        if (stopFlag) return;
        const elements = Array.from(document.querySelectorAll("button, gfn-button, a, [role='button']"));
        addBtn = elements.find(b => {
            if (!isVisible(b)) return false;
            const text = (b.innerText || b.textContent).toUpperCase().replace(/\s+/g, " ").trim();
            return ["MARK AS OWNED", "GET", "+ MARK AS OWNED", "ADD TO LIBRARY"].some(k => text.includes(k));
        });
        if (addBtn) break;
        await new Promise(r => setTimeout(r, 500));
    }

    if (!addBtn) {
        console.log(`[GFN] ℹ️ Button missing or already owned for "${title}".`);
        syncedGames.push(title);
        return this.searchNext();
    }

    if (addBtn.disabled || addBtn.classList.contains('disabled') || addBtn.getAttribute('aria-disabled') === 'true') {
        console.log(`[GFN] ℹ️ Button is disabled, assuming already owned/synced for "${title}"`);
        syncedGames.push(title);
        return this.searchNext();
    }

    addBtn.click();
    console.log(`[GFN] 🟢 Clicked Add/Mark Owned for "${title}"`);

    console.log(`[GFN] ⏳ Waiting for confirmation dialog...`);
    let confirmBtn = null;
    
    // 4. Poll for Confirmation
    for(let i=0; i<10; i++){
        if(stopFlag) return;
        const elements = Array.from(document.querySelectorAll("button, gfn-button, .mat-mdc-button"));
        confirmBtn = elements.find(b => {
            if(!isVisible(b)) return false;
            const text = (b.innerText || b.textContent).toUpperCase().replace(/\s+/g, " ").trim();
            return ["YES", "CONFIRM", "CONTINUE"].some(k => text.includes(k));
        });
        if(confirmBtn) break;
        await new Promise(r => setTimeout(r, 500));
    }
    
    if (confirmBtn) {
      confirmBtn.click();
      console.log(`[GFN] ✅ Marked as owned: "${title}"`);
      syncedGames.push(title);
    } else {
      console.warn(`[GFN] ❌ Confirm dialog missing for "${title}"`);
      skippedGames.push(title);
    }
    
    setTimeout(() => this.searchNext(), CONFIRM_DELAY);
  },

  reportSummary() {
    console.log("\n[GFN] Summary:");
    console.table({
      Synced: syncedGames.length,
      Skipped: skippedGames.length,
      "Name mismatches": nameMismatches.length
    });
  }
};

gfn.run();
