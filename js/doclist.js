/* ===== Saved documents list (invoices / receipts) ===== */
function docListPage(cfg){
  const L=buildLayout(cfg.active); if(!L) return;
  const content=L.content; let rows=[];

  content.innerHTML=`
    <div class="page-head">
      <div><h1>${cfg.title}</h1><div class="sub">${cfg.subtitle}</div></div>
      <button class="btn btn-primary" id="newBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> ${cfg.newLabel}
      </button>
    </div>
    <div id="area"><div class="center-load"><span class="spinner dark"></span></div></div>`;

  content.querySelector('#newBtn').onclick=()=>location.href=cfg.editorPage;

  function renderList(){
    const area=content.querySelector('#area');
    if(!rows.length){ area.innerHTML=`<div class="card empty">Belum ada data. Klik "${cfg.newLabel}".</div>`; return; }
    const head=cfg.columns.map(c=>`<th class="${c.right?'right':''}">${c.label}</th>`).join('');
    const body=rows.map(r=>{
      const tds=cfg.columns.map(c=>`<td class="${c.right?'right mono':''}">${c.render?c.render(r):esc(r[c.key]??'')}</td>`).join('');
      return `<tr>${tds}<td><div class="row-actions">
        <button class="btn btn-sm" data-edit="${r.id}">Buka</button>
        <button class="btn btn-sm btn-danger" data-del="${r.id}">Hapus</button>
      </div></td></tr>`;
    }).join('');
    area.innerHTML=`<div class="table-wrap"><table class="data">
      <thead><tr>${head}<th class="right">Aksi</th></tr></thead><tbody>${body}</tbody></table></div>`;
    area.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{
      const row=rows.find(r=>String(r.id)===b.dataset.edit);
      sessionStorage.setItem(cfg.editKey, JSON.stringify(row));
      location.href=cfg.editorPage;
    });
    area.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{
      const row=rows.find(r=>String(r.id)===b.dataset.del);
      if(!confirm(`Hapus "${row.nomor}"?`)) return;
      try{ await API.remove(cfg.sheet,row.id); toast('Data dihapus'); load(); }catch(e){ toast(e.message,'err'); }
    });
  }
  async function load(){
    try{
      const r=await API.list(cfg.sheet);
      rows=(r.rows||[]).filter(x=>x.id).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
      renderList();
    }catch(e){ content.querySelector('#area').innerHTML=`<div class="card empty" style="color:var(--red)">${esc(e.message)}</div>`; }
  }
  load();
}
