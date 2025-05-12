// ─── ➊ YOUR LIST ─────────────────────────────────────────────────────────
let gameTitles = []; // ← fill this with your list of game titles

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

// ─── ➋ XHR HOOK ──────────────────────────────────────────────────────────
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

// ─── ➌ MAIN LOGIC ─────────────────────────────────────────────────────────
let gfn = {
  total: 0,
  searchInput: null,

  async run() {
    this.total = gameTitles.length;
    if (this.total === 0) {
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

    if (gameTitles.length === 0) {
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

    // ➊ try exact title match with an Epic variant
    const match = items.find(i =>
      norm(i.title) === norm(title) &&
      i.variants.some(v => v.appStore === "EPIC")
    );

    // ➋ fallback-only to record a mismatch then SKIP
    if (!match) {
      const first = items[0];
      const epicFirst = first?.variants.find(v => v.appStore === "EPIC");
      if (first && epicFirst) {
        nameMismatches.push({ expected: title, found: first.title });
        console.warn(
          `[GFN][WARN] Name mismatch: expected "${title}", found "${first.title}". Skipping.`
        );
      } else {
        console.warn(
          `[GFN][WARN] "${title}" not in network result and no Epic fallback`
        );
      }
      skippedGames.push(title);
      return this.searchNext();
    }

    const usedMatch = match;

    // ➌ inspect Epic variant status
    const epicVariant = usedMatch.variants.find(v => v.appStore === "EPIC");
    const status = epicVariant.gfn.library.status;
    console.log(`[GFN] 🎮 "${usedMatch.title}" → Epic status: ${status}`);

    // ➍ skip UI if already owned or synced
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
      console.warn(
        `[GFN] ❌ Click target missing for "${usedMatch.title}"`
      );
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

  setTimeout(async () => {
    if (stopFlag) return;

    // do we already have the Epic chip?
    const storeSection = document.querySelector(".evidence-panel-description-row");
    const hasEpicChip = storeSection?.textContent.toLowerCase().includes("epic games store");

    if (!hasEpicChip) {
      console.warn(`[GFN] ⚠ "${title}" isn’t on Epic – switching store…`);

      // ➊ click the “more actions” (⋮) button
      const moreBtn = document.querySelector(
        "gfn-game-details-actions button.more-actions-button"
      );
      if (!moreBtn) {
        console.error(`[GFN] ❌ Couldn’t find ⋮ menu for "${title}"`);
        skippedGames.push(title);
        return this.searchNext();
      }
      moreBtn.click();

      // ➋ click “Change game store”
      await new Promise(r => setTimeout(r, 300));
      const changeItem = Array.from(document.querySelectorAll("button.mat-menu-item"))
        .find(b => /change game store/i.test(b.textContent));
      if (!changeItem) {
        console.error(`[GFN] ❌ “Change game store” menu missing`);
        skippedGames.push(title);
        return this.searchNext();
      }
      changeItem.click();

      // ➌ click “Epic Games Store” in the submenu
      await new Promise(r => setTimeout(r, 300));
      const epicOption = Array.from(document.querySelectorAll("button.mat-menu-item"))
        .find(b => /epic games store/i.test(b.textContent));
      if (!epicOption) {
        console.error(`[GFN] ❌ Epic entry missing in store list`);
        skippedGames.push(title);
        return this.searchNext();
      }
      epicOption.click();

      console.log(`[GFN] ▶️ Switched "${title}" to Epic Games Store`);
      // now wait for the panel to re-render
      await new Promise(r => setTimeout(r, TILE_DELAY));
    }

    // normal MARK AS OWNED path
    const addBtn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent.toUpperCase().includes("MARK AS OWNED"));

    if (!addBtn) {
      console.log(`[GFN] ℹ️ Already owned or no "MARK AS OWNED" for "${title}"`);
      syncedGames.push(title);
      return this.searchNext();
    }

    addBtn.click();
    console.log(`[GFN] 🟢 Clicked "MARK AS OWNED" for "${title}"`);

    setTimeout(() => {
      const confirmBtn = document.querySelector("button.mat-flat-button.mat-accent");
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

  }, TILE_DELAY);
},


  reportSummary() {
    console.log("\n[GFN] Summary:");
    console.table({
      Synced: syncedGames.length,
      Skipped: skippedGames.length,
      "Name mismatches": nameMismatches.length
    });
    if (nameMismatches.length) {
      console.table(nameMismatches);
    }
  }
};

gfn.run();
