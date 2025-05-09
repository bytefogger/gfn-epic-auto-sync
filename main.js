let gameTitles = []; // Fill this in before running

let SEARCH_DELAY = 1500; //
let TILE_DELAY = 1000; // Adjust as needed
let CONFIRM_DELAY = 2000; //

let stopFlag = false; // reset to rerun

const syncedGames = [];
const skippedGames = [];
const nameMismatches = [];

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "c") {
    stopFlag = true;
    console.warn("🛑 Ctrl+C detected. Halting script after current task...");
  }
});

let gfn = {
  total: 0,
  searchInput: null,

  async run() {
    this.total = gameTitles.length;
    if (stopFlag || this.total === 0) return;

    this.searchInput = document.querySelector(
      "body > gfn-root > gfn-back-to-exit-app > gfn-main-content > div > div > gfn-navigation > gfn-desktop-navigation > div > gfn-toolbar > nv-app-bar > div > div:nth-child(3) > div > nv-search > div > div > div > div > input"
    );

    if (!this.searchInput) {
      console.error("Search input not found");
      return;
    }

    await this.searchNext();
  },

  async searchNext() {
    if (stopFlag) return;
    if (gameTitles.length === 0) {
      console.log("✅ All games processed.");
      this.reportSummary();
      return;
    }

    const title = gameTitles.shift();
    this.currentTitle = title;
    console.log(`🔍 Searching: ${title} (${this.total - gameTitles.length}/${this.total})`);

    this.searchInput.value = title;
    this.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    this.searchInput.click();

    setTimeout(() => this.openFirstTile(title), SEARCH_DELAY);
  },

  openFirstTile(title) {
    if (stopFlag) return;

    const tile = document.querySelector(
      "body > gfn-root > gfn-back-to-exit-app > gfn-main-content > div > div > gfn-navigation > gfn-desktop-navigation > div > gfn-sidebar > mat-drawer-container > mat-drawer-content > div > div > gfn-game-section-grid > div > div:nth-child(3) > mat-sidenav-container > mat-sidenav-content > div > cdk-virtual-scroll-viewport > div.cdk-virtual-scroll-content-wrapper > div > div:nth-child(1) > gfn-games-grid-row > div > div.game-tile-container-shell > div:nth-child(1) > gfn-game-tile > div > div > div.crimson.constants-position-relative > div > img"
    );

    if (!tile) {
      console.warn(`⚠️ Game tile not found for: ${title}`);
      skippedGames.push(title);
      return setTimeout(() => this.searchNext(), TILE_DELAY);
    }

    tile.click();
    console.log(`📂 Opening tile for: ${title}`);
    setTimeout(() => this.clickEpicTagAndAdd(), TILE_DELAY);
  },

  clickEpicTagAndAdd() {
    if (stopFlag) return;
    const expectedTitle = this.currentTitle;

    setTimeout(() => {
      if (stopFlag) return;

      const storeSection = document.querySelector(
        "body > gfn-root > gfn-back-to-exit-app > gfn-main-content > div > div > gfn-navigation > gfn-desktop-navigation > div > gfn-sidebar > mat-drawer-container > mat-drawer-content > div > div > gfn-game-section-grid > div > div:nth-child(3) > mat-sidenav-container > mat-sidenav-content > div > cdk-virtual-scroll-viewport > div.cdk-virtual-scroll-content-wrapper > div > div:nth-child(1) > gfn-games-grid-row > div > div.game-detail-host-container > gfn-game-detail-component > gfn-evidence-panel-tile > div > div.evidence-panel-description-row"
      );

      if (!storeSection || !storeSection.textContent?.toLowerCase().includes("epic games store")) {
        console.warn("🚫 Epic Games Store not found in store section. Skipping.");
        skippedGames.push(expectedTitle);
        return setTimeout(() => this.searchNext(), SEARCH_DELAY);
      }

      const titleElement = document.querySelector(
        "body > gfn-root > gfn-back-to-exit-app > gfn-main-content > div > div > gfn-navigation > gfn-desktop-navigation > div > gfn-sidebar > mat-drawer-container > mat-drawer-content > div > div > gfn-game-section-grid > div > div:nth-child(3) > mat-sidenav-container > mat-sidenav-content > div > cdk-virtual-scroll-viewport > div.cdk-virtual-scroll-content-wrapper > div > div:nth-child(1) > gfn-games-grid-row > div > div.game-detail-host-container > gfn-game-detail-component > gfn-evidence-panel-tile > div > div"
      );

      const actualTitle = titleElement?.textContent?.trim();
      const normalize = str => str.toLowerCase().replace(/[^\w\s]/gi, '').trim();

      if (!actualTitle) {
        console.warn("❌ Game title not found on detail page");
        skippedGames.push(expectedTitle);
        return setTimeout(() => this.searchNext(), SEARCH_DELAY);
      }

      if (normalize(actualTitle) !== normalize(expectedTitle)) {
        console.warn(`⛔ Title mismatch: "${actualTitle}" vs expected "${expectedTitle}"`);
        nameMismatches.push({ expected: expectedTitle, found: actualTitle });
        skippedGames.push(expectedTitle);
        return setTimeout(() => this.searchNext(), SEARCH_DELAY);
      }

      

      const chipList = storeSection.querySelector("mat-chip-list");
      const chips = chipList?.querySelectorAll("mat-chip") || [];
      chips.forEach(chip => {
        if (chip.textContent?.toLowerCase().includes("epic games store")) {
          chip.click();
        }
      });

      const addButton = document.querySelector(
        "body > gfn-root > gfn-back-to-exit-app > gfn-main-content > div > div > gfn-navigation > gfn-desktop-navigation > div > gfn-sidebar > mat-drawer-container > mat-drawer-content > div > div > gfn-game-section-grid > div > div:nth-child(3) > mat-sidenav-container > mat-sidenav-content > div > cdk-virtual-scroll-viewport > div.cdk-virtual-scroll-content-wrapper > div > div:nth-child(1) > gfn-games-grid-row > div > div.game-detail-host-container > gfn-game-detail-component > gfn-evidence-panel-tile > div > div > div > div > button"
      );

      if (addButton && addButton.textContent.includes("MARK AS OWNED")) {
        addButton.click();

        setTimeout(() => {
          const confirmButton = document.querySelector("button.mat-flat-button.mat-accent");
          if (confirmButton) {
            confirmButton.click();
            console.log(`✅ Synced (${syncedGames.length + 1}/${this.total}): ${expectedTitle}`);
            syncedGames.push(expectedTitle);
          } else {
            console.warn("❌ Confirm button not found");
            skippedGames.push(expectedTitle);
          }
          setTimeout(() => this.searchNext(), CONFIRM_DELAY);
        }, CONFIRM_DELAY);
      } else {
        console.log("ℹ️ Add button not found or already added");
        syncedGames.push(expectedTitle);
        setTimeout(() => this.searchNext(), SEARCH_DELAY);
      }
    }, TILE_DELAY);
  },

  reportSummary() {
    console.log("\n✅ Finished syncing all games.\n");
    console.log(`✔ Synced: ${syncedGames.length}`);
    console.log(`⚠ Skipped: ${skippedGames.length}`);
    console.log(`⛔ Name mismatches: ${nameMismatches.length}`);
    if (nameMismatches.length > 0) console.table(nameMismatches);
  }
};

gfn.run();
