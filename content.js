(() => {
  const STORAGE_KEY = "hiddenTasks";
  const PROCESSED_ATTR = "data-mth-processed";

  // Moodleのダッシュボード/タイムラインに使われる代表的なセレクタ
  const ITEM_SELECTORS = [
    '[data-region="event-list-item"]',
    "li.list-group-item",
    ".timeline-event-list-item",
  ];

  const getTaskKey = (el) => {
    const link = el.querySelector("a[href]");
    if (link) {
      try {
        const url = new URL(link.href);
        return url.origin + url.pathname + url.search;
      } catch {
        return link.href;
      }
    }
    return el.textContent.trim().slice(0, 200);
  };

  const getTaskLabel = (el) => {
    const link = el.querySelector("a[href]");
    const title = link ? link.textContent.trim() : el.textContent.trim();
    return title.slice(0, 120) || "(無題の課題)";
  };

  const getHidden = () =>
    new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        resolve(res[STORAGE_KEY] || []);
      });
    });

  const setHidden = (list) =>
    new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: list }, resolve);
    });

  const hideTask = async (key, label, url) => {
    const list = await getHidden();
    if (!list.some((t) => t.key === key)) {
      list.push({ key, label, url, hiddenAt: Date.now() });
      await setHidden(list);
    }
  };

  const applyHiddenState = (el, hiddenKeys) => {
    const key = getTaskKey(el);
    el.classList.toggle("mth-hidden", hiddenKeys.has(key));
  };

  const processItem = async (el) => {
    if (el.getAttribute(PROCESSED_ATTR)) return;
    el.setAttribute(PROCESSED_ATTR, "1");

    const key = getTaskKey(el);
    const label = getTaskLabel(el);
    const link = el.querySelector("a[href]");
    const url = link ? link.href : "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mth-hide-btn";
    btn.title = "この課題を非表示にする";
    btn.textContent = "×";
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await hideTask(key, label, url);
      el.classList.add("mth-hidden");
    });

    el.appendChild(btn);

    const hidden = await getHidden();
    const hiddenKeys = new Set(hidden.map((t) => t.key));
    applyHiddenState(el, hiddenKeys);
  };

  const scan = () => {
    const seen = new Set();
    ITEM_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        processItem(el);
      });
    });
  };

  scan();

  const observer = new MutationObserver(() => {
    scan();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes[STORAGE_KEY]) return;
    const hiddenKeys = new Set(
      (changes[STORAGE_KEY].newValue || []).map((t) => t.key)
    );
    document
      .querySelectorAll(ITEM_SELECTORS.join(","))
      .forEach((el) => applyHiddenState(el, hiddenKeys));
  });
})();
