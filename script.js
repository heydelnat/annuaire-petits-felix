const ZONES = {
  all: {label:"Tous"},
  green: {label:"🟢 Bagnolet"},
  blue: {label:"🔵 Réunion"},
  yellow: {label:"🟡 Saint-Fargeau"}
};
const INTEREST_ICONS = {
  "Simple mise en relation":"🤝",
  "Récupérations ponctuelles entre familles":"🚸",
  "Mutualisation d'une nounou":"👶",
  "Activités hors temps scolaire":"🎈"
};
let families=[], activeFilter="all";
const $ = (id)=>document.getElementById(id);
const cards=$("cards"), search=$("search"), count=$("count"), empty=$("empty"), filters=$("filters");
function normalize(str){return String(str||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim()}
function cleanPhone(p){return String(p||"").replace(/[^0-9+]/g,"")}
function isMobileFR(ref){return /^33[67]\d{8}$/.test(ref.e164||"")}
async function sha256(message){const data=new TextEncoder().encode(message);const hash=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function isUnlocked(){return localStorage.getItem("annuaireUnlocked")==="1"}
async function unlock(password){return (await sha256(password))===APP_CONFIG.passwordHash}
function showApp(){
  $("lockScreen").classList.add("hidden");
  $("app").classList.remove("hidden");
  if(!localStorage.getItem("welcomeSeen")){
    $("welcomePanel").classList.remove("hidden");
  }
}
function showLock(){ $("app").classList.add("hidden"); $("lockScreen").classList.remove("hidden") }
$("passwordForm").addEventListener("submit", async (e)=>{e.preventDefault(); const ok=await unlock($("passwordInput").value); if(ok){localStorage.setItem("annuaireUnlocked","1"); showApp(); loadData()} else {$("passwordError").textContent="Mot de passe incorrect."}});
$("logoutButton").addEventListener("click",()=>{localStorage.removeItem("annuaireUnlocked"); showLock()});
$("welcomeOk").addEventListener("click",()=>{localStorage.setItem("welcomeSeen","1"); $("welcomePanel").classList.add("hidden")});
function zoneDots(f){return (f.zones.green?"🟢":"")+(f.zones.blue?"🔵":"")+(f.zones.yellow?"🟡":"")}
function zoneNames(f){return f.secteurs?.length ? f.secteurs.join("<br>") : "—"}
function matches(f){ if(activeFilter==="all") return true; return !!f.zones[activeFilter] }
function searchable(f){return normalize([f.enfant, f.repere, ...(f.referents||[]).map(r=>r.nom), ...(f.referents||[]).map(r=>r.telephone)].join(" "))}
function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function vcard(ref, fam){
  const tel=cleanPhone(ref.telephone); const fn=`${ref.nom} – ${fam.enfant}`;
  return `BEGIN:VCARD\nVERSION:3.0\nFN:${fn}\nTEL;TYPE=CELL:${tel}\nNOTE:Famille de ${fam.enfant} - Jardin d'enfants Félix Terrier\nEND:VCARD`;
}
function downloadVcard(ref,fam){
  const blob=new Blob([vcard(ref,fam)],{type:"text/vcard;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${ref.nom.replace(/\s+/g,"_")}_${fam.enfant}.vcf`; a.click(); URL.revokeObjectURL(a.href);
}
window.downloadVcardByIndex=(fi,ri)=>downloadVcard(families[fi].referents[ri], families[fi]);
function toggleFavorite(enfant){const set=new Set(JSON.parse(localStorage.getItem("favorites")||"[]")); set.has(enfant)?set.delete(enfant):set.add(enfant); localStorage.setItem("favorites",JSON.stringify([...set])); render()}
function isFavorite(enfant){return new Set(JSON.parse(localStorage.getItem("favorites")||"[]")).has(enfant)}
window.toggleFavorite=toggleFavorite;
function renderFilters(){
  const counts = {all: families.length, green:0, blue:0, yellow:0};
  families.forEach(f=>{if(f.zones.green)counts.green++; if(f.zones.blue)counts.blue++; if(f.zones.yellow)counts.yellow++});
  filters.innerHTML = Object.keys(ZONES).map(k=>`<button class="filter ${activeFilter===k?"active":""}" data-filter="${k}">${ZONES[k].label} (${counts[k]})</button>`).join("");
  document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{activeFilter=b.dataset.filter; render()}));
}
function render(){
  renderFilters();
  const q=normalize(search.value);
  let list=families.filter(f=>matches(f)&&(!q||searchable(f).includes(q)));
  const favs=new Set(JSON.parse(localStorage.getItem("favorites")||"[]"));
  list.sort((a,b)=>(favs.has(b.enfant)-favs.has(a.enfant))||a.enfant.localeCompare(b.enfant,"fr"));
  cards.innerHTML=list.map(f=>{
    const fi=families.findIndex(x=>x.enfant===f.enfant);
    const refs=(f.referents||[]).map((r,ri)=>{
      const tel=cleanPhone(r.telephone);
      const sms=tel?`<a class="action secondary" href="sms:${tel}">SMS</a>`:"";
      const call=tel?`<a class="action" href="tel:${tel}">Appeler</a>`:"";
      const wa=isMobileFR(r)?`<a class="action neutral" href="https://wa.me/${r.e164}" target="_blank" rel="noopener">WhatsApp</a>`:"";
      const add=`<a class="action neutral" href="#" onclick="event.preventDefault();downloadVcardByIndex(${fi},${ri})">Ajouter contact</a>`;
      return `<div class="ref"><div class="ref-top"><strong>${esc(r.nom)}</strong><span class="visible-phone">${esc(r.telephone||"")}</span></div><div class="actions">${call}${sms}${wa}${add}</div></div>`;
    }).join("");
    const interests=(f.interets||[]).map(i=>`<span class="pill">${INTEREST_ICONS[i]||"✓"} ${esc(i)}</span>`).join("");
    return `<article class="card">
      <div class="topline"><div><h2>${esc(f.enfant)}</h2></div><div><span class="badges">${zoneDots(f)}</span><button class="favorite ${isFavorite(f.enfant)?"active":""}" onclick="toggleFavorite('${esc(f.enfant)}')" aria-label="Favori">${isFavorite(f.enfant)?"★":"☆"}</button></div></div>
      <div class="field"><span class="label">Repère géographique</span><div class="value">${esc(f.repere||"—")}</div></div>
      <div class="field"><span class="label">À proximité</span><div class="value">${zoneNames(f)}</div></div>
      <div class="field contacts"><span class="label">Référent(s) + contacts</span><div class="refs">${refs||"—"}</div></div>
      <div class="field interest-field"><span class="label">Intéressés par</span><div class="interests">${interests||"—"}</div></div>
      ${f.precisions?`<div class="field notes-field"><span class="label">Précisions</span><div class="notes">${esc(f.precisions)}</div></div>`:""}
    </article>`
  }).join("");
  count.textContent=`${list.length} famille${list.length>1?"s":""} affichée${list.length>1?"s":""}`;
  empty.style.display=list.length?"none":"block";
  $("familyCount").textContent=families.length;
  $("referentCount").textContent=families.reduce((n,f)=>n+(f.referents?.length||0),0);
}
async function loadData(){
  const res=await fetch("data.json?version="+Date.now()); families=await res.json(); render();
}
search.addEventListener("input",render);render()});
$("topButton").addEventListener("click",()=>scrollTo({top:0,behavior:"smooth"}));
addEventListener("scroll",()=>{$("topButton").style.display=scrollY>450?"block":"none"});
if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js")}
if(isUnlocked()){showApp(); loadData()} else {showLock()}
