/* ===== Saved documents list (invoices / receipts) — filter + download ===== */
function docListPage(cfg){
  const L=buildLayout(cfg.active); if(!L) return;
  const content=L.content; let rows=[];
  let fSearch='', fMonth='', fYear='';

  const BULAN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  content.innerHTML=`
    <div class="page-head">
      <div><h1>${cfg.title}</h1><div class="sub">${cfg.subtitle}</div></div>
      <button class="btn btn-primary" id="newBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> ${cfg.newLabel}
      </button>
    </div>
    <div class="filter-bar">
      <div class="search-field">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input class="field" id="searchBox" placeholder="Cari nomor / nama...">
      </div>
      <select class="field filter-sel" id="monthSel">
        <option value="">Semua Bulan</option>
        ${BULAN.map((b,i)=>`<option value="${i}">${b}</option>`).join('')}
      </select>
      <select class="field filter-sel" id="yearSel">
        <option value="">Semua Tahun</option>
      </select>
      <span class="filter-count muted" id="filterCount"></span>
    </div>
    <div id="area"><div class="center-load"><span class="spinner dark"></span></div></div>`;

  content.querySelector('#newBtn').onclick=()=>location.href=cfg.editorPage;

  function ymOf(r){
    const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(r.tanggal||''));
    if(m) return { y:+m[1], m:+m[2]-1 };
    const d=new Date(r.tanggal); if(!isNaN(d)) return { y:d.getFullYear(), m:d.getMonth() };
    return { y:null, m:null };
  }
  function custName(r){ try{ return JSON.parse(r.customerSnapshot||'{}').nama||''; }catch(e){ return ''; } }

  function getFiltered(){
    return rows.filter(r=>{
      const ym=ymOf(r);
      if(fMonth!=='' && ym.m!==+fMonth) return false;
      if(fYear!=='' && ym.y!==+fYear) return false;
      if(fSearch){
        const q=fSearch.toLowerCase();
        const hay=[r.nomor, custName(r), r.sudahTerima, r.untukPembayaran, r.invoiceRef]
          .filter(Boolean).join(' ').toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function populateYears(){
    const years=[...new Set(rows.map(r=>ymOf(r).y).filter(Boolean))].sort((a,b)=>b-a);
    const sel=content.querySelector('#yearSel');
    sel.innerHTML=`<option value="">Semua Tahun</option>`+years.map(y=>`<option value="${y}">${y}</option>`).join('');
  }

  function renderList(){
    const area=content.querySelector('#area');
    const filtered=getFiltered();
    const countEl=content.querySelector('#filterCount');
    const filtering = fSearch||fMonth!==''||fYear!=='';
    if(countEl) countEl.textContent = filtering ? `${filtered.length} dari ${rows.length}` : `${rows.length} dokumen`;
    if(!rows.length){ area.innerHTML=`<div class="card empty">Belum ada data. Klik "${cfg.newLabel}".</div>`; return; }
    if(!filtered.length){
      area.innerHTML=`<div class="card empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <div>Tidak ada dokumen yang cocok dengan filter.</div></div>`;
      return;
    }
    const head=cfg.columns.map(c=>`<th class="${c.right?'right':''}">${c.label}</th>`).join('');
    const body=filtered.map(r=>{
      const tds=cfg.columns.map(c=>`<td class="${c.right?'right mono':''}">${c.render?c.render(r):esc(r[c.key]??'')}</td>`).join('');
      return `<tr>${tds}<td><div class="row-actions">
        <button class="btn btn-sm btn-icon" data-dl="${r.id}" title="Download PDF">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        </button>
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
    area.querySelectorAll('[data-dl]').forEach(b=>b.onclick=async()=>{
      const row=rows.find(r=>String(r.id)===b.dataset.dl);
      const orig=b.innerHTML; b.disabled=true; b.innerHTML='<span class="spinner dark" style="width:14px;height:14px"></span>';
      try{
        if(cfg.docType==='invoice') await DocRender.downloadInvoice(row);
        else await DocRender.downloadReceipt(row);
        toast('PDF diunduh');
      }catch(e){ toast('Gagal membuat PDF','err'); }
      finally{ b.disabled=false; b.innerHTML=orig; }
    });
  }

  async function load(){
    try{
      const r=await API.list(cfg.sheet);
      rows=(r.rows||[]).filter(x=>x.id).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
      populateYears();
      renderList();
    }catch(e){ content.querySelector('#area').innerHTML=`<div class="card empty" style="color:var(--red)">${esc(e.message)}</div>`; }
  }

  content.querySelector('#searchBox').addEventListener('input',e=>{ fSearch=e.target.value.trim(); renderList(); });
  content.querySelector('#monthSel').addEventListener('change',e=>{ fMonth=e.target.value; renderList(); });
  content.querySelector('#yearSel').addEventListener('change',e=>{ fYear=e.target.value; renderList(); });
  load();
}
