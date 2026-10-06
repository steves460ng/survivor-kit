// ===== 모드 데이터: 유저가 편집하는 영역 =====
// sprite는 이모지, data:image URL, 또는 이미지 파일명(예: "mage.png" -> ./img/mage.png, 경로는 mod.json의 assets.imgDir)
let DEFAULT_MOD = null, MOD = null;   // mod.json에서 불러옴 (init 참고)

// ===== 검증 =====
function validate(m){
  const e=[];
  for(const k of ["classes","skills","enemies","maps"]) if(!m[k]) e.push(`'${k}' 항목이 없습니다`);
  if(e.length) return e;
  for(const [cid,c] of Object.entries(m.classes)){
    for(const s of c.start||[]) if(!m.skills[s]) e.push(`클래스 ${cid}: 시작 스킬 '${s}'가 없습니다`);
    for(const s of Object.keys(c.pool||{})) if(!m.skills[s]) e.push(`클래스 ${cid}: 풀의 스킬 '${s}'가 없습니다`);
  }
  if(m.xp&&(m.xp.growth<1||m.xp.base<1))e.push("xp: base는 1 이상, growth는 1 이상이어야 합니다");
  if(m.difficulty&&!m.difficulty.presets?.[m.difficulty.default])e.push(`difficulty: default '${m.difficulty.default}' 프리셋이 없습니다`);
  const sbd=m.scoreboard;
  if(sbd){
    if(sbd.maxEntries!=null&&!(sbd.maxEntries>=1&&sbd.maxEntries<=50))e.push("scoreboard.maxEntries는 1~50");
    for(const [k,v] of Object.entries(sbd.formula||{}))if(!(v>=0))e.push(`scoreboard.formula.${k}: 0 이상이어야 합니다`);
  }
  for(const [k,v] of Object.entries(m.screens||{}))if(v.background!=null&&typeof v.background!=="string")e.push(`screens.${k}.background는 문자열`);
  const cs=m.difficulty?.clearScaling;
  if(cs){
    if(cs.mode&&!["compound","linear"].includes(cs.mode))e.push("clearScaling.mode는 compound 또는 linear");
    for(const k of ["hp","dmg","speed","spawn","xp","maxEnemies"])if(cs[k]!=null&&!(cs[k]>=0&&cs[k]<=(k==="maxEnemies"?100:2)))e.push(`clearScaling.${k}: 범위 초과(0~${k==="maxEnemies"?100:2})`);
  }
  if(m.difficulty?.onDeath&&!["keep","reset","down"].includes(m.difficulty.onDeath))e.push("difficulty.onDeath는 keep, down, reset 중 하나");
  for(const [did,d] of Object.entries(m.difficulty?.presets||{})) if(!(d.maxEnemies>0&&d.maxEnemies<=600))e.push(`난이도 ${did}: maxEnemies는 1~600`);
  if(m.assets?.imgDir!=null&&(typeof m.assets.imgDir!=="string"||badImgPath(m.assets.imgDir.replace(/^\.\//,""))))e.push("assets.imgDir: 상대 경로만 사용 (예: ./img)");
  const warns=[];
  const walkImg=(o,pth)=>{
    if(Array.isArray(o)){o.forEach((v,i)=>walkImg(v,`${pth}[${i}]`));return}
    if(!o||typeof o!=="object")return;
    for(const [k,v] of Object.entries(o)){
      if(typeof v==="string"&&/^(sprite|hurtSprite|hitSprite|background)$/.test(k)&&!v.startsWith("data:")&&IMG_EXT.test(v)&&badImgPath(v))e.push(`${pth}.${k}: 이미지는 imgDir 아래 상대 경로만 사용할 수 있습니다 ('${v}')`);
      if(typeof v==="string"&&/^(sprite|hurtSprite|hitSprite|background)$/.test(k)&&!v.startsWith("data:")){
        if(v!==v.trim()&&IMG_EXT.test(v.trim()))warns.push(`${pth}.${k}: '${v}' 앞뒤 공백 때문에 이미지로 인식되지 않고 글자로 표시됩니다`);
        else if(FILE_LIKE.test(v)&&!IMG_EXT.test(v))warns.push(`${pth}.${k}: '${v}' 지원하지 않는 이미지 형식이라 글자로 표시됩니다 (png, jpg, jpeg, gif, webp, svg만 가능)`);
      }
      walkImg(v,`${pth}.${k}`);
    }
  };
  walkImg(m,"mod");
  const STATS=["might","maxhp","speed","pickup","regen","cdr","armor","xpGain"],nodeOf={};
  for(const t of Object.values(m.meta?.trees||{}))for(const [id,n] of Object.entries(t.nodes||{}))nodeOf[id]=n;
  for(const [id,n] of Object.entries(nodeOf)){
    if(!(n.max>=1&&n.max<=20))e.push(`강화 ${id}: max는 1~20`);
    if(!(n.cost>=1))e.push(`강화 ${id}: cost는 1 이상`);
    for(const r of n.requires||[])if(!nodeOf[r.id])e.push(`강화 ${id}: 선행 '${r.id}'가 없습니다`);
    for(const f of n.effects||[])if(!STATS.includes(f.stat))e.push(`강화 ${id}: 알 수 없는 stat '${f.stat}'`);
    for(const c of n.classes||[])if(!m.classes[c])e.push(`강화 ${id}: 클래스 '${c}'가 없습니다`);
  }
  const vis={},dfs=(id,path)=>{if(path.includes(id)){e.push(`강화 선행 순환: ${[...path,id].join(" → ")}`);return}if(vis[id])return;vis[id]=1;for(const r of nodeOf[id]?.requires||[])if(nodeOf[r.id])dfs(r.id,[...path,id])};
  for(const id in nodeOf)dfs(id,[]);
  if(m.account&&(!(m.account.base>=1)||!(m.account.growth>=1)))e.push("account: base와 growth는 1 이상이어야 합니다");
  if(!Object.values(m.maps).some(x=>(x.unlock?.level||1)<=1))e.push("maps: 계정 레벨 1에서 열리는 맵이 하나 필요합니다");
  for(const [mid,mp] of Object.entries(m.maps)){
    if(!(mp.size>=600&&mp.size<=6000))e.push(`맵 ${mid}: size는 600~6000`);
    if(mp.unlock?.level!=null&&!(mp.unlock.level>=1))e.push(`맵 ${mid}: unlock.level은 1 이상`);
    if(mp.pointsMult!=null&&!(mp.pointsMult>0&&mp.pointsMult<=10))e.push(`맵 ${mid}: pointsMult는 0 초과 10 이하`);
    for(const [k,v] of Object.entries(mp.difficulty||{}))if(!(v>0&&v<=10))e.push(`맵 ${mid}: difficulty.${k}는 0 초과 10 이하`);
    for(const sp of mp.spawns||[]) if(!m.enemies[sp.enemy]) e.push(`맵 ${mid} 스폰: 적 '${sp.enemy}'가 없습니다`);
    if(mp.boss && !m.enemies[mp.boss.enemy]) e.push(`맵 ${mid} 보스: 적 '${mp.boss.enemy}'가 없습니다`);
  }
  for(const [sid,s] of Object.entries(m.skills)){
    if(!["projectile","orbit","aura","stat"].includes(s.type)) e.push(`스킬 ${sid}: 알 수 없는 type '${s.type}'`);
    if(s.dmg>500) e.push(`스킬 ${sid}: dmg 상한(500) 초과`);
  }
  e.warnings=warns;
  return e;
}

// ===== 메타 성장 (저장: localStorage, 실패 시 메모리) =====
// 모드 파일 경로: 기본 mod.json, 주소에 ?mod=mods/other.json 으로 교체 가능 (같은 폴더 하위 .json만 허용)
const MOD_PATH=(()=>{const q=new URLSearchParams(location.search).get("mod");return q&&/^[\w\-./]+\.json$/.test(q)&&!q.includes("..")&&!q.startsWith("/")?q:"mod.json"})();
const SAVE_KEY="survivorKit.save.v1:"+MOD_PATH;
let SAVE={points:0,ranks:{},runs:0,clears:0,scores:[],totalXp:0};
try{const r=localStorage.getItem(SAVE_KEY);if(r)SAVE={...SAVE,...JSON.parse(r)}}catch(e){}
const persist=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(SAVE))}catch(e){}};
function accLevel(){
  const a=MOD.account||{};let need=a.base??200,xp=SAVE.totalXp||0,lv=1;
  while(xp>=need&&lv<500){xp-=need;lv++;need=Math.max(1,Math.round(need*(a.growth??1.5)))}
  return {lv,xp,need};
}
const spr=x=>{const src=imgSrc(x);return src?`<img class="spimg" src="${esc(src)}" alt="">`:esc(x||"❓")};
const metaNodes=()=>{const o={};for(const [tid,t] of Object.entries(MOD.meta?.trees||{}))for(const [nid,n] of Object.entries(t.nodes||{}))o[nid]={...n,id:nid,tree:tid};return o};
const treeSpent=tid=>Object.entries(MOD.meta.trees[tid].nodes).reduce((a,[id,n])=>a+(SAVE.ranks[id]||0)*(n.cost||1),0);
function nodeState(n){
  if((SAVE.ranks[n.id]||0)>=(n.max||1))return"max";
  if((n.requires||[]).some(r=>(SAVE.ranks[r.id]||0)<(r.rank||1))||treeSpent(n.tree)<(n.reqTreePoints||0))return"lock";
  return SAVE.points>=(n.cost||1)?"ok":"poor";
}
function metaBonus(cid){
  const b={},N=metaNodes();
  for(const [id,rk] of Object.entries(SAVE.ranks)){const n=N[id];if(!n||(n.classes&&!n.classes.includes(cid)))continue;for(const f of n.effects||[])b[f.stat]=(b[f.stat]||0)+f.add*rk}
  return b;
}
const STAT_LABEL={might:"공격력",maxhp:"최대 체력",speed:"이동속도",pickup:"획득 범위",regen:"초당 회복",cdr:"쿨타임 감소",armor:"피해 감소",xpGain:"경험치 획득"};
const fmtEff=f=>`${STAT_LABEL[f.stat]||f.stat} ${["might","pickup","cdr","armor","xpGain"].includes(f.stat)?"+"+Math.round(f.add*100)+"%":"+"+f.add}`;
function describeNode(n,N){
  const rk=SAVE.ranks[n.id]||0,req=(n.requires||[]).map(r=>`${N[r.id]?.name||r.id} ${r.rank||1}랭크`);
  if(n.reqTreePoints)req.push(`트리 ${n.reqTreePoints}P 사용`);
  document.getElementById("mdesc").textContent=`${n.name} (${rk}/${n.max||1}) · 랭크당 ${n.cost||1}P · ${(n.effects||[]).map(fmtEff).join(", ")}${n.classes?` · 전용: ${n.classes.map(c=>MOD.classes[c]?.name||c).join(", ")}`:""}${req.length?` · 필요: ${req.join(", ")}`:""}`;
}
function showMeta(sel,loop){
  if(loop!==undefined)metaLoop=loop;
  const ov=document.getElementById("ovStart");ov.classList.add("scroll","on");setBg(ov,"select");
  ov.innerHTML=`<h2 style="margin:0">강화 트리 · 보유 ${SAVE.points}P</h2><div class="trees"></div><div id="mdesc" class="mdesc">노드를 눌러 강화합니다.</div><div class="row">${metaLoop?`<button class="go" id="mnext">다음 판 시작</button><button class="go" id="mback" style="background:#4b5550">클래스/맵 변경</button>`:`<button class="go" id="mback">돌아가기</button>`}<button class="go" id="mreset" style="background:#6b6f68">전체 초기화(환불)</button><button class="go" id="msave" style="background:#6b6f68">세이브 초기화</button></div>`;
  const wrap=ov.querySelector(".trees"),N=metaNodes();
  for(const [tid,t] of Object.entries(MOD.meta?.trees||{})){
    const box=document.createElement("div");box.className="tree";
    box.innerHTML=`<b>${t.name||tid}</b> <small>(${treeSpent(tid)}P 사용)</small>`;
    const g=document.createElement("div");g.className="tg";
    g.style.gridTemplateColumns=`repeat(${Math.max(...Object.values(t.nodes||{}).map(n=>n.pos?.[0]??0),0)+1},56px)`;
    for(const nid of Object.keys(t.nodes||{})){
      const n=N[nid],st=nodeState(n),rk=SAVE.ranks[nid]||0,b=document.createElement("button");
      b.className="nd "+st;b.style.gridColumn=(n.pos?.[0]??0)+1;b.style.gridRow=(n.pos?.[1]??0)+1;
      b.innerHTML=`<span>${spr(n.sprite)}</span><small>${rk}/${n.max||1}</small>`;
      b.onmouseenter=b.onfocus=()=>describeNode(n,N);
      b.onclick=()=>{if(st==="ok"){SAVE.points-=n.cost||1;SAVE.ranks[nid]=rk+1;persist()}showMeta(nid)};
      g.appendChild(b);
    }
    box.appendChild(g);wrap.appendChild(box);
  }
  if(sel&&N[sel])describeNode(N[sel],N);
  ov.querySelector("#mback").onclick=()=>showStart();
  const sb2=ov.querySelector("#msave");
  sb2.onclick=()=>{if(!sb2.dataset.armed){sb2.dataset.armed=1;sb2.textContent="포인트·강화·클리어·계정 레벨 삭제 (한 번 더)";return}SAVE={...SAVE,points:0,ranks:{},runs:0,clears:0,totalXp:0};persist();showMeta()};
  const nx=ov.querySelector("#mnext");if(nx)nx.onclick=()=>{ov.classList.remove("scroll");startGame(lastCid,lastMid)};
  const rb=ov.querySelector("#mreset");
  rb.onclick=()=>{
    if(!rb.dataset.armed){rb.dataset.armed=1;rb.textContent="한 번 더 누르면 초기화";return}
    for(const [id,rk] of Object.entries(SAVE.ranks))SAVE.points+=rk*(N[id]?.cost||0);
    SAVE.ranks={};persist();showMeta();
  };
}

// ===== 스프라이트 =====
const imgs={};
// 이미지 참조: data:image/... 또는 확장자가 이미지인 상대 경로(imgDir 기준). 그 외는 이모지/텍스트로 취급
const IMG_EXT=/\.(png|jpe?g|gif|webp|svg)$/i;
const FILE_LIKE=/^[^\s()#,;:]+\.[A-Za-z0-9]{1,5}$/;   // 파일명처럼 보이는 값
const badImgPath=v=>v.includes("..")||/^([a-z]+:)?\/\//i.test(v)||v.startsWith("/");
const imgDir=()=>(MOD?.assets?.imgDir||"./img").replace(/\/+$/,"");
function imgSrc(x){
  if(typeof x!=="string")return null;
  if(x.startsWith("data:image/"))return x;
  if(!IMG_EXT.test(x)||badImgPath(x))return null;
  return imgDir()+"/"+x.replace(/^\.\//,"");
}
function getImg(src){let im=imgs[src];if(!im){im=imgs[src]=new Image();im.onerror=()=>{im.bad=true};im.src=src}return im}
function drawSprite(ctx,sp,x,y,size){
  const src=imgSrc(sp);
  if(src){
    const im=getImg(src);
    if(im.complete&&im.naturalWidth>0){ctx.drawImage(im,x-size/2,y-size/2,size,size);return}
    if(!im.bad)return;
    sp="❓";
  }
  ctx.font=size+"px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(sp||"❓",x,y+size*0.05);
}

// ===== 게임 =====
const cv=document.getElementById("c"),ctx=cv.getContext("2d"),W=cv.width,H=cv.height;
let curDiff=null,lastCid=null,lastMid=null,metaLoop=false;
const FALLBACK_DIFF={name:"",hp:1,dmg:1,speed:1,spawn:1,xp:1,hpGrowth:1/150,spawnGrowth:1/90,maxEnemies:250};
const baseDiff=()=>{
  const D=MOD.difficulty,b=D?.presets?.[curDiff]||D?.presets?.[D?.default]||FALLBACK_DIFF,cs=D?.clearScaling,n=SAVE.clears||0;
  if(!cs||!n)return {...b};
  const f=k=>{const r=cs[k]||0,v=cs.mode==="linear"?1+r*n:Math.pow(1+r,n);return Math.min(cs.cap?.[k]??Infinity,v)};
  return {...b,hp:b.hp*f("hp"),dmg:b.dmg*f("dmg"),speed:b.speed*f("speed"),spawn:b.spawn*f("spawn"),xp:b.xp*f("xp"),maxEnemies:Math.min(600,b.maxEnemies+(cs.maxEnemies||0)*n)};
};
function nextNeed(lv){const x=MOD.xp||{};if(x.table&&x.table[lv-1]!=null)return x.table[lv-1];return Math.round(G.p.need*(x.growth??1.35)+(x.flat??3))}
let G=null,keys={},drag=null,last=0;
const rnd=(a,b)=>a+Math.random()*(b-a);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

const mapDiff=(d,mid)=>{const md=MOD.maps?.[mid]?.difficulty||{};return {...d,hp:d.hp*(md.hp??1),dmg:d.dmg*(md.dmg??1),speed:d.speed*(md.speed??1),spawn:d.spawn*(md.spawn??1),xp:d.xp*(md.xp??1)}};
const getDiff=()=>mapDiff(baseDiff(),lastMid);
function startGame(cid,mid){
  if(!MOD.maps[mid||lastMid])mid=Object.keys(MOD.maps)[0];else mid=mid||lastMid;
  lastMid=mid;
  const mp=MOD.maps[mid],c=MOD.classes[cid],S=mp.size;
  G={cid,mid,map:mp,diff:getDiff(),t:0,kills:0,paused:false,over:false,boss:false,
    p:{x:S/2,y:S/2,hp:c.hp,maxhp:c.hp,speed:c.speed,might:1,pickup:1,lv:1,xp:0,need:MOD.xp?.table?.[0]??MOD.xp?.base??5},
    sk:{},en:[],pr:[],gems:[],items:[],obs:[],traps:[],acc:{},vfx:[]};
  for(const s of c.start) G.sk[s]={lv:1,cd:0};
  const o=mp.obstacles,tr=mp.traps;
  const far=()=>{let x,y;do{x=rnd(40,S-40);y=rnd(40,S-40)}while(Math.hypot(x-S/2,y-S/2)<110);return{x,y}};
  for(let i=0;i<(o?.count||0);i++)G.obs.push({...far(),r:rnd(o.rMin,o.rMax)});
  for(let i=0;i<(tr?.count||0);i++)G.traps.push({...far(),r:tr.r});
  lastCid=cid;const mb=metaBonus(cid),q=G.p;
  q.maxhp=Math.max(10,q.maxhp+(mb.maxhp||0));q.hp=q.maxhp;q.speed+=mb.speed||0;q.might+=mb.might||0;q.pickup+=mb.pickup||0;
  q.regen=mb.regen||0;q.cdr=Math.min(.6,mb.cdr||0);q.armor=Math.min(.8,mb.armor||0);q.xpGain=mb.xpGain||0;G.xpEarned=0;
  document.getElementById("ovStart").classList.remove("on");
  document.getElementById("ovEnd").classList.remove("on");
  last=performance.now();
}
const lvScale=lv=>1+0.35*(lv-1);

function addSkill(id){
  const s=MOD.skills[id];
  if(s.type==="stat"){
    const lv=(G.sk[id]?.lv||0)+1;G.sk[id]={lv,cd:0};
    G.p[s.stat]=(G.p[s.stat]||0)+s.add;
    if(s.stat==="maxhp")G.p.hp=Math.min(G.p.maxhp,G.p.hp+s.add);
  } else if(G.sk[id]) G.sk[id].lv++; else G.sk[id]={lv:1,cd:0};
}

function spawnEnemy(id){
  const d=MOD.enemies[id],S=G.map.size,a=rnd(0,6.283);
  const x=Math.min(S-10,Math.max(10,G.p.x+Math.cos(a)*470)),y=Math.min(S-10,Math.max(10,G.p.y+Math.sin(a)*470));
  const k=G.diff.hp*(1+G.t*G.diff.hpGrowth);
  G.en.push({id,x,y,hp:d.hp*k,maxhp:d.hp*k,r:d.r,boss:id===G.map.boss?.enemy&&G.boss});
}

function vfx(f,x,y,size){if(!f||!f.sprite||G.vfx.length>150)return;const t=f.time||0.2;G.vfx.push({x,y,sprite:f.sprite,size:size||f.size||20,t,max:t})}
function hit(e,dmg,id){e.hp-=dmg*G.p.might;e.hurt=0.15;vfx((id&&MOD.skills[id]?.hitFx)||MOD.fx?.hit,e.x+rnd(-6,6),e.y+rnd(-6,6))}

function update(dt){
  const p=G.p,m=G.map,S=m.size;G.t+=dt;
  // 이동
  let dx=(keys.d||keys.ArrowRight?1:0)-(keys.a||keys.ArrowLeft?1:0),dy=(keys.s||keys.ArrowDown?1:0)-(keys.w||keys.ArrowUp?1:0);
  if(drag){dx=drag.dx;dy=drag.dy}
  const l=Math.hypot(dx,dy);if(l>0){dx/=Math.max(1,l);dy/=Math.max(1,l);p.x+=dx*p.speed*dt;p.y+=dy*p.speed*dt}
  p.x=Math.min(S-12,Math.max(12,p.x));p.y=Math.min(S-12,Math.max(12,p.y));
  for(const o of G.obs){const d=Math.hypot(p.x-o.x,p.y-o.y);if(d<o.r+12){const n=(o.r+12-d)/(d||1);p.x+=(p.x-o.x)*n;p.y+=(p.y-o.y)*n}}
  for(const t of G.traps) if(dist(p,t)<t.r+8) p.hp-=(m.traps.dps||10)*(1-p.armor)*dt;
  // 스폰
  const D=G.diff,k=D.spawn*(1+G.t*D.spawnGrowth);
  for(const s of m.spawns||[]){
    if(G.t<s.t||(s.until!=null&&G.t>s.until))continue;
    G.acc[s.enemy]=(G.acc[s.enemy]||0)+s.rate*k*dt;
    while(G.acc[s.enemy]>=1&&G.en.length<D.maxEnemies){G.acc[s.enemy]--;spawnEnemy(s.enemy)}
  }
  if(m.boss&&!G.boss&&G.t>=m.boss.t){G.boss=true;spawnEnemy(m.boss.enemy)}
  // 적
  for(const e of G.en){
    const d=MOD.enemies[e.id],ex=p.x-e.x,ey=p.y-e.y,dd=Math.hypot(ex,ey)||1;
    let nx=e.x+ex/dd*d.speed*G.diff.speed*dt,ny=e.y+ey/dd*d.speed*G.diff.speed*dt;
    for(const o of G.obs){const q=Math.hypot(nx-o.x,ny-o.y);if(q<o.r+e.r){const n=(o.r+e.r-q)/(q||1);nx+=(nx-o.x)*n;ny+=(ny-o.y)*n}}
    e.x=nx;e.y=ny;
    if(dd<e.r+12)p.hp-=d.dmg*G.diff.dmg*(1-p.armor)*dt;
  }
  // 스킬
  const near=[...G.en].sort((a,b)=>dist(a,p)-dist(b,p));
  for(const [id,st] of Object.entries(G.sk)){
    const s=MOD.skills[id],lv=st.lv;
    if(s.type==="projectile"){
      st.cd-=dt;
      if(st.cd<=0&&near.length){
        st.cd=s.cd*(1-p.cdr);vfx(s.castFx,p.x,p.y);const n=(s.count||1)+Math.floor((lv-1)/2);
        for(let i=0;i<n;i++){
          const t=near[i%near.length],a=Math.atan2(t.y-p.y,t.x-p.x)+(i>=near.length?rnd(-.4,.4):0);
          G.pr.push({x:p.x,y:p.y,vx:Math.cos(a)*s.speed,vy:Math.sin(a)*s.speed,dmg:s.dmg*lvScale(lv),pierce:(s.pierce||0)+(lv>=4?1:0),life:1.6,sp:s.sprite,id,hit:new Set()});
        }
      }
    } else if(s.type==="orbit"){
      const n=(s.count||1)+Math.floor((lv-1)/2);
      for(let i=0;i<n;i++){
        const a=G.t*s.speed+i*6.283/n,bx=p.x+Math.cos(a)*s.radius,by=p.y+Math.sin(a)*s.radius;
        st.pos=st.pos||[];st.pos[i]={x:bx,y:by};
        for(const e of G.en) if(Math.hypot(e.x-bx,e.y-by)<e.r+s.size&&!(e["h"+id+i]>G.t)){hit(e,s.dmg*lvScale(lv),id);e["h"+id+i]=G.t+0.4}
      }
      st.pos.length=n;
    } else if(s.type==="aura"){
      st.cd-=dt;
      if(st.cd<=0){st.cd=s.tick*(1-p.cdr);const R=s.radius*(1+0.12*(lv-1));st.R=R;st.flash=0.12;vfx(s.castFx,p.x,p.y,R*2);
        for(const e of G.en) if(dist(e,p)<R+e.r)hit(e,s.dmg*lvScale(lv),id)}
      st.flash-=dt;
    }
  }
  // 투사체
  for(const b of G.pr){
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    for(const e of G.en) if(!b.hit.has(e)&&Math.hypot(e.x-b.x,e.y-b.y)<e.r+6){hit(e,b.dmg,b.id);b.hit.add(e);if(b.pierce--<=0){b.life=0;break}}
  }
  G.pr=G.pr.filter(b=>b.life>0);
  // 사망, 드롭
  for(const e of G.en) if(e.hp<=0){
    const d=MOD.enemies[e.id];G.kills++;
    G.gems.push({x:e.x,y:e.y,xp:d.xp});
    if(Math.random()<(m.drops?.heal||0))G.items.push({x:e.x+8,y:e.y});
    if(e.boss){G.over=true;endScreen(true)}
  }
  G.en=G.en.filter(e=>e.hp>0);
  const mag=70*p.pickup;
  for(const g of G.gems){const d=dist(g,p);if(d<mag){g.x+=(p.x-g.x)/d*260*dt;g.y+=(p.y-g.y)/d*260*dt}if(d<14){const gx=g.xp*G.diff.xp*(1+p.xpGain);p.xp+=gx;G.xpEarned+=gx;g.xp=0}}
  G.gems=G.gems.filter(g=>g.xp>0);
  for(const it of G.items) if(dist(it,p)<16){p.hp=Math.min(p.maxhp,p.hp+(m.drops?.healAmount||20));it.dead=1}
  G.items=G.items.filter(i=>!i.dead);
  for(const f of G.vfx)f.t-=dt;G.vfx=G.vfx.filter(f=>f.t>0);
  for(const e of G.en)if(e.hurt>0)e.hurt-=dt;
  p.hurt=(p.hurt||0)-dt;p.vt=(p.vt||0)-dt;
  if(p.hp<(p.prev??p.hp)-0.01){p.hurt=0.2;if(p.vt<=0){vfx(MOD.fx?.playerHit,p.x,p.y-8);p.vt=0.35}}
  p.hp=Math.min(p.maxhp,p.hp+(p.regen||0)*dt);p.prev=p.hp;
  if(p.xp>=p.need){p.xp-=p.need;p.lv++;p.need=nextNeed(p.lv);levelUp()}
  if(p.hp<=0&&!G.over){G.over=true;endScreen(false)}
}

// ===== 레벨업: 클래스 풀에서 가중치 추첨 =====
function levelUp(){
  const c=MOD.classes[G.cid],cand=Object.entries(c.pool).filter(([id])=>MOD.skills[id]&&(G.sk[id]?.lv||0)<MOD.skills[id].max);
  const picks=[];
  while(picks.length<3&&cand.length){
    const tot=cand.reduce((a,[,w])=>a+w,0);let r=Math.random()*tot,i=0;
    for(;i<cand.length;i++){r-=cand[i][1];if(r<=0)break}
    picks.push(cand.splice(Math.min(i,cand.length-1),1)[0][0]);
  }
  if(!picks.length){G.p.hp=G.p.maxhp;return}
  G.paused=true;
  const ov=document.getElementById("ovLevel");
  ov.innerHTML=`<h2 style="margin:0">레벨 ${G.p.lv}</h2><div class="row"></div>`;
  const row=ov.querySelector(".row");
  for(const id of picks){
    const s=MOD.skills[id],cur=G.sk[id]?.lv||0,b=document.createElement("button");
    b.className="card "+(s.rarity||"");
    b.innerHTML=`<span class="sp">${spr(s.sprite)}</span><b>${s.name}</b><small>${cur?`Lv ${cur} → ${cur+1}`:"새 카드"}</small><small>${s.desc||""}</small>`;
    b.onclick=()=>{addSkill(id);ov.classList.remove("on");G.paused=false;last=performance.now()};
    row.appendChild(b);
  }
  ov.classList.add("on");row.firstChild.focus();
}

function endScreen(win){
  const ov=document.getElementById("ovEnd");
  let pts=0,sc=0,rk=0;if(!G.awarded){G.awarded=1;const M=MOD.meta||{};pts=Math.floor((G.xpEarned*(M.pointsPerXp??0.015)+(win?(M.winBonus||0):0))*(G.map.pointsMult||1));SAVE.points+=pts;SAVE.runs++;
    if(win)SAVE.clears=(SAVE.clears||0)+1;
    else{const od=MOD.difficulty?.onDeath||"keep";if(od==="reset")SAVE.clears=0;else if(od==="down")SAVE.clears=Math.max(0,(SAVE.clears||0)-1)}
    const F=MOD.scoreboard?.formula||{},ent={score:Math.floor(G.kills*(F.kill||0)+G.t*(F.second||0)+G.p.lv*(F.level||0)+G.xpEarned*(F.xp||0)+(win?(F.win||0):0)),
      map:G.map.name||G.mid,cls:MOD.classes[lastCid]?.name||lastCid,win,time:Math.floor(G.t),kills:G.kills,lv:G.p.lv,date:new Date().toISOString().slice(0,10)};
    sc=ent.score;SAVE.scores=[...(SAVE.scores||[]),ent].sort((a,b)=>b.score-a.score);
    rk=SAVE.scores.indexOf(ent)+1;SAVE.scores=SAVE.scores.slice(0,MOD.scoreboard?.maxEntries||10);if(rk>SAVE.scores.length)rk=0;
    G.lastScore={sc,rk};
    const lb=accLevel().lv;SAVE.totalXp=(SAVE.totalXp||0)+G.xpEarned;const la=accLevel().lv;
    G.accUp={from:lb,to:la};G.newMaps=Object.values(MOD.maps).filter(x=>(x.unlock?.level||1)>lb&&(x.unlock?.level||1)<=la).map(x=>x.name);
    persist()}
  if(G.lastScore){sc=G.lastScore.sc;rk=G.lastScore.rk}
  ov.innerHTML=`<h2 style="margin:0">${win?"보스 처치!":"쓰러졌습니다"}</h2><div>생존 ${Math.floor(G.t)}초 · 처치 ${G.kills} · 레벨 ${G.p.lv}</div><div>획득 경험치 ${Math.floor(G.xpEarned)} → <b>+${pts} 포인트</b> (보유 ${SAVE.points})</div><div>점수 <b>${sc}</b> · ${rk>0?rk+"위":"순위 밖"}</div>${G.accUp&&G.accUp.to>G.accUp.from?`<div>계정 레벨 ${G.accUp.to} 달성!${G.newMaps?.length?" 새 맵: "+G.newMaps.map(esc).join(", "):""}</div>`:""}${win?"<div>다음 판은 더 어려워집니다</div>":""}<button class="go" id="again">성장 단계로</button>`;
  ov.classList.add("on");document.getElementById("again").onclick=()=>{ov.classList.remove("on");G=null;showMeta(null,true)};
}

const esc=t=>String(t).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
function setBg(ov,key){const b=MOD.screens?.[key]?.background;ov.style.background=!b?"":imgSrc(b)?`linear-gradient(rgba(8,12,10,.5),rgba(8,12,10,.5)),url("${imgSrc(b)}") center/cover`:b}
function showOpening(){
  G=null;const ov=document.getElementById("ovStart"),o=MOD.screens?.opening||{};ov.classList.remove("scroll");setBg(ov,"opening");
  ov.innerHTML=`<h1 style="font-size:32px;margin:0">${esc(o.title||"게임 제목")}</h1><div>${esc(o.subtitle||"")}</div><div class="row"><button class="go" id="opStart">${esc(o.startText||"시작")}</button><button class="go" id="opScore" style="background:#4b5550">스코어 보드</button></div>`;
  ov.querySelector("#opStart").onclick=()=>showStart();
  ov.querySelector("#opScore").onclick=()=>showScores("opening");
  ov.classList.add("on");
}
function showScores(from){
  const ov=document.getElementById("ovStart");ov.classList.add("scroll");setBg(ov,"scoreboard");
  const rows=(SAVE.scores||[]).map((r,i)=>`<tr><td>${i+1}</td><td><b>${r.score}</b></td><td>${esc(r.map||"-")}</td><td>${esc(r.cls)}</td><td>${r.win?"클리어":"실패"}</td><td>${Math.floor(r.time/60)}:${String(r.time%60).padStart(2,"0")}</td><td>${r.kills}</td><td>${r.lv}</td><td>${r.date}</td></tr>`).join("");
  ov.innerHTML=`<h2 style="margin:0">${esc(MOD.screens?.scoreboard?.title||"스코어 보드")}</h2><table class="sb"><thead><tr><th>순위</th><th>점수</th><th>맵</th><th>클래스</th><th>결과</th><th>시간</th><th>처치</th><th>Lv</th><th>날짜</th></tr></thead><tbody>${rows||'<tr><td colspan="9">아직 기록이 없습니다. 게임을 플레이해 보세요.</td></tr>'}</tbody></table><div class="row"><button class="go" id="sback">돌아가기</button><button class="go" id="sreset" style="background:#6b6f68">기록 초기화</button></div>`;
  ov.querySelector("#sback").onclick=()=>from==="opening"?showOpening():showStart();
  const rb=ov.querySelector("#sreset");
  rb.onclick=()=>{if(!rb.dataset.armed){rb.dataset.armed=1;rb.textContent="한 번 더 누르면 초기화";return}SAVE.scores=[];persist();showScores(from)};
  ov.classList.add("on");
}

function showMapSelect(cid){
  const ov=document.getElementById("ovStart"),al=accLevel(),bd=baseDiff();ov.classList.add("scroll","on");setBg(ov,"mapSelect");
  ov.innerHTML=`<h2 style="margin:0">${esc(MOD.screens?.mapSelect?.title||"맵을 선택하세요")}</h2><div>계정 Lv ${al.lv} (${al.xp}/${al.need})</div><div class="row" id="mr"></div><div class="row"><button class="go" id="mb" style="background:#4b5550">클래스 선택</button></div>`;
  const row=ov.querySelector("#mr");
  for(const [mid,mp] of Object.entries(MOD.maps)){
    const need=mp.unlock?.level||1,ok=al.lv>=need,d=mapDiff(bd,mid),v=((d.hp+d.dmg+d.speed+d.spawn)/4).toFixed(2);
    const b=document.createElement("button");b.className="card";b.disabled=!ok;
    b.innerHTML=`<span class="sp">${ok?spr(mp.sprite):"🔒"}</span><b>${esc(mp.name||mid)}</b><small>${ok?esc(mp.desc||""):`계정 Lv ${need} 필요`}</small><small>difficulty ${v} · 보상 x${mp.pointsMult||1}</small>`;
    if(ok)b.onclick=()=>startGame(cid,mid);row.appendChild(b);
  }
  ov.querySelector("#mb").onclick=()=>showStart();
}

function showStart(){
  G=null;const ov=document.getElementById("ovStart");ov.classList.remove("scroll");setBg(ov,"select");
  ov.innerHTML=`<h2 style="margin:0">${esc(MOD.screens?.select?.title||"클래스를 선택하세요")}</h2><div class="row" id="cr"></div>`;
  const dp=MOD.difficulty?.presets||{};curDiff=dp[MOD.difficulty?.default]?MOD.difficulty.default:Object.keys(dp)[0];
  const row=ov.querySelector("#cr");
  for(const [cid,c] of Object.entries(MOD.classes)){
    const b=document.createElement("button");b.className="card";
    const names=[...c.start,...Object.keys(c.pool)].filter((v,i,a)=>a.indexOf(v)===i);
    b.innerHTML=`<span class="sp">${spr(c.sprite)}</span><b>${c.name}</b>${c.desc?`<small>${esc(c.desc)}</small>`:""}`;
    b.onclick=()=>showMapSelect(cid);row.appendChild(b);
  }
  ov.insertAdjacentHTML("beforeend",`<div class="col"><span>계정 Lv ${accLevel().lv} · 강화 포인트 ${SAVE.points}P</span><div class="row"><button class="go" id="metaBtn">강화 트리</button><button class="go" id="scBtn" style="background:#4b5550">스코어 보드</button></div></div>`);
  ov.querySelector("#metaBtn").onclick=()=>showMeta(null,false);
  ov.querySelector("#scBtn").onclick=()=>showScores("select");
  ov.classList.add("on");
}

// ===== 렌더 =====
function draw(){
  ctx.fillStyle=G?.map?.groundColor||"#0e1411";ctx.fillRect(0,0,W,H);
  if(!G)return;
  const p=G.p,S=G.map.size,cx=Math.min(S-W,Math.max(0,p.x-W/2)),cy=Math.min(S-H,Math.max(0,p.y-H/2));
  ctx.save();ctx.translate(-cx,-cy);
  ctx.strokeStyle=G.map.gridColor||"#1b2a22";ctx.lineWidth=1;
  for(let x=Math.floor(cx/80)*80;x<cx+W;x+=80){ctx.beginPath();ctx.moveTo(x,cy);ctx.lineTo(x,cy+H);ctx.stroke()}
  for(let y=Math.floor(cy/80)*80;y<cy+H;y+=80){ctx.beginPath();ctx.moveTo(cx,y);ctx.lineTo(cx+W,y);ctx.stroke()}
  ctx.strokeStyle="#5b3a3a";ctx.lineWidth=3;ctx.strokeRect(0,0,S,S);
  const m=G.map;
  ctx.globalAlpha=.7;for(const t of G.traps)drawSprite(ctx,m.traps.sprite,t.x,t.y,t.r*2);ctx.globalAlpha=1;
  for(const o of G.obs)drawSprite(ctx,m.obstacles.sprite,o.x,o.y,o.r*2.2);
  ctx.fillStyle="#6fe0ff";for(const g of G.gems){ctx.beginPath();ctx.arc(g.x,g.y,4,0,6.283);ctx.fill()}
  for(const i of G.items)drawSprite(ctx,"💗",i.x,i.y,16);
  // 오라
  for(const [id,st] of Object.entries(G.sk)){const s=MOD.skills[id];
    if(s.type==="aura"&&st.R){ctx.strokeStyle=`rgba(255,140,60,${st.flash>0?.7:.25})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,st.R,0,6.283);ctx.stroke()}
    if(s.type==="orbit"&&st.pos)for(const q of st.pos)drawSprite(ctx,s.sprite,q.x,q.y,s.size*2.2);}
  for(const e of G.en){const d=MOD.enemies[e.id],hurt=e.hurt>0;ctx.globalAlpha=hurt?.75:1;drawSprite(ctx,hurt&&d.hitSprite?d.hitSprite:d.sprite,e.x,e.y,e.r*2.2);ctx.globalAlpha=1;
    if(e.boss){ctx.fillStyle="#400";ctx.fillRect(e.x-30,e.y-e.r-10,60,5);ctx.fillStyle="#e44";ctx.fillRect(e.x-30,e.y-e.r-10,60*Math.max(0,e.hp/e.maxhp),5)}}
  for(const b of G.pr)drawSprite(ctx,b.sp,b.x,b.y,16);
  const cl=MOD.classes[G.cid],ph=p.hurt>0;
  ctx.globalAlpha=ph&&Math.floor(G.t*20)%2?.5:1;
  drawSprite(ctx,ph&&cl.hurtSprite?cl.hurtSprite:cl.sprite,p.x,p.y,28);ctx.globalAlpha=1;
  for(const f of G.vfx){ctx.globalAlpha=Math.max(0,f.t/f.max);drawSprite(ctx,f.sprite,f.x,f.y,f.size*(1+0.4*(1-f.t/f.max)))}
  ctx.globalAlpha=1;
  ctx.restore();
  // HUD
  ctx.fillStyle="#222";ctx.fillRect(0,0,W,8);ctx.fillStyle="#4fd1c5";ctx.fillRect(0,0,W*Math.min(1,p.xp/p.need),8);
  ctx.fillStyle="#400";ctx.fillRect(10,16,160,10);ctx.fillStyle="#e55";ctx.fillRect(10,16,160*Math.max(0,p.hp/p.maxhp),10);
  ctx.fillStyle="#e6e8e3";ctx.font="13px sans-serif";ctx.textAlign="left";ctx.textBaseline="top";
  ctx.fillText(`Lv ${p.lv}   ${Math.floor(G.t/60)}:${String(Math.floor(G.t%60)).padStart(2,"0")}   처치 ${G.kills}`,10,32);
  {const D=G.diff,v=(D.hp+D.dmg+D.speed+D.spawn)/4;ctx.textAlign="right";ctx.fillText(`difficulty ${v.toFixed(2)}`,W-10,14);ctx.textAlign="left"}
  let x=10;for(const [id,st] of Object.entries(G.sk)){drawSprite(ctx,MOD.skills[id].sprite,x+10,66,18);ctx.fillStyle="#e6e8e3";ctx.font="11px sans-serif";ctx.textAlign="left";ctx.fillText(st.lv,x+16,70);x+=30}
}

function loop(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(G&&!G.paused&&!G.over)update(dt);
  draw();requestAnimationFrame(loop);
}

// ===== 입력 =====
addEventListener("keydown",e=>{keys[e.key.length===1?e.key.toLowerCase():e.key]=true;if(e.key.startsWith("Arrow"))e.preventDefault()});
addEventListener("keyup",e=>{keys[e.key.length===1?e.key.toLowerCase():e.key]=false});
cv.addEventListener("pointerdown",e=>{drag={ox:e.clientX,oy:e.clientY,dx:0,dy:0};cv.setPointerCapture(e.pointerId)});
cv.addEventListener("pointermove",e=>{if(!drag)return;const dx=(e.clientX-drag.ox)/40,dy=(e.clientY-drag.oy)/40,l=Math.hypot(dx,dy);drag.dx=l>1?dx/l:dx;drag.dy=l>1?dy/l:dy});
cv.addEventListener("pointerup",()=>drag=null);cv.addEventListener("pointercancel",()=>drag=null);

// ===== 모드 편집 =====
const ta=document.getElementById("ta"),msg=document.getElementById("msg");
const dump=()=>ta.value=JSON.stringify(MOD,null,1);
document.getElementById("apply").onclick=()=>{
  try{
    const m=JSON.parse(ta.value),errs=validate(m);
    if(errs.length){msg.textContent="적용 실패:\n- "+errs.join("\n- ");return}
    MOD=m;msg.textContent="적용되었습니다. 오프닝 화면으로 돌아갑니다."+(errs.warnings?.length?"\n경고:\n- "+errs.warnings.join("\n- "):"");showOpening();
  }catch(e){msg.textContent="JSON 오류: "+e.message}
};
document.getElementById("reset").onclick=()=>{MOD=JSON.parse(JSON.stringify(DEFAULT_MOD));dump();msg.textContent="기본값으로 복원했습니다.";showOpening()};
let initWarn=[];
async function init(){
  try{
    const r=await fetch(MOD_PATH,{cache:"no-cache"});
    if(!r.ok)throw new Error(`${MOD_PATH} 로드 실패 (${r.status})`);
    DEFAULT_MOD=await r.json();
    const errs=validate(DEFAULT_MOD);
    if(errs.length)throw new Error("모드 검증 실패:\n- "+errs.join("\n- "));
    MOD=JSON.parse(JSON.stringify(DEFAULT_MOD));
    initWarn=errs.warnings||[];
  }catch(e){
    const ov=document.getElementById("ovStart");
    ov.innerHTML=`<h2 style="margin:0">모드를 불러오지 못했습니다</h2><div style="max-width:520px;white-space:pre-wrap">${esc(e.message)}</div><div class="hint">로컬에서는 파일을 직접 열지 말고 간단한 서버(예: python3 -m http.server)로 여세요.</div>`;
    ov.classList.add("on");requestAnimationFrame(loop);return;
  }
  (JSON.stringify(MOD).match(/"[^"\\]+\.(?:png|jpe?g|gif|webp|svg)"/gi)||[]).forEach(q=>{const s=imgSrc(q.slice(1,-1));if(s)getImg(s)});
  dump();if(initWarn.length)msg.textContent="경고:\n- "+initWarn.join("\n- ");showOpening();requestAnimationFrame(loop);
}
init();
