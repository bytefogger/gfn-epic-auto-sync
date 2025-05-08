// Auto-click "Show More" and collect game names
let epicGames = {
  gameTitles: [],
  clckInterval: null,

  start() {
    this.clckInterval = setInterval(() => {
      const btn = document.querySelector("#payment-history-show-more-button");
      if (btn) {
        btn.click();
      } else {
        clearInterval(this.clckInterval);
        this.extractTitles();
      }
    }, 300);
  },

  extractTitles() {
    const spans = document.querySelectorAll("span.MuiTypography-root.MuiTypography-body2.am-1vpuhu6");
    this.gameTitles = Array.from(spans)
      .map(el => el.textContent?.trim())
      .filter(title => title && title.toLowerCase() !== "purchased");

    console.log("🎮 Collected titles:", this.gameTitles);
  }
};

epicGames.start();
