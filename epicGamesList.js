const epicGames = {
  gameTitles: new Set(),
  pendingRequests: 0,
  doneLoading: false,
  clickInterval: null,

  init() {
    this.hookFetch();
    this.hookXHR();
    this.startAutoClick();
  },

  hookFetch() {
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = (typeof input === 'string' ? input : input.url) || '';
      const promise = originalFetch(input, init);

      if (url.includes('/account/v2/payment/ajaxGetOrderHistory')) {
        this.pendingRequests++;
        promise
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.clone().json();
          })
          .then(data => this.onResponse(data.orders))
          .catch(err => console.error('Fetch hook error:', err))
          .finally(() => this.checkDone());
      }

      return promise;
    };
  },

  hookXHR() {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._url = url;
      return origOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (body) {
      if (this._url && this._url.includes('/account/v2/payment/ajaxGetOrderHistory')) {
        epicGames.pendingRequests++;
        this.addEventListener('load', () => {
          if (this.status === 200) {
            try {
              const data = JSON.parse(this.responseText);
              epicGames.onResponse(data.orders);
            } catch (e) {
              console.error('XHR hook JSON parse error:', e);
            }
          }
          epicGames.checkDone();
        });
      }
      return origSend.call(this, body);
    };
  },

  startAutoClick() {
    this.clickInterval = setInterval(() => {
      const btn = document.querySelector("#next-btn");
      if (btn && !btn.disabled) {
        btn.click();
      } else {
        clearInterval(this.clickInterval);
        this.doneLoading = true;
        console.log('✅ All pages requested; awaiting last responses…');
        this.checkDone();
      }
    }, 300);
  },

  onResponse(orders = []) {
    let newCount = 0;
    orders.forEach(order =>
      order.items.forEach(item => {
        const title = item.description.trim();
        if (title && !this.gameTitles.has(title)) {
          this.gameTitles.add(title);
          newCount++;
        }
      })
    );
    if (newCount > 0) {
      console.log(`[Progress] +${newCount} new, total ${this.gameTitles.size}`);
    } else {
      console.log(`[Progress] no new titles, total still ${this.gameTitles.size}`);
    }
  },

  checkDone() {
    if (this.doneLoading && this.pendingRequests <= 0) {
      console.log('🎉 All done! Final titles:', Array.from(this.gameTitles));
    }
    // If there are still pendingRequests, we wait. Each hook decrements itself via finally().
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
  },
};

// Start collecting
epicGames.init();
