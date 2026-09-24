const defaultDivisions = [
  {name:'Core Coordination', writeScope:'orchestration-state', purpose:'Menerjemahkan permintaan user menjadi rencana kerja, dependency, ownership, dan pembagian tugas.', instruction:'Jangan mengerjakan domain spesialis sendiri. Routing, monitor, dedupe, dan eskalasi.', agents:['Intent Router','Task Planner','Dependency Mapper','Context Keeper','Escalation Lead']},
  {name:'Research / IERD', writeScope:'knowledge-base', purpose:'Mencari, memeriksa, dan merangkum informasi yang dibutuhkan tim lain.', instruction:'Pisahkan fakta, asumsi, dan hal yang belum terverifikasi. Sertakan evidence bila tersedia.', agents:['Research Lead','Source Scout','Fact Checker','Synthesis Analyst','Evidence Curator']},
  {name:'Field Operations', writeScope:'field-evidence', purpose:'Menangani observasi, pengumpulan kondisi nyata, evidence, dan laporan operasional.', instruction:'Catat temuan apa adanya. Jangan mengambil keputusan final di luar wewenang lapangan.', agents:['Field Lead','Observation Agent','Evidence Collector','Operations Reporter','Field Liaison']},
  {name:'Translation & Interpretation', writeScope:'localized-content', purpose:'Menerjemahkan bahasa, maksud, istilah teknis, dan konteks antar tim.', instruction:'Pertahankan makna asli. Tandai istilah ambigu dan jangan mengubah keputusan.', agents:['Language Translator','Context Interpreter','Technical Translator','Localization Agent','Terminology Keeper']},
  {name:'Operations & Supply', writeScope:'operations-ledger', purpose:'Menangani produksi, inventory, procurement, warehouse, dan perpindahan barang.', instruction:'Update melalui event operasional dan owner-specific state. Jangan menulis laporan keuangan final.', agents:['Production Agent','Inventory Agent','Procurement Agent','Warehouse Agent','Logistics Agent']},
  {name:'Business & Finance', writeScope:'business-ledger', purpose:'Menangani penjualan, HPP, keuangan, margin, dan analisis bisnis.', instruction:'Gunakan data transaksi terverifikasi; bedakan aktual, estimasi, dan proyeksi.', agents:['Sales Agent','Costing Agent','Finance Agent','Business Analyst','Dashboard Analyst']},
  {name:'Engineering & Data', writeScope:'app-core', purpose:'Mengelola software, API, database, analitik, dan integrasi teknis.', instruction:'Gunakan base-version check, patch workflow, schema ownership, dan test sebelum merge.', agents:['Frontend Engineer','Backend Engineer','Database Engineer','Data Analyst','Integration Engineer']},
  {name:'Execution', writeScope:'delivery-output', purpose:'Mengeksekusi rencana yang sudah disetujui menjadi output atau perubahan konkret.', instruction:'Kerja dari task valid. Semua perubahan dikirim sebagai patch, bukan overwrite final.', agents:['Execution Lead','Frontend Executor','Backend Executor','Automation Executor','Document Executor']},
  {name:'Decision Support', writeScope:'decision-brief', purpose:'Menyusun opsi, trade-off, risiko, dan rekomendasi berbasis hasil tim lain.', instruction:'Tidak boleh mengarang data. Keputusan final mengikuti authority user/system.', agents:['Decision Lead','Options Analyst','Risk Analyst','Priority Analyst','Recommendation Composer']},
  {name:'Internal Operations', writeScope:'ops-state', purpose:'Menjaga status task, handoff, arsip, provenance, dan komunikasi antar tim.', instruction:'Jaga konsistensi state dan jangan mengubah hasil spesialis tanpa provenance.', agents:['Internal Lead','Task Clerk','Handoff Coordinator','Archive Keeper','Status Monitor']},
  {name:'Security & QA', writeScope:'qa-registry', purpose:'Memeriksa keamanan, konflik, kualitas, pengujian, policy, dan kelayakan hasil sebelum final.', instruction:'Boleh reject patch bermasalah. Tidak boleh menulis final tanpa Merge Manager.', agents:['Security Reviewer','QA Tester','Conflict Detector','Policy Checker','Release Validator']}
];

const $ = id => document.getElementById(id);
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = obj => JSON.parse(JSON.stringify(obj));
const uid = (prefix='ID') => `${prefix}-${Date.now().toString(36).slice(-6)}-${Math.random().toString(36).slice(2,5)}`.toUpperCase();
const nowLabel = () => new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});

let divisions = JSON.parse(localStorage.getItem('nexa_custom_divisions') || 'null') || clone(defaultDivisions);
let chats = JSON.parse(localStorage.getItem('nexa_agent_chats') || '{}');
let memories = JSON.parse(localStorage.getItem('nexa_agent_memories') || '{}');
let routines = JSON.parse(localStorage.getItem('nexa_routines') || 'null') || [
  {name:'Research → Verify → Summarize', trigger:'Manual / handoff', steps:'Cari evidence → fact check → synthesize → handoff'},
  {name:'Safe Code Change', trigger:'Engineering task', steps:'Read base version → patch → test → QA → approval → atomic merge'},
  {name:'Business Event Chain', trigger:'Operational event', steps:'Production → inventory → costing → sales/finance → dashboard'}
];
let liveTasks = JSON.parse(localStorage.getItem('nexa_live_tasks') || 'null') || [];
let controlHistory = JSON.parse(localStorage.getItem('nexa_control_history') || 'null') || [{time:'Initial',text:'Human Override aktif. Semua perubahan user dicatat.'}];
let mergeQueue = JSON.parse(localStorage.getItem('nexa_merge_queue') || 'null') || [];
let resourceVersions = JSON.parse(localStorage.getItem('nexa_resource_versions') || 'null') || {
  'orchestration-state':3,'knowledge-base':8,'field-evidence':2,'localized-content':4,'operations-ledger':6,'business-ledger':5,'app-core':12,'delivery-output':7,'decision-brief':3,'ops-state':4,'qa-registry':9
};
let resourceLocks = JSON.parse(localStorage.getItem('nexa_resource_locks') || '{}');
let processedKeys = JSON.parse(localStorage.getItem('nexa_processed_keys') || '{}');
let conflictsPrevented = Number(localStorage.getItem('nexa_conflicts_prevented') || 0);
let a2aMessages = JSON.parse(localStorage.getItem('nexa_a2a') || 'null') || [
  {from:'Chief of Staff',to:'All Teams',text:'Specialist mode = patch-only. Final write reserved for Merge Manager.'}
];
let workspaceFiles = JSON.parse(localStorage.getItem('nexa_workspace_files') || 'null') || [
  {name:'task-brief.md',owner:'Chief of Staff',version:'v3',status:'shared'},
  {name:'ownership-map.json',owner:'Core Coordination',version:'v2',status:'active'},
  {name:'merge-policy.md',owner:'Security & QA',version:'v5',status:'enforced'}
];
let mainMessages = JSON.parse(localStorage.getItem('nexa_main_messages') || 'null') || [
  {who:'agent',text:'Saya NEXA Chief of Staff. Kasih tujuan besar; saya akan memecahnya menjadi task, dependency, owner, write scope, lalu menjaga final write tetap satu jalur.'}
];
let selectedAgent = null;
let running = false;

function persist(){
  localStorage.setItem('nexa_custom_divisions', JSON.stringify(divisions));
  localStorage.setItem('nexa_agent_chats', JSON.stringify(chats));
  localStorage.setItem('nexa_agent_memories', JSON.stringify(memories));
  localStorage.setItem('nexa_routines', JSON.stringify(routines));
  localStorage.setItem('nexa_live_tasks', JSON.stringify(liveTasks));
  localStorage.setItem('nexa_control_history', JSON.stringify(controlHistory));
  localStorage.setItem('nexa_merge_queue', JSON.stringify(mergeQueue));
  localStorage.setItem('nexa_resource_versions', JSON.stringify(resourceVersions));
  localStorage.setItem('nexa_resource_locks', JSON.stringify(resourceLocks));
  localStorage.setItem('nexa_processed_keys', JSON.stringify(processedKeys));
  localStorage.setItem('nexa_conflicts_prevented', String(conflictsPrevented));
  localStorage.setItem('nexa_a2a', JSON.stringify(a2aMessages));
  localStorage.setItem('nexa_workspace_files', JSON.stringify(workspaceFiles));
  localStorage.setItem('nexa_main_messages', JSON.stringify(mainMessages.slice(-80)));
}

function allAgents(){
  return divisions.flatMap((d,di)=>d.agents.map((name,ai)=>({id:`d${di}a${ai}`,name,division:d.name,purpose:d.purpose,instruction:d.instruction,writeScope:d.writeScope||slugScope(d.name)})));
}
function slugScope(name){return String(name||'custom-scope').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'custom-scope';}
function findDivision(name){return divisions.find(d=>d.name===name);}
function findAgentByName(name){return allAgents().find(a=>a.name===name);}
function normalizeTask(t){
  return {...t,dependencies:Array.isArray(t.dependencies)?t.dependencies:[],writeScope:t.writeScope||findDivision(t.team)?.writeScope||slugScope(t.team),mode:t.mode||'patch',idempotencyKey:t.idempotencyKey||`task:${t.id}`,progress:Number(t.progress||0)};
}
liveTasks = liveTasks.map(normalizeTask);

function syncMetrics(){
  const active=liveTasks.filter(t=>!['completed','rejected','deleted','merged'].includes(t.status)).length;
  const pending=mergeQueue.filter(x=>x.status!=='committed'&&x.status!=='rejected').length;
  $('metricAgents') && ($('metricAgents').textContent=allAgents().length);
  $('registeredCount') && ($('registeredCount').textContent=allAgents().length);
  $('metricQueue') && ($('metricQueue').textContent=active);
  $('metricMerge') && ($('metricMerge').textContent=pending);
  $('metricLocks') && ($('metricLocks').textContent=Object.keys(resourceLocks).length);
  $('metricConflicts') && ($('metricConflicts').textContent=conflictsPrevented);
  $('teamHeadline') && ($('teamHeadline').textContent=`${divisions.length} Tim · ${allAgents().length} Agent`);
}

function routeText(text){
  const s=text.toLowerCase();
  const routes=[];
  const add=name=>{if(findDivision(name)&&!routes.includes(name))routes.push(name);};
  if(/riset|research|cari|sumber|cek fakta|validasi|kompetitor|evidence/.test(s))add('Research / IERD');
  if(/lapangan|field|lokasi|survey|observasi/.test(s))add('Field Operations');
  if(/terjemah|translate|bahasa|lokalisasi/.test(s))add('Translation & Interpretation');
  if(/produksi|production|stok|inventory|gudang|warehouse|procurement|logistik/.test(s))add('Operations & Supply');
  if(/keuangan|finance|penjualan|sales|hpp|costing|margin|omzet|bisnis|dashboard/.test(s))add('Business & Finance');
  if(/buat|bangun|coding|frontend|backend|database|api|website|aplikasi|data/.test(s))add('Engineering & Data');
  if(/eksekusi|implementasi|dokumen|automation|deliver/.test(s))add('Execution');
  if(/pilih|rekomendasi|risiko|prioritas|keputusan|trade.?off/.test(s))add('Decision Support');
  if(/aman|security|test|qa|conflict|review|audit/.test(s))add('Security & QA');
  if(!routes.length)add('Core Coordination');
  return routes;
}

function dependencyNames(routes, team){
  const deps=[];
  const has=x=>routes.includes(x);
  if(team==='Translation & Interpretation' && has('Research / IERD')) deps.push('Research / IERD');
  if(team==='Business & Finance' && has('Operations & Supply')) deps.push('Operations & Supply');
  if(team==='Execution' && has('Engineering & Data')) deps.push('Engineering & Data');
  if(team==='Decision Support') ['Research / IERD','Field Operations','Business & Finance'].forEach(x=>{if(has(x))deps.push(x);});
  if(team==='Security & QA') ['Engineering & Data','Execution','Business & Finance'].forEach(x=>{if(has(x))deps.push(x);});
  return deps;
}

function createTasksFromPrompt(text){
  const routes=routeText(text);
  const stamp=Date.now().toString().slice(-6);
  const created=routes.map((team,i)=>{
    const d=findDivision(team); const id=`T-${stamp}-${String(i+1).padStart(2,'0')}`;
    return normalizeTask({id,title:text.length>78?text.slice(0,75)+'...':text,team,agent:d?.agents?.[0]||'Unassigned',status:'waiting',priority:'Normal',instruction:d?.instruction||'',progress:0,writeScope:d?.writeScope||slugScope(team),mode:'patch',dependencies:[],idempotencyKey:`prompt:${stamp}:${slugScope(team)}`});
  });
  created.forEach(t=>{
    t.dependencies=dependencyNames(routes,t.team).map(team=>created.find(x=>x.team===team)?.id).filter(Boolean);
    if(!t.dependencies.length)t.status='running';
  });
  liveTasks.unshift(...created);
  persist(); renderLiveTasks(); renderRouting(created); syncMetrics();
  return created;
}

function handleMainChat(text){
  const dedupeKey=`msg:${text.trim().toLowerCase()}`;
  mainMessages.push({who:'user',text});
  if(processedKeys[dedupeKey] && Date.now()-processedKeys[dedupeKey]<15000){
    conflictsPrevented++; mainMessages.push({who:'agent',text:'Perintah identik baru saja diproses. Saya dedupe agar task tidak tercatat dua kali.'});
    persist(); renderMainChat(); syncMetrics(); return;
  }
  processedKeys[dedupeKey]=Date.now();
  const created=createTasksFromPrompt(text);
  const teamNames=created.map(t=>t.team);
  mainMessages.push({who:'agent',text:`Plan dibuat untuk ${teamNames.join(', ')}. ${created.length} task aktif/menunggu dependency. Semua specialist bekerja patch-only; final write tetap lewat QA + Merge Manager.`});
  a2aMessages.unshift(...created.map(t=>({from:'Chief of Staff',to:t.agent,text:`Assigned ${t.id} · scope ${t.writeScope} · ${t.dependencies.length?`wait ${t.dependencies.join(', ')}`:'ready'}`})));
  workspaceFiles.unshift({name:`brief-${created[0].id.toLowerCase()}.md`,owner:'Chief of Staff',version:'v1',status:'shared'});
  addControlLog(`Chief of Staff membuat ${created.length} task dari Main Chat.`);
  renderAll();
}

function canStart(t){return (t.dependencies||[]).every(id=>liveTasks.find(x=>x.id===id)?.status==='completed' || liveTasks.find(x=>x.id===id)?.status==='merged');}
function proposePatch(t){
  if(mergeQueue.some(x=>x.taskId===t.id))return;
  const baseVersion=resourceVersions[t.writeScope]||1;
  mergeQueue.unshift({id:uid('P'),taskId:t.id,title:t.title,team:t.team,agent:t.agent,resource:t.writeScope,baseVersion,status:'qa_pending',qa:false,approved:false,createdAt:nowLabel()});
  workspaceFiles.unshift({name:`${t.writeScope}-${t.id.toLowerCase()}.patch`,owner:t.agent,version:`base v${baseVersion}`,status:'awaiting QA'});
  a2aMessages.unshift({from:t.agent,to:'Security & QA',text:`Patch ${t.id} siap diperiksa untuk ${t.writeScope} @ v${baseVersion}.`});
}

function advanceEngine(){
  let changed=0;
  liveTasks.forEach(t=>{
    if(t.status==='waiting' && canStart(t)){t.status='running';t.progress=Math.max(t.progress,8);changed++;addControlLog(`${t.id}: dependency selesai, task mulai berjalan.`);}
    else if(t.status==='running'){
      t.progress=Math.min(100,t.progress+25); changed++;
      if(t.progress>=100){t.status='completed';proposePatch(t);addControlLog(`${t.id}: specialist selesai dan mengirim patch ke Merge Queue.`);}
    }
  });
  if(!changed)addControlLog('Engine cycle: tidak ada task yang bisa maju saat ini.');
  persist(); renderAll();
}

function acquireLock(resource,owner){
  if(resourceLocks[resource] && resourceLocks[resource]!==owner)return false;
  resourceLocks[resource]=owner; return true;
}
function releaseLock(resource,owner){if(resourceLocks[resource]===owner)delete resourceLocks[resource];}
function validatePatch(id){const p=mergeQueue.find(x=>x.id===id);if(!p)return;p.qa=true;p.status='qa_validated';addControlLog(`${p.id}: QA validated.`);persist();renderAll();}
function approvePatch(id){const p=mergeQueue.find(x=>x.id===id);if(!p)return;p.approved=true;p.status=p.qa?'ready_to_merge':'approval_granted';addControlLog(`${p.id}: human approval granted.`);persist();renderAll();}
function rejectPatch(id){const p=mergeQueue.find(x=>x.id===id);if(!p)return;p.status='rejected';addControlLog(`${p.id}: patch rejected.`);persist();renderAll();}
function commitPatch(id){
  const p=mergeQueue.find(x=>x.id===id); if(!p || p.status==='committed')return;
  if(!p.qa || !p.approved){addControlLog(`${p.id}: commit diblok — QA dan approval belum lengkap.`);return renderAll();}
  const current=resourceVersions[p.resource]||1;
  if(current!==p.baseVersion){p.status='stale_blocked';conflictsPrevented++;addControlLog(`${p.id}: stale base v${p.baseVersion}, current v${current}. Konflik dicegah sebelum write.`);persist();return renderAll();}
  if(!acquireLock(p.resource,p.id)){p.status='lock_blocked';conflictsPrevented++;addControlLog(`${p.id}: resource ${p.resource} sedang terkunci. Commit ditunda.`);persist();return renderAll();}
  p.status='merging'; renderAll();
  resourceVersions[p.resource]=current+1;
  p.status='committed'; p.commitVersion=current+1;
  const task=liveTasks.find(t=>t.id===p.taskId); if(task)task.status='merged';
  releaseLock(p.resource,p.id);
  workspaceFiles.unshift({name:`commit-${p.id.toLowerCase()}.log`,owner:'Merge Manager',version:`v${current+1}`,status:'committed'});
  a2aMessages.unshift({from:'Merge Manager',to:p.agent,text:`Patch ${p.id} committed to ${p.resource} as v${current+1}.`});
  addControlLog(`${p.id}: atomic merge sukses ke ${p.resource} v${current+1}.`);
  persist(); renderAll();
}

function renderDivisionSnapshot(){
  const el=$('divisionSnapshot'); if(!el)return;
  el.innerHTML=divisions.map(d=>`<button class="division-chip" data-division="${esc(d.name)}"><b>${esc(d.name)}</b><small>${d.agents.length} agents · ${esc(d.writeScope||slugScope(d.name))}</small></button>`).join('');
  el.querySelectorAll('[data-division]').forEach(btn=>btn.onclick=()=>{goPage('agents');$('divisionFilter').value=btn.dataset.division;renderAgents();});
}
function renderDivisionFilter(){const select=$('divisionFilter');if(!select)return;const current=select.value||'all';select.innerHTML='<option value="all">Semua tim</option>'+divisions.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current;}
function renderDivisions(){const el=$('divisionGrid');if(!el)return;el.innerHTML=divisions.map((d,i)=>`<article class="division-card"><div class="division-card-top"><span class="division-number">${String(i+1).padStart(2,'0')}</span><span class="pill neutral">${d.agents.length} agents</span></div><h3>${esc(d.name)}</h3><p>${esc(d.purpose)}</p><div class="scope-line"><span>WRITE SCOPE</span><b>${esc(d.writeScope||slugScope(d.name))}</b></div><div class="instruction"><b>Instruksi kerja</b><span>${esc(d.instruction)}</span></div><div class="role-tags">${d.agents.map(a=>`<button data-open-agent="${esc(a)}">${esc(a)}</button>`).join('')}</div></article>`).join('');el.querySelectorAll('[data-open-agent]').forEach(b=>b.onclick=()=>openAgentByName(b.dataset.openAgent));}
function renderAgents(){const el=$('agentGrid');if(!el)return;const q=($('agentSearch')?.value||'').toLowerCase().trim();const filter=$('divisionFilter')?.value||'all';const list=allAgents().filter(a=>(filter==='all'||a.division===filter)&&(!q||`${a.name} ${a.division} ${a.purpose}`.toLowerCase().includes(q)));el.innerHTML=list.map(a=>{const task=liveTasks.find(t=>t.agent===a.name&&['running','waiting','paused'].includes(t.status));return `<button class="directory-card" data-id="${a.id}"><span class="agent-avatar">AI</span><div><b>${esc(a.name)}</b><small>${esc(a.division)}</small><p>${esc(a.purpose)}</p><em>${task?`${esc(task.status)} · ${esc(task.id)}`:'idle'}</em></div><i>Chat →</i></button>`}).join('')||'<div class="no-result">Agent tidak ditemukan.</div>';el.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openAgent(b.dataset.id));}

function openAgentByName(name){const a=findAgentByName(name);if(a)openAgent(a.id);}
function openAgent(id){selectedAgent=allAgents().find(a=>a.id===id);if(!selectedAgent)return;$('chatDivision').textContent=selectedAgent.division.toUpperCase();$('chatAgentName').textContent=selectedAgent.name;$('chatScope').textContent=`${selectedAgent.purpose} · patch-only → ${selectedAgent.writeScope}`;if(!chats[id])chats[id]=[{who:'agent',text:`Saya ${selectedAgent.name}. Scope saya ${selectedAgent.division}. Saya tidak melakukan final write; output saya dikirim sebagai patch ke ${selectedAgent.writeScope}.`}];renderChat();$('chatDrawer').classList.add('open');$('drawerBackdrop').classList.add('show');$('chatDrawer').setAttribute('aria-hidden','false');}
function closeChat(){$('chatDrawer')?.classList.remove('open');$('drawerBackdrop')?.classList.remove('show');$('chatDrawer')?.setAttribute('aria-hidden','true');}
function renderChat(){if(!selectedAgent)return;$('chatMessages').innerHTML=(chats[selectedAgent.id]||[]).map(m=>`<div class="message ${m.who}"><small>${m.who==='user'?'YOU':esc(selectedAgent.name)}</small><p>${esc(m.text)}</p></div>`).join('');$('chatMessages').scrollTop=$('chatMessages').scrollHeight;}
function agentReply(text){const a=selectedAgent,lower=text.toLowerCase();if(lower.startsWith('ingat ')||lower.startsWith('remember ')){memories[a.id]=memories[a.id]||[];memories[a.id].push(text.replace(/^(ingat|remember)\s+/i,''));persist();renderMemory();return 'Sudah saya simpan sebagai memory khusus role saya.';}if(lower.includes('tugas')||lower.includes('jobdesk'))return `Jobdesk saya: ${a.purpose} Instruksi: ${a.instruction}`;if(lower.includes('file')||lower.includes('edit')||lower.includes('ubah'))return `Saya hanya membuat patch pada scope ${a.writeScope}. Final write tetap lewat QA + Merge Manager.`;return `Task diterima sebagai ${a.name}. Saya bekerja dalam scope ${a.division}; bila melewati wewenang saya, saya handoff ke Chief of Staff.`;}

function renderMainChat(){const el=$('mainChatMessages');if(!el)return;el.innerHTML=mainMessages.map(m=>`<div class="message ${m.who}"><small>${m.who==='user'?'YOU':'NEXA CHIEF OF STAFF'}</small><p>${esc(m.text)}</p></div>`).join('');el.scrollTop=el.scrollHeight;}
function renderRouting(tasks=liveTasks.slice(0,8)){const el=$('routingPreview');if(!el)return;el.innerHTML=tasks.length?tasks.map(t=>`<div class="route-row"><span>${esc(t.id)}</span><div><b>${esc(t.team)}</b><small>${esc(t.agent)} · ${esc(t.status)}${t.dependencies.length?` · waits ${esc(t.dependencies.join(', '))}`:''}</small></div></div>`).join(''):'<div class="empty-route">Belum ada task.</div>';}
function statusClass(status){return `status-${String(status).replace(/\s+/g,'-')}`;}
function renderLiveTasks(){
  const el=$('liveTaskList');if(!el)return;
  el.innerHTML=liveTasks.length?liveTasks.map(t=>`<article class="live-task" data-task="${esc(t.id)}"><div class="task-top"><div><span class="task-id">${esc(t.id)}</span><h3>${esc(t.title)}</h3></div><span class="task-status ${statusClass(t.status)}">${esc(t.status)}</span></div><div class="task-meta"><span><b>Team</b>${esc(t.team)}</span><span><b>Agent</b>${esc(t.agent)}</span><span><b>Scope</b>${esc(t.writeScope)}</span><span><b>Progress</b>${t.progress}%</span></div><div class="progress"><i style="width:${Math.max(0,Math.min(100,t.progress))}%"></i></div><p>${t.dependencies.length?`Depends on: ${esc(t.dependencies.join(', '))}`:esc(t.instruction||'Ready to run.')}</p><div class="task-actions"><button data-act="toggle">${t.status==='paused'?'Resume':'Pause'}</button><button data-act="instruction">+ Instruction</button><button data-act="reassign">Reassign</button><button data-act="priority">${esc(t.priority)}</button><button data-act="approval">Need Approval</button><button class="danger-btn" data-act="delete">Delete</button></div></article>`).join(''):'<div class="empty-state compact"><strong>Belum ada task.</strong><small>Kirim perintah dari Main Chat.</small></div>';
  el.querySelectorAll('.live-task').forEach(card=>card.querySelectorAll('[data-act]').forEach(btn=>btn.onclick=()=>taskAction(card.dataset.task,btn.dataset.act)));
}
function addControlLog(text){controlHistory.unshift({time:nowLabel(),text});controlHistory=controlHistory.slice(0,50);persist();renderControlLog();}
function renderControlLog(){const el=$('controlLog');if(!el)return;el.innerHTML=controlHistory.map(x=>`<div class="control-entry"><span>${esc(x.time)}</span><p>${esc(x.text)}</p></div>`).join('');}
function taskAction(id,action){
  const t=liveTasks.find(x=>x.id===id);if(!t)return;
  if(action==='toggle'){if(['completed','merged','rejected'].includes(t.status))return;t.status=t.status==='paused'?'running':'paused';addControlLog(`${id}: ${t.status==='paused'?'dipause':'dilanjutkan'} oleh user.`);}
  if(action==='instruction'){const val=prompt(`Instruksi tambahan untuk ${id}:`,t.instruction||'');if(val!==null&&val.trim()){t.instruction=val.trim();a2aMessages.unshift({from:'USER OVERRIDE',to:t.agent,text:t.instruction});addControlLog(`${id}: instruksi diubah user.`);}}
  if(action==='reassign'){const val=prompt('Masukkan nama agent atau nama tim tujuan:',t.agent);if(val&&val.trim()){const q=val.trim().toLowerCase();const a=allAgents().find(x=>x.name.toLowerCase()===q);const d=divisions.find(x=>x.name.toLowerCase()===q);if(a){t.agent=a.name;t.team=a.division;t.writeScope=a.writeScope;}else if(d){t.team=d.name;t.agent=d.agents[0];t.writeScope=d.writeScope||slugScope(d.name);}else alert('Agent/tim tidak ditemukan.');addControlLog(`${id}: di-reassign ke ${t.agent} / ${t.team}.`);}}
  if(action==='priority'){const order=['Normal','High','Urgent'];t.priority=order[(order.indexOf(t.priority)+1)%order.length];addControlLog(`${id}: priority → ${t.priority}.`);}
  if(action==='approval'){t.status='approval';addControlLog(`${id}: task dipaksa berhenti di approval gate.`);}
  if(action==='delete'&&confirm(`Hapus task ${id}?`)){liveTasks=liveTasks.filter(x=>x.id!==id);addControlLog(`${id}: dihapus user.`);}
  persist();renderAll();
}

function renderWorkspace(){
  if($('workspaceFiles'))$('workspaceFiles').innerHTML=workspaceFiles.slice(0,20).map(f=>`<div class="workspace-row"><span>▤</span><div><b>${esc(f.name)}</b><small>${esc(f.owner)} · ${esc(f.version)}</small></div><i>${esc(f.status)}</i></div>`).join('');
  const tools=[['Web / Search','Research scoped'],['Repository / Files','Patch-only'],['Database','Owner-scoped'],['External Actions','Approval required'],['Merge API','Merge Manager only']];
  if($('toolRegistry'))$('toolRegistry').innerHTML=tools.map(t=>`<div class="workspace-row"><span>⌘</span><div><b>${t[0]}</b><small>${t[1]}</small></div></div>`).join('');
  if($('a2aMessages'))$('a2aMessages').innerHTML=a2aMessages.slice(0,24).map(m=>`<div class="a2a-row"><b>${esc(m.from)}</b><span>→</span><b>${esc(m.to)}</b><p>${esc(m.text)}</p></div>`).join('');
  if($('lockRegistry'))$('lockRegistry').innerHTML=Object.entries(resourceVersions).map(([resource,version])=>`<div class="workspace-row"><span>${resourceLocks[resource]?'●':'○'}</span><div><b>${esc(resource)}</b><small>Current version v${version}</small></div><i>${resourceLocks[resource]?`LOCKED · ${esc(resourceLocks[resource])}`:'available'}</i></div>`).join('');
}
function renderMergeQueue(){
  const el=$('mergeQueue');if(!el)return;
  el.innerHTML=mergeQueue.length?mergeQueue.map(p=>`<article class="merge-card ${p.status==='committed'?'merged':''}"><div class="merge-top"><div><span class="task-id">${esc(p.id)} · ${esc(p.taskId)}</span><h3>${esc(p.resource)}</h3></div><span class="task-status ${statusClass(p.status)}">${esc(p.status)}</span></div><p>${esc(p.title)}</p><div class="merge-meta"><span><b>Owner</b>${esc(p.agent)}</span><span><b>Base</b>v${p.baseVersion}</span><span><b>Current</b>v${resourceVersions[p.resource]||1}</span><span><b>QA</b>${p.qa?'validated':'pending'}</span><span><b>Approval</b>${p.approved?'granted':'pending'}</span></div><div class="task-actions"><button data-merge-act="validate" ${p.qa||p.status==='committed'?'disabled':''}>Validate QA</button><button data-merge-act="approve" ${p.approved||p.status==='committed'?'disabled':''}>Approve</button><button data-merge-act="commit" ${p.status==='committed'?'disabled':''}>Atomic Merge</button><button data-merge-act="reject" class="danger-btn" ${p.status==='committed'?'disabled':''}>Reject</button></div></article>`).join(''):'<div class="empty-state compact"><span>⇄</span><strong>Merge Queue kosong</strong><small>Selesaikan task dari Live Control untuk menghasilkan patch.</small></div>';
  el.querySelectorAll('.merge-card').forEach((card,i)=>card.querySelectorAll('[data-merge-act]').forEach(btn=>{const p=mergeQueue[i];btn.onclick=()=>({validate:validatePatch,approve:approvePatch,commit:commitPatch,reject:rejectPatch}[btn.dataset.mergeAct])(p.id);}));
}
function renderMemory(){const el=$('memoryRegistry');if(!el)return;const entries=Object.entries(memories).flatMap(([id,items])=>{const a=allAgents().find(x=>x.id===id);return(items||[]).map(text=>({agent:a?.name||id,text}));});el.innerHTML=entries.length?entries.slice(-30).reverse().map(m=>`<div class="workspace-row"><span>◉</span><div><b>${esc(m.agent)}</b><small>${esc(m.text)}</small></div></div>`).join(''):'<div class="empty-route">Belum ada learned memory. Buka chat agent lalu tulis “ingat ...”.</div>';}
function renderRoutines(){const el=$('routineList');if(!el)return;el.innerHTML=routines.map((r,i)=>`<div class="routine-card"><div><b>${esc(r.name)}</b><small>${esc(r.trigger)}</small><p>${esc(r.steps)}</p></div><button data-routine="${i}">Run</button></div>`).join('');el.querySelectorAll('[data-routine]').forEach(b=>b.onclick=()=>{const r=routines[+b.dataset.routine];handleMainChat(`Jalankan routine: ${r.name}. Langkah: ${r.steps}`);goPage('mainchat');});}
function teachRoutine(){const name=prompt('Nama routine / skill:');if(!name)return;const steps=prompt('Langkah kerja (contoh: A → B → C):');if(!steps)return;const trigger=prompt('Trigger (Manual / Event / Schedule / Handoff):','Manual')||'Manual';routines.push({name,steps,trigger});persist();renderRoutines();}

function addEvent(type,detail,index){const log=$('eventLog');if(!log)return;if(log.querySelector('.empty-state'))log.innerHTML='';const item=document.createElement('div');item.className='event-item';item.innerHTML=`<span class="event-bullet"></span><div><strong>${esc(type)}</strong><small>${esc(detail)}</small><small class="event-meta">Event #${String(index+1).padStart(3,'0')} · ${nowLabel()}</small></div>`;log.prepend(item);}
async function runSimulation(){
  if(running)return;running=true;$('runBtn').disabled=true;$('runBtn').textContent='Menjalankan...';$('workflowState').textContent='RUNNING';$('eventLog').innerHTML='';
  const events=[['INTENT_ROUTED','Chief of Staff membaca tujuan dan membuat idempotency key.'],['TASK_GRAPH_BUILT','Dependency graph dan write scope ditetapkan.'],['PARALLEL_WORK','Agent yang tidak saling bergantung mulai bersamaan.'],['PATCH_PROPOSED','Specialist mengirim patch, bukan overwrite final.'],['QA_VALIDATED','Security & QA memeriksa patch dan policy.'],['VERSION_CHECK','Base version dibandingkan dengan current state.'],['RESOURCE_LOCKED','Merge Manager mengambil lock hanya saat commit.'],['MERGE_COMMITTED','Commit atomik selesai, version bertambah, lock dilepas.']];
  for(let i=0;i<events.length;i++){await sleep(260);addEvent(events[i][0],events[i][1],i);}
  $('workflowState').textContent='COMPLETED';$('runBtn').disabled=false;$('runBtn').textContent='↻ Jalankan Lagi';running=false;
}
async function runPipeline(){const steps=[...document.querySelectorAll('.pipeline-step')];steps.forEach(s=>s.classList.remove('active','done'));for(const step of steps){step.classList.add('active');await sleep(330);step.classList.remove('active');step.classList.add('done');}}

function createDivisionFromForm(e){e.preventDefault();const name=$('customDivisionName').value.trim(),purpose=$('customDivisionPurpose').value.trim(),instruction=$('customDivisionInstruction').value.trim(),roles=$('customAgentRoles').value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,20),writeScope=$('customWriteScope').value.trim()||slugScope(name);if(!name||!purpose||!instruction||!roles.length)return;divisions.push({name,purpose,instruction,agents:roles,writeScope});if(!resourceVersions[writeScope])resourceVersions[writeScope]=1;persist();renderAll();$('divisionDialog').close();e.target.reset();goPage('divisions');addControlLog(`Custom team “${name}” dibuat dengan ${roles.length} agent dan scope ${writeScope}.`);}
function goPage(name){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.dataset.pageContent===name));document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===name));const titles={overview:['Agent Control Center','Orchestrator membagi pekerjaan, specialist mengirim patch, dan Merge Manager menjaga final write tetap satu jalur.'],mainchat:['NEXA Main Chat','Tulis tujuan besar; Chief of Staff akan routing, membuat dependency, dan menentukan ownership.'],control:['Live Control','Interupsi pekerjaan agent tanpa mencampur context atau mengambil write ownership agent lain.'],agents:['Agent Directory','Setiap agent punya role, chat, scope, dan batas wewenang terisolasi.'],divisions:['Team Blueprint Builder','Tim dapat dikustomisasi lengkap dengan role, instruksi, dan write scope.'],workspace:['Shared Workspace','Artifact, message bus, locks, dan resource version tetap auditable.'],merge:['Patch & Merge Queue','Satu jalur final write dengan QA, approval, version check, dan atomic lock.'],memory:['Persistent Memory','Memory per-agent terisolasi dan belajar dari koreksi user.'],routines:['Skills & Routines','Ajarkan prosedur sekali, gunakan ulang sebagai routine.'],workflow:['Conflict-Safe Workflow','Dependency + patch-only + QA + version guard + atomic merge.'],ownership:['Approvals & Safety','Human owner menentukan gate dan batas aksi agent.']};const [t,s]=titles[name]||titles.overview;$('pageTitle').textContent=t;$('pageSubtitle').textContent=s;window.scrollTo({top:0,behavior:'smooth'});}
function renderAll(){syncMetrics();renderDivisionFilter();renderDivisionSnapshot();renderDivisions();renderAgents();renderMainChat();renderRouting();renderLiveTasks();renderControlLog();renderWorkspace();renderMergeQueue();renderMemory();renderRoutines();}

function init(){
  renderAll();
  document.querySelectorAll('.nav-item').forEach(n=>n.onclick=()=>goPage(n.dataset.page));
  document.querySelectorAll('[data-go]').forEach(n=>n.onclick=()=>goPage(n.dataset.go));
  document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('mainChatInput').value=b.dataset.prompt;$('mainChatInput').focus();});
  $('agentSearch')?.addEventListener('input',renderAgents);$('divisionFilter')?.addEventListener('change',renderAgents);
  $('closeChat')?.addEventListener('click',closeChat);$('drawerBackdrop')?.addEventListener('click',closeChat);
  $('chatForm')?.addEventListener('submit',e=>{e.preventDefault();const input=$('chatInput'),text=input.value.trim();if(!text||!selectedAgent)return;chats[selectedAgent.id]=chats[selectedAgent.id]||[];chats[selectedAgent.id].push({who:'user',text});input.value='';renderChat();setTimeout(()=>{chats[selectedAgent.id].push({who:'agent',text:agentReply(text)});persist();renderChat();},140);persist();});
  $('mainChatForm')?.addEventListener('submit',e=>{e.preventDefault();const input=$('mainChatInput'),text=input.value.trim();if(!text)return;input.value='';handleMainChat(text);});
  $('addDivisionBtn')?.addEventListener('click',()=>$('divisionDialog').showModal());$('closeDivisionDialog')?.addEventListener('click',()=>$('divisionDialog').close());$('divisionForm')?.addEventListener('submit',createDivisionFromForm);
  $('runBtn')?.addEventListener('click',runSimulation);$('runWorkflowBtn')?.addEventListener('click',runPipeline);$('teachRoutineBtn')?.addEventListener('click',teachRoutine);$('advanceEngineBtn')?.addEventListener('click',advanceEngine);
}
init();
