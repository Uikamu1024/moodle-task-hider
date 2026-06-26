const STORAGE_KEY = "hiddenTasks";

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const template = document.getElementById("item-template");

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

const render = async () => {
  const hidden = await getHidden();
  listEl.innerHTML = "";
  emptyEl.hidden = hidden.length > 0;

  hidden
    .sort((a, b) => b.hiddenAt - a.hiddenAt)
    .forEach((task) => {
      const node = template.content.cloneNode(true);
      const labelEl = node.querySelector(".item-label");
      const btn = node.querySelector(".restore-btn");
      labelEl.textContent = task.label;
      labelEl.title = task.label;
      btn.addEventListener("click", async () => {
        const current = await getHidden();
        await setHidden(current.filter((t) => t.key !== task.key));
        render();
      });
      listEl.appendChild(node);
    });
};

render();
