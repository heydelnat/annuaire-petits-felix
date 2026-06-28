
const state={families:[],filter:"all",query:"",deferredInstall:null};

const qs=(s,root=document)=>root.querySelector(s);
const qsa=(s,root=document)=>[...root.querySelectorAll(s)];
const zones={
  all:{label:"Tous", dot:""},
  green:{label:"Bagnolet", class:"green", dot:"green"},
  blue:{label:"Réunion", class:"blue", dot:"blue"},
  yellow:{label:"St-Fargeau", class:"yellow", dot:"yellow"}
};

function normalize(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim()}
function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
async function sha256(message){const data=new TextEncoder().encode(message);const hash=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function isUnlocked(){return localStorage.getItem("lpf-unlocked")==="1"}
function unlock(){qs("#lock").classList.add("hidden");qs("#app").classList.remove("hidden");if(!localStorage.getItem("lpf-install-dismissed")) qs("#installPrompt").classList.remove("hidden")}
function lock(){localStorage.removeItem("lpf-unlocked");location.reload()}
function zoneDots(f){return ["green","blue","yellow"].filter(z=>f.zones[z]).map(z=>`<span class="dot ${z}"></span>`).join("")}
function searchable(f){return normalize([f.child,f.location,...(f.contacts||[]).flatMap(c=>[c.name,c.phone])].join(" "))}

function contactActions(c,family){
  const tel=(c.phone||"").replace(/[^0-9+]/g,"");
  const parts=[];
  if(tel) parts.push(`<a class="action call" href="tel:${tel}">Appeler</a>`);
  if(tel) parts.push(`<a class="action" href="sms:${tel}">SMS</a>`);
  if(c.e164 && /^33[67]/.test(c.e164)) parts.push(`<a class="action whatsapp" href="https://wa.me/${c.e164}" target="_blank" rel="noopener">WhatsApp</a>`);
  parts.push(`<button class="action" type="button" data-vcard="${esc(family.id)}|${esc(c.name)}">Contact</button>`);
  return parts.join("");
}

function familyText(f){
  const contacts=(f.contacts||[]).map(c=>`${c.name}${c.phone ? " – "+c.phone : ""}`).join(", ");
  const sectors=(f.sectors||[]).join(" / ");
  return `${f.child}${f.location ? " – "+f.location : ""}\n${contacts}\n${sectors}`;
}

function makeVcard(contact,family){
  const tel=(contact.phone||"").replace(/[^0-9+]/g,"");
  return `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name} – ${family.child}\nTEL;TYPE=CELL:${tel}\nNOTE:Famille de ${family.child} - Les Petits – Félix Terrier\nEND:VCARD`;
}

function downloadVcard(familyId, name){
  const family=state.families.find(f=>f.id===familyId);
  const contact=family?.contacts?.find(c=>c.name===name);
  if(!family||!contact) return;
  const blob=new Blob([makeVcard(contact,family)],{type:"text/vcard;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`${contact.name.replace(/\s+/g,"_")}_${family.child.replace(/\s+/g,"_")}.vcf`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function shareFamily(familyId){
  const family=state.families.find(f=>f.id===familyId);
  if(!family) return;
  const text=familyText(family);
  if(navigator.share){
    try{await navigator.share({title:`${family.child} – Les Petits`,text});}catch(e){}
  }else{
    await navigator.clipboard.writeText(text);
    alert("Fiche copiée dans le presse-papiers.");
  }
}

function renderFilters(){
  const counts={all:state.families.length,green:0,blue:0,yellow:0};
  state.families.forEach(f=>{if(f.zones.green)counts.green++; if(f.zones.blue)counts.blue++; if(f.zones.yellow)counts.yellow++});
  qs("#filters").innerHTML=Object.entries(zones).map(([key,z])=>{
    const dot = z.dot ? `<span class="filter-dot ${z.dot}"></span>` : "";
    return `<button class="filter ${state.filter===key?"active":""}" data-filter="${key}">${dot}${z.label} (${counts[key]})</button>`;
  }).join("");
}

function render(){
  renderFilters();
  const list=state.families.filter(f=>{
    const okFilter=state.filter==="all" || f.zones[state.filter];
    const okSearch=!state.query || searchable(f).includes(normalize(state.query));
    return okFilter && okSearch;
  });
  qs("#resultCount").textContent=`${list.length} famille${list.length>1?"s":""}`;
  qs("#empty").classList.toggle("hidden",list.length>0);
  qs("#cards").innerHTML=list.map(f=>{
    const contacts=(f.contacts||[]).map(c=>`
      <div class="contact">
        <div class="contact-head">
          <span class="contact-name">${esc(c.name)}</span>
          <span class="phone-visible">${esc(c.phone||"")}</span>
        </div>
        <div class="actions">${contactActions(c,f)}</div>
      </div>`).join("");
    const badges=(f.interests||[]).map(i=>`<span class="badge">${i.icon} ${esc(i.label)}</span>`).join("");
    return `<article class="family-card" data-id="${esc(f.id)}">
      <button class="card-summary" type="button" aria-expanded="false">
        <span>
          <span class="child">${esc(f.child)}</span>
          <span class="zone-dots">${zoneDots(f)}</span>
          <span class="location">${f.location ? "📍 "+esc(f.location) : "Repère non précisé"}</span>
        </span>
        <span class="chevron">⌄</span>
      </button>
      <div class="card-details">
        <div class="section-title">Référent(s)</div>
        ${contacts || "<p>—</p>"}
        ${badges ? `<div class="section-title">Intéressés par</div><div class="badges">${badges}</div>` : ""}
        ${f.notes ? `<div class="section-title">Précisions</div><div class="note">${esc(f.notes)}</div>` : ""}
        <button class="share-family" type="button" data-share="${esc(f.id)}">Partager cette famille</button>
      </div>
    </article>`;
  }).join("");
}

async function loadData(){
  const response=await fetch("data.json",{cache:"no-store"});
  state.families=await response.json();
  render();
}

function bindEvents(){
  qs("#passwordForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const pass=qs("#passwordInput").value;
    if(await sha256(pass)===APP_CONFIG.passwordHash){
      localStorage.setItem("lpf-unlocked","1");
      unlock();
      await loadData();
    }else{
      qs("#passwordError").textContent="Mot de passe incorrect.";
    }
  });
  qs("#searchInput").addEventListener("input",e=>{state.query=e.target.value;render()});
  qs("#filters").addEventListener("click",e=>{const btn=e.target.closest("[data-filter]");if(!btn)return;state.filter=btn.dataset.filter;render()});
  qs("#cards").addEventListener("click",e=>{
    const summary=e.target.closest(".card-summary");
    if(summary){
      const card=summary.closest(".family-card");
      card.classList.toggle("open");
      summary.setAttribute("aria-expanded",card.classList.contains("open"));
      return;
    }
    const v=e.target.closest("[data-vcard]");
    if(v){const [id,name]=v.dataset.vcard.split("|");downloadVcard(id,name);return;}
    const share=e.target.closest("[data-share]");
    if(share){shareFamily(share.dataset.share);}
  });
  qs("#aboutButton").addEventListener("click",()=>qs("#aboutDialog").showModal());
  qs("#logoutButton").addEventListener("click",lock);
  qs("#installLater").addEventListener("click",()=>{localStorage.setItem("lpf-install-dismissed","1");qs("#installPrompt").classList.add("hidden")});
  qs("#installNow").addEventListener("click",async()=>{
    if(state.deferredInstall){
      state.deferredInstall.prompt();
      await state.deferredInstall.userChoice;
      state.deferredInstall=null;
      qs("#installPrompt").classList.add("hidden");
    }else{
      qs("#aboutDialog").showModal();
    }
  });
  qs("#reloadApp").addEventListener("click",()=>location.reload());
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.deferredInstall=e;if(isUnlocked()&&!localStorage.getItem("lpf-install-dismissed"))qs("#installPrompt").classList.remove("hidden")});
}

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").then(reg=>{
    reg.addEventListener("updatefound",()=>{
      const worker=reg.installing;
      worker?.addEventListener("statechange",()=>{
        if(worker.state==="installed" && navigator.serviceWorker.controller){
          qs("#updateNotice").classList.remove("hidden");
        }
      });
    });
  });
}

bindEvents();
if(isUnlocked()){unlock();loadData();}
