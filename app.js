const agents = [
  ['orchestrator','TASK_CREATED','Membagi dependency produksi → stok → HPP → penjualan → keuangan → dashboard'],
  ['production','PRODUCTION_COMPLETED','Batch BATCH-001 selesai: 100 unit diproduksi'],
  ['inventory','INVENTORY_UPDATED','Stok barang jadi +100; bahan baku dikurangi sesuai pemakaian'],
  ['costing','HPP_CALCULATED','HPP dihitung Rp8.000 per unit dari total biaya Rp800.000'],
  ['sales','SALE_COMPLETED','10 unit terjual @ Rp15.000; event SALE-20260924-001 dibuat'],
  ['finance','FINANCE_POSTED','Pendapatan Rp150.000, COGS Rp80.000, gross profit Rp70.000'],
  ['dashboard','DASHBOARD_SYNCED','KPI tersinkron tanpa write ke domain operasional']
];

const cards = Object.fromEntries([...document.querySelectorAll('[data-agent]')].map(el => [el.dataset.agent, el]));
const log = document.getElementById('eventLog');
const runBtn = document.getElementById('runBtn');
const resetBtn = document.getElementById('resetBtn');
const metricEvents = document.getElementById('metricEvents');
const metricQueue = document.getElementById('metricQueue');
const workflowState = document.getElementById('workflowState');
let running = false;
let processed = new Set();

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function setCard(agent,state){
  const card=cards[agent]; if(!card) return;
  card.classList.remove('active','done');
  if(state==='active') card.classList.add('active');
  if(state==='done') card.classList.add('done');
  card.querySelector('em').textContent=state;
}
function addEvent(type,detail,index){
  if(processed.has(type)) return false;
  processed.add(type);
  if(log.querySelector('.empty-state')) log.innerHTML='';
  const item=document.createElement('div');
  item.className='event-item';
  item.innerHTML=`<span class="event-bullet"></span><div><strong>${type}</strong><small>${detail}</small><small class="event-meta">Event #${String(index+1).padStart(3,'0')} · idempotency OK</small></div>`;
  log.prepend(item);
  metricEvents.textContent=processed.size;
  return true;
}
function updateOutput(step){
  if(step>=1) document.getElementById('outProduction').textContent='100 unit';
  if(step>=2) document.getElementById('outStock').textContent='100 unit';
  if(step>=3) document.getElementById('outHpp').textContent='Rp8.000';
  if(step>=4) document.getElementById('outSales').textContent='Rp150.000';
  if(step>=5) document.getElementById('outProfit').textContent='Rp70.000';
  if(step>=6) document.getElementById('outDashboard').textContent='Sinkron';
}
async function runSimulation(){
  if(running) return;
  running=true; processed.clear();
  document.querySelectorAll('.agent-card').forEach(c=>{c.classList.remove('active','done');c.querySelector('em').textContent='idle'});
  log.innerHTML='<div class="empty-state"><span>⌁</span><strong>Menyiapkan event bus...</strong><small>Orchestrator sedang membuat dependency graph.</small></div>';
  metricEvents.textContent='0'; metricQueue.textContent=agents.length; workflowState.textContent='RUNNING';
  runBtn.disabled=true; runBtn.textContent='Menjalankan...';
  ['outProduction','outStock','outHpp','outSales','outProfit'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('outDashboard').textContent='Belum sinkron';
  for(let i=0;i<agents.length;i++){
    const [agent,type,detail]=agents[i];
    setCard(agent,'active'); metricQueue.textContent=agents.length-i-1;
    await sleep(i===0?700:850);
    addEvent(type,detail,i); updateOutput(i);
    setCard(agent,'done');
    await sleep(250);
  }
  workflowState.textContent='COMPLETED';
  runBtn.disabled=false; runBtn.textContent='↻ Jalankan Lagi';
  document.querySelector('.business').classList.add('run-flash');
  setTimeout(()=>document.querySelector('.business').classList.remove('run-flash'),600);
  running=false;
}
function reset(){
  if(running) return;
  processed.clear(); metricEvents.textContent='0'; metricQueue.textContent='0'; workflowState.textContent='IDLE';
  log.innerHTML='<div class="empty-state"><span>⌁</span><strong>Belum ada event</strong><small>Tekan “Jalankan Simulasi” untuk melihat alur agent.</small></div>';
  document.querySelectorAll('.agent-card').forEach(c=>{c.classList.remove('active','done');c.querySelector('em').textContent='idle'});
  ['outProduction','outStock','outHpp','outSales','outProfit'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('outDashboard').textContent='Belum sinkron';
  runBtn.textContent='▶ Jalankan Simulasi';
}
runBtn.addEventListener('click',runSimulation); resetBtn.addEventListener('click',reset);
document.querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));n.classList.add('active')}));
