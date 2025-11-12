/* script.js - improved */
/* Replace WORKER_URL with your Cloudflare Worker URL */
const WORKER_URL = "https://lorealroutinebuilder.debanhi-sandoval01.workers.dev/";

/* DOM refs */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const productModal = document.getElementById("productModal");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");

/* State & persistence keys */
let products = [];
let selected = []; // array of product ids
let conversation = []; // array of {role, content}
const KEY_SELECTED = "sr_selected_products_v1";
const KEY_CONVO = "sr_conversation_v1";

/* Helpers */
const el = id => document.getElementById(id);
const saveSelected = () => localStorage.setItem(KEY_SELECTED, JSON.stringify(selected));
const loadSelected = () => {
  try { selected = JSON.parse(localStorage.getItem(KEY_SELECTED)) || []; } catch { selected = []; }
};
const saveConversation = () => localStorage.setItem(KEY_CONVO, JSON.stringify(conversation));
const loadConversation = () => {
  try { conversation = JSON.parse(localStorage.getItem(KEY_CONVO)) || []; } catch { conversation = []; }
};
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* UI append */
function appendMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = (role === "user" ? "You: " : role === "assistant" ? "Bot: " : "") + text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Load products.json */
async function loadProducts() {
  const res = await fetch("products.json");
  const data = await res.json();
  products = data.products || [];
  return products;
}

/* Render product cards */
function renderProducts(list = []) {
  if (!list.length) {
    productsContainer.innerHTML = `<div class="placeholder-message">Select a category to view products</div>`;
    return;
  }
  productsContainer.innerHTML = list.map(p => {
    const sel = selected.includes(p.id) ? "selected" : "";
    return `
      <div class="product-card ${sel}" data-id="${p.id}" tabindex="0" role="button" aria-pressed="${selected.includes(p.id)}" aria-label="${escapeHtml(p.name)}">
        <img src="${p.image}" alt="${escapeHtml(p.name)}" />
        <div class="product-info">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.brand)}</p>
          <div class="product-actions">
            <button class="desc-btn" data-id="${p.id}" type="button">Details</button>
            <button class="select-btn" data-id="${p.id}" type="button">${selected.includes(p.id) ? "Remove" : "Select"}</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

/* Event delegation for product area */
productsContainer.addEventListener("click", (e) => {
  const card = e.target.closest(".product-card");
  if (!card) return;
  const id = Number(card.getAttribute("data-id"));
  if (e.target.matches(".select-btn") || e.target === card) {
    toggleSelection(id);
  } else if (e.target.matches(".desc-btn")) {
    showDetails(id);
  }
});

/* keyboard select on Enter for accessibility */
productsContainer.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const card = e.target.closest(".product-card");
    if (!card) return;
    const id = Number(card.getAttribute("data-id"));
    toggleSelection(id);
  }
});

/* Toggle product selection */
function toggleSelection(id) {
  const exists = selected.includes(id);
  if (exists) selected = selected.filter(x => x !== id);
  else selected.push(id);
  saveSelected();
  updateSelectedList();
  const currentCategory = categoryFilter.value;
  const toShow = currentCategory ? products.filter(p => p.category === currentCategory) : products;
  renderProducts(toShow);
}

/* Update selected product chips */
function updateSelectedList() {
  if (!selected.length) {
    selectedProductsList.innerHTML = `<div class="placeholder-message">No products selected</div>`;
    return;
  }
  selectedProductsList.innerHTML = selected.map(id => {
    const p = products.find(x => x.id === id);
    if (!p) return "";
    return `<div class="selected-chip" data-id="${p.id}">
      <img src="${p.image}" alt="${escapeHtml(p.name)}" />
      <div class="chip-meta"><strong>${escapeHtml(p.name)}</strong><button class="remove-chip" data-id="${p.id}" aria-label="Remove ${escapeHtml(p.name)}">×</button></div>
    </div>`;
  }).join("");
  // attach remove listeners
  selectedProductsList.querySelectorAll(".remove-chip").forEach(b => {
    b.onclick = () => {
      const id = Number(b.getAttribute("data-id"));
      selected = selected.filter(x => x !== id);
      saveSelected();
      updateSelectedList();
      const cur = categoryFilter.value;
      renderProducts(cur ? products.filter(p => p.category === cur) : products);
    };
  });
}

/* Show details in accessible modal */
function showDetails(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  modalBody.innerHTML = `<h3>${escapeHtml(p.name)}</h3><p><em>${escapeHtml(p.brand)}</em></p><img src="${p.image}" alt="${escapeHtml(p.name)}" style="max-width:160px"/><p>${escapeHtml(p.description)}</p>`;
  productModal.setAttribute("aria-hidden", "false");
  productModal.style.display = "block";
  modalClose.focus();
}
modalClose.addEventListener("click", () => {
  productModal.setAttribute("aria-hidden", "true");
  productModal.style.display = "none";
});
productModal.addEventListener("click", (e) => { if (e.target === productModal) { productModal.setAttribute("aria-hidden", "true"); productModal.style.display = "none"; }});

/* Category change */
categoryFilter.addEventListener("change", () => {
  const cat = categoryFilter.value;
  const filtered = cat ? products.filter(p => p.category === cat) : [];
  renderProducts(filtered);
});

/* Generate Routine: send selected products to Worker */
generateRoutineBtn.addEventListener("click", async () => {
  if (!selected.length) {
    appendMessage("assistant", "Please select at least one product before generating a routine.");
    return;
  }
  const items = selected.map(id => products.find(p => p.id === id)).filter(Boolean);
  const listText = items.map(p => `- ${p.brand} — ${p.name} (category: ${p.category}). ${p.description}`).join("\n");
  const userMsg = `Create a concise personalized routine using these selected products:\n${listText}`;
  conversation.push({ role: "user", content: userMsg });
  saveConversation();
  appendMessage("user", "Generate routine for selected products.");
  await sendConversationToWorker();
});

/* Chat submit (follow-ups) */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const txt = userInput.value.trim();
  if (!txt) return;
  userInput.value = "";
  conversation.push({ role: "user", content: txt });
  saveConversation();
  appendMessage("user", txt);
  await sendConversationToWorker();
});

/* Send conversation to Worker and handle reply */
async function sendConversationToWorker() {
  const thinking = appendThinking();
  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation })
    });
    const text = await resp.text();
    if (!resp.ok) {
      removeThinking(thinking);
      appendMessage("assistant", `Error: ${resp.status} ${text}`);
      return;
    }
    let data;
    try { data = JSON.parse(text); } catch {
      removeThinking(thinking);
      appendMessage("assistant", "Invalid JSON response from server.");
      return;
    }
    removeThinking(thinking);

    if (data && data.error === "out_of_scope") {
      const msg = data.message || "I'm sorry — I can only answer questions about beauty and health care.";
      conversation.push({ role: "assistant", content: msg });
      saveConversation();
      appendMessage("assistant", msg);
      return;
    }

    const assistantText = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || JSON.stringify(data);
    const reply = assistantText.trim();
    conversation.push({ role: "assistant", content: reply });
    saveConversation();
    appendMessage("assistant", reply);
  } catch (err) {
    removeThinking(thinking);
    appendMessage("assistant", `Network error: ${err.message || err}`);
  }
}

function appendThinking() {
  const node = document.createElement("div");
  node.className = "msg assistant";
  node.textContent = "Bot: …thinking…";
  chatWindow.appendChild(node);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return node;
}
function removeThinking(node) { if (node && node.remove) node.remove(); }

/* Init */
(async function init() {
  loadSelected();
  loadConversation();
  await loadProducts();
  updateSelectedList();
  // initial product list: none until category chosen; but render selected if category already chosen
  const cur = categoryFilter.value;
  renderProducts(cur ? products.filter(p => p.category === cur) : []);
  // restore conversation to chat window
  conversation.forEach(m => appendMessage(m.role, m.content));
})();


