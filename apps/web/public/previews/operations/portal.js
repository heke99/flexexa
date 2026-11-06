'use strict';
const $=id=>document.getElementById(id);
let model,platform=false;
const kr=x=>x===null?'Okänd':`${Number(x).toLocaleString('sv-SE',{minimumFractionDigits:2,maximumFractionDigits:2})} kr`;
const time=x=>new Date(x).toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit'});
function cell(row,value){const c=document.createElement('td');c.textContent=value;row.append(c);return c;}
function metric(a,b,c){$('stat1').textContent=a;$('stat2').textContent=b;$('stat3').textContent=c;}
function detail(asset){
 $('detail-title').textContent=asset.label;const root=$('detail');root.replaceChildren();
 const grid=document.createElement('div');grid.className='detail-grid';
 for(const [label,value] of [['Planerad energi',`${asset.energy_kwh} kWh`],['Avresa',time(asset.departure_at)],['Enbart elhandel',kr(asset.electricity)],['Rörligt inkl. nät och skatt',kr(asset.variable_total)]]){const item=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('strong');small.textContent=label;strong.textContent=value;item.append(small,strong);grid.append(item);}root.append(grid);
 const note=document.createElement('p');note.className='detail-note';note.textContent=asset.plan_status==='blocked'?'Planeringen är spärrad: fasunderlag saknas i testscenariot. Nollvärden visar att ingen energi har planerats.':'Planen är beräknad med gemensamma fasgränser. Den bekräftar inte faktisk laddning eller att bilen är färdig vid avresa.';root.append(note);
 for(const r of model.company.timeline.filter(x=>x.asset_id===asset.asset_id)){const line=document.createElement('div');line.className='time-row';const label=document.createElement('span'),amount=document.createElement('span');label.textContent=`${time(r.starts_at)}–${time(r.ends_at)} · ${r.current_a} A`;amount.textContent=`${r.energy_kwh} kWh`;line.append(label,amount);root.append(line);}
 const end=document.createElement('p');end.className='detail-note';end.textContent='Total inklusive effekttariff: okänd. Fasta abonnemangsavgifter ingår inte. Testpriserna är inte hämtade från elbörsen.';root.append(end);
}
function render(){
 if(!model)return;platform=location.hash==='#platform';
 $('company-nav').classList.toggle('active',!platform);$('platform-nav').classList.toggle('active',platform);
 $('eyebrow').textContent=platform?'PLATTFORMSADMIN':'FÖRETAGSPORTAL';$('title').textContent=platform?'Överblick över partnerbolagen.':'Laddning, med överblick.';
 $('subtitle').textContent=platform?'Samlad driftöversikt · endast syntetiska uppgifter':model.company.label;
 $('crumb').textContent=platform?'Administration / Partnerbolag':'Partner / Laddning';
 $('stat1-label').textContent=platform?'Partnerbolag':'Bilar / laddpunkter';$('stat2-label').textContent=platform?'Planerade resurser':'Planerade';
 const companies=model.platform.companies,assets=model.company.overview.assets;
 metric(platform?companies.length:assets.length,platform?companies.reduce((n,c)=>n+c.planned_count,0):assets.filter(a=>a.plan_status==='optimal').length,platform?companies.reduce((n,c)=>n+c.blocked_count,0):assets.filter(a=>a.plan_status==='blocked').length);
 $('table-title').textContent=platform?'Partnerbolag':'Bilar och laddpunkter';$('table-eyebrow').textContent=platform?'FÖRETAGSÖVERSIKT':'LADDPLANER';
 $('table-head').replaceChildren();const header=document.createElement('tr');for(const value of platform?['Företag','Resurser','Planerade','Spärrade']:['Bil / laddpunkt','Planstatus','Energi','Enbart el','Rörligt totalt','Plan']){const th=document.createElement('th');th.textContent=value;header.append(th);}$('table-head').append(header);
 const query=$('search').value.toLocaleLowerCase('sv-SE');$('rows').replaceChildren();
 const rows=(platform?companies:assets).filter(r=>r.label.toLocaleLowerCase('sv-SE').includes(query));$('empty').hidden=rows.length!==0;
 for(const r of rows){const tr=document.createElement('tr');cell(tr,r.label);if(platform){cell(tr,r.asset_count);cell(tr,r.planned_count);cell(tr,r.blocked_count);}else{const status=document.createElement('span');status.className=`status${r.plan_status==='blocked'?' blocked':''}`;status.textContent=r.plan_status==='optimal'?'Plan beräknad':'Spärrad';cell(tr,'').append(status);cell(tr,`${r.energy_kwh} kWh`);cell(tr,kr(r.electricity));cell(tr,kr(r.variable_total));const button=document.createElement('button');button.textContent='Visa plan';button.setAttribute('aria-label',`Visa plan för ${r.label}`);button.addEventListener('click',()=>detail(r));cell(tr,'').append(button);}$('rows').append(tr);}
 if(platform){$('detail-title').textContent='Avgränsad administration';$('detail').replaceChildren();const p=document.createElement('p');p.className='detail-note';p.textContent='Plattforms-API:t är separat från företags-API:t och kräver en privilegierad adapter med audit. Här visas bara förberäknade sammanställningar av testföretag. Privat inloggning och autentiserad backend är inte driftsatta.';$('detail').append(p);}else detail(assets[0]);
}
$('search').addEventListener('input',render);window.addEventListener('hashchange',()=>{$('search').value='';render();});
fetch('preview-data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{model=data;render();}).catch(()=>{$('subtitle').textContent='Testunderlaget kunde inte laddas. Försök ladda om sidan.';});
