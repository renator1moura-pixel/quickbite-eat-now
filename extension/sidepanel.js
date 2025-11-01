const listEl = document.getElementById("list");
const ctxLine = document.getElementById("ctx-line");

chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB" }, async (res) => {
  if (res && res.tab) {
    ctxLine.textContent = `Você está em: ${res.tab.title || res.tab.url}`;
  } else {
    ctxLine.textContent = "Não consegui detectar a aba atual.";
  }
});
