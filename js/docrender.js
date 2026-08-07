/* ===== Standalone A4 renderer + PDF download (untuk tombol download di daftar) =====
   Membangun HTML A4 yang sama dengan editor, dari data baris tersimpan,
   lalu render ke PDF via jsPDF + html2canvas. Dipakai di invoice-list & receipt-list. */

(function(){
  function payBlock(metodeBayar, bank){
    const m=metodeBayar||'';
    if(!m) return '';
    let inner=`<div class="pay-method">${esc(m)}</div>`;
    if(m==='Transfer' && bank){
      inner+=`<div class="bank-card">
        <div class="bn">${esc(bank.namaBank)}${bank.cabang?' — '+esc(bank.cabang):''}</div>
        <div class="br">${esc(bank.nomorRekening)}</div>
        <div class="an">a.n. ${esc(bank.atasNama)}</div>
      </div>`;
    }
    return `<div class="doc-pay"><div class="cap">Metode Pembayaran</div>${inner}</div>`;
  }
  function signBlock(s){
    if(!s.ttdNama && !s.ttdJabatan) return '';
    return `<div class="doc-sign"><div class="box">
        <div class="place">${esc(s.tempat||'')}, ${Fmt.date(s.tanggal)}</div>
        <div class="sign-space"></div>
        <div class="name">${esc(s.ttdNama||'—')}</div>
        ${s.ttdJabatan?`<div class="job">${esc(s.ttdJabatan)}</div>`:''}
      </div></div>`;
  }
  function parse(json, fallback){ try{ return JSON.parse(json); }catch(e){ return fallback; } }
  function logoHtml(logo, nama){
    return logo ? `<img src="${logo}" class="doc-logo">` : `<div class="doc-logo-empty">${esc(nama||'Logo')}</div>`;
  }

  // ---- INVOICE A4 dari row ----
  function invoiceHtml(inv){
    const cur=inv.mataUang||'IDR';
    const seller=parse(inv.sellerSnapshot,{}), cust=parse(inv.customerSnapshot,{});
    const items=parse(inv.items,[]);
    const bank=parse(inv.bankSnapshot,null);
    const lineTotal=(it)=>(Number(it.qty)||0)*(Number(it.harga)||0)*(1-(Number(it.disc)||0)/100);
    const active=items.filter(it=>(it.desc||'').trim()!=='' || Number(it.qty)||Number(it.harga));
    const total=active.reduce((s,it)=>s+lineTotal(it),0);
    const rate=(Number(inv.ppn)||0)/100;
    const dpp=rate>0?total/(1+rate):total, ppnAmt=total-dpp;
    const rows=active.length?active.map(it=>`
      <tr><td class="it-desc">${esc(it.desc||'—')}${it.disc?`<span style="color:#888;font-weight:400"> (disc ${Fmt.number(it.disc)}%)</span>`:''}</td>
      <td class="c">${Fmt.number(it.qty)}</td><td class="r">${Fmt.acc(lineTotal(it),cur)}</td></tr>`).join('')
      :`<tr><td colspan="3" style="text-align:center;color:#bbb;padding:26px">Belum ada item</td></tr>`;
    const badge=String(inv.status).toUpperCase()==='PAID'
      ?`<span class="doc-status st-paid">● LUNAS</span>`:`<span class="doc-status st-unpaid">● BELUM BAYAR</span>`;
    return `<div class="a4" id="a4sheet">
      <div class="doc-top"><div>${logoHtml(inv.logo,seller.nama)}</div>
        <div class="doc-title-block"><div class="doc-title">INVOICE</div>
          <div class="doc-number">${esc(inv.nomor||'—')}</div><div>${badge}</div></div></div>
      <div class="doc-parties">
        <div class="party"><div class="cap">Dari</div><div class="nm">${esc(seller.nama||'Nama Bisnis')}</div>
          <div class="ln">${esc(seller.alamat||'')}</div>
          <div class="ln">${[seller.telepon,seller.email].filter(Boolean).map(esc).join(' · ')}</div></div>
        <div class="party"><div class="cap">Ditagihkan kepada</div><div class="nm">${esc(cust.nama||'Nama Pelanggan')}</div>
          <div class="ln">${esc(cust.alamat||'')}</div>
          <div class="ln">${[cust.telepon,cust.email].filter(Boolean).map(esc).join(' · ')}</div></div>
        <div class="doc-meta">
          <div class="mrow"><span class="k">Tanggal</span><span class="v">${Fmt.date(inv.tanggal)}</span></div>
          <div class="mrow"><span class="k">Jatuh Tempo</span><span class="v">${Fmt.date(inv.jatuhTempo)}</span></div></div></div>
      <table class="doc-items"><thead><tr><th>Deskripsi</th><th class="c">Qty</th><th class="r">Jumlah</th></tr></thead>
        <tbody>${rows}</tbody></table>
      <div class="doc-bottom"><div class="doc-notes">
        ${inv.catatan?`<div class="cap">Catatan</div><div>${esc(inv.catatan).replace(/\n/g,'<br>')}</div>`:''}
        <div class="terbilang">Terbilang: ${terbilangRupiah(total,cur)}</div></div>
        <div class="doc-summary">
          <div class="sum-row sub"><span>DPP (HPP)</span><span>${Fmt.acc(dpp,cur)}</span></div>
          <div class="sum-row"><span>PPN (${Fmt.number(inv.ppn)}%)</span><span>${Fmt.acc(ppnAmt,cur)}</span></div>
          <div class="sum-total"><span>Total</span><span>${Fmt.acc(total,cur)}</span></div></div></div>
      <div class="doc-payrow"><div class="pay-col">${payBlock(inv.metodeBayar,bank)}</div>
        <div class="sign-col">${signBlock({ttdNama:inv.ttdNama,ttdJabatan:inv.ttdJabatan,tempat:inv.tempat,tanggal:inv.tanggal})}</div></div>
      <div class="doc-foot"><div class="line">Invoice ini diterbitkan oleh ${esc(seller.nama||'perusahaan')} dan sah sebagai dokumen tagihan.</div></div>
    </div>`;
  }

  // ---- KWITANSI A4 dari row ----
  function receiptHtml(k){
    const cur=k.mataUang||'IDR';
    const seller=parse(k.sellerSnapshot,{}), cust=parse(k.customerSnapshot,{});
    const bank=parse(k.bankSnapshot,null);
    const lines=parse(k.items,[]);
    const active=lines.filter(l=>(l.desc||'').trim()!=='' || Number(l.nilai) || l.invoiceId);
    const total=active.reduce((s,l)=>s+(Number(l.nilai)||0),0);
    const rows=active.length?active.map(l=>`
      <tr><td class="it-desc">${esc(l.desc|| (l.invoiceNomor?('Pelunasan '+l.invoiceNomor):'—'))}</td>
      <td class="r">${Fmt.acc(l.nilai,cur)}</td></tr>`).join('')
      :`<tr><td colspan="2" style="text-align:center;color:#bbb;padding:26px">Belum ada item</td></tr>`;
    return `<div class="a4" id="a4sheet">
      <div class="doc-top"><div>${logoHtml(k.logo,seller.nama)}</div>
        <div class="doc-title-block"><div class="doc-title">KWITANSI</div>
          <div class="doc-number">${esc(k.nomor||'—')}</div><div><span class="doc-status st-paid">● LUNAS</span></div></div></div>
      <div class="doc-parties kw-parties">
        <div class="party"><div class="cap">Diterima oleh</div><div class="nm">${esc(seller.nama||'Nama Bisnis')}</div>
          <div class="ln">${esc(seller.alamat||'')}</div>
          <div class="ln">${[seller.telepon,seller.email].filter(Boolean).map(esc).join(' · ')}</div></div>
        <div class="party"><div class="cap">Telah terima dari</div><div class="nm">${esc(k.sudahTerima||cust.nama||'Nama Pembayar')}</div>
          <div class="ln">${esc(cust.alamat||'')}</div>
          <div class="ln">${[cust.telepon,cust.email].filter(Boolean).map(esc).join(' · ')}</div></div></div>
      ${k.untukPembayaran?`<div class="kw-untuk"><span class="cap">Untuk pembayaran</span> ${esc(k.untukPembayaran)}</div>`:''}
      <table class="doc-items"><thead><tr><th>Deskripsi</th><th class="r">Jumlah</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="doc-bottom"><div class="doc-notes">
        ${k.catatan?`<div class="cap">Catatan</div><div>${esc(k.catatan).replace(/\n/g,'<br>')}</div>`:''}
        <div class="terbilang">Terbilang: ${terbilangRupiah(total,cur)}</div></div>
        <div class="doc-summary"><div class="sum-total"><span>Total Pembayaran</span><span>${Fmt.acc(total,cur)}</span></div></div></div>
      <div class="doc-payrow"><div class="pay-col">${payBlock(k.metodeBayar,bank)}</div>
        <div class="sign-col">${signBlock({ttdNama:k.ttdNama,ttdJabatan:k.ttdJabatan,tempat:k.tempat,tanggal:k.tanggal})}</div></div>
      <div class="doc-foot"><div class="line">Kwitansi ini merupakan bukti sah penerimaan pembayaran.</div></div>
    </div>`;
  }

  // ---- render HTML ke PDF (off-screen) ----
  async function htmlToPDF(html, filename, quality){
    if(!window.jspdf || !window.html2canvas){ toast('Modul PDF belum siap, coba lagi.','err'); return; }
    // container off-screen dengan lebar A4 agar layout sama persis
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;left:-9999px;top:0;width:794px;background:#fff;';
    wrap.innerHTML=html;
    document.body.appendChild(wrap);
    const el=wrap.querySelector('#a4sheet');
    el.style.minHeight='auto';
    try{
      const hd = quality==='hd';
      const scale = hd ? Math.min(3,(window.devicePixelRatio||1)*2.5) : 1.5;
      const canvas=await html2canvas(el,{scale:scale,useCORS:true,backgroundColor:'#ffffff',logging:false,imageTimeout:0,letterRendering:true});
      const fmt = hd?'PNG':'JPEG';
      const img = hd?canvas.toDataURL('image/png'):canvas.toDataURL('image/jpeg',0.92);
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({orientation:'p',unit:'mm',format:'a4',compress:true});
      const pw=210,ph=297,iw=pw,ih=canvas.height*pw/canvas.width, EPS=2;
      let left=ih,pos=0;
      pdf.addImage(img,fmt,0,pos,iw,ih,undefined,'FAST'); left-=ph;
      while(left>EPS){ pos=left-ih; pdf.addPage(); pdf.addImage(img,fmt,0,pos,iw,ih,undefined,'FAST'); left-=ph; }
      pdf.save(filename.replace(/[\/\\]/g,'-')+'.pdf');
    }catch(e){ toast('Gagal membuat PDF. Coba lagi.','err'); }
    finally{ wrap.remove(); }
  }

  window.DocRender = {
    invoiceHtml, receiptHtml,
    downloadInvoice: (inv, quality)=>htmlToPDF(invoiceHtml(inv), (inv.nomor||'invoice'), quality||localStorage.getItem('ledgerine_pdfq')||'hd'),
    downloadReceipt: (k, quality)=>htmlToPDF(receiptHtml(k), (k.nomor||'kwitansi'), quality||localStorage.getItem('ledgerine_pdfq')||'hd')
  };
})();
