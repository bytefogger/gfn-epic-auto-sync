# 🎮 GeForce NOW Epic Games Auto-Sync

This project automates the process of syncing your **Epic Games Store library** with your **GeForce NOW** account.

---

## 📦 File Structure

- `epicGamesList.js` — Extracts your Epic game titles from your transaction history  
- `main.js` — Runs the automation in GeForce NOW to tag those games  
- `README.md` — This guide  
- `LICENSE` — MIT license

---

## 🚀 How to Use

### Step 1: Extract Epic Games Library

1. Open:  
   https://store.epicgames.com/account/transactions

2. Open Developer Console (`F12` → **Console** tab).

3. Paste and run the contents of `epicGamesList.js`.

4. It will:
   - Auto-click **"Show More"**
   - Extract all purchased game titles
   - Print a list of game titles in the console under `epicGames.gameTitles`

> 📋 Copy the printed array from the console (you’ll use it in the next step).

---

### Step 2: Extract Amazon Prime Gaming Titles

1. **Open the following page** in your browser:  
   https://gaming.amazon.com/my-collection?offerType=games

2. **Open Developer Tools**:  
   Press `F12` (or `Ctrl+Shift+I` / `Cmd+Opt+I` on Mac) and switch to the **Console** tab.

3. **Paste and run** the contents of the `amazonPrime.js` script into the console.

4. The script will automatically:
   - Click all **"Show More" / "Load More"** buttons
   - Navigate through all **paginated pages**
   - Extract the titles of all **redeemed games**

> 📋 Copy the printed array from the console (you’ll use it in the next step).

---

### Step 3: Run GeForce NOW Auto-Tagging

1. Go to the tab opened by the previous script, or manually open:  
   https://play.geforcenow.com/

2. Wait until the entire UI has loaded.

3. Open Developer Console (`F12` → **Console** tab).

4. Paste this first (replace with your list):

   ```js
   const gameTitles = [
     "Fortnite",
     "Alan Wake Remastered",
     "Control"
   ];
   ```

5. Then paste and run the contents of `main.js`.

6. Finally, start the script:

   ```js
   gfn.run();
   ```

---

## ✋ How to Stop the Script

You can stop the automation at any point by pressing:

**Ctrl + C**

It will finish the current game and halt gracefully.

---

## ⚠️ Notes

- Some games may **not match** exactly between Epic and GeForce NOW (e.g., editions, renamed titles). These will be skipped.
- The script uses **hard-coded DOM selectors** — if the UI changes, you may need to update the script.
- It's intended for **desktop browser use** with sufficient screen resolution and loading speed.
- This is a user-side utility, not affiliated with Epic Games or NVIDIA.

---

## 📄 License

Released under the [MIT License](LICENSE). Use it freely, modify it, or contribute back!
