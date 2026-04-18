const epicGames = {
  gameTitles: new Set(),
  pendingRequests: 0,
  doneLoading: false,
  clickInterval: null,

  init() {
    this.scrapeInitialDOM();
    this.hookFetch();
    this.hookXHR();
    this.startAutoClick();
  },

  scrapeInitialDOM() {
    let count = 0;
    const text = document.body.innerText;
    const regex = /Purchased[\r\n]+([^\r\n]+)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const title = match[1].trim();
      if (title && !this.gameTitles.has(title)) {
        this.gameTitles.add(title);
        count++;
      }
    }
    console.log(`[Progress] Scraped ${count} titles from the initial page.`);
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
          .then(data => {
            if (data && data.orders) this.onResponse(data.orders);
          })
          .catch(err => console.error('Fetch hook error:', err))
          .finally(() => {
            this.pendingRequests--;
            this.checkDone();
          });
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
        
        // 'loadend' fires exactly once when the request stops (success, error, timeout, or abort)
        this.addEventListener('loadend', () => {
          if (this.status === 200 && this.responseText) {
            try {
              const data = JSON.parse(this.responseText);
              if (data && data.orders) {
                epicGames.onResponse(data.orders);
              }
            } catch (e) {
              console.error('XHR hook JSON parse error:', e);
            }
          }
          epicGames.pendingRequests--;
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
        
        // Failsafe: Force completion after 5 seconds if a request got stuck
        setTimeout(() => {
          if (this.pendingRequests > 0) {
            console.log('⚠️ Timeout waiting for a stuck request. Forcing output...');
            this.pendingRequests = 0;
            this.checkDone();
          }
        }, 5000);
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
  },
};

// Start collecting
epicGames.init();
