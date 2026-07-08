/* ===== Kwitansi (receipt) editor ===== */
(function(){
  const L=buildLayout('receipts.html'); if(!L) return;
  const content=L.content, user=L.user;

  const state={
    logo:'', nomor:'', mataUang:'IDR', tanggal:Fmt.dateInput(),
    seller:{nama:'',alamat:'',telepon:'',email:''},
    customerId:'', sudahTerima:'', untukPembayaran:'', jumlah:0, invoiceRef:'', tempat:'Gorontalo',
    editId:null
  };
  let customers=[];

  function nextNumber(list){
    const yr=new Date().getFullYear();
    const nums=list.map(r=>{ const m=String(r.nomor||'').match(/KW\/\d+\/(\d+)/); return m?parseInt(m[1]):0; });
    return `KW/${yr}/${String(Math.max(0,...nums)+1).padStart(3,'0')}`;
  }

  content.innerHTML=`
    <div class="page-head">
      <div><h1 id="ttl">Kwitansi Baru</h1><div class="sub">Bukti penerimaan pembayaran — pratinjau otomatis</div></div>
      <div class="flex gap">
        <button class="btn" id="listBtn">Daftar Kwitansi</button>
        <button class="btn btn-primary" id="saveBtn">Simpan ke Sheets</button>
      </div>
    </div>
    <div class="editor-layout">
      <div class="editor-col" id="editor"></div>
      <div class="preview-col"><div id="sheet"></div></div>
    </div>`;
  const editor=content.querySelector('#editor'), sheet=content.querySelector('#sheet');

  function buildEditor(){
    editor.innerHTML=`
      <div class="ed-section">
        <div class="sec-title">Logo</div>
        <div class="dropzone ${state.logo?'has':''}" id="dz">
          ${state.logo?`<img src="${state.logo}">`:`<div>Klik untuk mengunggah logo Anda</div>`}
        </div>
        <input type="file" id="logoInput" accept="image/*" hidden>
        ${state.logo?`<div class="logo-actions"><button class="btn btn-sm btn-danger" id="rmLogo">Hapus Logo</button></div>`:''}
      </div>

      <div class="ed-section">
        <div class="sec-title">Detail Kwitansi</div>
        <div class="ed-row"><label class="label">Nomor Kwitansi</label>
          <input class="field" data-b="nomor" value="${esc(state.nomor)}"></div>
        <div class="grid-2">
          <div class="ed-row"><label class="label">Tanggal</label>
            <input type="date" class="field" data-b="tanggal" value="${state.tanggal}"></div>
          <div class="ed-row"><label class="label">Mata Uang</label>
            <select class="field" data-b="mataUang">
              <option value="IDR" ${state.mataUang==='IDR'?'selected':''}>IDR (Rp)</option>
              <option value="USD" ${state.mataUang==='USD'?'selected':''}>USD ($)</option>
            </select></div>
        </div>
        <div class="ed-row"><label class="label">Ref. Faktur (opsional)</label>
          <input class="field" data-b="invoiceRef" value="${esc(state.invoiceRef)}" placeholder="INV/2026/001"></div>
      </div>

      <div class="ed-section">
        <div class="sec-title">Informasi Penerima (Penjual)</div>
        <div class="ed-row"><label class="label">Nama Bisnis</label>
          <input class="field" data-s="nama" value="${esc(state.seller.nama)}"></div>
        <div class="ed-row"><label class="label">Alamat</label>
          <textarea class="field" data-s="alamat">${esc(state.seller.alamat)}</textarea></div>
        <div class="grid-2">
          <div class="ed-row"><label class="label">Telepon</label>
            <input class="field" data-s="telepon" value="${esc(state.seller.telepon)}"></div>
          <div class="ed-row"><label class="label">Tempat Ttd</label>
            <input class="field" data-b="tempat" value="${esc(state.tempat)}"></div>
        </div>
        <button class="btn btn-sm mt-2" id="saveSeller">Simpan info penjual</button>
      </div>

      <div class="ed-section">
        <div class="sec-title">Isi Kwitansi</div>
        <div class="ed-row"><label class="label">Pilih Pelanggan</label>
          <select class="field" id="custSelect">
            <option value="">— pilih / isi manual —</option>
            ${customers.map(c=>`<option value="${c.id}" ${state.customerId===c.id?'selected':''}>${esc(c.nama)}</option>`).join('')}
          </select></div>
        <div class="ed-row"><label class="label">Telah terima dari</label>
          <input class="field" data-b="sudahTerima" value="${esc(state.sudahTerima)}" placeholder="Nama pihak yang membayar"></div>
        <div class="ed-row"><label class="label">Untuk pembayaran</label>
          <textarea class="field" data-b="untukPembayaran" placeholder="Uraian pembayaran">${esc(state.untukPembayaran)}</textarea></div>
        <div class="ed-row"><label class="label">Jumlah (angka)</label>
          <input type="number" class="field" data-b="jumlah" value="${state.jumlah}" min="0"></div>
      </div>

      <button class="btn btn-primary btn-block" id="pdfBtn" style="padding:12px">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        Download PDF
      </button>`;
    wireEditor();
  }

  function wireEditor(){
    editor.querySelectorAll('[data-b]').forEach(el=>el.addEventListener('input',()=>{
      const k=el.dataset.b; state[k]=(k==='jumlah')?(parseFloat(el.value)||0):el.value; render();
    }));
    editor.querySelectorAll('[data-s]').forEach(el=>el.addEventListener('input',()=>{ state.seller[el.dataset.s]=el.value; render(); }));

    const dz=editor.querySelector('#dz'), input=editor.querySelector('#logoInput');
    dz.onclick=()=>input.click();
    input.onchange=()=>{
      const f=input.files[0]; if(!f) return;
      if(!f.type.startsWith('image/')){ toast('File harus berupa gambar','err'); input.value=''; return; }
      const r=new FileReader(); r.onload=()=>{ state.logo=r.result; buildEditor(); render(); toast('Logo diunggah'); };
      r.readAsDataURL(f);
    };
    const rm=editor.querySelector('#rmLogo'); if(rm) rm.onclick=()=>{ state.logo=''; buildEditor(); render(); };

    editor.querySelector('#custSelect').onchange=(e)=>{
      const c=customers.find(x=>String(x.id)===e.target.value);
      state.customerId=c?c.id:''; if(c) state.sudahTerima=c.nama;
      buildEditor(); render();
    };
    editor.querySelector('#saveSeller').onclick=()=>{ localStorage.setItem('ledgerine_seller',JSON.stringify(state.seller)); toast('Info penjual disimpan'); };
    editor.querySelector('#pdfBtn').onclick=exportPDF;
  }

  function render(){
    const cur=state.mataUang;
    const logoHtml=state.logo?`<img src="${state.logo}" class="doc-logo">`:`<div class="doc-logo-empty">${esc(state.seller.nama||'Logo')}</div>`;
    sheet.innerHTML=`
    <div class="a4" id="a4sheet">
      <div class="doc-top">
        <div>${logoHtml}
          <div class="ln" style="color:#555;font-size:12px;margin-top:8px;white-space:pre-line">${esc(state.seller.alamat||'')}${state.seller.telepon?'\n'+esc(state.seller.telepon):''}</div>
        </div>
        <div class="doc-title-block">
          <div class="doc-title">KWITANSI</div>
          <div class="doc-number">${esc(state.nomor||'—')}</div>
          ${state.invoiceRef?`<div class="doc-number">Ref: ${esc(state.invoiceRef)}</div>`:''}
        </div>
      </div>

      <div class="kw-body">
        <div class="kw-field"><div class="k">Telah terima dari</div><div class="v">${esc(state.sudahTerima||'—')}</div></div>
        <div class="kw-field"><div class="k">Uang sejumlah</div><div class="v" style="font-style:italic">${terbilangRupiah(state.jumlah,cur)}</div></div>
        <div class="kw-field"><div class="k">Untuk pembayaran</div><div class="v" style="font-weight:500">${esc(state.untukPembayaran||'—')}</div></div>
      </div>

      <div class="kw-amount-box">
        <div class="lbl">Jumlah</div>
        <div class="amt">${Fmt.currency(state.jumlah,cur)}</div>
      </div>

      <div class="kw-sign">
        <div class="box">
          <div class="place">${esc(state.tempat||'—')}, ${Fmt.date(state.tanggal)}</div>
          <div class="name">${esc(state.seller.nama||'Penerima')}</div>
        </div>
      </div>

      <div class="doc-foot"><div class="line">Kwitansi ini merupakan bukti sah penerimaan pembayaran.</div></div>
    </div>`;
  }

  async function exportPDF(){
    const btn=editor.querySelector('#pdfBtn'), el=document.getElementById('a4sheet'), orig=btn.innerHTML;
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Generating PDF...';
    try{
      const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#ffffff'});
      const img=canvas.toDataURL('image/jpeg',0.95);
      const { jsPDF }=window.jspdf; const pdf=new jsPDF('p','mm','a4');
      const pw=210, ph=297, iw=pw, ih=canvas.height*pw/canvas.width;
      let left=ih, pos=0; pdf.addImage(img,'JPEG',0,pos,iw,ih); left-=ph;
      while(left>0){ pos=left-ih; pdf.addPage(); pdf.addImage(img,'JPEG',0,pos,iw,ih); left-=ph; }
      pdf.save((state.nomor||'kwitansi').replace(/[\/\\]/g,'-')+'.pdf');
      btn.innerHTML='Downloaded ✓'; setTimeout(()=>{ btn.innerHTML=orig; btn.disabled=false; },1800);
    }catch(e){ toast('Gagal membuat PDF. Coba lagi.','err'); btn.innerHTML=orig; btn.disabled=false; }
  }

  content.querySelector('#saveBtn').onclick=async ()=>{
    if(!state.nomor){ toast('Nomor kwitansi wajib diisi','err'); return; }
    const btn=content.querySelector('#saveBtn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Menyimpan...';
    const payload={
      nomor:state.nomor, tanggal:state.tanggal, mataUang:state.mataUang, customerId:state.customerId,
      customerSnapshot:JSON.stringify({nama:state.sudahTerima}), sellerSnapshot:JSON.stringify(state.seller),
      sudahTerima:state.sudahTerima, untukPembayaran:state.untukPembayaran, jumlah:Math.round(state.jumlah),
      terbilang:terbilangRupiah(state.jumlah,state.mataUang), invoiceRef:state.invoiceRef, logo:state.logo,
      createdBy:user.username
    };
    try{
      if(state.editId){ payload.id=state.editId; await API.update('Receipts',payload); toast('Kwitansi diperbarui'); }
      else{ payload.createdAt=new Date().toISOString(); const r=await API.create('Receipts',payload); state.editId=r.data.id; toast('Kwitansi disimpan'); }
    }catch(e){ toast(e.message,'err'); }
    finally{ btn.disabled=false; btn.innerHTML='Simpan ke Sheets'; }
  };
  content.querySelector('#listBtn').onclick=()=>location.href='receipt-list.html';

  function loadEdit(){
    const raw=sessionStorage.getItem('ledgerine_edit_receipt'); if(!raw) return false;
    sessionStorage.removeItem('ledgerine_edit_receipt');
    try{
      const k=JSON.parse(raw);
      state.editId=k.id; state.nomor=k.nomor; state.tanggal=Fmt.dateInput(k.tanggal);
      state.mataUang=k.mataUang||'IDR'; state.customerId=k.customerId||'';
      state.sudahTerima=k.sudahTerima||''; state.untukPembayaran=k.untukPembayaran||'';
      state.jumlah=Number(k.jumlah)||0; state.invoiceRef=k.invoiceRef||''; state.logo=k.logo||'';
      state.seller=k.sellerSnapshot?JSON.parse(k.sellerSnapshot):state.seller;
      content.querySelector('#ttl').textContent='Ubah Kwitansi';
      return true;
    }catch(e){ return false; }
  }

  async function init(){
    const s=localStorage.getItem('ledgerine_seller'); if(s){ try{ state.seller=JSON.parse(s); }catch(e){} }
    const isEdit=loadEdit();
    try{
      const [c,kw]=await Promise.all([API.list('Customers'),API.list('Receipts')]);
      customers=(c.rows||[]).filter(x=>x.id);
      if(!isEdit) state.nomor=nextNumber((kw.rows||[]).filter(x=>x.id));
    }catch(e){ toast(e.message,'err'); }
    buildEditor(); render();
  }
  init();
})();
