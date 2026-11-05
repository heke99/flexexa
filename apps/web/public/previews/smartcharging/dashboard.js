'use strict';
// Isolated design preview: synthetic fixtures only, no network or device writes.
const $ = (id) => document.getElementById(id);
const profiles = {
  bmw: { name: 'BMW 330e · 2023', soc: 38, target: 80, referenceTarget: 80, departure: '07:00', energy: 7.2 },
  second: { name: 'Bil 2 · simulator', soc: 55, target: 85, referenceTarget: 85, departure: '08:30', energy: 12 }
};
const prices = [0.92,0.76,0.61,0.52,0.58,0.74,1.02,1.37,1.58,1.43,1.12,0.98,0.88,0.82,0.92,1.08,1.35,1.63,1.71,1.56,1.28,1.15,1.04,0.96];
let selected = 'bmw', costMode = 'total', toastTimer;
const money = (value) => value.toLocaleString('sv-SE', {minimumFractionDigits:2,maximumFractionDigits:2});
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4200); }
function modal(title,text){$('dialog-title').textContent=title;$('dialog-text').textContent=text;$('info-dialog').showModal();}
function closeModal(){$('info-dialog').close();}
$('close-dialog').addEventListener('click',closeModal);$('dialog-ok').addEventListener('click',closeModal);
$('help').addEventListener('click',()=>modal('En förhandsvisning av Flexexa','Här testar du designen med simulerade bilar, priser och kostnader. BMW-bilden är en generell bilillustration. Ingen bil är ansluten och inga kommandon skickas. Planering och kostnadsberäkning ska senare komma från Flexexas API.'));
$('add-car').addEventListener('click',()=>modal('Anslut via Flexexa Connect','I den färdiga tjänsten öppnas ett säkert godkännandeflöde hos bil- eller laddboxleverantören. Du återvänder sedan till elbolagets app. Anslutningsflödet är ännu inte kopplat i denna förhandsvisning.'));
function calculate(){
 const p=profiles[selected],target=Number($('target').value), departure=$('departure').value;
 const energy=Math.max(0,p.energy*(target-p.soc)/(p.referenceTarget-p.soc));
 const end=departure?Math.max(0,Number(departure.slice(0,2))+Number(departure.slice(3))/60):7;
 const eligible=prices.map((price,hour)=>({price,hour})).filter(x=>x.hour+1<=end).sort((a,b)=>a.price-b.price).slice(0,3);
 const hours=energy>0?eligible.map(x=>x.hour):[];
 const unit=eligible.length?eligible.reduce((sum,x)=>sum+x.price,0)/eligible.length:0;
 const cents=(value)=>Math.round((value+Number.EPSILON)*100)/100;
 const electricity=cents(energy*(unit+.28)),network=cents(energy*.45),tax=cents(energy*.45);
 return {energy,electricity,network,tax,total:electricity+network+tax,hours,end,target,departure,difference:Math.max(0,energy*((prices[18]+prices[19]+prices[20])/3+.28)-electricity)};
}
function draw(){
 const p=profiles[selected],d=calculate();$('soc').innerHTML=`${p.soc}<span>%</span>`;
 $('target-display').innerHTML=`${d.target}<span>%</span>`;$('target-output').textContent=`${d.target} %`;
 $('battery-progress').style.width=`${p.soc}%`;$('target-marker').style.left=`${d.target}%`;
 $('energy-need').textContent=`${d.energy.toLocaleString('sv-SE',{maximumFractionDigits:1})} kWh`;
 $('electricity-cost').textContent=`${money(d.electricity)} kr`;$('network-cost').textContent=`${money(d.network)} kr`;$('tax-cost').textContent=`${money(d.tax)} kr`;
 const missing=d.energy>0&&!d.hours.length;
 $('cost-total').innerHTML=missing?'Ej beräknad':`${money(costMode==='total'?d.total:d.electricity)} <span>kr</span>`;
 $('metric-cost').innerHTML=missing?'Ej beräknad':`${money(d.total)} <span>kr</span>`;
 $('difference').innerHTML=missing?'Ej beräknad':`${money(d.difference)} <span>kr</span>`;
 document.querySelectorAll('.network-row').forEach(row=>row.hidden=costMode==='electricity');
 const ordered=[...d.hours].sort((a,b)=>a-b);
 $('window').textContent=ordered.length?ordered.map(h=>`${String(h).padStart(2,'0')}–${String(h+1).padStart(2,'0')}`).join(', '):'Inget laddfönster';
 $('plan-message').textContent=missing?'För kort tid i exempelmodellen. Ändra avresetiden.':d.energy===0?'Batterinivån är redan över ditt valda mål.':'De tre lägsta tillgängliga timpriserna är markerade. Detta är en visuell exempelplan.';
 $('car-status').textContent=missing?'Exempelplanen behöver justeras':d.energy===0?'Laddmålet är redan uppnått i demot':'Väntar på planerad laddning';
 $('price-chart').replaceChildren(...prices.map((price,hour)=>{const wrapper=document.createElement('div');wrapper.className='bar-wrap';wrapper.title=`${String(hour).padStart(2,'0')}.00: ${money(price)} kr/kWh${d.hours.includes(hour)?' · exempel på laddning':''}`;const bar=document.createElement('div');bar.className='price-bar'+(d.hours.includes(hour)?' scheduled':'');bar.style.height=`${price/1.8*135}px`;const label=document.createElement('div');label.className='bar-label';label.textContent=hour%3===0?String(hour).padStart(2,'0'):'';wrapper.append(bar,label);return wrapper;}));
}
$('vehicle').addEventListener('change',()=>{selected=$('vehicle').value;$('target').value=profiles[selected].target;$('departure').value=profiles[selected].departure;draw();toast('Visar '+profiles[selected].name+' med separata exempelinställningar.');});
$('target').addEventListener('input',draw);$('departure').addEventListener('input',draw);
$('save-plan').addEventListener('click',()=>{if(!$('departure').value){$('departure').reportValidity();return;}profiles[selected].target=Number($('target').value);profiles[selected].departure=$('departure').value;draw();toast('Exempelinställningarna är uppdaterade i denna session. Ingen bil styrs.');});
$('charge-now').addEventListener('click',()=>modal('Ladda nu – så fungerar det','I den anslutna tjänsten begär du omedelbar laddning här. Flexexa måste fortfarande följa installationens effektgränser och verifiera att laddningen startar. Demot skickar inga kommandon.'));
for(const button of document.querySelectorAll('[data-cost]'))button.addEventListener('click',()=>{costMode=button.dataset.cost;document.querySelectorAll('[data-cost]').forEach(b=>b.classList.toggle('selected',b===button));draw();});
const views={overview:['Redo för nästa resa.','Låt laddningen anpassa sig efter din vardag.'],plan:['Din plan, på dina villkor.','Utforska avresetid, laddmål och exempelpriser.'],vehicles:['Plats för hela hushållet.','Varje bil har egna inställningar.'],history:['Dina laddningar, samlade.','Historik visas när mätdata finns.'],settings:['Ett hem. En gemensam plan.','Anläggningens inställningar och anslutningar.']};
function setView(view){if(!views[view])view='overview';document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('page-title').textContent=views[view][0];$('page-description').textContent=views[view][1];const standard=view==='overview'||view==='plan';$('overview-content').hidden=!standard;$('secondary-content').hidden=standard;
 if(view==='vehicles'){$('secondary-content').innerHTML='<span class="eyebrow">DITT GARAGE · DEMO</span><h2>Två bilar. En överblick.</h2>'+Object.entries(profiles).map(([id,p])=>`<div class="car-row"><div><strong>${p.name}</strong><small>Simulerad batterinivå ${p.soc} % · mål ${p.target} % · avresa ${p.departure}</small></div><button class="secondary" data-select-car="${id}">Visa laddplan ↗</button></div>`).join('');document.querySelectorAll('[data-select-car]').forEach(b=>b.addEventListener('click',()=>{$('vehicle').value=b.dataset.selectCar;$('vehicle').dispatchEvent(new Event('change'));location.hash='plan';}));}
 if(view==='history')$('secondary-content').innerHTML='<span class="eyebrow">LADDHISTORIK</span><h2>Här börjar din laddhistorik.</h2><p>Ingen fysisk laddning har registrerats. När bilen eller laddboxen är ansluten visas laddad energi, tidsintervall och mätbaserad kostnad här.</p><p>Simulerade planer räknas inte som genomförda laddningar.</p>';
 if(view==='settings')$('secondary-content').innerHTML='<span class="eyebrow">ANLÄGGNING · DEMO</span><h2>Mitt hem</h2><div class="car-row"><div>Elområde<small>SE3 · illustrativt exempel</small></div><div>Elavtal<small>Exempel på tidsvarierat pris</small></div></div><div class="car-row"><div>Laddbox<small>Inte ansluten</small></div><div>Nättariff och huvudsäkring<small>Behöver verifieras före fysisk styrning</small></div></div><p>Produktionsinställningar sparas genom partnerns backend med behörighetskontroll. Denna förhandsversion innehåller inga anslutningsuppgifter.</p>';
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>location.hash=b.dataset.view));window.addEventListener('hashchange',()=>setView(location.hash.slice(1)));draw();setView(location.hash.slice(1)||'overview');
