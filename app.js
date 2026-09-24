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

const $ = id => document.getElementById(id);
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = obj => JSON.parse(JSON.stringify(obj));

let divisions = JSON.parse(localStorage.getItem('nexa_custom_divisions') || 'null') || clone(defaultDivisions);
let chats = JSON.parse(localStorage.getItem('nexa_agent_chats') || '{}');
let memories = JSON.parse(localStorage.getItem('nexa_agent_memories') || '{}');
let routines = JSON.parse(localStorage.getItem('nexa_routines') || 'null') || [
  {name:'Research → Verify → Summarize', trigger:'Manual / handoff', steps:'Cari sumber → cek fakta → ringkas → kirim evidence ke tim berikutnya'},
  {name:'Safe Code Change', trigger:'Engineering task', steps:'Baca base version → buat patch → QA → approval bila perlu → merge'}
];
let liveTasks = JSON.parse(localStorage.getItem('nexa_live_tasks') || 'null') || [
  {id:'T-001',title:'Validasi kebutuhan dan sumber data',team:'Research / IERD',agent:'Research Lead',status:'running',priority:'High',instruction:'Pisahkan fakta dan asumsi.',progress:48},
  {id:'T-002',title:'Kumpulkan kondisi lapangan',team:'Field Operations',agent:'Field Lead',status:'waiting',priority:'Normal',instruction:'Menunggu brief dari Research.',progress:15},
  {id:'T-003',title:'Siapkan patch dashboard',team:'Execution',agent:'Frontend Executor',status:'approval',priority:'High',instruction:'Jangan final write sebelum user approve.',progress:72}
];
let controlHistory = JSON.parse(localStorage.getItem('nexa_control_history') || 'null') || [
  {time:'Initial',text:'Human Override aktif. Semua perubahan user akan dicatat di sini.'}
];
let a2aMessages = [
  {from:'Research Lead',to:'Field Lead',text:'Mohon verifikasi kondisi aktual sebelum analisis final.'},
  {from:'Field Lead',to:'Decision Lead',text:'Evidence lapangan akan diteruskan setelah validasi.'}
];
let workspaceFiles = [
  {name:'task-brief.md',owner:'Chief of Staff',version:'v3',status:'shared'},
  {name:'field-evidence.json',owner:'Field Operations',version:'v1',status:'draft'},
  {name:'dashboard.patch',owner:'Execution',version:'base v12',status:'awaiting approval'}
];
let mainMessages = [{who:'agent',text:'Saya NEXA Chief of Staff. Tulis tujuan lo; saya akan memilih tim, membuat task, dan lo bisa interupsi dari Live Control kapan pun.'}];
let selectedAgent = null;
let running = false;

function persist(){
  localStorage.setItem('nexa_custom_divisions', JSON.stringify(divisions));
  localStorage.setItem('nexa_agent_chats', JSON.stringify(chats));
  localStorage.setItem('nexa_agent_memories', JSON.stringify(memories));
  localStorage.setItem('nexa_routines', JSON.stringify(routines));
  localStorage.setItem('nexa_live_tasks', JSON.stringify(liveTasks));
  localStorage.setItem('nexa_control_history', JSON.stringify(controlHistory));
}

function allAgents(){
  return divisions.flatMap((d,di)=>d.agents.map((name,ai)=>({id:`d${di}a${ai}`,name,division:d.name,purpose:d.purpose,instruction:d.instruction})));
}
function findDivision(name){ return divisions.find(d=>d.name===name); }
function findAgentByName(name){ return allAgents().find(a=>a.name===name); }
function nowLabel(){ return new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }

function syncMetrics(){
  const total=allAgents().length;
  if($('metricAgents')) $('metricAgents').textContent=total;
  if($('metricChats')) $('metricChats').textContent=total;
  if($('registeredCount')) $('registeredCount').textContent=total;
  if($('metricQueue')) $('metricQueue').textContent=liveTasks.filter(t=>!['completed','rejected','deleted'].includes(t.status)).length;
}

function renderDivisionSnapshot(){
  const el=$('divisionSnapshot'); if(!el)return;
  el.innerHTML=divisions.map(d=>`<button class="division-chip" data-division="${esc(d.name)}"><b>${esc(d.name)}</b><small>${d.agents.length} agents</small></button>`).join('');
  el.querySelectorAll('[data-division]').forEach(btn=>btn.onclick=()=>{goPage('agents');if($('divisionFilter'))$('divisionFilter').value=btn.dataset.division;renderAgents();});
}
function renderDivisionFilter(){
  const select=$('divisionFilter'); if(!select)return;
  const current=select.value||'all';
  select.innerHTML='<option value="all">Semua tim</option>'+divisions.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');
  if([...select.options].some(o=>o.value===current))select.value=current;
}
function renderDivisions(){
  const el=$('divisionGrid'); if(!el)return;
  el.innerHTML=divisions.map((d,i)=>`<article class="division-card"><div class="division-card-top"><span class="division-number">${String(i+1).padStart(2,'0')}</span><span class="pill neutral">${d.agents.length} agents</span></div><h3>${esc(d.name)}</h3><p>${esc(d.purpose)}</p><div class="instruction"><b>Instruksi kerja</b><span>${esc(d.instruction)}</span></div><div class="role-tags">${d.agents.map(a=>`<button data-open-agent="${esc(a)}">${esc(a)}</button>`).join('')}</div></article>`).join('');
  el.querySelectorAll('[data-open-agent]').forEach(b=>b.onclick=()=>openAgentByName(b.dataset.openAgent));
}
function renderAgents(){
  const el=$('agentGrid'); if(!el)return;
  const q=($('agentSearch')?.value||'').toLowerCase().trim();
  const filter=$('divisionFilter')?.value||'all';
  const list=allAgents().filter(a=>(filter==='all'||a.division===filter)&&(!q||`${a.name} ${a.division} ${a.purpose}`.toLowerCase().includes(q)));
  el.innerHTML=list.map(a=>`<button class="directory-card" data-id="${a.id}"><span class="agent-avatar">AI</span><div><b>${esc(a.name)}</b><small>${esc(a.division)}</small><p>${esc(a.purpose)}</p></div><i>Chat →</i></button>`).join('')||'<div class="no-result">Agent tidak ditemukan.</div>';
  el.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openAgent(b.dataset.id));
}

function openAgentByName(name){const a=findAgentByName(name);if(a)openAgent(a.id);}
function openAgent(id){
  selectedAgent=allAgents().find(a=>a.id===id); if(!selectedAgent)return;
  $('chatDivision').textContent=selectedAgent.division.toUpperCase();
  $('chatAgentName').textContent=selectedAgent.name;
  $('chatScope').textContent=selectedAgent.purpose;
  if(!chats[id])chats[id]=[{who:'agent',text:`Saya ${selectedAgent.name}. Tugas saya: ${selectedAgent.purpose} Aturan kerja: ${selectedAgent.instruction}`}];
  renderChat();
  $('chatDrawer').classList.add('open');$('drawerBackdrop').classList.add('show');$('chatDrawer').setAttribute('aria-hidden','false');
}
function closeChat(){if(!$('chatDrawer'))return;$('chatDrawer').classList.remove('open');$('drawerBackdrop').classList.remove('show');$('chatDrawer').setAttribute('aria-hidden','true');}
function renderChat(){if(!selectedAgent)return;$('chatMessages').innerHTML=(chats[selectedAgent.id]||[]).map(m=>`<div class="message ${m.who}"><small>${m.who==='user'?'YOU':esc(selectedAgent.name)}</small><p>${esc(m.text)}</p></div>`).join('');$('chatMessages').scrollTop=$('chatMessages').scrollHeight;}
function agentReply(text){
  const a=selectedAgent, lower=text.toLowerCase();
  if(lower.startsWith('ingat ')||lower.startsWith('remember ')){
    memories[a.id]=memories[a.id]||[];memories[a.id].push(text.replace(/^(ingat|remember)\s+/i,''));persist();renderMemory();return 'Sudah saya simpan sebagai memory khusus role saya.';
  }
  if(lower.includes('tugas')||lower.includes('jobdesk'))return `Jobdesk saya: ${a.purpose} Instruksi utama: ${a.instruction}`;
  if(lower.includes('file')||lower.includes('edit')||lower.includes('ubah'))return `Saya akan membuat patch sesuai scope ${a.division}. Final write tetap lewat Merge Manager.`;
  return `Task diterima sebagai ${a.name}. Saya bekerja dalam scope ${a.division} dan akan eskalasi jika tugas keluar dari wewenang.`;
}

function routeText(text){
  const s=text.toLowerCase();
  const routes=[];
  const add=name=>{if(findDivision(name)&&!routes.includes(name))routes.push(name);};
  if(/riset|research|cari|sumber|cek fakta|validasi|kompetitor/.test(s))add('Research / IERD');
  if(/lapangan|field|lokasi|survey|observasi|bukti/.test(s))add('Field Operations');
  if(/terjemah|translate|bahasa|lokalisasi/.test(s))add('Translation & Interpretation');
  if(/buat|bangun|coding|dashboard|api|website|eksekusi|dokumen/.test(s)){add('Engineering & Data');add('Execution');}
  if(/keuangan|finance|penjualan|sales|stok|hpp|bisnis/.test(s))add('Business & Finance');
  if(/pilih|rekomendasi|risiko|prioritas|keputusan/.test(s))add('Decision Support');
  if(/aman|security|test|qa|conflict|review/.test(s))add('Security & QA');
  if(!routes.length)add('Core Coordination');
  return routes;
}
function renderMainChat(){const el=$('mainChatMessages');if(!el)return;el.innerHTML=mainMessages.map(m=>`<div class="message ${m.who}"><small>${m.who==='user'?'YOU':'NEXA CHIEF OF STAFF'}</small><p>${esc(m.text)}</p></div>`).join('');el.scrollTop=el.scrollHeight;}
function createTasksFromPrompt(text){
  const routes=routeText(text);
  const created=routes.map((team,i)=>{
    const d=findDivision(team);const id=`T-${String(Date.now()).slice(-5)}-${i+1}`;
    return {id,title:text.length>72?text.slice(0,69)+'...':text,team,agent:d?.agents?.[0]||'Unassigned',status:i===0?'running':'waiting',priority:'Normal',instruction:d?.instruction||'',progress:i===0?12:0};
  });
  liveTasks.unshift(...created);persist();renderLiveTasks();syncMetrics();
  return created;
}
function handleMainChat(text){
  mainMessages.push({who:'user',text});
  const created=createTasksFromPrompt(text);
  const teamNames=[...new Set(created.map(t=>t.team))];
  mainMessages.push({who:'agent',text:`Saya routing task ini ke ${teamNames.join(', ')}. ${created.length} task dibuat. Lo bisa buka Live Control sekarang untuk pause, koreksi, reassign, atau hapus task.`});
  a2aMessages.unshift(...created.map(t=>({from:'Chief of Staff',to:t.agent,text:`Assigned ${t.id}: ${t.title}`})));
  workspaceFiles.unshift({name:`brief-${created[0].id.toLowerCase()}.md`,owner:'Chief of Staff',version:'v1',status:'shared'});
  renderMainChat();renderRouting(created);renderWorkspace();addControlLog(`Chief of Staff membuat ${created.length} task dari Main Chat.`);
}
function renderRouting(tasks=liveTasks.slice(0,5)){
  const el=$('routingPreview');if(!el)return;
  el.innerHTML=tasks.length?tasks.map(t=>`<div class="route-row"><span>${esc(t.id)}</span><div><b>${esc(t.team)}</b><small>${esc(t.agent)} · ${esc(t.status)}</small></div></div>`).join(''):'<div class="empty-route">Belum ada task.</div>';
}

function statusClass(status){return `status-${status.replace(/\s+/g,'-')}`;}
function renderLiveTasks(){
  const el=$('liveTaskList');if(!el)return;
  el.innerHTML=liveTasks.length?liveTasks.map(t=>`<article class="live-task" data-task="${esc(t.id)}"><div class="task-top"><div><span class="task-id">${esc(t.id)}</span><h3>${esc(t.title)}</h3></div><span class="task-status ${statusClass(t.status)}">${esc(t.status)}</span></div><div class="task-meta"><span><b>Team</b>${esc(t.team)}</span><span><b>Agent</b>${esc(t.agent)}</span><span><b>Priority</b>${esc(t.priority)}</span><span><b>Progress</b>${t.progress}%</span></div><div class="progress"><i style="width:${Math.max(0,Math.min(100,t.progress))}%"></i></div><p>${esc(t.instruction||'Tidak ada instruksi tambahan.')}</p><div class="task-actions"><button data-act="toggle">${t.status==='paused'?'Resume':'Pause'}</button><button data-act="instruction">+ Instruction</button><button data-act="reassign">Reassign</button><button data-act="priority">Priority</button><button data-act="approval">${t.status==='approval'?'Approve':'Need Approval'}</button>${t.status==='approval'?'<button data-act="reject">Reject</button>':''}<button class="danger-btn" data-act="delete">Delete</button></div></article>`).join(''):'<div class="empty-state"><strong>Belum ada task.</strong><small>Kirim perintah dari Main Chat atau jalankan simulasi.</small></div>';
  el.querySelectorAll('.live-task').forEach(card=>card.querySelectorAll('[data-act]').forEach(btn=>btn.onclick=()=>taskAction(card.dataset.task,btn.dataset.act)));
}
function addControlLog(text){controlHistory.unshift({time:nowLabel(),text});controlHistory=controlHistory.slice(0,30);persist();renderControlLog();}
function renderControlLog(){const el=$('controlLog');if(!el)return;el.innerHTML=controlHistory.map(x=>`<div class="control-entry"><span>${esc(x.time)}</span><p>${esc(x.text)}</p></div>`).join('');}
function taskAction(id,action){
  const t=liveTasks.find(x=>x.id===id);if(!t)return;
  if(action==='toggle'){t.status=t.status==='paused'?'running':'paused';addControlLog(`${id}: ${t.status==='paused'?'dipause':'dilanjutkan'} oleh user.`);}
  if(action==='instruction'){
    const val=prompt(`Instruksi tambahan untuk ${id}:`,t.instruction||'');if(val!==null&&val.trim()){t.instruction=val.trim();if(t.status==='waiting')t.status='running';a2aMessages.unshift({from:'USER OVERRIDE',to:t.agent,text:t.instruction});addControlLog(`${id}: instruksi diubah langsung oleh user.`);}
  }
  if(action==='reassign'){
    const val=prompt('Masukkan nama agent atau nama tim tujuan:',t.agent);if(val&&val.trim()){const q=val.trim().toLowerCase();const a=allAgents().find(x=>x.name.toLowerCase()===q);const d=divisions.find(x=>x.name.toLowerCase()===q);if(a){t.agent=a.name;t.team=a.division;}else if(d){t.team=d.name;t.agent=d.agents[0];}else{alert('Agent/tim tidak ditemukan.');}addControlLog(`${id}: di-reassign ke ${t.agent} / ${t.team}.`);}
  }
  if(action==='priority'){const order=['Normal','High','Urgent'];t.priority=order[(order.indexOf(t.priority)+1)%order.length];addControlLog(`${id}: priority diubah menjadi ${t.priority}.`);}
  if(action==='approval'){
    if(t.status==='approval'){t.status='running';t.instruction=`APPROVED BY USER. ${t.instruction}`;addControlLog(`${id}: user memberi approval.`);}else{t.status='approval';addControlLog(`${id}: user memaksa task berhenti di approval gate.`);}
  }
  if(action==='reject'){t.status='rejected';addControlLog(`${id}: ditolak oleh user dan tidak boleh masuk final merge.`);}
  if(action==='delete'){if(confirm(`Hapus task ${id}?`)){liveTasks=liveTasks.filter(x=>x.id!==id);addControlLog(`${id}: dihapus oleh user.`);}}
  persist();renderLiveTasks();renderRouting();renderWorkspace();syncMetrics();
}

function renderWorkspace(){
  if($('workspaceFiles'))$('workspaceFiles').innerHTML=workspaceFiles.map(f=>`<div class="workspace-row"><span>▤</span><div><b>${esc(f.name)}</b><small>${esc(f.owner)} · ${esc(f.version)}</small></div><i>${esc(f.status)}</i></div>`).join('');
  const tools=[['Web / Search','Research scoped'],['Repository / Files','Patch-only'],['Database','Owner-scoped'],['External Actions','Approval required']];
  if($('toolRegistry'))$('toolRegistry').innerHTML=tools.map(t=>`<div class="workspace-row"><span>⌘</span><div><b>${t[0]}</b><small>${t[1]}</small></div></div>`).join('');
  if($('a2aMessages'))$('a2aMessages').innerHTML=a2aMessages.slice(0,20).map(m=>`<div class="a2a-row"><b>${esc(m.from)}</b><span>→</span><b>${esc(m.to)}</b><p>${esc(m.text)}</p></div>`).join('');
}
function renderMemory(){
  const el=$('memoryRegistry');if(!el)return;
  const entries=Object.entries(memories).flatMap(([id,items])=>{const a=allAgents().find(x=>x.id===id);return (items||[]).map(text=>({agent:a?.name||id,text}));});
  el.innerHTML=entries.length?entries.slice(-20).reverse().map(m=>`<div class="workspace-row"><span>◉</span><div><b>${esc(m.agent)}</b><small>${esc(m.text)}</small></div></div>`).join(''):'<div class="empty-route">Belum ada learned memory. Buka chat agent lalu tulis “ingat ...”.</div>';
}
function renderRoutines(){const el=$('routineList');if(!el)return;el.innerHTML=routines.map((r,i)=>`<div class="routine-card"><div><b>${esc(r.name)}</b><small>${esc(r.trigger)}</small><p>${esc(r.steps)}</p></div><button data-routine="${i}">Run</button></div>`).join('');el.querySelectorAll('[data-routine]').forEach(b=>b.onclick=()=>{const r=routines[+b.dataset.routine];handleMainChat(`Jalankan routine: ${r.name}. Langkah: ${r.steps}`);goPage('mainchat');});}
function teachRoutine(){const name=prompt('Nama routine / skill:');if(!name)return;const steps=prompt('Langkah kerja (contoh: A → B → C):');if(!steps)return;const trigger=prompt('Trigger (Manual / Event / Schedule / Handoff):','Manual')||'Manual';routines.push({name,steps,trigger});persist();renderRoutines();}

function addEvent(type,detail,index){const log=$('eventLog');if(!log)return;if(log.querySelector('.empty-state'))log.innerHTML='';const item=document.createElement('div');item.className='event-item';item.innerHTML=`<span class="event-bullet"></span><div><strong>${esc(type)}</strong><small>${esc(detail)}</small><small class="event-meta">Event #${String(index+1).padStart(3,'0')} · auditable</small></div>`;log.prepend(item);}
async function runSimulation(){
  if(running)return;running=true;if($('runBtn')){$('runBtn').disabled=true;$('runBtn').textContent='Menjalankan...';}if($('workflowState'))$('workflowState').textContent='RUNNING';
  const events=[['INTENT_ROUTED','Chief of Staff menerima tujuan user.'],['RESEARCH_ASSIGNED','Research / IERD memeriksa informasi.'],['FIELD_HANDOFF','Field Operations menerima brief.'],['USER_OVERRIDE_READY','Human owner dapat menginterupsi task aktif kapan pun.'],['PARALLEL_EXECUTION','Engineering dan Execution bekerja pada patch terpisah.'],['APPROVAL_GATE','Perubahan sensitif berhenti menunggu approval.'],['QA_VALIDATED','Security & QA memeriksa konflik dan hasil.'],['MERGE_COMMITTED','Merge Manager menjadi satu-satunya final writer.']];
  if($('eventLog'))$('eventLog').innerHTML='';
  for(let i=0;i<events.length;i++){await sleep(350);addEvent(events[i][0],events[i][1],i);}
  if(!liveTasks.some(t=>t.id==='SIM-001')){liveTasks.unshift({id:'SIM-001',title:'Simulasi multi-team workflow',team:'Core Coordination',agent:'Task Planner',status:'running',priority:'Normal',instruction:'User boleh interupsi dari Live Control.',progress:35});persist();}
  renderLiveTasks();syncMetrics();if($('workflowState'))$('workflowState').textContent='COMPLETED';if($('runBtn')){$('runBtn').disabled=false;$('runBtn').textContent='↻ Jalankan Lagi';}running=false;
}
async function runPipeline(){const steps=[...document.querySelectorAll('.pipeline-step')];steps.forEach(s=>s.classList.remove('active','done'));for(const step of steps){step.classList.add('active');await sleep(420);step.classList.remove('active');step.classList.add('done');}}

function createDivisionFromForm(e){e.preventDefault();const name=$('customDivisionName').value.trim(),purpose=$('customDivisionPurpose').value.trim(),instruction=$('customDivisionInstruction').value.trim(),roles=$('customAgentRoles').value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,20);if(!name||!purpose||!instruction||!roles.length)return;divisions.push({name,purpose,instruction,agents:roles});persist();renderAll();$('divisionDialog').close();e.target.reset();goPage('divisions');addControlLog(`Custom team “${name}” dibuat dengan ${roles.length} agent.`);}

function goPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.dataset.pageContent===name));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===name));
  const titles={overview:['Agent Control Center','Satu Chief of Staff mengatur banyak teammate AI, sementara user tetap punya human override.'],mainchat:['NEXA Main Chat','Tulis tujuan; Chief of Staff akan routing ke tim yang sesuai.'],control:['Live Control','Interupsi pekerjaan agent secara langsung tanpa menunggu workflow selesai.'],agents:['Agent Directory','Masuk langsung ke chat agent tertentu tanpa mencampur context.'],divisions:['Team Blueprint Builder','Tim, jobdesk, instruksi, dan agent dapat dikustomisasi.'],workspace:['Shared Workspace','Artifact, tools, dan pesan agent-to-agent tetap auditable.'],memory:['Persistent Memory','Memory per-agent terisolasi dan bisa belajar dari koreksi user.'],routines:['Skills & Routines','Ajarkan prosedur sekali, gunakan ulang sebagai routine.'],workflow:['Safe Workflow','Dependency + human override + QA + single final writer.'],ownership:['Approvals & Safety','Human owner menentukan gate dan batas aksi agent.']};
  const [t,s]=titles[name]||titles.overview;if($('pageTitle'))$('pageTitle').textContent=t;if($('pageSubtitle'))$('pageSubtitle').textContent=s;
}
function renderAll(){syncMetrics();renderDivisionFilter();renderDivisionSnapshot();renderDivisions();renderAgents();renderMainChat();renderRouting();renderLiveTasks();renderControlLog();renderWorkspace();renderMemory();renderRoutines();}

function init(){
  renderAll();
  document.querySelectorAll('.nav-item').forEach(n=>n.onclick=()=>goPage(n.dataset.page));
  document.querySelectorAll('[data-go]').forEach(n=>n.onclick=()=>goPage(n.dataset.go));
  $('agentSearch')?.addEventListener('input',renderAgents);$('divisionFilter')?.addEventListener('change',renderAgents);
  $('closeChat')?.addEventListener('click',closeChat);$('drawerBackdrop')?.addEventListener('click',closeChat);
  $('chatForm')?.addEventListener('submit',e=>{e.preventDefault();const input=$('chatInput'),text=input.value.trim();if(!text||!selectedAgent)return;chats[selectedAgent.id]=chats[selectedAgent.id]||[];chats[selectedAgent.id].push({who:'user',text});input.value='';renderChat();setTimeout(()=>{chats[selectedAgent.id].push({who:'agent',text:agentReply(text)});persist();renderChat();},180);persist();});
  $('mainChatForm')?.addEventListener('submit',e=>{e.preventDefault();const input=$('mainChatInput'),text=input.value.trim();if(!text)return;input.value='';handleMainChat(text);});
  $('addDivisionBtn')?.addEventListener('click',()=>$('divisionDialog').showModal());$('divisionForm')?.addEventListener('submit',createDivisionFromForm);
  $('runBtn')?.addEventListener('click',runSimulation);$('runWorkflowBtn')?.addEventListener('click',runPipeline);$('teachRoutineBtn')?.addEventListener('click',teachRoutine);
}
init();