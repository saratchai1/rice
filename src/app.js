import { ASSETS, REGIONS, DEMO_SITES, DEMO_TEAMS, CAPEX_PER_SITE, NATIONAL_NOMINAL_CAPEX,
  getFleetStats, calculateDrying, makeWorkOrder, advanceWorkOrder, seedWorkOrders, WORKFLOW_LABELS } from './model.mjs';
import { PlantScene } from './scene.js';
import { PROVINCE_MAP, projectLocation, provinceSvgPath, generateMapPositions } from './map-geo.mjs';
import { attachMapViewport } from './map-viewport.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const number = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n);
const money = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
const escapeHtml = x => String(x ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
const findSite = id => DEMO_SITES.find(s => s.id === id) || DEMO_SITES[0];
const findAsset = id => ASSETS.find(a => a.id === Number(id)) || ASSETS[2];
const STATUSES = { healthy: 'HEALTHY', warning: 'ATTENTION', critical: 'CRITICAL', offline: 'NO DATA' };
const demoMapPositions = generateMapPositions(DEMO_SITES);
const localKey = 'rice-atlas-demo-workorders-v1';
const state = {
  view: 'fleet', region: 'all', selectedSiteId: 'RICE-001', assetId: 3,
  scenario: 'normal', inputMoisture: 24, targetMoisture: 14, feed: 2.8, solarFactor: 72,
  workOrderFilter: 'all', workOrders: loadOrders(), scene: null,
};
let toastTimer;

function loadOrders() {
  try { const stored = JSON.parse(localStorage.getItem(localKey)); if (Array.isArray(stored)) return stored.filter(w => DEMO_SITES.some(s => s.id === w.siteId) && ASSETS.some(a => a.id === w.assetId)); } catch {} // invalid local data resets demo
  return seedWorkOrders();
}
function saveOrders() { try { localStorage.setItem(localKey, JSON.stringify(state.workOrders)); } catch {} }
function toast(message) { const el=$('#toast'); el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3500); }
function statCard(label,value,unit,detail,tone='') {
  return `<div class="kpi-card ${tone?'tone-'+tone:''}"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-tag">◆</span></div><div class="kpi-number">${value}<small>${unit}</small></div><div class="kpi-bottom">${detail}</div></div>`;
}
function showView(view) {
  state.view=view;
  $$('.view').forEach(el=>el.classList.toggle('is-active',el.id===`view-${view}`));
  $$('.rail-link').forEach(el=>el.classList.toggle('is-active',el.dataset.nav===view));
  $('#page-eyebrow').textContent=({fleet:'NATIONAL FLEET',site:'PLANT DIGITAL TWIN',maintenance:'DITTO SERVICE HUB',insights:'INTELLIGENCE LAB'})[view];
  if(view==='site'){
    if(!state.scene){
      try {state.scene=new PlantScene($('#twin-canvas'),selectAsset);}
      catch(err){console.error('3D renderer unavailable',err);$('#canvas-wrap').insertAdjacentHTML('afterbegin','<div style="padding:90px 20px;text-align:center;color:#ffc97b">WebGL ไม่พร้อมใช้งานบนเบราว์เซอร์นี้ กรุณาเปิด Hardware Acceleration เพื่อดูโรงงาน 3D</div>');}
    }
    state.scene?.resize();renderSite();
  }
  if(view==='maintenance')renderMaintenance();
  if(view==='insights')renderInsights();
  window.scrollTo({top:0,behavior:'instant'});
}
function selectSite(siteId, open3D=true) {
  if(!DEMO_SITES.some(s=>s.id===siteId))return;
  state.selectedSiteId=siteId;
  if(open3D)showView('site');
  else renderSite();
}

function fleetSummary(){
  const stats=getFleetStats();
  $('#fleet-kpis').innerHTML=[
    statCard('PROJECT NETWORK',number(stats.sites),'SITES','ตัวอย่าง 300 โครงการ / 77 จังหวัด','cyan'),
    statCard('CONNECTED ASSET MODEL',number(stats.assets),'ASSETS','8 หมวดต่อโครงการ · model only'),
    statCard('ATTENTION / CRITICAL',number(stats.warning+stats.critical),'SITES','สถานะสุขภาพเป็นข้อมูลสังเคราะห์','amber'),
    statCard('OPEN WORK ORDERS',number(state.workOrders.filter(w=>w.status!=='done').length),'CASES','ใบงานทดลองในเบราว์เซอร์','blue'),
    statCard('NOMINAL CAPEX', '3.54','฿B','300 × 11.8 ล้านบาท / ประมาณการ','cyan'),
  ].join('');
}
function renderFleet(){fleetSummary();renderRegionList();renderMap();renderPrioritySites();}

function filteredSites(){return state.region==='all'?DEMO_SITES:DEMO_SITES.filter(s=>s.region===state.region)}
function renderRegionList(){
  const all=DEMO_SITES.length;
  const rows=[{id:'all',name:'ทุกภูมิภาค',en:'ALL REGIONS',color:'#76e7c7',count:all},...REGIONS.map(r=>({...r,count:DEMO_SITES.filter(s=>s.region===r.id).length}))];
  $('#region-list').innerHTML=rows.map(r=>`<button class="region-item ${state.region===r.id?'active':''}" data-region="${r.id}"><i class="region-bar" style="background:${r.color}"></i><span class="region-name">${r.name}<small>${r.en}</small></span><span class="region-total">${r.count}</span></button>`).join('');
  $$('.region-item').forEach(el=>el.addEventListener('click',()=>{state.region=el.dataset.region;renderRegionList();renderMap();renderPrioritySites()}));
  $('#region-count').textContent=String(REGIONS.length).padStart(2,'0');
}
function svgNode(name,attributes={}) {const el=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v] of Object.entries(attributes))el.setAttribute(k,v);return el;}
function renderMap(){
  const svg=$('#thailand-map'),dots=$('#map-projects');
  if (!svg.querySelector('#real-province-outlines')) {
    svg.querySelector('.map-land')?.remove(); // Replace the old hand-drawn schematic.
    const land=svgNode('g',{id:'real-province-outlines','aria-hidden':'true'});
    const clip=svgNode('clipPath',{id:'thailand-land-clip'});
    for (const feature of PROVINCE_MAP.values()) {
      const d=provinceSvgPath(feature);
      land.append(svgNode('path',{d,class:'map-province',fill:'url(#mapFill)',stroke:'#4b8a8e','stroke-width':'0.65','stroke-linejoin':'round','fill-rule':'evenodd'}));
      clip.append(svgNode('path',{d,'clip-rule':'evenodd'}));
    }
    svg.querySelector('defs').append(clip);
    svg.insertBefore(land,dots);
    svg.setAttribute('aria-label','ขอบเขตประเทศไทยและจังหวัดตาม GeoJSON จริง พร้อมจุดสาธิต 300 โครงการซึ่งอยู่ภายในขอบเขตจังหวัด');
    dots.setAttribute('clip-path','url(#thailand-land-clip)');
    $('.map-panel .micro-head').textContent='GEOGRAPHIC INTELLIGENCE / THAILAND ADM1';
    $('.map-coordinates').innerHTML='THAILAND · WGS84<br><span>77 PROVINCE OUTLINES</span>';
    $('.map-footnote').innerHTML='<span>●</span> จุดภายในจังหวัดเป็นตำแหน่งจำลอง ไม่ใช่ GPS โรงงานจริง';
  }
  dots.replaceChildren();
  DEMO_SITES.forEach(site=>{
    const point=demoMapPositions.get(site.id), {x,y}=projectLocation(point.lon,point.lat);
    const col=site.status==='critical'?'#ff8587':site.status==='warning'?'#ffcd79':site.status==='offline'?'#5a7b89':'#69d9c6';
    const dot=svgNode('circle',{cx:x.toFixed(2),cy:y.toFixed(2),r:site.status==='critical'?'3.3':'2',fill:col,
      opacity:state.region==='all'||state.region===site.region?'.92':'.10',class:'map-node'});
    dot.append(svgNode('title'));
    dot.lastChild.textContent=`${site.id} · ${site.province} · ${STATUSES[site.status]} (ตำแหน่งจำลองภายในจังหวัด)`;
    dot.addEventListener('click',()=>selectSite(site.id));
    dots.append(dot);
  });
}
function renderPrioritySites(){
  const sites=filteredSites().filter(s=>s.status==='critical'||s.status==='warning').sort((a,b)=>
    ({critical:0,warning:1})[a.status]-({critical:0,warning:1})[b.status]).slice(0,5);
  $('#priority-sites').innerHTML=sites.length?sites.map(s=>`<div class="priority-site" data-site="${s.id}" role="button" tabindex="0"><span class="risk-orb ${s.status==='warning'?'warn':''}">!</span><div class="p-text"><b>${s.id} · ${s.province}</b><small>${REGIONS.find(r=>r.id===s.region).en} / HEALTH ${s.health}</small></div><span class="p-trend ${s.status==='warning'?'warn':''}">${STATUSES[s.status]} ↗</span></div>`).join(''):'<p style="padding:14px;color:#7899a7">ไม่มีไซต์ตัวอย่างที่ต้องเฝ้าระวังในพื้นที่นี้</p>';
  $$('.priority-site').forEach(el=>{
    el.addEventListener('click',()=>selectSite(el.dataset.site));
    el.addEventListener('keydown',e=>{if(e.key==='Enter')selectSite(el.dataset.site)});
  });
}

function renderSitePicker(){
  const select=$('#site-picker');
  if(!select.options.length)select.innerHTML=DEMO_SITES.map(s=>`<option value="${s.id}">${s.id} · ${s.province}</option>`).join('');
  select.value=state.selectedSiteId;
}
function calc(){return calculateDrying({inletMoisture:state.inputMoisture,outletMoisture:state.targetMoisture,feedTph:state.feed,solarKwp:60,solarFactor:state.solarFactor/100})}
function assetStatus(assetId){
  const site=findSite(state.selectedSiteId);
  if(site.status==='offline')return 'offline';
  if((state.scenario==='alarm'||site.status==='critical')&&assetId===3)return 'critical';
  if((state.scenario==='wet'&&assetId===3)||(site.status==='warning'&&assetId===2))return 'warning';
  return 'healthy';
}
function assetHealth(assetId){
  const s=assetStatus(assetId);
  return s==='offline'?null:s==='critical'?38:s==='warning'?72:89+(assetId%9);
}
function selectAsset(id){state.assetId=id;renderAssetList();renderInspector();}
function renderSite(){
  const site=findSite(state.selectedSiteId),sim=calc();
  $('#site-heading').innerHTML=`${site.id} <span class="title-muted">/ ${escapeHtml(site.province)} · Interactive 3D Factory</span>`;
  renderSitePicker();
  state.scene?.setSiteStatus(site.status);
  state.scene?.setScenario(state.scenario);
  state.scene?.selectAsset(state.assetId,false);
  $('#site-kpis').innerHTML=[
    ['INLET FEED',number(sim.feedTph),'t/h'],['INLET MOISTURE',number(sim.inletMoisture),'%'],
    ['TARGET MOISTURE',number(sim.outletMoisture),'%'],['WATER REMOVAL',number(sim.evaporatedKgH),'kg/h'],
    ['SOLAR PRODUCTION',number(sim.solarKw),'kW'],['PLANT STATUS',site.status.toUpperCase(),'DEMO'],
  ].map(([label,value,unit])=>`<div class="site-mini-kpi"><span>${label}</span><strong>${value} <em>${unit}</em></strong></div>`).join('');
  renderAssetList();renderInspector();renderProcessStrip();renderSimulator();renderSignals();
}
function renderAssetList(){
  $('#asset-list').innerHTML=ASSETS.map(asset=>`<button class="asset-row ${state.assetId===asset.id?'active':''}" data-asset="${asset.id}"><span class="asset-index">${String(asset.id).padStart(2,'0')}</span><span class="asset-info"><b>${asset.code}</b><small>${asset.short}</small></span><span class="asset-state ${assetStatus(asset.id)==='critical'?'critical':assetStatus(asset.id)==='warning'?'warn':''}"></span></button>`).join('');
  $$('.asset-row').forEach(button=>button.addEventListener('click',()=>state.scene?state.scene.selectAsset(Number(button.dataset.asset)):selectAsset(Number(button.dataset.asset))));
}
function getTelemetry(assetId,sim){
  const site=findSite(state.selectedSiteId),unit=site.status==='offline'?'—':null;
  const read=(v,u)=>unit??`${number(v)} ${u}`;
  const readings={
    1:[['Material feed',read(sim.feedTph,'t/h')],['Hopper level','68%'],['Motor status','RUN · DEMO']],
    2:[['Motor current','8.2 A'],['Vibration RMS','2.9 mm/s'],['Screen load','64%']],
    3:[['Inlet moisture',read(sim.inletMoisture,'%')],['Target outlet',read(sim.outletMoisture,'%')],['Evaporation',read(sim.evaporatedKgH,'kg/h')],['Thermal duty',read(sim.heatKw,'kW')]],
    4:[['Silo 1 inventory','13.2 / 20 t'],['Silo 2 inventory','8.8 / 20 t'],['Silo 3 inventory','11.4 / 20 t']],
    5:[['Rated grader capacity','1 t/h'],['Demo sorting rate','0.8 t/h'],['Vibration','2.1 mm/s']],
    6:[['Voltage','382 V'],['Power factor','0.94'],['Electrical demand',read(sim.electricalDemandKw,'kW')]],
    7:[['Bag size range','5–50 kg'],['Demo packing count','46 bags/h'],['Pack weight','25.0 kg']],
    8:[['Solar nameplate','60 kWp*'],['PV generation',read(sim.solarKw,'kW')],['Grid purchase',read(sim.gridKw,'kW')]],
  };
  return readings[assetId]||[];
}
function renderInspector(){
  const asset=findAsset(state.assetId),health=assetHealth(asset.id),status=assetStatus(asset.id),sim=calc();
  const history=state.workOrders.filter(w=>w.siteId===state.selectedSiteId&&w.assetId===asset.id);
  const coords=Array.from({length:34},(_,i)=>`${i*6},${50-(Math.sin(i*.5+asset.id)*7+Math.cos(i*.22)*10+i*.16)}`).join(' ');
  $('#asset-inspector').innerHTML=`<div class="inspector-card"><div class="inspector-hero"><span class="asset-badge">${asset.code}</span><h4>${asset.short}</h4><p>${asset.thai}</p><div class="health-row"><div><span class="health-label">ASSET HEALTH · DEMO</span><div class="health-score" style="color:${status==='critical'?'#fb8587':status==='warning'?'#ffcd79':'#74e8cd'}">${health??'—'}<small>${health===null?'':' / 100'}</small></div></div><span class="pill" style="padding:5px 9px">${STATUSES[status]||'OFFLINE'}</span></div><div class="health-bar"><div style="width:${health||0}%;background:${status==='critical'?'#fb8587':status==='warning'?'#ffcd79':'#74e8cd'}"></div></div></div><div><p class="telemetry-title">TELEMETRY CHANNELS*</p>${getTelemetry(asset.id,sim).map(([a,b])=>`<div class="telemetry-row"><span>${a}</span><strong>${b}</strong></div>`).join('')}<p class="telemetry-title">SENSOR PLAN</p><div class="telemetry-row"><span>${asset.sensor}</span></div><p class="telemetry-title">RECENT TREND · DEMO</p><div class="mini-chart"><svg viewBox="0 0 200 80" preserveAspectRatio="none"><polygon points="0,80 ${coords} 200,80" fill="#60d7bd1c"/><polyline points="${coords}" stroke="#66e8cc" stroke-width="2" fill="none"/></svg></div></div><div><p class="telemetry-title">ASSET LIFECYCLE</p><div class="telemetry-row"><span>Per-site budget</span><strong>฿${money(asset.cost)}</strong></div><div class="telemetry-row"><span>Maintenance history</span><strong>${history.length} demo cases</strong></div><div class="telemetry-row"><span>Warranty / OEM</span><strong>Pending registry</strong></div><div class="inspect-actions"><button class="button button-primary" id="inspector-create-wo">+ CREATE WORK ORDER</button><button class="button button-outline" id="inspector-service">SERVICE HISTORY ↗</button></div><div class="inspector-foot">* ทั้งหมดเป็นค่าจำลอง ยกเว้นชื่อ/ราคา/ขนาดตามภาพที่ได้รับ; Solar 60 kWp คือสมมติฐาน</div></div></div>`;
  $('#inspector-create-wo').addEventListener('click',()=>openWorkOrderModal(state.selectedSiteId,asset.id));
  $('#inspector-service').addEventListener('click',()=>showView('maintenance'));
}
function renderProcessStrip(){
  const stages=[['01','RECEIVE'],['02','CLEAN'],['03','DRY'],['04','STORE'],['05','GRADE'],['07','PACK']];
  $('#process-strip').innerHTML=stages.map(([num,text],i)=>`<span class="process-step">${num} <small>${text}</small></span>${i===stages.length-1?'':'<span class="process-arrow">→</span>'}`).join('');
}
function renderSimulator(){
  const sim=calc();
  [['input-moisture-value',`${state.inputMoisture}%`],['target-moisture-value',`${state.targetMoisture}%`],['feed-value',`${state.feed.toFixed(1)} t/h`],['solar-factor-value',`${state.solarFactor}%`]].forEach(([id,value])=>{$('#'+id).textContent=value});
  $$('.scenario').forEach(el=>el.classList.toggle('active',el.dataset.scenario===state.scenario));
  $('#simulation-results').innerHTML=[
    ['WATER REMOVED',sim.evaporatedKgH,'kg/h'],['BIOMASS FUEL',sim.biomassKgH,'kg/h'],
    ['THERMAL DUTY',sim.heatKw,'kW'],['GRID ELECTRICITY',sim.gridKw,'kW'],
  ].map(([label,value,unit])=>`<div class="sim-result"><small>${label}</small><strong>${number(value)} <span>${unit}</span></strong></div>`).join('');
  const percent=sim.electricalDemandKw?100*sim.solarUsedKw/sim.electricalDemandKw:0;
  $('#solar-share-label').textContent=`${Math.round(percent)}%`;
  $('#solar-fill').style.width=`${percent}%`;
  $('#simulation-warning').textContent=sim.warnings[0]||'Biomass: 14 MJ/kg, thermal efficiency: 55%, solar nameplate: 60 kWp (all assumptions)';
}
function renderSignals(){
  const site=findSite(state.selectedSiteId),sim=calc();
  let signals=[{severity:'green',title:'Mass balance checked',detail:`ประเมินน้ำระเหย ${number(sim.evaporatedKgH)} kg/h จาก wet-basis moisture`},
    {severity:'amber',title:'Process bottleneck to validate',detail:'ข้อมูลที่ได้รับระบุเครื่องคัดเมล็ดพันธุ์ 1 t/h; ทดสอบ line balancing ก่อนใช้ feed จำลอง'},
    {severity:'green',title:'Remote control disabled',detail:'MVP อ่านและจำลองเท่านั้น ไม่มีคำสั่งไป PLC'}];
  if(state.scenario==='alarm'||site.status==='critical')signals.unshift({severity:'red',title:'Dryer temperature excursion · DEMO',detail:'จำลองเหตุผิดปกติที่เครื่องอบ DRY-03 → เปิดใบงานซ่อม P1'});
  if(state.scenario==='wet')signals.unshift({severity:'amber',title:'High incoming moisture · DEMO',detail:'แนะนำตรวจการใช้ชีวมวลและเวลาพักเมล็ดเพื่อคงคุณภาพ'});
  if(state.scenario==='solar')signals.unshift({severity:'amber',title:'Low PV generation · DEMO',detail:'ประมาณการซื้อไฟฟ้าจากสายส่งเพิ่มขึ้นในชั่วโมงแสงน้อย'});
  $('#signal-count').textContent=String(signals.length).padStart(2,'0');
  $('#signals-list').innerHTML=signals.slice(0,4).map(s=>`<div class="signal-row"><i class="signal-icon ${s.severity==='red'?'red':s.severity==='green'?'green':''}"></i><div class="signal-content"><b>${s.title}</b><small>${s.detail}</small></div></div>`).join('');
}

function renderMaintenance(){
  const all=state.workOrders,active=all.filter(w=>w.status!=='done'),urgent=active.filter(w=>w.priority==='high');
  $('#maintenance-kpis').innerHTML=[
    statCard('FLEET COVERAGE','300','SITES','ทะเบียนโรงงานสาธิตทั้งประเทศ','cyan'),
    statCard('OPEN CASES',active.length,'WO','ใบงานซ่อมใน local demo','amber'),
    statCard('P1 / URGENT',urgent.length,'CASES','การจัดลำดับโดยระดับความสำคัญ','red'),
    statCard('IN PROGRESS',active.filter(w=>w.status==='in_progress').length,'WO','สถานะขั้นตอนปัจจุบัน'),
    statCard('SERVICE NETWORK','06','ZONES','ตัวอย่างโซนรอข้อมูลทีม Ditto','blue'),
  ].join('');
  $('#service-zones').innerHTML=REGIONS.map(r=>{
    const zones=DEMO_SITES.filter(s=>s.region===r.id),open=active.filter(w=>w.region===r.id);
    return `<div class="zone"><div class="zone-top"><span class="zone-pin" style="background:${r.color}"></span><span class="small-muted">${r.en}</span></div><div class="zone-name">${r.name}</div><strong>${zones.length} <small>SITES</small></strong><small>${open.length} demo work orders</small></div>`;
  }).join('');
  const ranked=[...active].sort((a,b)=>(a.priority==='high'?0:1)-(b.priority==='high'?0:1)).slice(0,5);
  $('#triage-list').innerHTML=ranked.length?ranked.map(w=>{
    const site=findSite(w.siteId),asset=findAsset(w.assetId);
    return `<div class="triage-row" data-order-site="${site.id}" data-order-asset="${asset.id}" role="button" tabindex="0"><span class="triage-level ${w.priority==='high'?'':'medium'}">${w.priority==='high'?'P1':'P2'}</span><div class="triage-info"><b>${asset.code} · ${site.province}</b><small>${w.id} / ${WORKFLOW_LABELS[w.status]}</small></div><span class="triage-arrow">↗</span></div>`;
  }).join(''):'<p style="color:#7da3ad">ไม่มีใบงานค้าง</p>';
  $$('.triage-row').forEach(el=>{
    const open=()=>{state.assetId=Number(el.dataset.orderAsset);selectSite(el.dataset.orderSite)};
    el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter')open()});
  });
  renderOrders();
}
function renderOrders(){
  const orders=state.workOrders.filter(w=>state.workOrderFilter==='all'||w.status===state.workOrderFilter)
    .sort((a,b)=>(a.status==='done'?1:0)-(b.status==='done'?1:0)||({high:0,medium:1,low:2})[a.priority]-({high:0,medium:1,low:2})[b.priority]);
  $('#order-count').textContent=`/ ${orders.length} cases`;
  $('#orders-table').innerHTML=orders.length?orders.map(w=>{
    const site=findSite(w.siteId),asset=findAsset(w.assetId),team=DEMO_TEAMS.find(t=>t.id===w.teamId);
    const action={new:'ASSIGN ↗',assigned:'START WORK ↗',in_progress:'CLOSE CASE ✓',done:'CLOSED'}[w.status];
    return `<tr><td><b>${escapeHtml(w.id)}</b><small>${escapeHtml(w.createdAt.slice(0,10))} · demo</small></td><td><b>${site.id}</b><small>${escapeHtml(site.province)}</small></td><td><b>${asset.code}</b><small>${asset.short}</small></td><td><span class="priority-badge ${w.priority}">${w.priority==='high'?'P1 · URGENT':w.priority==='medium'?'P2 · NORMAL':'P3 · PLANNED'}</span></td><td>${team?escapeHtml(team.name):'<span style="color:#7399a6">UNASSIGNED</span>'}</td><td><span class="workflow-badge ${w.status}">${WORKFLOW_LABELS[w.status]||'—'}</span></td><td><button class="advance-order" data-wo="${escapeHtml(w.id)}" ${w.status==='done'?'disabled':''}>${action}</button></td></tr>`;
  }).join(''):'<tr><td colspan="7" style="padding:30px;text-align:center">ไม่มีใบงานในตัวกรองนี้</td></tr>';
  $$('.advance-order').forEach(el=>el.addEventListener('click',()=>advanceOrderById(el.dataset.wo)));
}
function advanceOrderById(id){
  const i=state.workOrders.findIndex(w=>w.id===id);if(i<0)return;
  const w=state.workOrders[i];const team=DEMO_TEAMS.find(t=>t.region===w.region);
  try{state.workOrders[i]=advanceWorkOrder(w,team?.id);saveOrders();renderMaintenance();fleetSummary();toast(`${id} → ${WORKFLOW_LABELS[state.workOrders[i].status]} (DEMO)`)}
  catch(err){toast(err.message)}
}
function openWorkOrderModal(siteId=state.selectedSiteId,assetId=state.assetId){
  $('#wo-site').innerHTML=DEMO_SITES.map(s=>`<option value="${s.id}">${s.id} · ${s.province}</option>`).join('');
  $('#wo-asset').innerHTML=ASSETS.map(a=>`<option value="${a.id}">${a.code} · ${a.thai}</option>`).join('');
  $('#wo-site').value=siteId;$('#wo-asset').value=String(assetId);
  $('#wo-priority').value=state.scenario==='alarm'?'high':'medium';
  $('#wo-description').value=state.scenario==='alarm'?'พบเหตุจำลอง: อุณหภูมิห้องอบสูงเกินช่วงปลอดภัย โปรดตรวจหัววัดและระบบลมร้อน':'';
  $('#wo-modal').showModal();
}
function submitWorkOrder(e){
  e.preventDefault();
  const w=makeWorkOrder({siteId:$('#wo-site').value,assetId:Number($('#wo-asset').value),priority:$('#wo-priority').value,description:$('#wo-description').value,id:`WO-${Date.now()}-${Math.floor(Math.random()*1000)}`});
  state.workOrders.unshift(w);saveOrders();$('#wo-modal').close();toast(`สร้าง ${w.id} สำเร็จ (สาธิต / ยังไม่ส่งถึง Ditto)`);showView('maintenance');
}
function exportWorkOrders(){
  const fields=['id','siteId','region','assetId','priority','status','teamId','description','createdAt','updatedAt','demo'];
  const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv='\ufeff'+[fields.join(','),...state.workOrders.map(w=>fields.map(f=>quote(w[f])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='rice-atlas-demo-workorders.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast('Export CSV ใบงานจำลองสำเร็จ');
}

function renderInsights(){
  $('#budget-bar').innerHTML=ASSETS.map(a=>`<i style="width:${a.cost/CAPEX_PER_SITE*100}%;background:${a.color}" title="${a.short}: ฿${money(a.cost)}"></i>`).join('');
  $('#budget-legend').innerHTML=ASSETS.map(a=>`<div class="budget-item"><i style="background:${a.color}"></i><span>${a.code}</span><b>฿${(a.cost/1e6).toFixed(2)}M</b></div>`).join('');
  $('.value-panel h3').innerHTML=`฿${(NATIONAL_NOMINAL_CAPEX/1e9).toFixed(2)} <span>billion</span>`;
}

function openCopilot(){const c=$('#copilot');c.classList.add('open');c.setAttribute('aria-hidden','false');$('#drawer-backdrop').hidden=false;}
function closeCopilot(){const c=$('#copilot');c.classList.remove('open');c.setAttribute('aria-hidden','true');$('#drawer-backdrop').hidden=true;}
function answerQuestion(topic){
  const stats=getFleetStats(),sim=calculateDrying({inletMoisture:28,outletMoisture:14,feedTph:2.8,solarKwp:60,solarFactor:.72});
  const open=state.workOrders.filter(w=>w.status!=='done'),urgent=open.filter(w=>w.priority==='high');
  const answers={
    fleet:`ภาพรวม 300 โครงการ (ข้อมูลสังเคราะห์)\n• ${stats.critical} ไซต์วิกฤต, ${stats.warning} ไซต์ต้องเฝ้าระวัง, ${stats.offline} ไซต์ไร้ข้อมูล\n• หากมีเครื่องจักร 8 หมวดทุกแห่ง จะเป็นทะเบียน ${number(stats.assets)} asset records\n• ขอพิกัด/รหัสไซต์จริงและ IoT sensor registry ก่อนเปิดใช้งานจริง\n\nแนะนำ: ติดตั้ง gateway + condition monitoring นำร่อง 5–10 ไซต์ก่อน`,
    energy:`WHAT-IF: ข้าวความชื้น 28% → 14% ที่ 2.8 t/h\n• น้ำที่ต้องระเหยประมาณ ${number(sim.evaporatedKgH)} kg/h\n• ความร้อนที่ใช้ตามสมมติฐาน ${number(sim.heatKw)} kW\n• เชื้อเพลิงชีวมวลตามสมมติฐาน ${number(sim.biomassKgH)} kg/h\n• ควรตรวจสอบ dryer capacity, คุณภาพข้าว และอัตราคัด 1 t/h ซึ่งอาจเป็นจุดคอขวด\n\nหมายเหตุ: ยังไม่มีข้อมูล efficiency และราคาพลังงานจริง`,
    service:`DITTO SERVICE TRIAGE (เฉพาะข้อมูลสาธิต)\n• ใบงานเปิด ${open.length} รายการ; Priority 1 จำนวน ${urgent.length} รายการ\n• แนะนำจัดลำดับ P1 → ตรวจการเข้าถึงและความปลอดภัย → จัดช่างในภูมิภาค → ยืนยันอะไหล่ → ปิดงานแนบหลักฐาน\n• SLA/ระยะเดินทางยังประเมินไม่ได้จนกว่าจะมีทะเบียนศูนย์บริการและพิกัดไซต์จริง\n\nระบบยังไม่ได้ส่งข้อมูลถึง Ditto หรือใช้ AI เชื่อมต่อจริง`,
  };
  $('#copilot-answer').textContent=answers[topic]||'เลือกหัวข้อเพื่อวิเคราะห์';
}

function setScenario(which){
  state.scenario=which;
  const presets={normal:[24,14,2.8,72],wet:[29,14,2.8,72],alarm:[24,14,2.8,72],solar:[24,14,2.8,9]};
  [state.inputMoisture,state.targetMoisture,state.feed,state.solarFactor]=presets[which]||presets.normal;
  $('#input-moisture').value=state.inputMoisture;$('#target-moisture').value=state.targetMoisture;
  $('#feed').value=state.feed;$('#solar-factor').value=state.solarFactor;
  renderSite();toast(({normal:'กลับสู่โหมดมาตรฐาน',wet:'เริ่มจำลองข้าวความชื้นสูง',alarm:'ฉากเตือนเครื่องอบ: ตรวจ DRY-03 / สร้างใบงานได้',solar:'เริ่มจำลองโซลาร์ผลิตไฟต่ำ'})[which]);
}

function init(){
  $$('.rail-link').forEach(el=>el.addEventListener('click',()=>showView(el.dataset.nav)));
  $('#open-site-primary').addEventListener('click',()=>showView('site'));
  $('#map-open-maintenance').addEventListener('click',()=>showView('maintenance'));
  $('#service-teaser-button').addEventListener('click',()=>showView('maintenance'));
  $('#insights-open-site').addEventListener('click',()=>showView('site'));
  $('#site-picker').addEventListener('change',e=>selectSite(e.target.value,false));
  $('#site-new-wo').addEventListener('click',()=>openWorkOrderModal());
  $('#create-wo-button').addEventListener('click',()=>openWorkOrderModal());
  $('#signals-create-wo').addEventListener('click',()=>openWorkOrderModal(state.selectedSiteId,3));
  $('#wo-form').addEventListener('submit',submitWorkOrder);
  $('#close-wo-modal').addEventListener('click',()=>$('#wo-modal').close());
  $('#cancel-wo').addEventListener('click',()=>$('#wo-modal').close());
  $('#workorder-filter').addEventListener('change',e=>{state.workOrderFilter=e.target.value;renderOrders()});
  $('#export-workorders').addEventListener('click',exportWorkOrders);
  $('#toggle-flow').addEventListener('click',e=>{e.currentTarget.classList.toggle('active');state.scene?.setFlowVisible(e.currentTarget.classList.contains('active'))});
  $('#toggle-heat').addEventListener('click',e=>{e.currentTarget.classList.toggle('active');state.scene?.setThermalVisible(e.currentTarget.classList.contains('active'))});
  $('#view-source-reference').addEventListener('click',()=>{showView('insights');$('#source-evidence').scrollIntoView({behavior:'smooth'})});
  $('#reset-camera').addEventListener('click',()=>state.scene?.resetCamera());
  $$('.scenario').forEach(el=>el.addEventListener('click',()=>setScenario(el.dataset.scenario)));
  [['input-moisture','inputMoisture'],['target-moisture','targetMoisture'],['feed','feed'],['solar-factor','solarFactor']].forEach(([id,key])=>{
    $('#'+id).addEventListener('input',e=>{state[key]=Number(e.target.value);state.scenario='custom';renderSite()});
  });
  $('#open-copilot').addEventListener('click',openCopilot);
  $('#close-copilot').addEventListener('click',closeCopilot);
  $('#drawer-backdrop').addEventListener('click',closeCopilot);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCopilot()});
  $$('.copilot-prompts button').forEach(el=>el.addEventListener('click',()=>answerQuestion(el.dataset.question)));
  const tickClock=()=>{$('#live-clock').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())};
  tickClock();setInterval(tickClock,1000);
  const mapSvg=$('#thailand-map');
  mapSvg.setAttribute('tabindex','0');
  attachMapViewport(mapSvg,{
    zoomIn:$('#map-zoom-in'),zoomOut:$('#map-zoom-out'),reset:$('#map-zoom-reset'),label:$('#map-zoom-label')
  });
  renderFleet();renderInsights();
  console.info('RICE ATLAS Prototype · synthetic telemetry and sites · no PLC control or live Ditto dispatch');
}
init();
