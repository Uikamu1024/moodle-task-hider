(() => {
  const STORAGE_KEY = "hiddenTasks";
  const PROCESSED_ATTR = "data-mth-processed";
  const HEADING_RE = /^\d{4}年\s*\d{1,2}月\s*\d{1,2}日/;

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

  // 見出し（「2026年 06月 17日(水曜日)」など）の直下にある課題が
  // すべて非表示になった場合は見出し自体も非表示にする
  const isHeadingEl = (el) =>
    el.children.length === 0 && HEADING_RE.test(el.textContent.trim());

  const findHeadingRoot = (items) => {
    let node = items[0];
    for (let i = 0; i < 8 && node.parentElement; i++) {
      node = node.parentElement;
      const matches = node.textContent.match(new RegExp(HEADING_RE, "g"));
      if (matches && matches.length >= 2) return node;
    }
    return node;
  };

  const updateHeadings = () => {
    const items = Array.from(
      document.querySelectorAll(ITEM_SELECTORS.join(","))
    );
    if (items.length === 0) return;
    const root = findHeadingRoot(items);
    if (!root) return;

    const itemSet = new Set(items);
    const all = root.querySelectorAll("*");

    let currentHeading = null;
    let currentItems = [];
    const sections = [];

    all.forEach((el) => {
      if (itemSet.has(el)) {
        if (currentHeading) currentItems.push(el);
        return;
      }
      if (isHeadingEl(el)) {
        if (currentHeading) {
          sections.push({ heading: currentHeading, items: currentItems });
        }
        currentHeading = el;
        currentItems = [];
      }
    });
    if (currentHeading) {
      sections.push({ heading: currentHeading, items: currentItems });
    }

    sections.forEach(({ heading, items: sectionItems }) => {
      if (sectionItems.length === 0) return;
      const allHidden = sectionItems.every((it) =>
        it.classList.contains("mth-hidden")
      );
      heading.classList.toggle("mth-hidden", allHidden);
    });
  };

  const processItem = async (el) => {
    if (el.getAttribute(PROCESSED_ATTR)) return;
    el.setAttribute(PROCESSED_ATTR, "1");

    if (getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mth-hide-btn";
    btn.title = "この課題を非表示にする";
    btn.textContent = "×";

    el.appendChild(btn);

    const hidden = await getHidden();
    const hiddenKeys = new Set(hidden.map((t) => t.key));
    applyHiddenState(el, hiddenKeys);
  };

  // ボタンを個別にバインドせず、document側で委譲することで
  // Moodle側のDOM再構築によるイベントリスナー消失を防ぐ
  document.addEventListener(
    "click",
    async (e) => {
      const btn = e.target.closest(".mth-hide-btn");
      if (!btn) return;
      const el = btn.closest(ITEM_SELECTORS.join(","));
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();

      const key = getTaskKey(el);
      const label = getTaskLabel(el);
      const link = el.querySelector("a[href]");
      const url = link ? link.href : "";

      await hideTask(key, label, url);
      el.classList.add("mth-hidden");
      updateHeadings();
    },
    true
  );

  const scan = () => {
    const seen = new Set();
    ITEM_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        processItem(el);
      });
    });
    updateHeadings();
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
    updateHeadings();
  });
})();
