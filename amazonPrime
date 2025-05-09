(async function extractEpicGamesOnly() {
  console.log("🔄 Starting Epic Games Store title extraction...");

  // === STEP 0: Open paginator dropdown and get buttons container
  async function openPaginatorDropdownAndGetContainer() {
    const toggleButton = document.querySelector(
      "#root > div > div > main > div > div > div > div > div.tw-pd-x-3.tw-sm-pd-x-0 > div.time-window-filters.tw-align-items-center.tw-flex.tw-flex-row.tw-full-width.tw-md-mg-t-3.tw-mg-t-1.tw-sm-mg-t-2 > div > div > div > div:nth-child(1) > button"
    );
    if (!toggleButton) return null;

    toggleButton.click();
    for (let i = 0; i < 20; i++) {
      const container = document.querySelector(
        "div.tw-absolute.tw-block.tw-bubble.tw-bubble--center.tw-bubble--down.tw-bubble--md > div > div > div"
      );
      if (container?.children?.length) return container;
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  }

  // === STEP 1: Scroll & click "Load More" repeatedly
  async function autoClickLoadMore() {
    const selector = "#root > div > div > main > div > div > div > div > div > div > button";
    let count = 0;
    while (true) {
      const button = document.querySelector(selector);
      if (!button) break;

      button.scrollIntoView({ behavior: "smooth", block: "center" });
      await new Promise(r => setTimeout(r, 500));
      button.click();
      count++;
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log(`✅ Load More clicked ${count} times.`);
  }

  // === STEP 2: Extract Epic Games titles from page
  function getEpicGamesTitlesFromPage() {
    const entries = document.querySelectorAll('[data-a-target="accordion_entry"]');
    const titles = [];

    entries.forEach((entry, i) => {
      const titleEl = entry.querySelector("h3[title]");
      const innerHTML = entry.innerHTML.toLowerCase();

      const isEpic = innerHTML.includes("epic games store");
      if (titleEl && isEpic) {
        const title = titleEl.textContent.trim();
        titles.push(title);
        console.log(`🎯 [${i + 1}] ${title}`);
      }
    });

    return titles;
  }

  // === STEP 3: Paginate through pages
  function makeNextPageFunction() {
    let index = 1;
    return async function () {
      const container = await openPaginatorDropdownAndGetContainer();
      if (!container) return false;
      const buttons = container.children;
      if (index >= buttons.length) {
        console.log("✅ No more pages.");
        return false;
      }
      console.log(`📄 Navigating to page ${index + 1}`);
      buttons[index].click();
      index++;
      await new Promise(r => setTimeout(r, 2000));
      return true;
    };
  }

  // === STEP 4: Combine all steps across pages
  const nextPage = makeNextPageFunction();
  const allTitles = [];
  let page = 1;

  do {
    console.log(`\n📘 Page ${page} ---------------------`);
    await autoClickLoadMore();
    allTitles.push(...getEpicGamesTitlesFromPage());
    await new Promise(r => setTimeout(r, 1000));
    page++;
  } while (await nextPage());

  // === STEP 5: Output and copy to clipboard
  const uniqueTitles = [...new Set(allTitles)];
  console.log(`\n🎉 Done. Found ${uniqueTitles.length} Epic Games titles.`);
  console.log(uniqueTitles);

  const output = uniqueTitles.join("\n");
  navigator.clipboard.writeText(output)
    .then(() => console.log("📋 Copied to clipboard."))
    .catch(err => console.warn("⚠️ Clipboard copy failed:", err));
})();
