let stopFlag = false;

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "c") {
    stopFlag = true;
    console.warn("🛑 Ctrl+C detected. Halting script after current task...");
  }
});

let gfn = {
  index: 0,
  searchInput: null,

  async run() {
    if (stopFlag) return;
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
    if (this.index >= gameTitles.length) {
      console.log("✅ All games processed.");
      this.index = 0;
      return;
    }

    const title = gameTitles[this.index];
    console.log(`🔍 Searching: ${title}`);
    this.searchInput.value = title;
    this.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    this.searchInput.click();

    setTimeout(() => this.openFirstTile(title), 2000);
  },

  openFirstTile(title) {
    if (stopFlag) return;
    const tile = document.querySelector(
      "body > gfn-root > gfn-back-to-exit-app > gfn-main-content > div > div > gfn-navigation > gfn-desktop-navigation > div > gfn-sidebar > mat-drawer-container > mat-drawer-content > div > div > gfn-game-section-grid > div > div:nth-child(3) > mat-sidenav-container > mat-sidenav-content > div > cdk-virtual-scroll-viewport > div.cdk-virtual-scroll-content-wrapper > div > div:nth-child(1) > gfn-games-grid-row > div > div.game-tile-container-shell > div:nth-child(1) > gfn-game-tile > div > div > div.crimson.constants-position-relative > div > img"
    );
    if (!tile) {
      console.warn(`⚠️ Game tile not found for: ${title}`);
      this.index++;
      setTimeout(() => this.searchNext(), 2000);
      return;
    }

    tile.click();
    console.log(`📂 Opening tile for: ${title}`);
    setTimeout(() => this.clickEpicTagAndAdd(), 2000);
  },

  clickEpicTagAndAdd() {
    if (stopFlag) return;
    const expectedTitle = gameTitles[this.index];

    setTimeout(() => {
      if (stopFlag) return;
      const titleElement = document.querySelector(
        "body > gfn-root > gfn-back-to-exit-app > gfn-main-content > div > div > gfn-navigation > gfn-desktop-navigation > div > gfn-sidebar > mat-drawer-container > mat-drawer-content > div > div > gfn-game-section-grid > div > div:nth-child(3) > mat-sidenav-container > mat-sidenav-content > div > cdk-virtual-scroll-viewport > div.cdk-virtual-scroll-content-wrapper > div > div:nth-child(1) > gfn-games-grid-row > div > div.game-detail-host-container > gfn-game-detail-component > gfn-evidence-panel-tile > div > div"
      );
      const actualTitle = titleElement?.textContent?.trim();
      const normalize = str => str.toLowerCase().replace(/[^\w\s]/gi, '').trim();

      if (!actualTitle) {
        console.warn("❌ Game title not found on detail page");
        this.index++;
        return setTimeout(() => this.searchNext(), 2000);
      }

      if (normalize(actualTitle) !== normalize(expectedTitle)) {
        console.warn(`⛔ Title mismatch: "${actualTitle}" vs expected "${expectedTitle}"`);
        this.index++;
        return setTimeout(() => this.searchNext(), 2000);
      }

      // ✅ Check store section for "Epic Games Store" text
      const storeSection = document.querySelector(
        "body > gfn-root > gfn-back-to-exit-app > gfn-main-content > div > div > gfn-navigation > gfn-desktop-navigation > div > gfn-sidebar > mat-drawer-container > mat-drawer-content > div > div > gfn-game-section-grid > div > div:nth-child(3) > mat-sidenav-container > mat-sidenav-content > div > cdk-virtual-scroll-viewport > div.cdk-virtual-scroll-content-wrapper > div > div:nth-child(1) > gfn-games-grid-row > div > div.game-detail-host-container > gfn-game-detail-component > gfn-evidence-panel-tile > div > div.evidence-panel-description-row"
      );

      if (!storeSection || !storeSection.textContent?.toLowerCase().includes("epic games store")) {
        console.warn("🚫 Epic Games Store not found in store section. Skipping.");
        this.index++;
        return setTimeout(() => this.searchNext(), 2000);
      }

      // ✅ Optional chip click
      const chipList = storeSection.querySelector("mat-chip-list");
      const chips = chipList?.querySelectorAll("mat-chip") || [];

      chips.forEach(chip => {
        if (chip.textContent?.toLowerCase().includes("epic games store")) {
          chip.click();
          console.log("🎮 Clicked Epic Games Store chip (optional)");
        }
      });

      // ✅ Try add to library
      const addButton = document.querySelector(
        "body > gfn-root > gfn-back-to-exit-app > gfn-main-content > div > div > gfn-navigation > gfn-desktop-navigation > div > gfn-sidebar > mat-drawer-container > mat-drawer-content > div > div > gfn-game-section-grid > div > div:nth-child(3) > mat-sidenav-container > mat-sidenav-content > div > cdk-virtual-scroll-viewport > div.cdk-virtual-scroll-content-wrapper > div > div:nth-child(1) > gfn-games-grid-row > div > div.game-detail-host-container > gfn-game-detail-component > gfn-evidence-panel-tile > div > div > div > div > button"
      );

      if (addButton && addButton.textContent.includes("MARK AS OWNED")) {
        addButton.click();

        setTimeout(() => {
          const confirmButton = document.querySelector("button.mat-flat-button.mat-accent");
          if (confirmButton) {
            confirmButton.click();
            console.log("✅ Confirmed in dialog");
          } else {
            console.warn("❌ Confirm button not found");
          }
        }, 2000);

        console.log("✅ Add button clicked");
      } else {
        console.log("ℹ️ Add button not found or already added");
      }

      this.index++;
      setTimeout(() => this.searchNext(), 2000);
    }, 2000);
  }
};
