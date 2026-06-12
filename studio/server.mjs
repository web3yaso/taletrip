// studio/server.mjs
// TaleTrip Parent Studio — a long-lived local server (Bare) that holds the
// @qvac/sdk worker + models warm and serves a browser UI for parents to
// generate personalized StoryPacks on the MacBook.
//
// Run:  node_modules/.bin/bare studio/server.mjs   →   open http://localhost:3000
import http from "bare-http1";
import fs from "bare-fs";
import path from "bare-path";
import { beginRun, endRun } from "./evidence.mjs";
import { loadEngines, generateStoryPack } from "./generate.mjs";
import { generateStoryPackAgentic } from "./orchestrator.mjs";
import { publishPack } from "./seeder.mjs";

const AGENTIC = true; // orchestrator-agent pipeline; falls back per-request on derailment

const PORT = 3000;
fs.mkdirSync("studio/packs", { recursive: true });
const PACKS_ROOT = fs.realpathSync("studio/packs"); // canonical root for static file serving

function send(res, status, type, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";

  // ── Parent UI ──
  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    return send(res, 200, "text/html; charset=utf-8", PAGE);
  }

  // ── vendored QR generator (browser renders the pairing code locally, no cloud) ──
  if (req.method === "GET" && url === "/qrcode.js") {
    try {
      return send(res, 200, "application/javascript", fs.readFileSync("node_modules/qrcode-generator/dist/qrcode.js"));
    } catch { return send(res, 404, "text/plain", "not found"); }
  }

  // ── list generated packs ──
  if (req.method === "GET" && url === "/api/packs") {
    let ids = [];
    try {
      ids = fs.readdirSync("studio/packs").filter((d) => fs.existsSync(`studio/packs/${d}/storypack.json`));
      // newest first — the UI shows only the latest tale's pairing QR
      ids.sort((a, b) => fs.statSync(`studio/packs/${b}/storypack.json`).mtimeMs - fs.statSync(`studio/packs/${a}/storypack.json`).mtimeMs);
    } catch {}
    const metas = ids.map((id) => {
      try { return JSON.parse(fs.readFileSync(`studio/packs/${id}/storypack.json`)); } catch { return null; }
    }).filter(Boolean);
    const packs = [];
    for (const p of metas) {
      let pairKey = null;
      try { pairKey = (await publishPack(p.id)).keyHex; } catch {}
      packs.push({ id: p.id, title: p.title, pages: p.pages.length, pairKey });
    }
    return send(res, 200, "application/json", JSON.stringify(packs));
  }

  // ── serve a generated image / json (sandboxed to PACKS_ROOT) ──
  if (req.method === "GET" && url.startsWith("/packs/")) {
    const rel = decodeURIComponent(url.split("?")[0]).replace(/^\/packs\//, "");
    if (rel.includes("\0") || rel.split("/").some((s) => s === "..")) return send(res, 400, "text/plain", "bad path");
    if (!/\.(png|json)$/.test(rel)) return send(res, 403, "text/plain", "forbidden");
    const resolved = path.resolve(PACKS_ROOT, rel);
    if (resolved !== PACKS_ROOT && !resolved.startsWith(PACKS_ROOT + path.sep)) return send(res, 403, "text/plain", "forbidden");
    try {
      const buf = fs.readFileSync(resolved);
      res.statusCode = 200; res.setHeader("Content-Type", resolved.endsWith(".png") ? "image/png" : "application/json"); return res.end(buf);
    } catch { return send(res, 404, "text/plain", "not found"); }
  }

  // ── generate (SSE progress) ──
  if (req.method === "POST" && url === "/api/generate") {
    const reqBody = await readBody(req);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    const emit = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    try {
      beginRun("generate", { destination: reqBody?.destination, childName: reqBody?.childName, pages: reqBody?.pages, agentic: AGENTIC });
      const onP = (label, step, total) => emit({ label, step, total });
      let pack;
      if (AGENTIC && reqBody?.agentic !== false) {
        try {
          pack = await generateStoryPackAgentic(reqBody, onP);
        } catch (e) {
          console.log("agentic derailed, falling back:", e?.message ?? e);
          emit({ label: "agent derailed — using the classic pipeline…", step: 0, total: 0 });
          pack = await generateStoryPack(reqBody, onP);
        }
      } else {
        pack = await generateStoryPack(reqBody, onP);
      }
      emit({ label: "seeding over P2P…", step: 0, total: 0 });
      let pairKey = null;
      try { pairKey = (await publishPack(pack.id)).keyHex; } catch (e) { console.log("seed error:", e); }
      endRun({ packId: pack.id, pages: pack.pages.length, pairKey: pairKey ? pairKey.slice(0, 12) : null });
      emit({ done: true, pack, pairKey });
    } catch (e) {
      emit({ error: String(e?.message ?? e) });
    }
    return res.end();
  }

  send(res, 404, "text/plain", "not found");
});

server.listen(PORT, () => {
  console.log(`\n  TaleTrip Parent Studio → http://localhost:${PORT}\n`);
  // warm the models so the first generation is fast
  loadEngines((m) => console.log("  " + m)).then(() => console.log("  engines ready ✅\n")).catch((e) => console.log("  warmup error:", e));
});

// ───────────────────────── browser UI (self-contained) ─────────────────────────
const PAGE = `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>TaleTrip · Parent Studio</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,500&family=Lora:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--paper:#f7eed8;--paperDeep:#efe2c4;--card:#fbf6e9;--cardInset:#f3e8cf;--ink:#294a63;--inkSoft:#3f617a;--inkFaint:#6b8499;--accent:#bd5838;--accentD:#a4482b;--blue:#2f6f8f;--hair:rgba(41,74,99,.14);--display:'Cormorant Garamond',Georgia,serif;--body:'Lora',Georgia,serif;}
*{box-sizing:border-box} body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body);}
.wrap{max-width:1100px;margin:0 auto;padding:32px 28px 64px}
h1{font-family:var(--display);font-weight:600;font-size:46px;margin:0}
h1 .t{color:var(--accent)} .sub{font-family:var(--display);font-style:italic;color:var(--accentD);font-size:22px;margin:2px 0 0}
.badge{display:inline-flex;gap:8px;align-items:center;background:var(--card);border-radius:999px;padding:7px 14px;font-size:14px;color:var(--inkSoft);box-shadow:0 1px 0 var(--hair)}
.card{background:var(--card);border-radius:20px;padding:26px 28px;box-shadow:0 18px 40px -24px rgba(40,55,70,.45);margin-top:22px}
label{display:block;font-family:var(--display);font-size:20px;font-weight:600;margin:14px 0 6px}
input{width:100%;font-family:var(--body);font-size:18px;padding:13px 16px;border:1px solid var(--hair);border-radius:14px;background:#fff;color:var(--ink)}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.chip{cursor:pointer;background:var(--cardInset);border:none;border-radius:999px;padding:8px 14px;font-family:var(--body);font-size:15px;color:var(--inkSoft)}
.row{display:flex;gap:18px} .row>div{flex:1}
button.go{margin-top:22px;width:100%;background:#284a60;color:#f6ecd6;border:none;border-radius:16px;padding:16px;font-family:var(--display);font-size:24px;font-weight:600;cursor:pointer}
button.go:disabled{opacity:.5}
.prog{margin-top:18px;font-size:16px;color:var(--inkSoft)}
.bar{height:8px;background:var(--cardInset);border-radius:999px;overflow:hidden;margin-top:8px}
.bar>i{display:block;height:100%;background:var(--accent);width:0;transition:width .3s}
.book{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-top:18px}
.pg{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 24px -18px rgba(40,55,70,.5)}
.pg img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.pg p{font-size:14px;line-height:1.5;margin:0;padding:12px 14px;color:var(--ink)}
.ok{display:inline-flex;gap:8px;align-items:center;color:#2f8a63;font-family:var(--display);font-size:22px;font-weight:600;margin-top:16px}
.muted{color:var(--inkFaint);font-size:14px}
.pair{margin-top:16px;background:var(--cardInset);border-radius:14px;padding:14px 16px}
.pair .lbl{font-size:14px;color:var(--inkSoft)}
.code{display:block;font-family:ui-monospace,Menlo,monospace;font-size:14px;word-break:break-all;margin-top:6px;color:var(--accentD);user-select:all;cursor:text}
.tcode{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--inkFaint);word-break:break-all;user-select:all}
.pairrow{display:flex;gap:14px;align-items:center;margin-top:10px}
.qr{width:120px;height:120px;border-radius:10px;background:#fff;padding:6px;box-shadow:0 2px 10px rgba(0,0,0,.12);image-rendering:pixelated}
.packrow{display:flex;gap:20px;align-items:center;margin-bottom:8px}
.packrow .qr{width:230px;height:230px;padding:8px}
</style></head><body><div class="wrap">
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <div><h1>Tale<span class="t">Trip</span> · <span style="font-size:32px">Parent Studio</span></h1>
  <div class="sub">Create a personalized trip story — generated on this Mac, read offline on the iPad.</div></div>
  <span class="badge">● on-device · no cloud</span>
</div>

<div class="card">
  <div class="row">
    <div><label>Destination</label><input id="dest" value="Lisbon" placeholder="any city in the world"/>
      <div class="chips" id="chips"></div></div>
    <div><label>Child's name</label><input id="name" value="Mia"/>
      <label>Learning language</label><input id="lang" value="es" /></div>
  </div>
  <button class="go" id="go">✨ Generate the storybook</button>
  <div class="prog" id="prog" style="display:none"><span id="plabel">…</span><div class="bar"><i id="pbar"></i></div></div>
  <div id="result"></div>
</div>

<div class="card"><label style="margin-top:0">Your tales</label><div id="packs" class="muted">loading…</div></div>

<script src="/qrcode.js"></script>
<script>
const DESTS=["Lisbon","Barcelona","Tokyo","Rome","Paris","Marrakesh"];
function qrImg(text,cell){const qr=qrcode(0,'M');qr.addData(text);qr.make();const img=el('img',{class:'qr'});img.src=qr.createDataURL(cell||6,8);img.alt='pairing QR';return img;}
const chips=document.getElementById('chips');
DESTS.forEach(d=>{const b=document.createElement('button');b.className='chip';b.textContent=d;b.onclick=()=>document.getElementById('dest').value=d;chips.appendChild(b)});

function el(tag,props,...kids){const e=document.createElement(tag);if(props)for(const k in props){if(k==='class')e.className=props[k];else if(k==='text')e.textContent=props[k];else e.setAttribute(k,props[k]);}for(const c of kids)if(c)e.appendChild(c);return e;}
function clear(n){while(n.firstChild)n.removeChild(n.firstChild);}
async function loadPacks(){
  const r=await fetch('/api/packs');const ps=await r.json();
  const box=document.getElementById('packs');clear(box);
  if(!ps.length){box.appendChild(el('span',{class:'muted',text:'none yet — generate your first one above'}));return;}
  const p=ps[0]; // newest only — exactly one pairing QR on screen
  const d=el('div',{class:'packrow'});
  if(p.pairKey)d.appendChild(qrImg(p.pairKey,6));
  const t=el('div',{style:'flex:1'});
  const h=el('div',{style:'font-size:18px'});h.appendChild(document.createTextNode('📖 '));h.appendChild(el('b',{text:p.title}));h.appendChild(document.createTextNode(' · '+(p.pages|0)+' pages'));t.appendChild(h);
  t.appendChild(el('div',{class:'lbl',style:'margin-top:8px',text:'On the kid\\'s iPad: Get a book → Scan, point at this QR (same WiFi · P2P · no cloud).'}));
  if(p.pairKey)t.appendChild(el('div',{class:'tcode',style:'margin-top:8px',text:p.pairKey}));
  d.appendChild(t);box.appendChild(d);
}
loadPacks();

document.getElementById('go').onclick=async()=>{
  const dest=document.getElementById('dest').value, name=document.getElementById('name').value, lang=document.getElementById('lang').value;
  const go=document.getElementById('go');go.disabled=true;
  const prog=document.getElementById('prog');prog.style.display='block';
  const result=document.getElementById('result');clear(result);
  const res=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination:dest,childName:name,vocabLang:lang})});
  const reader=res.body.getReader();const dec=new TextDecoder();let buf='';
  while(true){const {done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});
    let idx;while((idx=buf.indexOf('\\n\\n'))>=0){const line=buf.slice(0,idx).replace(/^data: /,'');buf=buf.slice(idx+2);if(!line)continue;
      const ev=JSON.parse(line);
      if(ev.label){document.getElementById('plabel').textContent=ev.label;if(ev.total)document.getElementById('pbar').style.width=Math.round(ev.step/ev.total*100)+'%';}
      if(ev.error){document.getElementById('plabel').textContent='⚠️ '+ev.error;}
      if(ev.done){renderBook(ev.pack,ev.pairKey);prog.style.display='none';loadPacks();}
    }}
  go.disabled=false;
};
function renderBook(pack,pairKey){
  const result=document.getElementById('result');clear(result);
  result.appendChild(el('div',{class:'ok',text:'✓ '+pack.title+' is ready'}));
  const book=el('div',{class:'book'});
  const idOk=/^[a-z0-9-]+$/.test(pack.id);
  for(const p of pack.pages){
    const card=el('div',{class:'pg'});
    if(idOk&&/^p\\d+\\.png$/.test(p.image)){const img=el('img');img.src='/packs/'+pack.id+'/'+p.image;card.appendChild(img);}
    card.appendChild(el('p',{text:p.authoredNarration}));
    book.appendChild(card);
  }
  result.appendChild(book);
  result.appendChild(el('div',{class:'muted',text:pack.vocab.length+' Spanish words · reads aloud on-device · '+pack.pages.length+' illustrations painted on this Mac'}));
  if(pairKey){
    const box=el('div',{class:'pair'});
    box.appendChild(el('div',{class:'lbl',text:'📡 Pairing code — on the kid\\'s iPad open “Get a book”, tap Scan, point at this (same WiFi, P2P, no cloud):'}));
    const row=el('div',{class:'pairrow'});
    row.appendChild(qrImg(pairKey,6));
    row.appendChild(el('code',{class:'code',text:pairKey}));
    box.appendChild(row);
    result.appendChild(box);
  }
}
</script>
</div></body></html>`;
