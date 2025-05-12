// ─── ➊ YOUR LIST ─────────────────────────────────────────────────────────
let gameTitles = []; // ← fill this with your list of game titles

// ─── ➋ CONFIG ────────────────────────────────────────────────────────────
let SEARCH_DELAY  = 1500;
let TILE_DELAY    = 1000;
let CONFIRM_DELAY = 2000;

let stopFlag = false;
const syncedGames    = [];
const skippedGames   = [];
const nameMismatches = [];

// Ctrl+C to cancel mid-run
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key.toLowerCase() === "c") {
    stopFlag = true;
    console.warn("[GFN] 🛑 Cancelled by user");
  }
});

// ─── ➌ XHR HOOK ──────────────────────────────────────────────────────────
window.latestSearchResult = null;
(function(open) {
  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return open.apply(this, arguments);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    this.addEventListener("load", () => {
      if (
        this._url?.includes("games.geforce.com/graphql") &&
        this.responseText.includes('"apps"')
      ) {
        try {
          const json = JSON.parse(this.responseText);
          window.latestSearchResult = json.data.apps.items;
          console.log(
            `[GFN] ← network result (${window.latestSearchResult.length} items)`
          );
        } catch {
          console.warn("[GFN] ⚠️ Could not parse network response");
        }
      }
    });
    return origSend.apply(this, arguments);
  };
})(XMLHttpRequest.prototype.open);

// ─── ➍ MAIN LOGIC ─────────────────────────────────────────────────────────
let gfn = {
  total: 0,
  searchInput: null,

  async run() {
    this.total = gameTitles.length;
    if (!this.total) {
      console.log("[GFN] No games to process.");
      return;
    }

    this.searchInput = document.querySelector("input.search-input");
    if (!this.searchInput) {
      console.error("[GFN] ❌ Search input not found");
      return;
    }

    console.log(`[GFN] Starting sync of ${this.total} game(s)…`);
    await this.searchNext();
  },

  async searchNext() {
    if (stopFlag) return;

    if (!gameTitles.length) {
      console.log("[GFN] ✅ All done.");
      return this.reportSummary();
    }

    const title = gameTitles.shift();
    this.currentTitle = title;
    const count = this.total - gameTitles.length;
    console.log(`[GFN] 🔍 [${count}/${this.total}] Searching "${title}"…`);

    this.searchInput.value = title;
    this.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    this.searchInput.click();

    setTimeout(() => this.openFirstTile(title), SEARCH_DELAY);
  },

  openFirstTile(title) {
    if (stopFlag) return;

    const items = window.latestSearchResult || [];
    const norm = s => s.toLowerCase().replace(/[^\w\s]/g, "").trim();

    // ➊ exact-match with available Epic variant
    let match = items.find(i =>
      norm(i.title) === norm(title) &&
      i.variants.some(v => v.appStore === "EPIC")
    );
    let usedMatch = match;

    // ➋ fallback to first item if it’s NOT_OWNED on Epic
    if (!match) {
      const first = items[0];
      const epicFirst = first?.variants.find(v => v.appStore === "EPIC");
      if (first && epicFirst?.gfn.library.status === "NOT_OWNED") {
        nameMismatches.push({ expected: title, found: first.title });
        usedMatch = first;
        console.warn(
          `[GFN] ⚠ Name mismatch: expected "${title}", using "${first.title}"`
        );
      } else {
        console.warn(
          `[GFN] ❌ "${title}" not in network result and no valid fallback`
        );
        skippedGames.push(title);
        return this.searchNext();
      }
    }

    // ➌ inspect Epic status
    const epicVariant = usedMatch.variants.find(v => v.appStore === "EPIC");
    const status = epicVariant?.gfn.library.status;
    console.log(`[GFN] 🎮 "${usedMatch.title}" → Epic status: ${status}`);

    // ➍ skip UI if already owned/synced
    if (status !== "NOT_OWNED") {
      console.log(`[GFN] ℹ️ "${usedMatch.title}" is already owned/synced`);
      syncedGames.push(usedMatch.title);
      return this.searchNext();
    }

    // ➎ click the matching DOM card by index
    const idx = items.indexOf(usedMatch);
    const cards = Array.from(document.querySelectorAll("gfn-game-tile"));
    const card  = cards[idx];
    if (!card) {
      console.warn(
        `[GFN] ❌ No DOM card at index ${idx} for "${usedMatch.title}"`
      );
      skippedGames.push(title);
      return this.searchNext();
    }

    const clickTarget = card.childNodes[0]?.childNodes[0]?.childNodes[0];
    if (!clickTarget) {
      console.warn(`[GFN] ❌ Click target missing for "${usedMatch.title}"`);
      skippedGames.push(title);
      return this.searchNext();
    }

    clickTarget.click();
    console.log(`[GFN] 📂 Opened tile for: "${usedMatch.title}"`);
    setTimeout(() => this.clickEpicTagAndAdd(), TILE_DELAY);
  },

  clickEpicTagAndAdd() {
    if (stopFlag) return;
    const title = this.currentTitle;

    setTimeout(() => {
      if (stopFlag) return;

      const storeSection = document.querySelector(
        ".evidence-panel-description-row"
      );
      const hasEpic = storeSection
        ?.textContent
        .toLowerCase()
        .includes("epic games store");

      if (!hasEpic) {
        console.warn(
          `[GFN] 🚫 Epic Games Store not available for "${title}", switching store…`
        );
        return this.changeStoreToEpic();
      }

      console.log(`[GFN] ▶️ Found Epic chip for "${title}", proceeding to add`);
      Array.from(storeSection.querySelectorAll("mat-chip"))
        .find(c => c.textContent.toLowerCase().includes("epic games store"))
        ?.click();

      setTimeout(() => this.markAsOwned(), TILE_DELAY);
    }, TILE_DELAY);
  },

  markAsOwned() {
    const title = this.currentTitle;

    const addBtn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent.toUpperCase().includes("MARK AS OWNED"));

    if (!addBtn) {
      console.log(
        `[GFN] ℹ️ Already owned or no "MARK AS OWNED" for "${title}"`
      );
      syncedGames.push(title);
      return this.searchNext();
    }

    addBtn.click();
    console.log(`[GFN] 🟢 Clicked "MARK AS OWNED" for "${title}"`);

    setTimeout(() => {
      const confirmBtn = document.querySelector(
        "button.mat-flat-button.mat-accent"
      );
      if (confirmBtn) {
        confirmBtn.click();
        console.log(`[GFN] ✅ Marked as owned: "${title}"`);
        syncedGames.push(title);
      } else {
        console.warn(`[GFN] ❌ Confirm dialog missing for "${title}"`);
        skippedGames.push(title);
      }
      setTimeout(() => this.searchNext(), CONFIRM_DELAY);
    }, CONFIRM_DELAY);
  },

  changeStoreToEpic() {
    const title = this.currentTitle;

    // ① open the “⋮” menu
    const menuBtn = document.querySelector(
      'gfn-game-details-actions button.more-actions-button'
    );
    if (!menuBtn) {
      console.warn(`[GFN] ❌ “More actions” button not found for "${title}"`);
      return this.searchNext();
    }
    menuBtn.click();

    setTimeout(() => {
      // ② click “Change game store”
      const panels = Array.from(
        document.querySelectorAll("mat-menu-panel, div.mat-menu-panel")
      );
      const changeItem = panels[0]
        ?.querySelectorAll("button")
        && Array.from(panels[0].querySelectorAll("button"))
             .find(b => b.textContent.trim().includes("Change game store"));

      if (!changeItem) {
        console.warn(
          `[GFN] ❌ “Change game store” not found for "${title}"`
        );
        return this.searchNext();
      }
      changeItem.click();

      setTimeout(() => {
        // ③ click “Epic Games Store”
        const panels2 = Array.from(
          document.querySelectorAll("mat-menu-panel, div.mat-menu-panel")
        );
        const epicOption = panels2[1]
          ?.querySelectorAll("button span")
          && Array.from(panels2[1].querySelectorAll("button span"))
               .find(span => span.textContent.trim() === "Epic Games Store");

        if (!epicOption) {
          console.warn(
            `[GFN] ❌ “Epic Games Store” option not found for "${title}"`
          );
          return this.searchNext();
        }
        epicOption.click();
        console.log(`[GFN] 🔄 Store switched to Epic for "${title}"`);

        // ④ now retry the add flow
        setTimeout(() => this.clickEpicTagAndAdd(), TILE_DELAY);
      }, TILE_DELAY);
    }, TILE_DELAY);
  },

  reportSummary() {
    console.log("\n[GFN] Summary:");
    console.table({
      Synced: syncedGames.length,
      Skipped: skippedGames.length,
      "Name mismatches": nameMismatches.length
    });
    if (nameMismatches.length) console.table(nameMismatches);
  }
};

gfn.run();
