/**
 * LEDGERINE — Backend Google Apps Script
 * Arsitektur GET-only (hindari CORS preflight).
 * Semua request lewat ?action=...&payload={json}
 *
 * CARA PAKAI:
 * 1. Buat Google Spreadsheet baru.
 * 2. Extensions > Apps Script, tempel kode ini.
 * 3. Jalankan setup() sekali (dari editor) untuk membuat sheet & user default.
 * 4. Deploy > New deployment > Web app > Execute as: Me, Access: Anyone.
 * 5. Salin URL /exec ke config.js (API_URL).
 */

var SS_ID = ''; // kosongkan jika script terikat ke spreadsheet (bound). Isi ID jika standalone.

function getSS() {
  return SS_ID ? SpreadsheetApp.openById(SS_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

// ---- Skema sheet ----
var SHEETS = {
  Users:     ['id','username','password','nama','role','aktif'],
  Customers: ['id','nama','alamat','telepon','email','createdAt'],
  Products:  ['id','nama','satuan','harga','createdAt'],
  Banks:     ['id','namaBank','nomorRekening','atasNama','cabang','createdAt'],
  Invoices:  ['id','nomor','tanggal','jatuhTempo','mataUang','customerId','customerSnapshot','sellerSnapshot','items','ppn','subtotal','total','status','catatan','metodeBayar','bankId','bankSnapshot','ttdNama','ttdJabatan','tempat','logo','createdBy','createdAt'],
  Receipts:  ['id','nomor','tanggal','mataUang','customerId','customerSnapshot','sellerSnapshot','sudahTerima','untukPembayaran','items','ppn','subtotal','jumlah','terbilang','invoiceRef','invoiceId','metodeBayar','bankId','bankSnapshot','ttdNama','ttdJabatan','tempat','catatan','logo','createdBy','createdAt']
};

function setup() {
  var ss = getSS();
  Object.keys(SHEETS).forEach(function(name){
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clear();
    sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);
    sh.setFrozenRows(1);
  });
  // user default
  var u = ss.getSheetByName('Users');
  if (u.getLastRow() < 2) {
    u.appendRow([ 'U1','admin','admin123','Administrator','admin','YA' ]);
    u.appendRow([ 'U2','staff','staff123','Staff Operasional','staff','YA' ]);
  }
  return 'setup selesai';
}

function doGet(e) {
  var out = { ok:false };
  try {
    var action = (e.parameter.action || '').trim();
    var payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
    switch (action) {
      case 'login':      out = login(payload); break;
      case 'list':       out = listRows(payload.sheet); break;
      case 'create':     out = createRow(payload.sheet, payload.data); break;
      case 'update':     out = updateRow(payload.sheet, payload.data); break;
      case 'delete':     out = deleteRow(payload.sheet, payload.id); break;
      case 'ping':       out = { ok:true, message:'pong' }; break;
      default:           out = { ok:false, error:'unknown action: '+action };
    }
  } catch (err) {
    out = { ok:false, error:String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetData(name) {
  var sh = getSS().getSheetByName(name);
  if (!sh) throw new Error('sheet tidak ada: '+name);
  var values = sh.getDataRange().getValues();
  var headers = values.shift();
  var rows = values.map(function(r){
    var o = {};
    headers.forEach(function(h,i){ o[h] = r[i]; });
    return o;
  });
  return { sh:sh, headers:headers, rows:rows };
}

function login(p) {
  var d = sheetData('Users');
  var user = d.rows.filter(function(r){
    return String(r.username) === String(p.username) &&
           String(r.password) === String(p.password) &&
           String(r.aktif).toUpperCase() === 'YA';
  })[0];
  if (!user) return { ok:false, error:'Username / password salah, atau akun nonaktif.' };
  return { ok:true, user:{ id:user.id, username:user.username, nama:user.nama, role:user.role } };
}

function listRows(name) {
  var d = sheetData(name);
  return { ok:true, rows:d.rows };
}

function createRow(name, data) {
  var d = sheetData(name);
  if (!data.id) data.id = name.charAt(0) + Date.now();
  var row = d.headers.map(function(h){ return data[h] !== undefined ? data[h] : ''; });
  d.sh.appendRow(row);
  return { ok:true, data:data };
}

function updateRow(name, data) {
  var d = sheetData(name);
  var idx = d.rows.map(function(r){ return String(r.id); }).indexOf(String(data.id));
  if (idx < 0) return { ok:false, error:'id tidak ditemukan' };
  var merged = d.rows[idx];
  Object.keys(data).forEach(function(k){ merged[k] = data[k]; });
  var row = d.headers.map(function(h){ return merged[h] !== undefined ? merged[h] : ''; });
  d.sh.getRange(idx+2, 1, 1, d.headers.length).setValues([row]);
  return { ok:true, data:merged };
}

function deleteRow(name, id) {
  var d = sheetData(name);
  var idx = d.rows.map(function(r){ return String(r.id); }).indexOf(String(id));
  if (idx < 0) return { ok:false, error:'id tidak ditemukan' };
  d.sh.deleteRow(idx+2);
  return { ok:true };
}
