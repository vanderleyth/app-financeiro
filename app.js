// ======================
// 1) COLE AQUI O LINK CSV DA ABA "API" PUBLICADA
// Exemplo (você vai trocar): const CSV_URL = "https://docs.google.com/spreadsheets/d/e/SEU_ID/pub?output=csv";
const CSV_URL = "COLE_AQUI_O_LINK_CSV_PUBLICADO";

// ======================

let dataRows = []; // {mes, despesas, a_receber, recebido, saldo, restante}

const el = (id) => document.getElementById(id);
const money = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function parseNumberBR(v){
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  // remove "R$", espaços; troca milhar/decimal
  const clean = s.replace(/R\$\s?/g,"").replace(/\./g,"").replace(",",".");
  const num = Number(clean);
  return Number.isFinite(num) ? num : 0;
}

function csvToRows(csv){
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map(h => h.trim().toLowerCase());

  const idx = (name) => headers.indexOf(name);

  const iMes = idx("mes");
  const iDes = idx("despesas");
  const iRec = idx("a_receber");
  const iReb = idx("recebido");
  const iSal = idx("saldo");
  const iRes = idx("restante");

  if ([iMes,iDes,iRec,iReb,iSal,iRes].some(i => i === -1)){
    throw new Error("A aba API precisa das colunas: mes, despesas, a_receber, recebido, saldo, restante");
  }

  return lines.map(line => {
    // CSV do Google pode vir com vírgulas; assumimos sem aspas complexas.
    const cols = line.split(",");
    return {
      mes: (cols[iMes] || "").trim(),
      despesas: parseNumberBR(cols[iDes]),
      a_receber: parseNumberBR(cols[iRec]),
      recebido: parseNumberBR(cols[iReb]),
      saldo: parseNumberBR(cols[iSal]),
      restante: parseNumberBR(cols[iRes])
    };
  }).filter(r => r.mes);
}

async function fetchData(){
  if (!CSV_URL || CSV_URL.includes("COLE_AQUI")){
    throw new Error("Cole o link CSV publicado da aba API em CSV_URL (app.js).");
  }
  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Não consegui baixar o CSV. Verifique se a aba API foi publicada.");
  const csv = await res.text();
  return csvToRows(csv);
}

// UI helpers
function setBadge(id, text, kind){
  const b = el(id);
  b.textContent = text;
  b.style.background = kind.bg;
  b.style.color = kind.fg;
  b.style.borderColor = "rgba(255,255,255,.12)";
}

const KINDS = {
  green: { bg: "rgba(34,197,94,.18)", fg: "#bff7cf" },
  red:   { bg: "rgba(239,68,68,.18)", fg: "#ffd0d0" },
  amber: { bg: "rgba(245,158,11,.18)", fg: "#ffe6ba" },
  grey:  { bg: "rgba(255,255,255,.08)", fg: "#d6e6ff" }
};

function renderAlerts(row){
  const receitaTotal = row.a_receber + row.recebido;
  const alerts = [];

  // Despesa > Receita
  if (row.despesas > receitaTotal){
    alerts.push({ icon:"🚨", title:"Despesa maior que Receita", sub:"Reduza gastos ou aumente receita", kind:"red" });
  } else {
    alerts.push({ icon:"✅", title:"Despesas OK", sub:"Dentro da receita total", kind:"green" });
  }

  // Saldo
  if (row.saldo < 0){
    alerts.push({ icon:"❌", title:"Saldo negativo", sub:"Atenção aos gastos", kind:"red" });
  } else if (row.saldo > 0){
    alerts.push({ icon:"✅", title:"Saldo positivo", sub:"Controle OK", kind:"green" });
  } else {
    alerts.push({ icon:"⚪", title:"Saldo zerado", sub:"Sem sobra no mês", kind:"grey" });
  }

  // Parcelas
  if (row.restante > 0){
    alerts.push({ icon:"🕒", title:"Parcelas em aberto", sub:"Há valores pendentes", kind:"amber" });
  } else {
    alerts.push({ icon:"✅", title:"Sem parcelas em aberto", sub:"Tudo em dia", kind:"green" });
  }

  const box = el("alerts");
  box.innerHTML = "";
  for (const a of alerts){
    const div = document.createElement("div");
    div.className = "alert";
    const k = KINDS[a.kind];
    div.style.background = k.bg;
    div.style.borderColor = "rgba(255,255,255,.12)";
    div.innerHTML = `<div style="font-size:18px">${a.icon}</div>
      <div>
        <div>${a.title}</div>
        <div class="small">${a.sub}</div>
      </div>`;
    box.appendChild(div);
  }
}

let barChart, pieChart;

function renderCharts(row){
  const receitaTotal = row.a_receber + row.recebido;

  const barData = {
    labels: ["Receita Total", "Despesas", "Saldo"],
    datasets: [{
      label: "R$",
      data: [receitaTotal, row.despesas, row.saldo]
    }]
  };

  const pieData = {
    labels: ["Despesas", "A Receber", "Recebido", "Saldo", "Restante"],
    datasets: [{
      data: [row.despesas, row.a_receber, row.recebido, row.saldo, row.restante]
    }]
  };

  // Bar
  const bctx = el("barChart").getContext("2d");
  if (barChart) barChart.destroy();
  barChart = new Chart(bctx, {
    type: "bar",
    data: barData,
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#eaf2ff" }, grid: { color: "rgba(255,255,255,.08)" } },
        y: { ticks: { color: "#eaf2ff" }, grid: { color: "rgba(255,255,255,.08)" } }
      }
    }
  });

  // Pie
  const pctx = el("pieChart").getContext("2d");
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pctx, {
    type: "pie",
    data: pieData,
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#eaf2ff" } }
      }
    }
  });
}

function renderRow(row){
  el("subtitle").textContent = `Resumo do mês • ${row.mes}`;
  el("vDespesas").textContent = money(row.despesas);
  el("vReceber").textContent  = money(row.a_receber);
  el("vRecebido").textContent = money(row.recebido);
  el("vSaldo").textContent    = money(row.saldo);
  el("vRestante").textContent = money(row.restante);

  const receitaTotal = row.a_receber + row.recebido;

  // Badges (cards)
  setBadge("bReceber", row.a_receber > 0 ? "✅ A RECEBER" : "⚪ SEM A RECEBER", row.a_receber > 0 ? KINDS.green : KINDS.grey);
  setBadge("bRecebido", row.recebido > 0 ? "✅ RECEBIDO" : "⚪ SEM RECEBIMENTOS", row.recebido > 0 ? KINDS.green : KINDS.grey);

  if (row.saldo < 0) setBadge("bSaldo", "❌ SALDO NEGATIVO", KINDS.red);
  else if (row.saldo > 0) setBadge("bSaldo", "✅ SALDO POSITIVO", KINDS.green);
  else setBadge("bSaldo", "⚪ SALDO ZERO", KINDS.grey);

  if (row.restante > 0) setBadge("bRestante", "🕒 PARCELAS EM ABERTO", KINDS.amber);
  else setBadge("bRestante", "✅ SEM PARCELAS", KINDS.green);

  if (row.despesas > receitaTotal) setBadge("bDespesas", "🚨 DESPESA > RECEITA", KINDS.red);
  else setBadge("bDespesas", "✅ DESPESA OK", KINDS.green);

  renderAlerts(row);
  renderCharts(row);

  el("lastSync").textContent = `Atualizado: ${new Date().toLocaleString("pt-BR")}`;
}

function populateMonths(rows){
  const select = el("monthSelect");
  select.innerHTML = "";
  rows.forEach((r, i) => {
    const opt = document.createElement("option");
    opt.value = r.mes;
    opt.textContent = r.mes;
    select.appendChild(opt);
  });

  // Seleciona o último mês por padrão
  select.value = rows[rows.length - 1].mes;
  select.addEventListener("change", () => {
    const row = dataRows.find(x => x.mes === select.value);
    if (row) renderRow(row);
  });
}

async function boot(){
  // PWA register
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js");
  }

  el("refreshBtn").addEventListener("click", async () => {
    try{
      dataRows = await fetchData();
      populateMonths(dataRows);
      const row = dataRows.find(x => x.mes === el("monthSelect").value) || dataRows[dataRows.length-1];
      renderRow(row);
    }catch(err){
      alert(err.message);
      console.error(err);
    }
  });

  try{
    dataRows = await fetchData();
    populateMonths(dataRows);
    renderRow(dataRows[dataRows.length - 1]);
  }catch(err){
    alert(err.message);
    console.error(err);
  }
}

boot();
