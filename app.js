/* ---------- STATE ---------- */
const STORAGE_KEY = 'grandlivre_v1';

function defaultState(){
  return {
    income: { amount: null, tithePct: 10, savePct: 10 },
    extraPayment: 30,
    startingTotalDebt: null, // snapshot for overall progress bar, set on first load
    debts: [
      { id: cryptoRandom(), name: 'Easy Financière', balance: 5718.10, rate: 34.70, min: 146, status: 'active' },
      { id: cryptoRandom(), name: 'KOHO Cover', balance: 0, rate: 0, min: 0, status: 'active' },
      { id: cryptoRandom(), name: 'CIBC', balance: 0, rate: 0, min: 0, status: 'closed' }
    ],
    engagements: [],
    savings: { balance: 0, target: 5000, history: [] },
    goals: [
      { id: cryptoRandom(), name: 'Entreprise — machines distributrices', target: 3000, saved: 0, priority: 2, deadline: null },
      { id: cryptoRandom(), name: 'Déménagement', target: 2000, saved: 0, priority: 2, deadline: '2027-07-01' },
      { id: cryptoRandom(), name: 'Voiture', target: 6000, saved: 0, priority: 3, deadline: '2027-07-01' }
    ],
    capitalOne: { balance: 0, limit: 1000 },
    koho: { balance: 0 },
    creditChecklist: [
      { id:'c1', label:'Utilisation Capital One sous 30%', done:false },
      { id:'c2', label:'Paiements minimums faits à temps, chaque paie', done:false },
      { id:'c3', label:'KOHO Cover fermé une fois le solde à zéro', done:false },
      { id:'c4', label:'Aucune nouvelle demande de crédit pendant le remboursement', done:false }
    ],
    journal: []
  };
}

function cryptoRandom(){ return Math.random().toString(36).slice(2,10); }

let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // merge with defaults to survive schema additions
    return Object.assign(defaultState(), parsed);
  }catch(e){
    console.error('Erreur de lecture des données', e);
    return defaultState();
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  document.getElementById('todayLine').textContent = today.toLocaleDateString('fr-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  if(state.startingTotalDebt === null){
    state.startingTotalDebt = sumActiveDebts();
    saveState();
  }

  document.getElementById('ov-income').value = state.income.amount ?? '';
  document.getElementById('ov-tithe-pct').value = state.income.tithePct;
  document.getElementById('ov-save-pct').value = state.income.savePct;
  document.getElementById('extra-payment').value = state.extraPayment;
  document.getElementById('sav-balance').value = state.savings.balance;
  document.getElementById('sav-target').value = state.savings.target;
  document.getElementById('c1-balance').value = state.capitalOne.balance;
  document.getElementById('c1-limit').value = state.capitalOne.limit;
  document.getElementById('koho-balance').value = state.koho.balance;

  setupTabs();
  renderAll();
});

function setupTabs(){
  document.querySelectorAll('nav.tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      document.getElementById('panel-' + btn.dataset.tab).style.display = 'block';
    });
  });
}

function renderAll(){
  renderOverview();
  renderDebts();
  renderEngagements();
  renderSavings();
  renderCredit();
  renderInvest();
  renderJournal();
}

/* ---------- HELPERS ---------- */
function money(n){
  if(n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('fr-CA', { style:'currency', currency:'CAD' });
}
function sumActiveDebts(){
  return state.debts.filter(d => d.status === 'active').reduce((s,d) => s + Number(d.balance||0), 0);
}

/* ---------- OVERVIEW ---------- */
function saveIncomeSplit(){
  state.income.amount = parseFloat(document.getElementById('ov-income').value) || null;
  state.income.tithePct = parseFloat(document.getElementById('ov-tithe-pct').value) || 0;
  state.income.savePct = parseFloat(document.getElementById('ov-save-pct').value) || 0;
  saveState();
  renderOverview();
}

function renderOverview(){
  const totalDebt = sumActiveDebts();
  document.getElementById('ov-total-debt').textContent = money(totalDebt);
  const activeCount = state.debts.filter(d=>d.status==='active' && d.balance>0).length;
  document.getElementById('ov-debt-note').textContent = activeCount + ' dette(s) active(s)';
  document.getElementById('ov-total-savings').textContent = money(state.savings.balance);

  // income split
  const amt = state.income.amount;
  const resultEl = document.getElementById('ov-split-result');
  if(amt){
    const tithe = amt * (state.income.tithePct/100);
    const save = amt * (state.income.savePct/100);
    const minimums = state.debts.filter(d=>d.status==='active').reduce((s,d)=>s+Number(d.min||0),0);
    const extra = Number(state.extraPayment||0);
    const engagementsDue = state.engagements
      .filter(e => e.paidInstallments < e.installments)
      .reduce((s,e) => s + (e.amount/e.installments), 0);
    const remainder = amt - tithe - save - minimums - extra - engagementsDue;
    resultEl.innerHTML = `
      <div class="ledger-row"><div class="desc"><span class="name">Dîme (${state.income.tithePct}%)</span></div><div class="amt debit">${money(tithe)}</div></div>
      <div class="ledger-row"><div class="desc"><span class="name">Épargne (${state.income.savePct}%)</span></div><div class="amt credit">${money(save)}</div></div>
      <div class="ledger-row"><div class="desc"><span class="name">Minimums dettes</span></div><div class="amt debit">${money(minimums)}</div></div>
      <div class="ledger-row"><div class="desc"><span class="name">Extra boule de neige</span></div><div class="amt debit">${money(extra)}</div></div>
      <div class="ledger-row"><div class="desc"><span class="name">Engagements par tranche (actifs)</span></div><div class="amt debit">${money(engagementsDue)}</div></div>
      <hr class="divider">
      <div class="ledger-row"><div class="desc"><span class="name">Reste disponible</span></div><div class="amt ${remainder<0?'debit':'credit'}">${money(remainder)}</div></div>
    `;
  } else {
    resultEl.innerHTML = '<div class="empty">Entre ton revenu net par paie pour voir la répartition.</div>';
  }

  // overall progress
  const start = state.startingTotalDebt || totalDebt || 1;
  const paidPct = start > 0 ? Math.max(0, Math.min(100, ((start - totalDebt) / start) * 100)) : 0;
  document.getElementById('ov-progress-fill').style.width = paidPct.toFixed(1) + '%';
  document.getElementById('ov-progress-pct').textContent = paidPct.toFixed(1) + '%';
  document.getElementById('ov-progress-txt').textContent = 'remboursé depuis le départ (' + money(start) + ')';
}

/* ---------- DETTES ---------- */
let editingDebtId = null;

function openDebtForm(id){
  editingDebtId = id || null;
  document.getElementById('debt-form-wrap').style.display = 'block';
  if(id){
    const d = state.debts.find(x=>x.id===id);
    document.getElementById('d-name').value = d.name;
    document.getElementById('d-balance').value = d.balance;
    document.getElementById('d-rate').value = d.rate;
    document.getElementById('d-min').value = d.min;
    document.getElementById('d-status').value = d.status;
  } else {
    document.getElementById('d-name').value = '';
    document.getElementById('d-balance').value = '';
    document.getElementById('d-rate').value = '';
    document.getElementById('d-min').value = '';
    document.getElementById('d-status').value = 'active';
  }
}
function closeDebtForm(){
  document.getElementById('debt-form-wrap').style.display = 'none';
  editingDebtId = null;
}
function saveDebt(){
  const name = document.getElementById('d-name').value.trim();
  if(!name){ alert('Donne un nom au créancier.'); return; }
  const payload = {
    name,
    balance: parseFloat(document.getElementById('d-balance').value) || 0,
    rate: parseFloat(document.getElementById('d-rate').value) || 0,
    min: parseFloat(document.getElementById('d-min').value) || 0,
    status: document.getElementById('d-status').value
  };
  if(editingDebtId){
    const d = state.debts.find(x=>x.id===editingDebtId);
    Object.assign(d, payload);
  } else {
    state.debts.push(Object.assign({ id: cryptoRandom() }, payload));
  }
  saveState();
  closeDebtForm();
  renderDebts();
  renderOverview();
}
function deleteDebt(id){
  if(!confirm('Supprimer cette dette du registre ?')) return;
  state.debts = state.debts.filter(d=>d.id!==id);
  saveState();
  renderDebts();
  renderOverview();
}
function saveExtra(){
  state.extraPayment = parseFloat(document.getElementById('extra-payment').value) || 0;
  saveState();
  renderDebts();
  renderOverview();
}

function renderDebts(){
  const list = document.getElementById('debt-list');
  const active = state.debts.filter(d=>d.status==='active').sort((a,b)=>a.balance-b.balance);
  const closed = state.debts.filter(d=>d.status==='closed');
  list.innerHTML = '';
  if(active.length===0 && closed.length===0){
    list.innerHTML = '<div class="empty">Aucune dette enregistrée.</div>';
  }
  active.forEach((d,i) => {
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.innerHTML = `
      <div class="desc">
        <span class="name">${i===0?'🎯 ':''}${escapeHtml(d.name)}</span>
        ${i===0?'<span class="tag">cible actuelle</span>':''}
        <div class="meta">${d.rate}% annuel · min ${money(d.min)}/paie</div>
      </div>
      <div style="text-align:right;">
        <div class="amt debit">${money(d.balance)}</div>
        <div class="row-actions" style="margin-top:6px;">
          <button class="btn outline small" onclick="openDebtForm('${d.id}')">Modifier</button>
          <button class="btn danger small" onclick="deleteDebt('${d.id}')">✕</button>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
  closed.forEach(d => {
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.innerHTML = `
      <div class="desc"><span class="name">${escapeHtml(d.name)}</span><span class="tag closed">Fermée</span></div>
      <div style="text-align:right;">
        <button class="btn outline small" onclick="openDebtForm('${d.id}')">Modifier</button>
      </div>
    `;
    list.appendChild(row);
  });

  renderDebtChart();
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* Snowball simulation: biweekly periods */
function simulateSnowball(){
  let debts = state.debts.filter(d=>d.status==='active' && d.balance>0)
    .map(d => ({...d}))
    .sort((a,b)=>a.balance-b.balance);
  const extra = Number(state.extraPayment||0);
  const periods = [{ period:0, total: debts.reduce((s,d)=>s+d.balance,0) }];
  let period = 0;
  const maxPeriods = 260; // 10 years of biweekly safety cap
  while(debts.some(d=>d.balance>0.01) && period < maxPeriods){
    period++;
    let extraPool = extra;
    debts.forEach(d => {
      if(d.balance<=0) return;
      // biweekly interest accrual (annual rate / 26)
      const interest = d.balance * (d.rate/100/26);
      d.balance += interest;
      let pay = Math.min(d.min, d.balance);
      d.balance -= pay;
    });
    // apply extra to smallest remaining active balance
    for(const d of debts.sort((a,b)=>a.balance-b.balance)){
      if(extraPool<=0) break;
      if(d.balance<=0) continue;
      const pay = Math.min(extraPool, d.balance);
      d.balance -= pay;
      extraPool -= pay;
    }
    const total = debts.reduce((s,d)=>s+Math.max(0,d.balance),0);
    periods.push({ period, total });
  }
  return periods;
}

let debtChartInstance = null;
function renderDebtChart(){
  const sim = simulateSnowball();
  const ctx = document.getElementById('debtChart');
  if(!ctx) return;
  const labels = sim.map(p => 'Paie ' + p.period);
  const data = sim.map(p => p.total);
  if(debtChartInstance) debtChartInstance.destroy();
  debtChartInstance = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{
      label:'Solde total dettes',
      data,
      borderColor:'#A23B2E',
      backgroundColor:'rgba(162,59,46,0.12)',
      fill:true,
      tension:0.25,
      pointRadius:0
    }]},
    options:{
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ ticks:{ maxTicksLimit:6, font:{family:'IBM Plex Mono', size:10} }, grid:{ display:false } },
        y:{ ticks:{ font:{family:'IBM Plex Mono', size:10}, callback:v=>'$'+v }, grid:{ color:'#E8DFC6' } }
      }
    }
  });
  const lastPeriod = sim[sim.length-1];
  const el = document.getElementById('payoff-estimate');
  if(lastPeriod.total <= 0.01){
    const years = (lastPeriod.period/26).toFixed(1);
    el.innerHTML = `<span class="stamp">Dettes libres en ~${lastPeriod.period} paies (${years} ans)</span>`;
  } else {
    el.innerHTML = `<em>Solde encore élevé après ${lastPeriod.period} paies simulées — augmente l'extra ou vérifie les taux.</em>`;
  }
}

/* ---------- ENGAGEMENTS PAR TRANCHE (sans intérêt) ---------- */
function tierInstallments(amount){
  amount = Number(amount) || 0;
  if(amount <= 0) return 1;
  if(amount < 300) return 1;
  if(amount <= 500) return 2;
  if(amount <= 800) return 3;
  return Math.ceil(amount / 200);
}
function previewInstallments(){
  const amount = parseFloat(document.getElementById('e-amount').value) || 0;
  const n = tierInstallments(amount);
  document.getElementById('e-installments').value = n;
  const perPaie = amount>0 ? (amount/n) : 0;
  document.getElementById('e-preview').innerHTML = amount>0
    ? `<span>${n} paie(s)</span><span>${money(perPaie)}/paie</span>`
    : '';
}
function addEngagement(){
  const name = document.getElementById('e-name').value.trim();
  const amount = parseFloat(document.getElementById('e-amount').value) || 0;
  const installments = parseInt(document.getElementById('e-installments').value) || tierInstallments(amount);
  if(!name || amount<=0){ alert('Entre un nom et un montant valide.'); return; }
  state.engagements.push({
    id: cryptoRandom(),
    name, amount, installments,
    paidInstallments: 0
  });
  document.getElementById('e-name').value='';
  document.getElementById('e-amount').value='';
  document.getElementById('e-installments').value='';
  document.getElementById('e-preview').innerHTML='';
  saveState();
  renderEngagements();
}
function payNextInstallment(id){
  const e = state.engagements.find(x=>x.id===id);
  if(e.paidInstallments < e.installments) e.paidInstallments++;
  saveState();
  renderEngagements();
}
function undoInstallment(id){
  const e = state.engagements.find(x=>x.id===id);
  if(e.paidInstallments > 0) e.paidInstallments--;
  saveState();
  renderEngagements();
}
function deleteEngagement(id){
  if(!confirm('Supprimer cet engagement ?')) return;
  state.engagements = state.engagements.filter(x=>x.id!==id);
  saveState();
  renderEngagements();
}
function renderEngagements(){
  const list = document.getElementById('engagement-list');
  if(!list) return;
  if(state.engagements.length===0){
    list.innerHTML = '<div class="empty">Aucun engagement par tranche pour l\'instant.</div>';
    return;
  }
  list.innerHTML = '';
  state.engagements.forEach(e => {
    const perPaie = e.amount / e.installments;
    const paid = e.paidInstallments * perPaie;
    const remaining = e.amount - paid;
    const done = e.paidInstallments >= e.installments;
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.innerHTML = `
      <div class="desc">
        <span class="name">${escapeHtml(e.name)}${done?' <span class="tag">réglé</span>':''}</span>
        <div class="meta">${e.paidInstallments}/${e.installments} paie(s) · ${money(perPaie)}/paie</div>
        <div class="progress-wrap" style="margin:6px 0 0;">
          <div class="progress-bar" style="height:10px;"><div class="progress-fill" style="width:${(e.paidInstallments/e.installments*100).toFixed(0)}%;"></div></div>
        </div>
      </div>
      <div style="text-align:right;min-width:100px;">
        <div class="amt debit">${money(remaining)}</div>
        <div class="row-actions" style="margin-top:6px;justify-content:flex-end;">
          ${done ? '' : `<button class="btn gold small" onclick="payNextInstallment('${e.id}')">Payer</button>`}
          ${e.paidInstallments>0 ? `<button class="btn outline small" onclick="undoInstallment('${e.id}')">Annuler</button>` : ''}
          <button class="btn danger small" onclick="deleteEngagement('${e.id}')">✕</button>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
}

/* ---------- EPARGNE ---------- */
function saveSavings(){
  state.savings.balance = parseFloat(document.getElementById('sav-balance').value) || 0;
  state.savings.target = parseFloat(document.getElementById('sav-target').value) || 0;
  saveState();
  renderSavings();
  renderOverview();
}
function addSavingsDeposit(){
  const amt = parseFloat(document.getElementById('sav-deposit').value);
  if(!amt) return;
  state.savings.balance += amt;
  state.savings.history.push({ date: new Date().toISOString(), amount: amt });
  document.getElementById('sav-deposit').value = '';
  document.getElementById('sav-balance').value = state.savings.balance;
  saveState();
  renderSavings();
  renderOverview();
}
let savingsChartInstance = null;
function renderSavings(){
  const target = state.savings.target || 1;
  const pct = Math.max(0, Math.min(100, (state.savings.balance/target)*100));
  document.getElementById('sav-progress-fill').style.width = pct.toFixed(1)+'%';
  document.getElementById('sav-progress-pct').textContent = pct.toFixed(1)+'%';

  const ctx = document.getElementById('savingsChart');
  if(ctx){
    let running = 0;
    const points = state.savings.history.map(h => { running += h.amount; return running; });
    const labels = state.savings.history.map((h,i) => 'Dépôt ' + (i+1));
    if(savingsChartInstance) savingsChartInstance.destroy();
    if(state.savings.history.length>0){
      savingsChartInstance = new Chart(ctx, {
        type:'line',
        data:{ labels, datasets:[{
          label:'Épargne cumulée',
          data: points,
          borderColor:'#3F6B4C',
          backgroundColor:'rgba(63,107,76,0.12)',
          fill:true,
          tension:0.25
        }]},
        options:{ responsive:true, plugins:{legend:{display:false}},
          scales:{ x:{ grid:{display:false}, ticks:{font:{family:'IBM Plex Mono',size:10}} }, y:{ ticks:{font:{family:'IBM Plex Mono',size:10}, callback:v=>'$'+v}, grid:{color:'#E8DFC6'} } } }
      });
    } else {
      ctx.getContext('2d').clearRect(0,0,ctx.width,ctx.height);
    }
  }
  renderGoals();
  renderGoalWaterfall();
}

/* ---------- OBJECTIFS (ENVELOPPES) ---------- */
let editingGoalId = null;
function openGoalForm(id){
  editingGoalId = id || null;
  document.getElementById('goal-form-wrap').style.display = 'block';
  if(id){
    const g = state.goals.find(x=>x.id===id);
    document.getElementById('g-name').value = g.name;
    document.getElementById('g-target').value = g.target;
    document.getElementById('g-saved').value = g.saved;
    document.getElementById('g-priority').value = g.priority;
    document.getElementById('g-deadline').value = g.deadline || '';
  } else {
    document.getElementById('g-name').value = '';
    document.getElementById('g-target').value = '';
    document.getElementById('g-saved').value = 0;
    document.getElementById('g-priority').value = 2;
    document.getElementById('g-deadline').value = '';
  }
}
function closeGoalForm(){
  document.getElementById('goal-form-wrap').style.display = 'none';
  editingGoalId = null;
}
function saveGoal(){
  const name = document.getElementById('g-name').value.trim();
  if(!name){ alert('Donne un nom à l\'objectif.'); return; }
  const payload = {
    name,
    target: parseFloat(document.getElementById('g-target').value) || 0,
    saved: parseFloat(document.getElementById('g-saved').value) || 0,
    priority: parseInt(document.getElementById('g-priority').value) || 2,
    deadline: document.getElementById('g-deadline').value.trim() || null
  };
  if(editingGoalId){
    Object.assign(state.goals.find(x=>x.id===editingGoalId), payload);
  } else {
    state.goals.push(Object.assign({ id: cryptoRandom() }, payload));
  }
  saveState();
  closeGoalForm();
  renderGoals();
  renderGoalWaterfall();
}
function deleteGoal(id){
  if(!confirm('Supprimer cet objectif ?')) return;
  state.goals = state.goals.filter(g=>g.id!==id);
  saveState();
  renderGoals();
  renderGoalWaterfall();
}
function addGoalDeposit(id, amount){
  const g = state.goals.find(x=>x.id===id);
  g.saved = Math.min(g.target, g.saved + amount);
  saveState();
  renderGoals();
}
function biweeklyPeriodsUntil(dateStr){
  if(!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  const days = (target - now) / (1000*60*60*24);
  if(days <= 0) return 0;
  return Math.max(1, Math.round(days/14));
}
function renderGoals(){
  const list = document.getElementById('goal-list');
  if(!list) return;
  const sorted = [...state.goals].sort((a,b)=>a.priority-b.priority);
  if(sorted.length===0){
    list.innerHTML = '<div class="empty">Aucun objectif enregistré.</div>';
    return;
  }
  list.innerHTML = '';
  sorted.forEach(g => {
    const pct = g.target>0 ? Math.min(100,(g.saved/g.target)*100) : 0;
    const periods = biweeklyPeriodsUntil(g.deadline);
    const remaining = Math.max(0, g.target - g.saved);
    const perPaieNeeded = periods && periods>0 ? remaining/periods : null;
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.innerHTML = `
      <div class="desc" style="width:100%;">
        <span class="name">${escapeHtml(g.name)}</span>
        <span class="tag">priorité ${g.priority}</span>
        <div class="meta">${money(g.saved)} / ${money(g.target)}${g.deadline ? ' · cible: '+g.deadline : ''}</div>
        <div class="progress-wrap" style="margin:6px 0 0;">
          <div class="progress-bar" style="height:10px;"><div class="progress-fill" style="width:${pct.toFixed(0)}%;"></div></div>
        </div>
        ${perPaieNeeded!==null ? `<div class="meta" style="margin-top:4px;">≈ ${money(perPaieNeeded)}/paie pour respecter la date</div>` : ''}
        <div class="row-actions" style="margin-top:8px;">
          <button class="btn outline small" onclick="openGoalForm('${g.id}')">Modifier</button>
          <button class="btn danger small" onclick="deleteGoal('${g.id}')">✕</button>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
}

/* Cascade: fonds de sécurité (priorité 1) -> priorité 2 (parallèle, égal) -> priorité 3 */
function renderGoalWaterfall(){
  const el = document.getElementById('goal-waterfall');
  if(!el) return;
  const contribution = parseFloat(document.getElementById('goal-contribution').value);
  if(!contribution || contribution<=0){
    el.innerHTML = '<div class="empty">Entre un montant pour voir la répartition automatique.</div>';
    return;
  }
  let pool = contribution;
  const lines = [];

  // Priorité 1: fonds de sécurité
  const secRemaining = Math.max(0, state.savings.target - state.savings.balance);
  const toSecurite = Math.min(pool, secRemaining);
  if(toSecurite>0){ lines.push({ name:'Fonds de sécurité', amount:toSecurite }); pool -= toSecurite; }

  if(pool>0){
    const p2 = state.goals.filter(g=>g.priority===2 && g.saved<g.target);
    if(p2.length>0){
      const share = pool / p2.length;
      p2.forEach(g => {
        const remaining = g.target - g.saved;
        const amt = Math.min(share, remaining);
        if(amt>0){ lines.push({ name:g.name, amount:amt }); pool -= amt; }
      });
    }
  }
  // any leftover pool from p2 underfunded goals reallocate to p3 progressively (simplified: pass remaining pool to p3)
  if(pool>0){
    const p3 = state.goals.filter(g=>g.priority===3 && g.saved<g.target);
    if(p3.length>0){
      const share = pool / p3.length;
      p3.forEach(g => {
        const remaining = g.target - g.saved;
        const amt = Math.min(share, remaining);
        if(amt>0){ lines.push({ name:g.name, amount:amt }); pool -= amt; }
      });
    }
  }

  let html = lines.map(l => `<div class="ledger-row"><div class="desc"><span class="name">${escapeHtml(l.name)}</span></div><div class="amt credit">${money(l.amount)}</div></div>`).join('');
  if(pool>0.01){
    html += `<div class="ledger-row"><div class="desc"><span class="name">Non assigné (tous les objectifs sont remplis)</span></div><div class="amt">${money(pool)}</div></div>`;
  }
  el.innerHTML = html || '<div class="empty">Tous les objectifs sont déjà atteints 🎉</div>';
}

/* ---------- CREDIT ---------- */
function saveCapitalOne(){
  state.capitalOne.balance = parseFloat(document.getElementById('c1-balance').value) || 0;
  state.capitalOne.limit = parseFloat(document.getElementById('c1-limit').value) || 1;
  saveState();
  renderCredit();
}
function saveKoho(){
  state.koho.balance = parseFloat(document.getElementById('koho-balance').value) || 0;
  saveState();
  renderCredit();
}
function toggleCheck(id){
  const item = state.creditChecklist.find(c=>c.id===id);
  item.done = !item.done;
  saveState();
  renderCredit();
}
function renderCredit(){
  const util = state.capitalOne.limit>0 ? (state.capitalOne.balance/state.capitalOne.limit)*100 : 0;
  document.getElementById('c1-progress-fill').style.width = Math.min(100,util).toFixed(1)+'%';
  document.getElementById('c1-util-pct').textContent = util.toFixed(1)+'%';

  const kohoTag = document.getElementById('koho-tag');
  const kohoStatus = document.getElementById('koho-status');
  if(state.koho.balance<=0){
    kohoTag.textContent = 'prêt à fermer';
    kohoStatus.innerHTML = '<span class="stamp">Solde à zéro — tu peux fermer KOHO Cover</span>';
  } else {
    kohoTag.textContent = 'à fermer';
    kohoStatus.innerHTML = `<em>Encore ${money(state.koho.balance)} à rembourser avant fermeture.</em>`;
  }

  const list = document.getElementById('credit-checklist');
  list.innerHTML = '';
  state.creditChecklist.forEach(item => {
    const row = document.createElement('div');
    row.className = 'checkline' + (item.done?' done':'');
    row.innerHTML = `<input type="checkbox" ${item.done?'checked':''} onchange="toggleCheck('${item.id}')"><span class="clabel">${escapeHtml(item.label)}</span>`;
    list.appendChild(row);
  });
}

/* ---------- INVESTIR ---------- */
function renderInvest(){
  const sim = simulateSnowball();
  const last = sim[sim.length-1];
  const el = document.getElementById('invest-eta');
  if(last.total<=0.01){
    const years = (last.period/26).toFixed(1);
    el.innerHTML = `<div class="ledger-row"><div class="desc"><span class="name">Dettes à taux élevé libres</span></div><div class="amt credit">~${last.period} paies (${years} ans)</div></div><p style="font-size:12.5px;color:var(--ink-soft);margin-top:8px;">À ce moment, le surplus libéré pourra être redirigé vers le CELI.</p>`;
  } else {
    el.innerHTML = '<div class="empty">Ajoute tes dettes actives pour estimer la date de départ des investissements.</div>';
  }
}

/* ---------- JOURNAL ---------- */
function addJournalEntry(){
  const note = document.getElementById('j-note').value.trim();
  if(!note) return;
  state.journal.unshift({ id: cryptoRandom(), date: new Date().toISOString(), note });
  document.getElementById('j-note').value = '';
  saveState();
  renderJournal();
}
function deleteJournalEntry(id){
  state.journal = state.journal.filter(j=>j.id!==id);
  saveState();
  renderJournal();
}
function renderJournal(){
  const list = document.getElementById('journal-list');
  list.innerHTML = '';
  if(state.journal.length===0){
    list.innerHTML = '<div class="empty">Aucune entrée pour le moment.</div>';
    return;
  }
  state.journal.forEach(j => {
    const d = new Date(j.date);
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.innerHTML = `
      <div class="desc">
        <div class="meta">${d.toLocaleDateString('fr-CA')} ${d.toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})}</div>
        <div class="name" style="font-weight:400;font-size:13.5px;">${escapeHtml(j.note)}</div>
      </div>
      <button class="btn outline small" onclick="deleteJournalEntry('${j.id}')">✕</button>
    `;
    list.appendChild(row);
  });
}

/* ---------- EXPORT / IMPORT / RESET ---------- */
function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'grand-livre-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}
function importData(evt){
  const file = evt.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      state = Object.assign(defaultState(), parsed);
      saveState();
      location.reload();
    }catch(e){
      alert('Fichier invalide.');
    }
  };
  reader.readAsText(file);
}
function resetAll(){
  if(!confirm('Réinitialiser toutes les données du Grand Livre ? Cette action est irréversible.')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}
