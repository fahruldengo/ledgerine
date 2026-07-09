/* ===== Kwitansi (receipt) editor — multi-invoice, nilai dari total invoice ===== */
(function(){
  const L=buildLayout('receipts.html'); if(!L) return;
  const content=L.content, user=L.user;

  const state={
    logo:'', nomor:'', mataUang:'IDR', tanggal:Fmt.dateInput(),
    seller:{nama:'',alamat:'',telepon:'',email:''},
    customerId:'', customer:{nama:'',alamat:'',telepon:'',email:''},
    sudahTerima:'', untukPembayaran:'',
    lines:[],            // {invoiceId, invoiceNomor, desc, nilai}
    catatan:'', ttdNama:'', ttdJabatan:'', tempat:'Gorontalo',
    metodeBayar:'Transfer', bankId:'', bank:null,
    pdfQuality: (localStorage.getItem('ledgerine_pdfq')||'hd'),
    editId:null
  };

  let customers=[], paidInvoices=[], usedInvoiceIds=new Set(), banks=[];

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

  // invoice yang boleh dipilih: PAID & belum dibuatkan kwitansi (kecuali yang sudah masuk state ini saat edit)
  function availableInvoices(){
    const chosen=new Set(state.lines.map(l=>String(l.invoiceId)));
    return paidInvoices.filter(inv=> !usedInvoiceIds.has(String(inv.id)) || chosen.has(String(inv.id)));
  }

  function buildEditor(){
    const invList=availableInvoices();
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
        <div class="sec-title">Pilih Invoice (Lunas)</div>
        <div class="muted" style="font-size:11.5px;margin-bottom:10px">Centang invoice yang dilunasi. Nilai diambil dari total tiap invoice. Bisa lebih dari satu.</div>
        <div id="invChecklist">
          ${invList.length? invList.map(inv=>{
            let cn=''; try{ cn=JSON.parse(inv.customerSnapshot||'{}').nama||''; }catch(e){}
            const checked=state.lines.some(l=>String(l.invoiceId)===String(inv.id));
            return `<label class="inv-check ${checked?'on':''}">
              <input type="checkbox" data-inv="${inv.id}" ${checked?'checked':''}>
              <span class="ic-body">
                <span class="ic-nom">${esc(inv.nomor)}</span>
                <span class="ic-meta">${esc(cn)} · ${Fmt.currency(inv.total,inv.mataUang)}</span>
              </span>
            </label>`;
          }).join('') : `<div class="muted" style="font-size:12.5px">Tidak ada invoice Lunas yang tersedia. Buat kwitansi manual dengan menambah baris di bawah.</div>`}
        </div>
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
          <div class="ed-row"><label class="label">Email</label>
            <input class="field" data-s="email" value="${esc(state.seller.email)}"></div>
        </div>
        <button class="btn btn-sm mt-2" id="saveSeller">Simpan info penjual</button>
      </div>

      <div class="ed-section">
        <div class="sec-title">Pembayar</div>
        <div class="ed-row"><label class="label">Pilih Pelanggan</label>
          <select class="field" id="custSelect">
            <option value="">— pilih / isi manual —</option>
            ${customers.map(c=>`<option value="${c.id}" ${state.customerId===c.id?'selected':''}>${esc(c.nama)}</option>`).join('')}
          </select></div>
        <div class="ed-row"><label class="label">Telah terima dari</label>
          <input class="field" data-b="sudahTerima" value="${esc(state.sudahTerima)}" placeholder="Nama pihak yang membayar"></div>
        <div class="ed-row"><label class="label">Alamat pembayar</label>
          <textarea class="field" data-c="alamat">${esc(state.customer.alamat)}</textarea></div>
        <div class="ed-row"><label class="label">Untuk pembayaran</label>
          <input class="field" data-b="untukPembayaran" value="${esc(state.untukPembayaran)}" placeholder="contoh: Pelunasan tagihan iklan Januari 2026"></div>
      </div>

      <div class="ed-section">
        <div class="sec-title">Rincian Kwitansi</div>
        <div class="muted" style="font-size:11.5px;margin-bottom:10px">Deskripsi bisa diisi manual. Nilai dari invoice terkunci; baris manual bisa diedit nilainya.</div>
        <div id="liArea"></div>
        <button class="btn btn-sm add-line" id="addLine">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Tambah baris manual</button>
      </div>

      <div class="ed-section">
        <div class="sec-title">Metode Bayar</div>
        <div class="ed-row"><label class="label">Metode</label>
          <select class="field" data-b="metodeBayar">
            <option value="Transfer" ${state.metodeBayar==='Transfer'?'selected':''}>Transfer</option>
            <option value="Tunai" ${state.metodeBayar==='Tunai'?'selected':''}>Tunai</option>
            <option value="QRIS" ${state.metodeBayar==='QRIS'?'selected':''}>QRIS</option>
          </select></div>
        <div class="ed-row" id="bankRow" style="${state.metodeBayar==='Transfer'?'':'display:none'}">
          <label class="label">Rekening Tujuan</label>
          <select class="field" id="bankSelect">
            <option value="">— pilih bank —</option>
            ${banks.map(b=>`<option value="${b.id}" ${String(state.bankId)===String(b.id)?'selected':''}>${esc(b.namaBank)} · ${esc(b.nomorRekening)} (${esc(b.atasNama)})</option>`).join('')}
          </select>
          ${banks.length?'':'<div class="muted" style="font-size:11.5px;margin-top:6px">Belum ada bank. Tambahkan di menu Bank.</div>'}
        </div>
      </div>

      <div class="ed-section">
        <div class="sec-title">Catatan</div>
        <div class="ed-row"><textarea class="field" data-b="catatan" style="min-height:70px" placeholder="Catatan tambahan (opsional)">${esc(state.catatan)}</textarea></div>
      </div>

      <div class="ed-section">
        <div class="sec-title">Tanda Tangan Pejabat</div>
        <div class="ed-row"><label class="label">Tempat</label>
          <input class="field" data-b="tempat" value="${esc(state.tempat)}" placeholder="Gorontalo"></div>
        <div class="ed-row"><label class="label">Nama Pejabat</label>
          <input class="field" data-b="ttdNama" value="${esc(state.ttdNama)}" placeholder="Nama penanda tangan"></div>
        <div class="ed-row"><label class="label">Jabatan</label>
          <input class="field" data-b="ttdJabatan" value="${esc(state.ttdJabatan)}" placeholder="contoh: Direktur"></div>
      </div>

      <div class="ed-section">
        <div class="sec-title">Kualitas PDF</div>
        <div class="pdf-qual">
          <label class="qual-opt ${state.pdfQuality==='normal'?'on':''}">
            <input type="radio" name="pdfq" value="normal" ${state.pdfQuality==='normal'?'checked':''}>
            <span><strong>Normal</strong><span class="qd">File kecil, cepat</span></span>
          </label>
          <label class="qual-opt ${state.pdfQuality==='hd'?'on':''}">
            <input type="radio" name="pdfq" value="hd" ${state.pdfQuality==='hd'?'checked':''}>
            <span><strong>HD</strong><span class="qd">Tajam, file lebih besar</span></span>
          </label>
        </div>
      </div>

      <button class="btn btn-primary btn-block" id="pdfBtn" style="padding:12px">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        Download PDF
      </button>`;
    wireEditor();
    buildLines();
  }

  function wireEditor(){
    editor.querySelectorAll('[data-b]').forEach(el=>el.addEventListener('input',()=>{
      state[el.dataset.b]=el.value; render();
    }));
    editor.querySelectorAll('[data-s]').forEach(el=>el.addEventListener('input',()=>{ state.seller[el.dataset.s]=el.value; render(); }));
    editor.querySelectorAll('[data-c]').forEach(el=>el.addEventListener('input',()=>{ state.customer[el.dataset.c]=el.value; render(); }));

    const dz=editor.querySelector('#dz'), input=editor.querySelector('#logoInput');
    dz.onclick=()=>input.click();
    input.onchange=()=>{
      const f=input.files[0]; if(!f) return;
      if(!f.type.startsWith('image/')){ toast('File harus berupa gambar','err'); input.value=''; return; }
      const r=new FileReader(); r.onload=()=>{ state.logo=r.result; buildEditor(); render(); toast('Logo diunggah'); };
      r.readAsDataURL(f);
    };
    const rm=editor.querySelector('#rmLogo'); if(rm) rm.onclick=()=>{ state.logo=''; buildEditor(); render(); };

    // checkbox invoice → tambah/hapus baris
    editor.querySelectorAll('input[data-inv]').forEach(chk=>{
      chk.addEventListener('change',()=>{
        const inv=paidInvoices.find(x=>String(x.id)===chk.dataset.inv);
        if(!inv) return;
        if(chk.checked){
          state.lines.push({ invoiceId:inv.id, invoiceNomor:inv.nomor, desc:'', nilai:Number(inv.total)||0 });
          // ambil data pembayar & penjual dari invoice pertama yang dicentang
          if(state.lines.length===1){
            let cust={}; try{ cust=JSON.parse(inv.customerSnapshot||'{}'); }catch(e){}
            state.customerId=inv.customerId||'';
            state.customer={nama:cust.nama||'',alamat:cust.alamat||'',telepon:cust.telepon||'',email:cust.email||''};
            if(!state.sudahTerima) state.sudahTerima=cust.nama||'';
            if(inv.sellerSnapshot){ try{ state.seller=JSON.parse(inv.sellerSnapshot); }catch(e){} }
            if(inv.logo && !state.logo) state.logo=inv.logo;
            if(inv.metodeBayar) state.metodeBayar=inv.metodeBayar;
            if(inv.bankId){ state.bankId=inv.bankId; state.bank=inv.bankSnapshot?JSON.parse(inv.bankSnapshot):(banks.find(b=>String(b.id)===String(inv.bankId))||null); }
          }
        }else{
          state.lines=state.lines.filter(l=>String(l.invoiceId)!==String(inv.id));
        }
        buildEditor(); render();
      });
    });

    editor.querySelector('#custSelect').onchange=(e)=>{
      const c=customers.find(x=>String(x.id)===e.target.value);
      state.customerId=c?c.id:'';
      if(c){ state.customer={nama:c.nama,alamat:c.alamat,telepon:c.telepon,email:c.email}; state.sudahTerima=c.nama; }
      buildEditor(); render();
    };
    editor.querySelector('#saveSeller').onclick=()=>{ localStorage.setItem('ledgerine_seller',JSON.stringify(state.seller)); toast('Info penjual disimpan'); };
    editor.querySelector('#addLine').onclick=()=>{ state.lines.push({invoiceId:'',invoiceNomor:'',desc:'',nilai:0}); buildLines(); render(); };
    editor.querySelector('#pdfBtn').onclick=exportPDF;
    editor.querySelectorAll('input[name="pdfq"]').forEach(r=>r.addEventListener('change',()=>{
      if(r.checked){ state.pdfQuality=r.value; localStorage.setItem('ledgerine_pdfq',r.value);
        editor.querySelectorAll('.qual-opt').forEach(o=>o.classList.remove('on'));
        r.closest('.qual-opt').classList.add('on'); }
    }));

    const mSel=editor.querySelector('[data-b="metodeBayar"]');
    mSel.addEventListener('change',()=>{
      state.metodeBayar=mSel.value;
      const row=editor.querySelector('#bankRow');
      if(row) row.style.display = state.metodeBayar==='Transfer' ? '' : 'none';
      if(state.metodeBayar!=='Transfer'){ state.bankId=''; state.bank=null; }
      render();
    });
    const bSel=editor.querySelector('#bankSelect');
    if(bSel) bSel.onchange=()=>{
      const b=banks.find(x=>String(x.id)===bSel.value);
      state.bankId=b?b.id:''; state.bank=b||null; render();
    };
  }

  function buildLines(){
    const area=editor.querySelector('#liArea');
    if(!state.lines.length){
      area.innerHTML=`<div class="muted" style="font-size:12.5px;padding:6px 0">Belum ada baris. Centang invoice di atas atau tambah baris manual.</div>`;
      return;
    }
    area.innerHTML=`<table class="li-table">
      <thead><tr><th style="width:58%">Deskripsi</th><th class="r">Nilai</th><th></th></tr></thead>
      <tbody>${state.lines.map((l,i)=>{
        const fromInv=!!l.invoiceId;
        return `<tr>
          <td>
            <input class="field li-input-desc" data-i="${i}" data-f="desc" value="${esc(l.desc)}" placeholder="${fromInv?('Pelunasan '+esc(l.invoiceNomor)):'Deskripsi'}">
            ${fromInv?`<div class="muted" style="font-size:10.5px;margin-top:3px">dari ${esc(l.invoiceNomor)}</div>`:''}
          </td>
          <td><input class="field" type="number" data-i="${i}" data-f="nilai" value="${l.nilai}" min="0" style="width:110px;${fromInv?'background:#F3F4F6':''}" ${fromInv?'readonly title="Nilai terkunci dari invoice"':''}></td>
          <td><button class="li-del" data-del="${i}" title="Hapus">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button></td>
        </tr>`;
      }).join('')}</tbody></table>`;
    area.querySelectorAll('input[data-i]').forEach(el=>{
      el.addEventListener('input',()=>{
        const i=+el.dataset.i, f=el.dataset.f;
        if(f==='nilai' && state.lines[i].invoiceId) return; // terkunci
        state.lines[i][f]=(f==='desc')?el.value:(parseFloat(el.value)||0);
        render();
      });
    });
    area.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
      const l=state.lines[+b.dataset.del];
      state.lines.splice(+b.dataset.del,1);
      buildEditor(); render(); // rebuild agar checkbox invoice ikut ter-uncheck
    });
  }

  function calc(){
    const active=state.lines.filter(l=>l.desc.trim()!=='' || Number(l.nilai) || l.invoiceId);
    const total=active.reduce((s,l)=>s+(Number(l.nilai)||0),0);
    return {active,total};
  }

  function paymentBlock(){
    const m=state.metodeBayar||'';
    if(!m) return '';
    let inner=`<div class="pay-method">${esc(m)}</div>`;
    if(m==='Transfer' && state.bank){
      inner+=`<div class="bank-card">
        <div class="bn">${esc(state.bank.namaBank)}${state.bank.cabang?' — '+esc(state.bank.cabang):''}</div>
        <div class="br">${esc(state.bank.nomorRekening)}</div>
        <div class="an">a.n. ${esc(state.bank.atasNama)}</div>
      </div>`;
    }
    return `<div class="doc-pay"><div class="cap">Metode Pembayaran</div>${inner}</div>`;
  }

  function signatureBlock(){
    if(!state.ttdNama && !state.ttdJabatan) return '';
    return `<div class="doc-sign"><div class="box">
        <div class="place">${esc(state.tempat||'')}, ${Fmt.date(state.tanggal)}</div>
        <div class="sign-space"></div>
        <div class="name">${esc(state.ttdNama||'—')}</div>
        ${state.ttdJabatan?`<div class="job">${esc(state.ttdJabatan)}</div>`:''}
      </div></div>`;
  }

  function render(){
    const {active,total}=calc();
    const cur=state.mataUang;
    const rows=active.length?active.map(l=>`
      <tr>
        <td class="it-desc">${esc(l.desc|| (l.invoiceNomor?('Pelunasan '+l.invoiceNomor):'—'))}</td>
        <td class="r">${Fmt.acc(l.nilai,cur)}</td>
      </tr>`).join('')
      :`<tr><td colspan="2" style="text-align:center;color:#bbb;padding:26px">Belum ada item</td></tr>`;

    const logoHtml=state.logo?`<img src="${state.logo}" class="doc-logo">`:`<div class="doc-logo-empty">${esc(state.seller.nama||'Logo')}</div>`;

    sheet.innerHTML=`
    <div class="a4" id="a4sheet">
      <div class="doc-top">
        <div>${logoHtml}</div>
        <div class="doc-title-block">
          <div class="doc-title">KWITANSI</div>
          <div class="doc-number">${esc(state.nomor||'—')}</div>
          <div><span class="doc-status st-paid">● LUNAS</span></div>
        </div>
      </div>

      <div class="doc-parties kw-parties">
        <div class="party">
          <div class="cap">Diterima oleh</div>
          <div class="nm">${esc(state.seller.nama||'Nama Bisnis')}</div>
          <div class="ln">${esc(state.seller.alamat||'')}</div>
          <div class="ln">${[state.seller.telepon,state.seller.email].filter(Boolean).map(esc).join(' · ')}</div>
        </div>
        <div class="party">
          <div class="cap">Telah terima dari</div>
          <div class="nm">${esc(state.sudahTerima||state.customer.nama||'Nama Pembayar')}</div>
          <div class="ln">${esc(state.customer.alamat||'')}</div>
          <div class="ln">${[state.customer.telepon,state.customer.email].filter(Boolean).map(esc).join(' · ')}</div>
        </div>
      </div>

      ${state.untukPembayaran?`<div class="kw-untuk"><span class="cap">Untuk pembayaran</span> ${esc(state.untukPembayaran)}</div>`:''}

      <table class="doc-items">
        <thead><tr><th>Deskripsi</th><th class="r">Jumlah</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="doc-bottom">
        <div class="doc-notes">
          ${state.catatan?`<div class="cap">Catatan</div><div>${esc(state.catatan).replace(/\n/g,'<br>')}</div>`:''}
          <div class="terbilang">Terbilang: ${terbilangRupiah(total,cur)}</div>
          ${paymentBlock()}
        </div>
        <div class="doc-summary">
          <div class="sum-total"><span>Total Pembayaran</span><span>${Fmt.acc(total,cur)}</span></div>
        </div>
      </div>

      ${signatureBlock()}

      <div class="doc-foot"><div class="line">Kwitansi ini merupakan bukti sah penerimaan pembayaran.</div></div>
    </div>`;
  }

  async function exportPDF(){
    const btn=editor.querySelector('#pdfBtn'), el=document.getElementById('a4sheet'), orig=btn.innerHTML;
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Generating PDF...';
    try{
      const scale = state.pdfQuality==='hd' ? Math.min(3,(window.devicePixelRatio||1)*2.5) : 1.5;
      const canvas=await html2canvas(el,{scale:scale,useCORS:true,backgroundColor:'#ffffff',
        logging:false, imageTimeout:0, letterRendering:true});
      const hd = state.pdfQuality==='hd';
      const fmt = hd ? 'PNG' : 'JPEG';
      const img = hd ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg',0.92);
      const { jsPDF }=window.jspdf; const pdf=new jsPDF({orientation:'p',unit:'mm',format:'a4',compress:true});
      const pw=210, ph=297, iw=pw, ih=canvas.height*pw/canvas.width;
      let left=ih, pos=0; pdf.addImage(img,fmt,0,pos,iw,ih,undefined,'FAST'); left-=ph;
      while(left>0){ pos=left-ih; pdf.addPage(); pdf.addImage(img,fmt,0,pos,iw,ih,undefined,'FAST'); left-=ph; }
      pdf.save((state.nomor||'kwitansi').replace(/[\/\\]/g,'-')+'.pdf');
      btn.innerHTML='Downloaded ✓'; setTimeout(()=>{ btn.innerHTML=orig; btn.disabled=false; },1800);
    }catch(e){ toast('Gagal membuat PDF. Coba lagi.','err'); btn.innerHTML=orig; btn.disabled=false; }
  }

  content.querySelector('#saveBtn').onclick=async ()=>{
    if(!state.nomor){ toast('Nomor kwitansi wajib diisi','err'); return; }
    if(!state.metodeBayar){ toast('Pilih metode bayar','err'); return; }
    if(state.metodeBayar==='Transfer' && !state.bankId){ toast('Pilih rekening bank tujuan','err'); return; }
    const {total}=calc();
    if(total<=0){ toast('Nilai kwitansi masih 0. Centang invoice atau isi baris manual.','err'); return; }
    const btn=content.querySelector('#saveBtn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Menyimpan...';
    const invoiceIds=state.lines.map(l=>l.invoiceId).filter(Boolean);
    const payload={
      nomor:state.nomor, tanggal:state.tanggal, mataUang:state.mataUang, customerId:state.customerId,
      customerSnapshot:JSON.stringify(state.customer), sellerSnapshot:JSON.stringify(state.seller),
      sudahTerima:state.sudahTerima, untukPembayaran:state.untukPembayaran,
      items:JSON.stringify(state.lines), ppn:0, subtotal:Math.round(total),
      jumlah:Math.round(total), terbilang:terbilangRupiah(total,state.mataUang),
      invoiceRef:state.lines.map(l=>l.invoiceNomor).filter(Boolean).join(', '),
      invoiceId:invoiceIds.join(','),
      metodeBayar:state.metodeBayar, bankId:state.bankId,
      bankSnapshot:state.bank?JSON.stringify(state.bank):'',
      catatan:state.catatan, ttdNama:state.ttdNama, ttdJabatan:state.ttdJabatan, tempat:state.tempat,
      logo:state.logo, createdBy:user.username
    };
    try{
      if(state.editId){ payload.id=state.editId; await API.update('Receipts',payload); toast('Kwitansi diperbarui'); }
      else{ payload.createdAt=new Date().toISOString(); const r=await API.create('Receipts',payload); state.editId=r.data.id;
        invoiceIds.forEach(id=>usedInvoiceIds.add(String(id)));
        toast('Kwitansi disimpan'); }
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
      state.customer=k.customerSnapshot?JSON.parse(k.customerSnapshot):state.customer;
      state.sudahTerima=k.sudahTerima||''; state.untukPembayaran=k.untukPembayaran||'';
      // items lama bisa berformat item {desc,qty,harga}; konversi ke lines {desc,nilai}
      let parsed=[]; try{ parsed=k.items?JSON.parse(k.items):[]; }catch(e){}
      state.lines=parsed.map(x=>{
        if('nilai' in x) return { invoiceId:x.invoiceId||'', invoiceNomor:x.invoiceNomor||'', desc:x.desc||'', nilai:Number(x.nilai)||0 };
        const val=(Number(x.qty)||0)*(Number(x.harga)||0)*(1-(Number(x.disc)||0)/100);
        return { invoiceId:'', invoiceNomor:'', desc:x.desc||'', nilai:Math.round(val) };
      });
      state.catatan=k.catatan||''; state.logo=k.logo||'';
      state.ttdNama=k.ttdNama||''; state.ttdJabatan=k.ttdJabatan||''; state.tempat=k.tempat||'Gorontalo';
      state.metodeBayar=k.metodeBayar||'Transfer'; state.bankId=k.bankId||'';
      state.bank=k.bankSnapshot?JSON.parse(k.bankSnapshot):null;
      state.seller=k.sellerSnapshot?JSON.parse(k.sellerSnapshot):state.seller;
      content.querySelector('#ttl').textContent='Ubah Kwitansi';
      return true;
    }catch(e){ return false; }
  }

  async function init(){
    const s=localStorage.getItem('ledgerine_seller'); if(s){ try{ state.seller=JSON.parse(s); }catch(e){} }
    const isEdit=loadEdit();
    try{
      const [c,kw,inv,bk]=await Promise.all([API.list('Customers'),API.list('Receipts'),API.list('Invoices'),API.list('Banks')]);
      customers=(c.rows||[]).filter(x=>x.id);
      banks=(bk.rows||[]).filter(x=>x.id);
      if(state.bankId && !state.bank) state.bank=banks.find(b=>String(b.id)===String(state.bankId))||null;
      const receipts=(kw.rows||[]).filter(x=>x.id);
      // kumpulkan invoiceId yang sudah dipakai (bisa comma-separated)
      usedInvoiceIds=new Set();
      receipts.forEach(r=>{ String(r.invoiceId||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(id=>usedInvoiceIds.add(id)); });
      paidInvoices=(inv.rows||[]).filter(x=>x.id && String(x.status).toUpperCase()==='PAID');
      if(!isEdit) state.nomor=nextNumber(receipts);
    }catch(e){ toast(e.message,'err'); }
    buildEditor(); render();
  }
  init();
})();
