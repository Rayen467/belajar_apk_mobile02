const defaultDivisions = [
  {name:'Core Coordination', purpose:'Menerjemahkan permintaan user menjadi rencana kerja, dependency, dan pembagian tugas.', instruction:'Jangan mengerjakan domain spesialis sendiri. Routing, monitor, dan eskalasi.', agents:['Intent Router','Task Planner','Dependency Mapper','Context Keeper','Escalation Lead']},
  {name:'Research / IERD', purpose:'Mencari, memeriksa, dan merangkum informasi yang dibutuhkan tim lain.', instruction:'Pisahkan fakta, asumsi, dan hal yang belum terverifikasi. Sertakan sumber/context bila tersedia.', agents:['Research Lead','Source Scout','Fact Checker','Synthesis Analyst','Evidence Curator']},
  {name:'Field Operations', purpose:'Menangani pekerjaan lapangan, observasi, pengumpulan kondisi nyata, dan bukti operasional.', instruction:'Catat apa yang ditemukan apa adanya. Jangan mengambil keputusan final di luar wewenang lapangan.', agents:['Field Lead','Observation Agent','Evidence Collector','Operations Reporter','Field Liaison']},
  {name:'Translation & Interpretation', purpose:'Menerjemahkan bahasa, maksud, istilah teknis, dan konteks antar tim.', instruction:'Pertahankan makna asli. Tandai istilah ambigu dan jangan mengubah keputusan.', agents:['Language Translator','Context Interpreter','Technical Translator','Localization Agent','Terminology Keeper']},
  {name:'Execution', purpose:'Mengeksekusi rencana yang sudah disetujui menjadi output atau perubahan konkret.', instruction:'Kerja dari task yang valid. Semua perubahan file dikirim sebagai patch, bukan overwrite final.', agents:['Execution Lead','Frontend Executor','Backend Executor','Automation Executor','Document Executor']},
  {name:'Decision Support', purpose:'Menyusun opsi, trade-off, risiko, dan rekomendasi berbasis hasil tim lain.', instruction:'Tidak boleh mengarang data. Keputusan final mengikuti authority yang ditetapkan user/system.', agents:['Decision Lead','Options Analyst','Risk Analyst','Priority Analyst','Recommendation Composer']},
  {name:'Internal Operations', purpose:'Menjaga proses internal, arsip, status task, handoff, dan komunikasi antar tim.', instruction:'Jaga konsistensi state dan jangan mengubah hasil spesialis tanpa provenance.', agents:['Internal Lead','Task Clerk','Handoff Coordinator','Archive Keeper','Status Monitor']},
  {name:'Engineering & Data', purpose:'Mengelola software, API, database, analitik, dan integrasi teknis.', instruction:'Gunakan ownership, version check, patch workflow, dan test sebelum merge.', agents:['Frontend Engineer','Backend Engineer','Database Engineer','Data Analyst','Integration Engineer']},
  {name:'Business & Finance', purpose:'Menangani operasi bisnis, keuangan, penjualan, biaya, stok, dan laporan.', instruction:'Gunakan data transaksi yang tersedia; jangan mencampur estimasi dengan angka aktual.', agents:['Finance Agent','Sales Agent','Inventory Agent','Costing Agent','Business Analyst']},
  {name:'Security & QA', purpose:'Memeriksa keamanan, konflik, kualitas, pengujian, dan kelayakan hasil sebelum final.', instruction:'Boleh reject patch bermasalah. Tidak boleh menulis final tanpa lewat Merge Manager.', agents:['Security Reviewer','QA Tester','Conflict Detector','Policy Checker','Release Validator']}
];

let divisions = JSON.parse(localStorage.getItem('nexa_custom_divisions') || 'null') || structuredClone(defaultDivisions);
let chats = {};
let selectedAgent = null;
let running = false;

const $ = (id) => document.getElementById(id);
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function allAgents(){
  return divisions.flatMap((d,di)=>d.agents.map((name,ai)=>({id:`d${di}a${ai}`,name,division:d.name,purpose:d.purpose,instruction:d.instruction})));
}

function syncMetrics(){
  const total = allAgents().length;
  if($('metricAgents')) $('metricAgents').textContent=total;
  if($('metricChats')) $('metricChats').textContent=total;
  if($('registeredCount')) $('registeredCount').textContent=total;
}

function renderDivisionSnapshot(){
  const el=$('divisionSnapshot'); if(!el) return;
  el.innerHTML=divisions.map(d=>`<button class="division-chip" data-division="${esc(d.name)}"><b>${esc(d.name)}</b><small>${d.agents.length} agents</small></button>`).join('');
  el.querySelectorAll('[data-division]').forEach(btn=>btn.addEventListener('click',()=>{goPage('agents');$('divisionFilter').value=btn.dataset.division;renderAgents();}));
}

function renderDivisionFilter(){
  const select=$('divisionFilter'); if(!select) return;
  const current=select.value||'all';
  select.innerHTML='<option value="all">Semua divisi</option>'+divisions.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');
  select.value=[...select.options].some(o=>o.value===current)?current:'all';
}

function renderDivisions(){
  const el=$('divisionGrid'); if(!el) return;
  el.innerHTML=divisions.map((d,i)=>`<article class="division-card">
    <div class="division-card-top"><span class="division-number">${String(i+1).padStart(2,'0')}</span><span class="pill neutral">${d.agents.length} agents</span></div>
    <h3>${esc(d.name)}</h3>
    <p>${esc(d.purpose)}</p>
    <div class="instruction"><b>Instruksi kerja</b><span>${esc(d.instruction)}</span></div>
    <div class="role-tags">${d.agents.map(a=>`<button data-open-agent="${esc(a)}">${esc(a)}</button>`).join('')}</div>
  </article>`).join('');
  el.querySelectorAll('[data-open-agent]').forEach(b=>b.addEventListener('click',()=>openAgentByName(b.dataset.openAgent)));
}

function renderAgents(){
  const el=$('agentGrid'); if(!el) return;
  const q=($('agentSearch')?.value||'').toLowerCase().trim();
  const filter=$('divisionFilter')?.value||'all';
  const list=allAgents().filter(a=>(filter==='all'||a.division===filter)&&(!q||`${a.name} ${a.division} ${a.purpose}`.toLowerCase().includes(q)));
  el.innerHTML=list.map(a=>`<button class="directory-card" data-id="${a.id}"><span class="agent-avatar">AI</span><div><b>${esc(a.name)}</b><small>${esc(a.division)}</small><p>${esc(a.purpose)}</p></div><i>Chat →</i></button>`).join('') || '<div class="no-result">Agent tidak ditemukan.</div>';
  el.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>openAgent(b.dataset.id)));
}

function openAgentByName(name){const a=allAgents().find(x=>x.name===name);if(a)openAgent(a.id)}
function openAgent(id){
  selectedAgent=allAgents().find(a=>a.id===id); if(!selectedAgent) return;
  $('chatDivision').textContent=selectedAgent.division.toUpperCase();
  $('chatAgentName').textContent=selectedAgent.name;
  $('chatScope').textContent=selectedAgent.purpose;
  const key=id;
  if(!chats[key]) chats[key]=[{who:'agent',text:`Saya ${selectedAgent.name}. Tugas saya: ${selectedAgent.purpose} Aturan kerja saya: ${selectedAgent.instruction}`}];
  renderChat(); $('chatDrawer').classList.add('open'); $('drawerBackdrop').classList.add('show'); $('chatDrawer').setAttribute('aria-hidden','false');
}
function closeChat(){ $('chatDrawer').classList.remove('open'); $('drawerBackdrop').classList.remove('show'); $('chatDrawer').setAttribute('aria-hidden','true'); }
function renderChat(){
  if(!selectedAgent) return;
  $('chatMessages').innerHTML=chats[selectedAgent.id].map(m=>`<div class="message ${m.who}"><small>${m.who==='user'?'YOU':esc(selectedAgent.name)}</small><p>${esc(m.text)}</p></div>`).join('');
  $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
}

function agentReply(text){
  const a=selectedAgent;
  const lower=text.toLowerCase();
  if(lower.includes('tugas')||lower.includes('jobdesk')) return `Jobdesk saya: ${a.purpose} Instruksi utama: ${a.instruction}`;
  if(lower.includes('file')||lower.includes('ubah')||lower.includes('edit')) return `Saya akan menyiapkan PATCH sesuai scope ${a.division}. Saya tidak akan overwrite file final; Merge Manager yang melakukan final write setelah version dan conflict check.`;
  return `Task diterima dalam scope ${a.division}. Saya akan mengerjakannya sebagai ${a.name}, mengikuti instruksi: ${a.instruction}`;
}

function goPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.dataset.pageContent===name));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===name));
  const titles={overview:['Agent Control Center','Role-based AI organization: tiap tim punya tujuan, instruksi, agent, dan batas wewenang.'],agents:['Agent Directory','Buka chat agent tertentu tanpa mencampur konteks dengan agent lain.'],divisions:['Division Builder','Tim bisa dibuat untuk domain apa pun: lapangan, internal, penerjemah, eksekusi, keputusan, atau custom.'],workflow:['Safe Workflow','Orchestrator mengatur dependency; specialist menghasilkan patch; Merge Manager menjaga final write.'],ownership:['Anti-Conflict System','Ownership, versioning, dependency, QA, dan single final writer mencegah perubahan saling menimpa.']};
  const [t,s]=titles[name]||titles.overview; $('pageTitle').textContent=t;$('pageSubtitle').textContent=s;
}

function addEvent(type,detail,index){
  const log=$('eventLog'); if(log.querySelector('.empty-state')) log.innerHTML='';
  const item=document.createElement('div');item.className='event-item';
  item.innerHTML=`<span class="event-bullet"></span><div><strong>${esc(type)}</strong><small>${esc(detail)}</small><small class="event-meta">Event #${String(index+1).padStart(3,'0')} · ownership OK</small></div>`;
  log.prepend(item);
}

async function runSimulation(){
  if(running)return;running=true;$('runBtn').disabled=true;$('runBtn').textContent='Menjalankan...';$('workflowState').textContent='RUNNING';
  const events=[
    ['INTENT_ROUTED','Main Chat mengirim permintaan ke Core Coordination.'],
    ['RESEARCH_ASSIGNED','Research / IERD menerima task verifikasi informasi.'],
    ['FIELD_ASSIGNED','Field Operations menerima task pengumpulan kondisi lapangan.'],
    ['TRANSLATION_HANDOFF','Translation & Interpretation menormalkan bahasa dan konteks.'],
    ['PARALLEL_EXECUTION','Engineering, Business, dan Execution bekerja pada patch terpisah.'],
    ['DECISION_REVIEW','Decision Support menyusun opsi, risiko, dan prioritas.'],
    ['QA_VALIDATED','Security & QA memeriksa konflik, policy, dan hasil test.'],
    ['MERGE_COMMITTED','Merge Manager melakukan satu-satunya final write.']
  ];
  $('metricQueue').textContent=events.length;$('eventLog').innerHTML='';
  for(let i=0;i<events.length;i++){await sleep(430);addEvent(events[i][0],events[i][1],i);$('metricQueue').textContent=events.length-i-1;}
  $('workflowState').textContent='COMPLETED';$('runBtn').disabled=false;$('runBtn').textContent='↻ Jalankan Lagi';running=false;
}

async function runPipeline(){
  const steps=[...document.querySelectorAll('.pipeline-step')];steps.forEach(s=>s.classList.remove('active','done'));
  for(const step of steps){step.classList.add('active');await sleep(500);step.classList.remove('active');step.classList.add('done');}
}

function saveDivisions(){localStorage.setItem('nexa_custom_divisions',JSON.stringify(divisions));syncMetrics();renderDivisionFilter();renderDivisionSnapshot();renderDivisions();renderAgents();}

function createDivisionFromForm(e){
  e.preventDefault();
  const name=$('customDivisionName').value.trim();
  const purpose=$('customDivisionPurpose').value.trim();
  const instruction=$('customDivisionInstruction').value.trim();
  const roles=$('customAgentRoles').value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,10);
  if(!name||!purpose||!instruction||roles.length===0)return;
  divisions.push({name,purpose,instruction,agents:roles});saveDivisions();$('divisionDialog').close();e.target.reset();goPage('divisions');
}

function init(){
  syncMetrics();renderDivisionFilter();renderDivisionSnapshot();renderDivisions();renderAgents();
  document.querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',()=>goPage(n.dataset.page)));
  document.querySelectorAll('[data-go]').forEach(n=>n.addEventListener('click',()=>goPage(n.dataset.go)));
  $('agentSearch')?.addEventListener('input',renderAgents);$('divisionFilter')?.addEventListener('change',renderAgents);
  $('closeChat')?.addEventListener('click',closeChat);$('drawerBackdrop')?.addEventListener('click',closeChat);
  $('chatForm')?.addEventListener('submit',e=>{e.preventDefault();const input=$('chatInput');const text=input.value.trim();if(!text||!selectedAgent)return;chats[selectedAgent.id].push({who:'user',text});input.value='';renderChat();setTimeout(()=>{chats[selectedAgent.id].push({who:'agent',text:agentReply(text)});renderChat();},280)});
  $('addDivisionBtn')?.addEventListener('click',()=>$('divisionDialog').showModal());
  $('divisionForm')?.addEventListener('submit',createDivisionFromForm);
  $('runBtn')?.addEventListener('click',runSimulation);$('runWorkflowBtn')?.addEventListener('click',runPipeline);
}
init();
