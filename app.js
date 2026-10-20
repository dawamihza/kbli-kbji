/* ============================================================
   KBLI KBJI — logika aplikasi
   Seluruh data dimuat dari berkas JSON di folder data/ dan
   disimpan di memori. Tidak ada permintaan ke server mana pun
   setelah berkas tersimpan, sehingga aplikasi tetap berjalan
   tanpa koneksi internet.
   ============================================================ */

'use strict';

/* ---------- Definisi kamus ---------- */

const KAMUS = {
  KBLI: {
    kode: 'KBLI',
    namaPendek: 'KBLI 2025',
    namaPanjang: 'Klasifikasi Baku Lapangan Usaha Indonesia',
    file: 'data/kbli2025.json',
    panduan: [
      { t: 'Apa KBLI suatu usaha?' },
      { j: 'Lihat bidang dan output (produk akhir) yang dihasilkan (dikomersialkan)' },
      { spasi: true },
      { t: 'Seseorang bekerja di KBLI apa?' },
      { j: 'Lihat bidang dan output (produk akhir) yang dihasilkan (dikomersialkan) PENYEDIA KERJA (unit usaha), bukan output pekerja.' },
      { j: 'Penyedia Kerja adalah entitas YANG MEMBERI UPAH/GAJI, bukan tempat riil bekerja.' },
      { spasi: true },
      { k: 'KUNCI: KBLI berbicara UNIT USAHA (PENYEDIA KERJA), bukan pekerja.' }
    ],
    placeholder: 'Cari kode atau kegiatan usaha…',
    judulAkar: 'Telusuri menurut kategori',
    catatanTerdalam: 'Kode 5 digit — inilah kode yang dipakai saat mendaftarkan bidang usaha di sistem OSS.',
    tingkatan: [
      { key: 'kategori',       label: 'Kategori',       digit: '1 huruf' },
      { key: 'golongan_pokok', label: 'Golongan Pokok', digit: '2 digit' },
      { key: 'golongan',       label: 'Golongan',       digit: '3 digit' },
      { key: 'subgolongan',    label: 'Subgolongan',    digit: '4 digit' },
      { key: 'kelompok',       label: 'Kelompok',       digit: '5 digit' }
    ]
  },
  KBJI: {
    kode: 'KBJI',
    namaPendek: 'KBJI 2026',
    namaPanjang: 'Klasifikasi Baku Jabatan Indonesia',
    file: 'data/kbji2026.json',
    panduan: [
      { t: 'Apa KBJI seseorang dalam pekerjaan?' },
      { j: 'Lihat jobdesc/uraian tugas, peran, dan posisi/jabatan dalam pekerjaan.' },
      { spasi: true },
      { k: 'KUNCI: KBJI berbicara PEKERJA dalam pekerjaan/usaha, bukan unit usaha.' }
    ],
    placeholder: 'Cari kode atau nama jabatan…',
    judulAkar: 'Telusuri menurut golongan pokok',
    catatanTerdalam: 'Kode jabatan 6 digit — tingkat paling rinci, dipakai untuk pendataan ketenagakerjaan.',
    tingkatan: [
      { key: 'golongan_pokok',    label: 'Golongan Pokok',    digit: '1 digit' },
      { key: 'subgolongan_pokok', label: 'Subgolongan Pokok', digit: '2 digit' },
      { key: 'golongan',          label: 'Golongan',          digit: '3 digit' },
      { key: 'subgolongan',       label: 'Subgolongan',        digit: '4 digit' },
      { key: 'jabatan',           label: 'Jabatan',            digit: '6 digit' }
    ]
  }
};

const WARNA_TINGKAT = ['var(--lv0)', 'var(--lv1)', 'var(--lv2)', 'var(--lv3)', 'var(--lv4)'];

function warnaTingkat(kamus, levelKey) {
  const i = KAMUS[kamus].tingkatan.findIndex(t => t.key === levelKey);
  return WARNA_TINGKAT[Math.min(Math.max(i, 0), WARNA_TINGKAT.length - 1)];
}

function tingkatTerdalam(kamus) {
  const t = KAMUS[kamus].tingkatan;
  return t[t.length - 1].key;
}

/* ---------- Penyimpanan data di memori ---------- */

const repo = {};   // repo.KBLI = { entries, byCode, children, roots, index }

function normalisasi(teks) {
  return teks
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function muatKamus(kode) {
  if (repo[kode]) return repo[kode];

  const res = await fetch(KAMUS[kode].file);
  if (!res.ok) throw new Error('Gagal memuat ' + KAMUS[kode].file);
  const entries = await res.json();

  const byCode = new Map();
  const children = new Map();
  const roots = [];

  for (const e of entries) {
    byCode.set(e.code, e);
    if (e.parent == null) {
      roots.push(e);
    } else {
      if (!children.has(e.parent)) children.set(e.parent, []);
      children.get(e.parent).push(e);
    }
  }

  const urut = (a, b) => a.code.localeCompare(b.code, 'en');
  roots.sort(urut);
  for (const arr of children.values()) arr.sort(urut);

  // Indeks pencarian: teks dinormalisasi sekali di awal agar pencarian cepat
  const index = entries.map(e => ({
    e,
    code: e.code.toLowerCase(),
    codePlain: e.code.toLowerCase().replace(/\./g, ''),
    title: normalisasi(e.title),
    desc: normalisasi(e.description || '')
  }));

  repo[kode] = { entries, byCode, children, roots, index };
  return repo[kode];
}

/* ---------- Pencarian ---------- */

function cari(kode, kataKunci, levelFilter, batas = 300) {
  const r = repo[kode];
  if (!r) return [];
  const q = normalisasi(kataKunci);
  if (!q) return [];
  const qAlt = q.replace(/\./g, '');
  const terdalam = tingkatTerdalam(kode);

  const hasil = [];
  for (const it of r.index) {
    if (levelFilter && it.e.level !== levelFilter) continue;

    let skor = null;
    if (it.code === q || it.codePlain === qAlt) skor = 0;
    else if (it.code.startsWith(q) || it.codePlain.startsWith(qAlt)) skor = 1;
    else if (it.title === q) skor = 2;
    else if (it.title.startsWith(q)) skor = 3;
    else if (it.title.includes(q)) skor = 4;
    else if (it.desc.includes(q)) skor = 6;
    if (skor === null) continue;

    // Tingkat paling rinci sedikit diprioritaskan karena paling sering dicari
    const bonus = it.e.level === terdalam ? 0 : 1;
    hasil.push([skor * 2 + bonus, it.e]);
  }

  hasil.sort((a, b) => a[0] - b[0] || a[1].code.localeCompare(b[1].code, 'en'));
  return hasil.slice(0, batas).map(x => x[1]);
}

function jalurHierarki(kode, code) {
  const r = repo[kode];
  const jalur = [];
  let cur = r.byCode.get(code);
  let penjaga = 0;
  while (cur && penjaga++ < 12) {
    jalur.unshift(cur);
    cur = cur.parent != null ? r.byCode.get(cur.parent) : null;
  }
  return jalur;
}

/* ---------- Bantuan tampilan ---------- */

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function barisEntri(kamus, e, denganCuplikan) {
  const warna = warnaTingkat(kamus, e.level);
  const lebar = kamus === 'KBJI' ? ' wide' : '';
  const cuplikan = denganCuplikan && e.description
    ? `<div class="snippet">${esc(e.description.replace(/\n/g, ' '))}</div>` : '';
  return `
    <button class="row${lebar}" data-code="${esc(e.code)}" data-kamus="${kamus}">
      <span class="code" style="color:${warna};background:var(--surface-variant);background:color-mix(in srgb, ${warna} 12%, transparent)">${esc(e.code)}</span>
      <span class="main">
        <span class="title">${esc(e.title)}</span>
        <span class="badge" style="color:${warna};background:var(--surface-variant);background:color-mix(in srgb, ${warna} 13%, transparent)">${esc(e.levelLabel)}</span>
        ${cuplikan}
      </span>
      <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
    </button>`;
}

/** Mengubah uraian menjadi paragraf dan butir, mengikuti susunan baris di PDF. */
function uraianKeHtml(teks) {
  if (!teks) return '';
  const baris = teks.split('\n').map(s => s.trim()).filter(Boolean);
  let html = '';
  let dalamList = false;

  for (const b of baris) {
    const butir = b.startsWith('- ');
    const sub = b.startsWith('• ');
    if (butir || sub) {
      if (!dalamList) { html += '<ul>'; dalamList = true; }
      const isi = esc(b.slice(2).trim());
      html += sub ? `<li class="sub">${isi}</li>` : `<li>${isi}</li>`;
    } else {
      if (dalamList) { html += '</ul>'; dalamList = false; }
      html += `<p>${esc(b)}</p>`;
    }
  }
  if (dalamList) html += '</ul>';
  return html;
}

function toast(pesan) {
  const t = $('#toast');
  t.textContent = pesan;
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { t.hidden = true; }, 2000);
}

/* ---------- Keadaan aplikasi ---------- */

const state = {
  kamus: 'KBLI',
  query: '',
  levelFilter: null
};

/* ---------- Beranda ---------- */

function gambarTab() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.setAttribute('aria-selected', String(btn.dataset.kamus === state.kamus));
  });
  const k = KAMUS[state.kamus];
  $('#home-title').textContent = k.namaPendek;
  $('#home-subtitle').textContent = k.namaPanjang;
  $('#search').placeholder = k.placeholder;
}

function gambarSaringan() {
  const wrap = $('#filters');
  if (!state.query) { wrap.hidden = true; wrap.innerHTML = ''; return; }
  const k = KAMUS[state.kamus];
  let html = `<button class="chip" data-level="" aria-pressed="${!state.levelFilter}">Semua</button>`;
  for (const t of k.tingkatan) {
    html += `<button class="chip" data-level="${t.key}" aria-pressed="${state.levelFilter === t.key}">${esc(t.label)}</button>`;
  }
  wrap.innerHTML = html;
  wrap.hidden = false;
}

function gambarBeranda() {
  gambarTab();
  gambarSaringan();
  const body = $('#home-body');
  const r = repo[state.kamus];

  if (!r) {
    body.innerHTML = `<div class="empty"><div class="spinner"></div>Memuat data ${esc(KAMUS[state.kamus].namaPendek)}…</div>`;
    return;
  }

  if (state.query) {
    const hasil = cari(state.kamus, state.query, state.levelFilter);
    if (!hasil.length) {
      body.innerHTML = `<div class="empty">Tidak ada hasil untuk “${esc(state.query)}” di ${esc(KAMUS[state.kamus].namaPendek)}.<br><br>Coba kata kunci lain, atau ketik langsung kode angkanya.</div>`;
      return;
    }
    body.innerHTML =
      `<p class="count-note">${hasil.length} hasil ditemukan</p>` +
      hasil.map(e => barisEntri(state.kamus, e, true)).join('') +
      `<div class="pad-bottom"></div>`;
    return;
  }

  // Tampilan telusur: kartu struktur lalu daftar entri teratas
  const k = KAMUS[state.kamus];
  const jumlah = {};
  for (const e of r.entries) jumlah[e.level] = (jumlah[e.level] || 0) + 1;

  const barisStruktur = k.tingkatan.map(t =>
    `<div class="struct-row"><span>${esc(t.label)} (${esc(t.digit)})</span><b>${(jumlah[t.key] || 0).toLocaleString('id-ID')}</b></div>`
  ).join('');

  const panduan = k.panduan.map(b => {
    if (b.spasi) return '<div class="gap"></div>';
    if (b.t) return `<p class="tanya">${esc(b.t)}</p>`;
    if (b.j) return `<p class="jawab">--&gt; ${esc(b.j)}</p>`;
    return `<p class="kunci">${esc(b.k)}</p>`;
  }).join('');

  body.innerHTML = `
    <div class="card">
      <h2>Struktur ${esc(k.namaPendek)}</h2>
      ${barisStruktur}
      <hr class="card-hr">
      ${panduan}
    </div>
    <h2 class="section-title">${esc(k.judulAkar)}</h2>
    ${r.roots.map(e => barisEntri(state.kamus, e, false)).join('')}
    <div class="pad-bottom"></div>`;
}

/* ---------- Detail ---------- */

let detailSekarang = null;   // { kamus, code }

function gambarDetail(kamus, code) {
  const r = repo[kamus];
  const e = r ? r.byCode.get(code) : null;
  detailSekarang = e ? { kamus, code } : null;

  $('#detail-code').textContent = code;
  $('#detail-kamus').textContent = KAMUS[kamus].namaPendek;
  $('#btn-share').hidden = !e;

  const body = $('#detail-body');
  if (!e) {
    body.innerHTML = `<div class="empty">Kode ${esc(code)} tidak ditemukan di ${esc(KAMUS[kamus].namaPendek)}.</div>`;
    return;
  }

  const warna = warnaTingkat(kamus, e.level);
  const anak = r.children.get(code) || [];
  const jalur = jalurHierarki(kamus, code);
  const palingRinci = e.level === tingkatTerdalam(kamus);

  let html = `
    <div class="detail-head">
      <span class="badge" style="color:${warna};background:var(--surface-variant);background:color-mix(in srgb, ${warna} 13%, transparent)">${esc(e.levelLabel)}</span>
      <h2>${esc(e.title)}</h2>
      ${palingRinci ? `<p class="note">${esc(KAMUS[kamus].catatanTerdalam)}</p>` : ''}
    </div>`;

  if (e.description) {
    html += `<div class="detail-section"><h3>Uraian</h3><div class="desc">${uraianKeHtml(e.description)}</div></div>`;
  }

  html += `<div class="detail-section"><h3>Struktur klasifikasi</h3>`;
  jalur.forEach((item, i) => {
    const akhir = i === jalur.length - 1;
    const w = warnaTingkat(kamus, item.level);
    html += `
      <button class="crumb${akhir ? ' last' : ''}" ${akhir ? 'disabled' : `data-code="${esc(item.code)}" data-kamus="${kamus}"`}
              style="padding-left:${i * 14}px">
        <span class="c-code" style="color:${akhir ? 'inherit' : w}">${esc(item.code)}</span>
        <span class="c-title">${esc(item.title)}</span>
      </button>`;
  });
  html += `</div>`;

  if (anak.length) {
    html += `<div class="detail-section"><h3>Rincian di bawahnya (${anak.length})</h3></div>`;
    html += anak.map(a => barisEntri(kamus, a, false)).join('');
  }

  html += `<div class="pad-bottom"></div>`;
  body.innerHTML = html;
  window.scrollTo(0, 0);
}

async function bagikan() {
  if (!detailSekarang) return;
  const { kamus, code } = detailSekarang;
  const e = repo[kamus].byCode.get(code);
  if (!e) return;

  let isi = `${KAMUS[kamus].namaPendek} — ${e.code}\n${e.title}`;
  if (e.description) {
    const d = e.description.replace(/\n/g, ' ');
    isi += '\n\n' + d.slice(0, 1000) + (d.length > 1000 ? '…' : '');
  }

  // Web Share API tersedia di Safari iOS dan sebagian besar peramban ponsel
  if (navigator.share) {
    try {
      await navigator.share({ title: `${KAMUS[kamus].kode} ${e.code} - ${e.title}`, text: isi });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;  // dibatalkan pengguna
    }
  }
  try {
    await navigator.clipboard.writeText(isi);
    toast('Disalin ke papan klip');
  } catch (err) {
    toast('Tidak dapat membagikan di peramban ini');
  }
}

/* ---------- Navigasi antar halaman ---------- */

function tampilkan(view) {
  for (const id of ['view-home', 'view-detail', 'view-about']) {
    document.getElementById(id).hidden = (id !== view);
  }
}

async function terapkanRute() {
  const hash = location.hash || '#/';

  if (hash === '#/about') {
    tampilkan('view-about');
    window.scrollTo(0, 0);
    return;
  }

  const m = hash.match(/^#\/d\/(KBLI|KBJI)\/(.+)$/);
  if (m) {
    const kamus = m[1];
    const code = decodeURIComponent(m[2]);
    tampilkan('view-detail');
    if (!repo[kamus]) {
      $('#detail-body').innerHTML = `<div class="empty"><div class="spinner"></div>Memuat data…</div>`;
      try { await muatKamus(kamus); } catch (err) {
        $('#detail-body').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
        return;
      }
    }
    gambarDetail(kamus, code);
    return;
  }

  tampilkan('view-home');
  gambarBeranda();
}

function bukaEntri(kamus, code) {
  location.hash = `#/d/${kamus}/${encodeURIComponent(code)}`;
}

/* ---------- Pemasangan pendengar peristiwa ---------- */

function pasangPendengar() {
  // Tab kamus
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      const k = btn.dataset.kamus;
      if (k === state.kamus) return;
      state.kamus = k;
      state.query = '';
      state.levelFilter = null;
      $('#search').value = '';
      $('#btn-clear').hidden = true;
      gambarBeranda();
      if (!repo[k]) {
        try { await muatKamus(k); } catch (err) {
          $('#home-body').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
          return;
        }
      }
      gambarBeranda();
    });
  });

  // Kotak pencarian
  const input = $('#search');
  input.addEventListener('input', () => {
    state.query = input.value;
    $('#btn-clear').hidden = !input.value;
    gambarBeranda();
  });
  $('#btn-clear').addEventListener('click', () => {
    input.value = '';
    state.query = '';
    state.levelFilter = null;
    $('#btn-clear').hidden = true;
    gambarBeranda();
    input.focus();
  });

  // Saringan tingkatan
  $('#filters').addEventListener('click', ev => {
    const chip = ev.target.closest('.chip');
    if (!chip) return;
    state.levelFilter = chip.dataset.level || null;
    gambarBeranda();
  });

  // Klik baris entri dan jejak hierarki
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-code][data-kamus]');
    if (!el || el.disabled) return;
    bukaEntri(el.dataset.kamus, el.dataset.code);
  });

  // Tombol bilah atas
  $('#btn-about').addEventListener('click', () => { location.hash = '#/about'; });
  $('#btn-back').addEventListener('click', () => history.back());
  $('#btn-back-about').addEventListener('click', () => history.back());
  $('#btn-share').addEventListener('click', bagikan);

  window.addEventListener('hashchange', terapkanRute);
}

/* ---------- Mulai ---------- */

async function mulai() {
  pasangPendengar();
  gambarTab();
  tampilkan(location.hash.startsWith('#/d/') ? 'view-detail' : 'view-home');
  gambarBeranda();

  try {
    await muatKamus('KBLI');
  } catch (err) {
    $('#home-body').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    return;
  }
  await terapkanRute();

  // Muat kamus kedua di latar agar perpindahan tab terasa langsung
  muatKamus('KBJI').catch(() => {});
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

mulai();
