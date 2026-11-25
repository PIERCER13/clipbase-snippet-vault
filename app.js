// @author piercer
(() => {
  const KEY = "piercer_clipbase_v1";
  const DEMO = [
    {
      id: "s1",
      title: "Resposta Rápida — Envio de Pedido",
      cat: "Suporte",
      tags: ["cliente", "envio"],
      body: "Olá {{cliente}}!\nSeu pedido #{{pedido}} foi enviado em {{data}}.\nCódigo de rastreio: {{rastreio}}\nQualquer dúvida estamos à disposição!",
      pinned: true,
    },
    {
      id: "s2",
      title: "Backup PostgreSQL via SSH",
      cat: "Dev",
      tags: ["postgres", "bash", "vps"],
      body: "pg_dump -U {{usuario}} -h localhost {{banco}} | gzip > backup_{{data}}.sql.gz",
      pinned: false,
    },
    {
      id: "s3",
      title: "Prompt Code Review Sênior",
      cat: "Prompts",
      tags: ["ia", "review"],
      body: "Analise o código em {{linguagem}} abaixo focando em segurança, performance, duplicação de lógica e edge cases:\n\n{{codigo}}",
      pinned: true,
    },
  ];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { snippets: DEMO, history: [], vars: {} };
      const parsed = JSON.parse(raw);
      return {
        snippets: Array.isArray(parsed.snippets) ? parsed.snippets : DEMO,
        history: Array.isArray(parsed.history) ? parsed.history : [],
        vars: parsed.vars || {},
      };
    } catch {
      return { snippets: DEMO, history: [], vars: {} };
    }
  }

  let state = load();
  let activeCat = "Todas";
  let search = "";

  const els = {
    searchInput: document.getElementById("searchInput"),
    catList: document.getElementById("catList"),
    historyList: document.getElementById("historyList"),
    varBar: document.getElementById("varBar"),
    varInputs: document.getElementById("varInputs"),
    snippetGrid: document.getElementById("snippetGrid"),
    btnNew: document.getElementById("btnNew"),
    btnExport: document.getElementById("btnExport"),
    inputImport: document.getElementById("inputImport"),
    editModal: document.getElementById("editModal"),
    modalTitle: document.getElementById("modalTitle"),
    btnCloseModal: document.getElementById("btnCloseModal"),
    btnCancel: document.getElementById("btnCancel"),
    btnDelete: document.getElementById("btnDelete"),
    snippetForm: document.getElementById("snippetForm"),
    fId: document.getElementById("fId"),
    fTitle: document.getElementById("fTitle"),
    fCat: document.getElementById("fCat"),
    fTags: document.getElementById("fTags"),
    fBody: document.getElementById("fBody"),
    toast: document.getElementById("toast"),
  };

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function esc(s) {
    return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function extractVars(text) {
    const matches = [...String(text || "").matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1]);
    return [...new Set(matches)].filter((v) => v !== "data");
  }

  function resolveBody(body) {
    const today = new Date().toLocaleDateString("pt-BR");
    return String(body || "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
      if (key === "data") return today;
      return state.vars[key] ? state.vars[key] : `{{${key}}}`;
    });
  }

  function copyText(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      state.history = [{ label, text, at: new Date().toLocaleTimeString("pt-BR") }, ...state.history].slice(0, 12);
      save();
      renderHistory();
      showToast(`Copiado: ${label}`);
    });
  }

  function getFiltered() {
    const q = search.trim().toLowerCase();
    return state.snippets
      .filter((s) => activeCat === "Todas" || s.cat === activeCat)
      .filter((s) => {
        if (!q) return true;
        return `${s.title} ${s.cat} ${(s.tags || []).join(" ")} ${s.body}`.toLowerCase().includes(q);
      })
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }

  function renderCategories() {
    const counts = { Todas: state.snippets.length };
    state.snippets.forEach((s) => {
      counts[s.cat] = (counts[s.cat] || 0) + 1;
    });
    els.catList.innerHTML = "";
    Object.entries(counts).forEach(([cat, count]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cat-btn ${activeCat === cat ? "active" : ""}`;
      btn.innerHTML = `<span>${esc(cat)}</span><span>${count}</span>`;
      btn.addEventListener("click", () => {
        activeCat = cat;
        renderAll();
      });
      els.catList.appendChild(btn);
    });
  }

  function renderHistory() {
    els.historyList.innerHTML = "";
    if (!state.history.length) {
      els.historyList.innerHTML = `<span class="subtitle">Nenhuma cópia recente</span>`;
      return;
    }
    state.history.forEach((h) => {
      const div = document.createElement("div");
      div.className = "hist-item";
      div.title = h.text;
      div.textContent = `[${h.at}] ${h.label}`;
      div.addEventListener("click", () => copyText(h.text, h.label));
      els.historyList.appendChild(div);
    });
  }

  function renderVarBar(items) {
    const vars = [...new Set(items.flatMap((s) => extractVars(s.body)))];
    if (!vars.length) {
      els.varBar.classList.add("hidden");
      return;
    }
    els.varBar.classList.remove("hidden");
    els.varInputs.innerHTML = "";
    vars.forEach((v) => {
      const wrap = document.createElement("div");
      wrap.className = "field";
      wrap.innerHTML = `<label>{{${esc(v)}}}</label>`;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = state.vars[v] || "";
      inp.placeholder = `Valor para ${v}`;
      inp.addEventListener("input", () => {
        state.vars[v] = inp.value;
        save();
        renderSnippets(items);
      });
      wrap.appendChild(inp);
      els.varInputs.appendChild(wrap);
    });
  }

  function renderSnippets(items) {
    els.snippetGrid.innerHTML = "";
    if (!items.length) {
      els.snippetGrid.innerHTML = `<div class="card subtitle">Nenhum snippet encontrado.</div>`;
      return;
    }
    items.forEach((s) => {
      const card = document.createElement("article");
      card.className = "card snip-card";
      const resolved = resolveBody(s.body);
      card.innerHTML = `
        <div class="snip-top">
          <div>
            <div class="snip-title">${s.pinned ? "★ " : ""}${esc(s.title)}</div>
            <div class="snip-meta" style="margin-top:4px;">
              <span class="pill">${esc(s.cat)}</span>
              ${(s.tags || []).map((t) => `<span class="pill">#${esc(t)}</span>`).join("")}
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-pin">${s.pinned ? "Desafixar" : "Fixar"}</button>
        </div>
        <pre class="snip-body">${esc(resolved)}</pre>
        <div class="snip-actions">
          <button type="button" class="btn btn-ghost btn-edit">Editar</button>
          <button type="button" class="btn btn-primary btn-copy">Copiar</button>
        </div>
      `;
      card.querySelector(".btn-pin").addEventListener("click", () => {
        s.pinned = !s.pinned;
        save();
        renderAll();
      });
      card.querySelector(".btn-edit").addEventListener("click", () => openModal(s));
      card.querySelector(".btn-copy").addEventListener("click", () => copyText(resolveBody(s.body), s.title));
      els.snippetGrid.appendChild(card);
    });
  }

  function openModal(snip = null) {
    els.fId.value = snip ? snip.id : "";
    els.fTitle.value = snip ? snip.title : "";
    els.fCat.value = snip ? snip.cat : (activeCat === "Todas" ? "Geral" : activeCat);
    els.fTags.value = snip ? (snip.tags || []).join(", ") : "";
    els.fBody.value = snip ? snip.body : "";
    els.modalTitle.textContent = snip ? "Editar Snippet" : "Novo Snippet";
    els.btnDelete.style.display = snip ? "inline-block" : "none";
    els.editModal.classList.remove("hidden");
  }

  function closeModal() {
    els.editModal.classList.add("hidden");
  }

  function renderAll() {
    const items = getFiltered();
    renderCategories();
    renderHistory();
    renderVarBar(items);
    renderSnippets(items);
  }

  els.searchInput.addEventListener("input", () => {
    search = els.searchInput.value;
    renderAll();
  });
  els.btnNew.addEventListener("click", () => openModal(null));
  els.btnCloseModal.addEventListener("click", closeModal);
  els.btnCancel.addEventListener("click", closeModal);

  els.snippetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = els.fId.value;
    const tags = els.fTags.value.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
    const payload = {
      id: id || `s_${Date.now()}`,
      title: els.fTitle.value.trim(),
      cat: els.fCat.value.trim() || "Geral",
      tags,
      body: els.fBody.value,
      pinned: false,
    };
    if (id) {
      const idx = state.snippets.findIndex((x) => x.id === id);
      if (idx >= 0) payload.pinned = state.snippets[idx].pinned;
      state.snippets[idx] = payload;
    } else {
      state.snippets.unshift(payload);
    }
    save();
    closeModal();
    renderAll();
  });

  els.btnDelete.addEventListener("click", () => {
    const id = els.fId.value;
    if (!id || !confirm("Excluir este snippet?")) return;
    state.snippets = state.snippets.filter((s) => s.id !== id);
    save();
    closeModal();
    renderAll();
  });

  els.btnExport.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "piercer_clipbase_backup.json";
    a.click();
  });

  els.inputImport.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (Array.isArray(d.snippets)) {
        state.snippets = d.snippets;
        save();
        renderAll();
        showToast("Snippets importados!");
      }
    } catch {
      alert("JSON inválido.");
    }
    e.target.value = "";
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      els.searchInput.focus();
    }
  });

  renderAll();
})();
