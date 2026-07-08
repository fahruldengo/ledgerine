/* ===== Generic CRUD page (customers, products, users) ===== */
function crudPage(cfg){
  const L = buildLayout(cfg.active);
  if(!L) return;
  const content = L.content;
  let rows = [];

  content.innerHTML = `
    <div class="page-head">
      <div><h1>${cfg.title}</h1><div class="sub">${cfg.subtitle}</div></div>
      <button class="btn btn-primary" id="addBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        ${cfg.addLabel}
      </button>
    </div>
    <div id="listArea"><div class="center-load"><span class="spinner dark"></span></div></div>
  `;

  const overlay=document.createElement('div');
  overlay.className='overlay';
  overlay.innerHTML=`<div class="modal">
    <div class="modal-head"><h2 id="mTitle"></h2>
      <button class="btn btn-ghost btn-sm" id="mClose">✕</button></div>
    <div class="modal-body" id="mBody"></div>
    <div class="modal-foot">
      <button class="btn" id="mCancel">Batal</button>
      <button class="btn btn-primary" id="mSave">Simpan</button>
    </div></div>`;
  document.body.appendChild(overlay);
  const closeM=()=>overlay.classList.remove('show');
  overlay.querySelector('#mClose').onclick=closeM;
  overlay.querySelector('#mCancel').onclick=closeM;
  overlay.addEventListener('click',e=>{ if(e.target===overlay) closeM(); });

  let editing=null;
  function openModal(row){
    editing=row;
    overlay.querySelector('#mTitle').textContent = row? cfg.editLabel : cfg.addLabel;
    const body=overlay.querySelector('#mBody');
    body.innerHTML = cfg.fields.map(f=>{
      const val = row? (row[f.key]??'') : (f.default??'');
      if(f.type==='select'){
        const opts=f.options.map(o=>`<option value="${esc(o.v)}" ${String(val)===String(o.v)?'selected':''}>${esc(o.t)}</option>`).join('');
        return `<div><label class="label">${f.label}</label><select class="field" data-k="${f.key}">${opts}</select></div>`;
      }
      if(f.type==='textarea'){
        return `<div><label class="label">${f.label}</label><textarea class="field" data-k="${f.key}" placeholder="${f.ph||''}">${esc(val)}</textarea></div>`;
      }
      return `<div><label class="label">${f.label}</label><input class="field" data-k="${f.key}" type="${f.type||'text'}" placeholder="${f.ph||''}" value="${esc(val)}"></div>`;
    }).join('');
    overlay.classList.add('show');
    setTimeout(()=>body.querySelector('[data-k]')?.focus(),50);
  }

  overlay.querySelector('#mSave').onclick=async ()=>{
    const inputs=overlay.querySelectorAll('[data-k]');
    const data={};
    inputs.forEach(i=>data[i.dataset.k]=i.value.trim());
    if(cfg.validate){ const err=cfg.validate(data,editing,rows); if(err){ toast(err,'err'); return; } }
    const saveBtn=overlay.querySelector('#mSave');
    saveBtn.disabled=true; saveBtn.innerHTML='<span class="spinner"></span>';
    try{
      if(editing){
        data.id=editing.id;
        await API.update(cfg.sheet,data);
        toast(cfg.savedMsg||'Perubahan disimpan');
      }else{
        if(cfg.beforeCreate) cfg.beforeCreate(data);
        await API.create(cfg.sheet,data);
        toast(cfg.createdMsg||'Data ditambahkan');
      }
      closeM(); await load();
    }catch(e){ toast(e.message,'err'); }
    finally{ saveBtn.disabled=false; saveBtn.textContent='Simpan'; }
  };

  async function del(row){
    if(!confirm(`Hapus "${row[cfg.nameKey]||row.id}"?`)) return;
    try{ await API.remove(cfg.sheet,row.id); toast('Data dihapus'); await load(); }
    catch(e){ toast(e.message,'err'); }
  }

  function renderList(){
    const area=content.querySelector('#listArea');
    if(!rows.length){
      area.innerHTML=`<div class="card empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h18v18H3zM3 9h18M9 21V9"/></svg>
        <div>Belum ada data. Klik "${cfg.addLabel}" untuk menambah.</div></div>`;
      return;
    }
    const head=cfg.columns.map(c=>`<th class="${c.right?'right':''}">${c.label}</th>`).join('');
    const bodyRows=rows.map(r=>{
      const tds=cfg.columns.map(c=>{
        const v = c.render? c.render(r) : esc(r[c.key]??'');
        return `<td class="${c.right?'right mono':''}">${v}</td>`;
      }).join('');
      return `<tr>${tds}<td><div class="row-actions">
        <button class="btn btn-sm" data-edit="${r.id}">Ubah</button>
        <button class="btn btn-sm btn-danger" data-del="${r.id}">Hapus</button>
      </div></td></tr>`;
    }).join('');
    area.innerHTML=`<div class="table-wrap"><table class="data">
      <thead><tr>${head}<th class="right">Aksi</th></tr></thead>
      <tbody>${bodyRows}</tbody></table></div>`;
    area.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openModal(rows.find(r=>String(r.id)===b.dataset.edit)));
    area.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>del(rows.find(r=>String(r.id)===b.dataset.del)));
  }

  async function load(){
    try{
      const r=await API.list(cfg.sheet);
      rows=(r.rows||[]).filter(x=>x.id);
      if(cfg.sortBy) rows.sort(cfg.sortBy);
      renderList();
    }catch(e){
      content.querySelector('#listArea').innerHTML=`<div class="card empty" style="color:var(--red)">${esc(e.message)}</div>`;
    }
  }

  content.querySelector('#addBtn').onclick=()=>openModal(null);
  load();
}
