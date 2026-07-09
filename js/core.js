/* ===== LEDGERINE core.js — shared utilities ===== */

/* ---------- API (GET-only, JSON param → hindari CORS preflight) ---------- */
const API = {
  async call(action, payload = {}) {
    const url = CONFIG.API_URL;
    if (!url || url.includes('PASTE_YOUR')) {
      throw new Error('API_URL belum diisi. Edit js/config.js di GitHub.');
    }
    const qs = 'action=' + encodeURIComponent(action) +
               '&payload=' + encodeURIComponent(JSON.stringify(payload));
    const res = await fetch(url + '?' + qs, { method:'GET', redirect:'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Permintaan gagal');
    return data;
  },
  login:  (username,password) => API.call('login',{username,password}),
  list:   (sheet)             => API.call('list',{sheet}),
  create: (sheet,data)        => API.call('create',{sheet,data}),
  update: (sheet,data)        => API.call('update',{sheet,data}),
  remove: (sheet,id)          => API.call('delete',{sheet,id})
};

/* ---------- Auth ---------- */
const Auth = {
  key:'ledgerine_user',
  get(){ try{ return JSON.parse(sessionStorage.getItem(this.key)); }catch(e){ return null; } },
  set(u){ sessionStorage.setItem(this.key, JSON.stringify(u)); },
  clear(){ sessionStorage.removeItem(this.key); },
  guard(){
    const u = this.get();
    if(!u){ location.href='login.html'; return null; }
    return u;
  },
  logout(){ this.clear(); location.href='login.html'; }
};

/* ---------- Format ---------- */
const Fmt = {
  currency(n, cur='IDR'){
    n = Math.round((Number(n)||0)*100)/100;
    if(cur==='USD'){
      return '$' + n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    }
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  },
  // format accounting (Excel-style): simbol kiri, angka kanan, sejajar dalam sel
  acc(n, cur='IDR'){
    n = Number(n)||0;
    const sym = cur==='USD' ? '$' : 'Rp';
    const num = cur==='USD'
      ? Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
      : Math.round(Math.abs(n)).toLocaleString('id-ID');
    const val = n<0 ? '('+num+')' : num;
    return `<span class="acc"><span class="acc-sym">${sym}</span><span class="acc-num">${val}</span></span>`;
  },
  number(n){ return (Math.round((Number(n)||0)*100)/100).toLocaleString('id-ID'); },
  date(d){
    if(!d) return '-';
    const x = new Date(d);
    if(isNaN(x)) return d;
    return x.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
  },
  dateInput(d){
    const x = d?new Date(d):new Date();
    if(isNaN(x)) return '';
    return x.toISOString().slice(0,10);
  }
};

/* ---------- Terbilang (Bahasa Indonesia) ---------- */
function terbilang(angka){
  angka = Math.floor(Math.abs(Number(angka)||0));
  const satuan = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
  function toWords(n){
    if(n < 12) return satuan[n];
    if(n < 20) return toWords(n-10)+' belas';
    if(n < 100) return toWords(Math.floor(n/10))+' puluh'+(n%10?' '+toWords(n%10):'');
    if(n < 200) return 'seratus'+(n%100?' '+toWords(n%100):'');
    if(n < 1000) return toWords(Math.floor(n/100))+' ratus'+(n%100?' '+toWords(n%100):'');
    if(n < 2000) return 'seribu'+(n%1000?' '+toWords(n%1000):'');
    if(n < 1000000) return toWords(Math.floor(n/1000))+' ribu'+(n%1000?' '+toWords(n%1000):'');
    if(n < 1000000000) return toWords(Math.floor(n/1000000))+' juta'+(n%1000000?' '+toWords(n%1000000):'');
    if(n < 1000000000000) return toWords(Math.floor(n/1000000000))+' miliar'+(n%1000000000?' '+toWords(n%1000000000):'');
    return toWords(Math.floor(n/1000000000000))+' triliun'+(n%1000000000000?' '+toWords(n%1000000000000):'');
  }
  if(angka===0) return 'nol';
  let w = toWords(angka).replace(/\s+/g,' ').trim();
  return w.charAt(0).toUpperCase()+w.slice(1);
}
function terbilangRupiah(n, cur='IDR'){
  if(cur==='USD') return terbilang(n)+' dollar';
  return terbilang(n)+' rupiah';
}

/* ---------- Toast ---------- */
function toast(msg, type='ok'){
  let wrap = document.querySelector('.toast-wrap');
  if(!wrap){ wrap=document.createElement('div'); wrap.className='toast-wrap'; document.body.appendChild(wrap); }
  const t = document.createElement('div');
  t.className = 'toast '+(type==='err'?'err':type==='ok'?'ok':'');
  const icon = type==='err'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
  t.innerHTML = icon + '<span>'+msg+'</span>';
  wrap.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(8px)'; setTimeout(()=>t.remove(),200); }, 2800);
}

/* ---------- HTML escape ---------- */
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- Sidebar / layout builder ---------- */
const NAV = [
  ['dashboard.html','Dashboard','M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z'],
  ['invoices.html','Invoice','M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6'],
  ['receipts.html','Kwitansi','M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM8 8h8M8 12h8'],
  ['customers.html','Pelanggan','M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'],
  ['products.html','Barang','M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'],
  ['banks.html','Bank','M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3'],
  ['users.html','Pengguna','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 11h-6M19 8v6','admin']
];

function buildLayout(active){
  const u = Auth.guard(); if(!u) return null;
  const initials = (u.nama||u.username||'?').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
  const navHtml = NAV.filter(n=>!n[3]||n[3]===u.role).map(n=>{
    const [href,label,icon]=n;
    const act = href===active?'active':'';
    return `<a href="${href}" class="${act}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon}"/></svg>${label}</a>`;
  }).join('');

  const shell = document.createElement('div');
  shell.className='app';
  shell.innerHTML = `
    <aside class="sidebar">
      <div class="brand"><span class="brand-dot">L</span> Ledgerine</div>
      <nav class="nav">${navHtml}</nav>
      <div class="nav-foot">
        <div class="user-chip">
          <div class="avatar">${esc(initials)}</div>
          <div class="meta"><div class="nm">${esc(u.nama||u.username)}</div>
            <div class="rl" style="text-transform:capitalize">${esc(u.role)}</div></div>
        </div>
        <button class="btn btn-block btn-sm mt-2" id="logoutBtn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Keluar
        </button>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <div class="flex items-center gap">
          <button class="btn btn-ghost btn-sm sidebar-toggle" id="sidebarToggle" title="Sembunyikan/tampilkan menu" aria-label="Toggle menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
          <strong>${esc(NAV.find(n=>n[0]===active)?.[1]||'Ledgerine')}</strong>
        </div>
        <span class="badge badge-role">${esc(u.role)}</span>
      </div>
      <div class="content" id="content"></div>
    </div>`;
  document.body.innerHTML='';
  document.body.appendChild(shell);
  document.getElementById('logoutBtn').onclick = ()=>Auth.logout();

  // backdrop untuk mode mobile
  const backdrop=document.createElement('div');
  backdrop.className='sidebar-backdrop';
  shell.appendChild(backdrop);

  const isMobile = ()=>window.matchMedia('(max-width:900px)').matches;

  // desktop: collapse (persist). mobile: overlay open/close.
  applyDesktopCollapsed(localStorage.getItem('ledgerine_sidebar')==='1');
  function applyDesktopCollapsed(c){ if(!isMobile()) shell.classList.toggle('sidebar-collapsed', c); }

  document.getElementById('sidebarToggle').onclick = ()=>{
    if(isMobile()){
      shell.classList.toggle('sidebar-open');
    }else{
      const now = !shell.classList.contains('sidebar-collapsed');
      shell.classList.toggle('sidebar-collapsed', now);
      localStorage.setItem('ledgerine_sidebar', now?'1':'0');
    }
  };
  backdrop.onclick = ()=>shell.classList.remove('sidebar-open');
  // tutup overlay saat klik menu (mobile)
  shell.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>{
    if(isMobile()) shell.classList.remove('sidebar-open');
  }));

  return { user:u, content:document.getElementById('content') };
}
