// The Semester at Sea scrapbook. Reads data/story.json and lays the voyage
// out as a book of two-page spreads: prints taped to cream pages on land,
// navy pages at sea. Every word on a page comes from the data.

const COUNTRY = {
  US: ['Hello', 'United States', '#3c3b6e'], NL: ['Hallo', 'Nederland', '#21468b'], PT: ['Olá', 'Portugal', '#046a38'],
  ES: ['Hola', 'España', '#aa151b'], MA: ['Salam', 'المغرب', '#c1272d'], GH: ['Akwaaba', 'Ghana', '#006b3f'],
  ZA: ['Sawubona', 'Mzansi', '#007749'], MU: ['Bonzour', 'Moris', '#1a206d'], IN: ['Namaste', 'भारत', '#c8661a'],
  VN: ['Xin chào', 'Việt Nam', '#da251d'], HK: ['Néih hóu', '香港', '#de2910'], TH: ['Sawasdee', 'ประเทศไทย', '#2d2a4a'],
}
const regions = new Intl.DisplayNames(['en'], { type: 'region' })
const countryName = (cc) => ({ HK: 'Hong Kong', US: 'United States' })[cc] || regions.of(cc)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`
const range = (a, b) => (a === b ? day(a) : a.slice(5, 7) === b.slice(5, 7) ? `${day(a)}–${+b.slice(8, 10)}` : `${day(a)} – ${day(b)}`)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const nights = (n) => (n ? `${n} ${n === 1 ? 'night' : 'nights'}` : 'day stop')

// A small repeatable random, so the book looks hand-laid but identical on every visit.
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

// ---------- who came by ----------
// Counts how far a visit got: arrived at the question, opened the book, read
// a quarter, half, three quarters, finished. A personal link (…/sas/?from=ryan)
// adds that name to each count. Nothing is sent from your own Mac.
const who = (() => {
  const given = (new URLSearchParams(location.search).get('from') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24)
  try {
    if (given) localStorage.setItem('sas.from', given)
    return given || localStorage.getItem('sas.from') || ''
  } catch { return given }
})()
const sent = new Set()
function mark(step, tries = 0) {
  if (sent.has(step) || ['localhost', '127.0.0.1'].includes(location.hostname)) return
  if (!window.goatcounter?.count) return tries < 20 && setTimeout(() => mark(step, tries + 1), 500) // the counter loads after the page
  sent.add(step)
  window.goatcounter.count({ path: who ? `${step} (${who})` : step, title: 'Semester at Sea', event: true })
}

// ---------- the lock ----------
// A published copy is encrypted: every file under data/ is AES-256-GCM
// ciphertext, and the key is derived from the answer to one question. The
// answer is never stored in the site. Locally (no data/vault.json) the book
// simply opens.
let vault = null
const urls = new Map()
const MIME = { jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', mov: 'video/quicktime', json: 'application/json' }
const srcAttr = (src, frag = '') => (vault ? `data-enc="data/${esc(src)}" data-frag="${frag}"` : `src="data/${esc(src)}${frag}"`)

// Fetches an encrypted file and returns a private in-memory URL for its
// contents. A copy the browser cached from before the last update will not
// open with today's key, so a failure is tried once more, fresh from the site.
// Only the most recent files are kept in memory, which matters on a phone.
const KEEP = 70
async function open1(path, fresh) {
  const buf = await fetch(`${path}.enc`, fresh ? { cache: 'reload' } : {}).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, vault.key, buf.slice(12))
  return URL.createObjectURL(new Blob([clear], { type: MIME[path.split('.').pop().toLowerCase()] || 'application/octet-stream' }))
}
function plain(path) {
  if (urls.has(path)) {
    const again = urls.get(path)
    urls.delete(path)
    urls.set(path, again) // most recently used goes to the back of the line
    return again
  }
  const made = open1(path).catch(() => open1(path, true))
  made.catch(() => urls.delete(path))
  urls.set(path, made)
  for (const old of [...urls.keys()].slice(0, Math.max(0, urls.size - KEEP))) {
    if (document.querySelector(`[data-path="${CSS.escape(old)}"]`)) continue // still on the page
    urls.get(old).then((u) => URL.revokeObjectURL(u)).catch(() => {})
    urls.delete(old)
  }
  return made
}
function unlockMedia(root) {
  if (!vault) return
  for (const el of root.querySelectorAll('[data-enc]')) {
    const path = el.dataset.enc
    el.removeAttribute('data-enc')
    el.dataset.path = path
    plain(path).then((u) => (el.src = u + (el.dataset.frag || ''))).catch(() => {})
  }
}
async function deriveKey(answer, info) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(answer.trim().toLowerCase()), 'PBKDF2', false, ['deriveKey'])
  const salt = Uint8Array.from(atob(info.salt), (c) => c.charCodeAt(0))
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: info.iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
}
async function tryAnswer(answer, info) {
  const key = await deriveKey(answer, info)
  const check = Uint8Array.from(atob(info.check), (c) => c.charCodeAt(0))
  await crypto.subtle.decrypt({ name: 'AES-GCM', iv: check.slice(0, 12) }, key, check.slice(12)) // throws if the answer is wrong
  vault = { key }
}
async function unlock() {
  const info = await fetch('data/vault.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  if (!info) return
  mark('arrived')
  const saved = localStorage.getItem('sas.answer')
  if (saved) try { return (await tryAnswer(saved, info), mark('opened')) } catch { localStorage.removeItem('sas.answer') }
  const gate = document.getElementById('gate')
  gate.hidden = false
  gate.querySelector('input').focus()
  await new Promise((done) => {
    gate.querySelector('form').onsubmit = async (e) => {
      e.preventDefault()
      const answer = gate.querySelector('input').value
      try {
        await tryAnswer(answer, info)
        localStorage.setItem('sas.answer', answer.trim().toLowerCase())
        gate.hidden = true
        mark('opened')
        done()
      } catch {
        gate.querySelector('.wrong').textContent = 'Not quite. Try again.'
        gate.querySelector('input').select()
      }
    }
  })
}

// ---------- maps: land outlines from the bundled country shapes ----------
let land = []
function loadLand(topo) {
  const { scale, translate } = topo.transform
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0
    return arc.map(([dx, dy]) => [(x += dx) * scale[0] + translate[0], (y += dy) * scale[1] + translate[1]])
  })
  const ring = (ids) => ids.flatMap((i, n) => {
    const a = i < 0 ? [...arcs[~i]].reverse() : arcs[i]
    return n ? a.slice(1) : a
  })
  for (const g of topo.objects.countries.geometries) {
    for (const poly of g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []) {
      const r = ring(poly[0])
      const xs = r.map((p) => p[0]), ys = r.map((p) => p[1])
      // Rings that wrap the date line would draw a stripe across the whole map.
      if (Math.max(...xs) - Math.min(...xs) < 170) land.push({ r, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] })
    }
  }
}

function mapSvg({ box, legs, dots = [], width = 400, cls = '' }) {
  let [x0, y0, x1, y1] = box
  const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180)
  const height = Math.round((width * (y1 - y0)) / ((x1 - x0) * k))
  const px = (lng) => (((lng - x0) / (x1 - x0)) * width).toFixed(1)
  const py = (lat) => (((y1 - lat) / (y1 - y0)) * height).toFixed(1)
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${px(p[0])} ${py(p[1])}`).join('')
  const shore = land.filter((l) => l.box[2] > x0 && l.box[0] < x1 && l.box[3] > y0 && l.box[1] < y1).map((l) => path(l.r) + 'Z').join('')
  const routes = legs.map((l) => `<path class="leg ${l.type}" d="${path(l.coords)}"/>`).join('')
  const marks = dots.map((d) => `<circle class="dot${d.main ? ' main' : ''}" cx="${px(d.lng)}" cy="${py(d.lat)}" r="${d.main ? 4.5 : 3}"/>${d.label ? `<text x="${+px(d.lng) + (d.dx ?? (d.left ? -8 : 8))}" y="${+py(d.lat) + (d.dy ?? 4)}" ${d.left ? 'text-anchor="end"' : ''}>${esc(d.label)}</text>` : ''}`).join('')
  return `<svg class="map ${cls}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Route map"><path class="land" d="${shore}"/>${routes}${marks}</svg>`
}

function stamp(cc, port, date) {
  const [, native, ink] = COUNTRY[cc] || ['', '', '#333']
  const tilt = (hash(cc) % 15) - 7
  return `<svg class="stamp" viewBox="0 0 140 140" style="color:${ink};transform:rotate(${tilt}deg)" role="img" aria-label="${esc(countryName(cc))} stamp">
    <defs><path id="arc-${cc}" d="M 22 70 A 48 48 0 0 1 118 70"/></defs>
    <g fill="none" stroke="currentColor"><circle cx="70" cy="70" r="62" stroke-width="3"/><circle cx="70" cy="70" r="55" stroke-width="1"/></g>
    <g fill="currentColor" text-anchor="middle">
      <text class="s-en"><textPath href="#arc-${cc}" startOffset="50%">${esc(countryName(cc).toUpperCase())}</textPath></text>
      <text class="s-native" x="70" y="78" style="font-size:${native.length > 9 ? 15 : 23}px">${esc(native)}</text>
      <text class="s-port" x="70" y="98">${esc((port || '').toUpperCase())}</text>
      <text class="s-date" x="70" y="112">${esc(`${day(date)} ${date.slice(0, 4)}`.toUpperCase())}</text>
    </g></svg>`
}

// ---------- laying prints on a page ----------
const PAGE = 0.74 // page width / page height
const ratio = (m) => (m.w && m.h ? m.w / m.h : m.kind === 'video' ? 0.5625 : 1.33)
const PAD = 2.6, STRIP = 3.4, GX = 2.6, GY = 2.4 // frame, date strip and gaps, in percent of the page

// Extra height a print needs under the picture for a caption, in percent of the page.
function extra(m, w) {
  const words = (m.caption || '').length * 1.8 + (m.said ? m.said.text.length * 1.65 + 50 : 0)
  return words ? Math.ceil(words / Math.max(8, w - PAD)) * 3.7 + 1 : 0
}

// Every way of cutting a run of n prints into rows.
function cuts(n) {
  if (!n) return [[]]
  const out = []
  for (let k = 1; k <= Math.min(n, 3); k++) for (const rest of cuts(n - k)) out.push([k, ...rest])
  return out
}

// Prints fill the page the way they would on a real one: rows of equal
// height, or one tall print with the others stacked beside it. Each
// arrangement is tried and the one that shows the pictures largest wins.
// Returns [x, y, w, h] per print, in percent of the page.
function arrange(items, [X, Y, W, H]) {
  const ar = items.map(ratio)
  const weight = items.map((m) => (m.big ? 3 : m.small ? 0.3 : 1))
  const tries = []
  const score = (boxes) => {
    const area = boxes.map(([, , w, , ih], i) => ((w - PAD) * ih) / PAGE)
    const even = area.filter((_, i) => weight[i] === 1)
    const fair = even.length ? Math.min(...even) / (even.reduce((a, b) => a + b, 0) / even.length) : 1
    return area.reduce((sum, a, i) => sum + a * weight[i], 0) * Math.sqrt(fair)
  }
  for (const cut of cuts(items.length)) {
    let i = 0
    const rows = cut.map((k) => Array.from({ length: k }, () => i++))
    let scale = 1, boxes
    for (let pass = 0; pass < 3; pass++) {
      const laid = rows.map((row) => {
        const ih = (((W - GX * (row.length - 1) - PAD * row.length) * PAGE) / row.reduce((s, j) => s + ar[j], 0)) * scale
        const ws = row.map((j) => (ih * ar[j]) / PAGE + PAD)
        return { row, ih, ws, cap: STRIP + Math.max(...row.map((j, n) => extra(items[j], ws[n]))) }
      })
      const fixed = laid.reduce((s, r) => s + r.cap, 0) + GY * (rows.length - 1)
      const pics = laid.reduce((s, r) => s + r.ih, 0)
      if (fixed + pics > H) scale *= Math.max(0.05, (H - fixed) / pics)
      let y = Y + Math.max(0, H - fixed - Math.min(pics, H - fixed)) / 2
      boxes = []
      for (const r of laid) {
        const ih = Math.min(r.ih, r.ih * (fixed + pics > H ? (H - fixed) / pics : 1))
        const ws = r.row.map((j) => (ih * ar[j]) / PAGE + PAD)
        let x = X + (W - ws.reduce((a, b) => a + b, 0) - GX * (r.row.length - 1)) / 2
        for (const [n, j] of r.row.entries()) (boxes[j] = [x, y, ws[n], ih + r.cap, ih]), (x += ws[n] + GX)
        y += ih + r.cap + GY
      }
    }
    if (boxes.every((b) => b[4] > 6)) tries.push(boxes)
  }
  // One print the full height, the rest in a column beside it.
  if (items.length > 1 && items.length < 5) {
    for (const lead of new Set([0, items.length - 1, Math.max(0, items.findIndex((m) => m.big))])) {
      const rest = items.map((_, j) => j).filter((j) => j !== lead)
      const k = rest.length
      const S = rest.reduce((s, j) => s + 1 / ar[j], 0)
      const caps = rest.reduce((s, j) => s + STRIP + extra(items[j], W * 0.4), 0)
      const capLead = STRIP + extra(items[lead], W * 0.55)
      const c = caps - capLead + GY * (k - 1)
      let ih = Math.min(H - capLead, (W - 2 * PAD - GX + c / (PAGE * S)) / (ar[lead] / PAGE + 1 / (PAGE * S)))
      const wc = PAD + (ih - c) / (PAGE * S)
      if (wc < PAD + 8 || ih < 10) continue
      const wl = (ih * ar[lead]) / PAGE + PAD
      const left = lead <= rest[0]
      const x0 = X + (W - wl - GX - wc) / 2, y0 = Y + (H - ih - capLead) / 2
      const boxes = []
      boxes[lead] = [left ? x0 : x0 + wc + GX, y0, wl, ih + capLead, ih]
      let y = y0
      for (const j of rest) {
        const h = ((wc - PAD) * PAGE) / ar[j]
        const cap = STRIP + extra(items[j], W * 0.4)
        boxes[j] = [left ? x0 + wl + GX : x0, y, wc, h + cap, h]
        y += h + cap + GY
      }
      tries.push(boxes)
    }
  }
  return tries.reduce((best, b) => (score(b) > score(best) ? b : best))
}

const quote = (m) => (m.said ? `<q>${esc(m.said.text)}</q><small>Text home · ${day(m.said.date)}</small>` : '')
function prints(items, area, seed, list) {
  const rnd = seeded(seed)
  const boxes = arrange(items, area)
  return items.map((m, i) => {
    const [left, top, w] = boxes[i]
    const ar = ratio(m)
    const tilt = (rnd() * 3 - 1.5).toFixed(2)
    const tape = rnd() > 0.45 ? `<i class="tape" style="left:${(10 + rnd() * 50).toFixed(0)}%;transform:rotate(${(rnd() * 12 - 6).toFixed(1)}deg)"></i>` : ''
    const inner = m.kind === 'video'
      ? `<div class="clip"><video ${srcAttr(m.src, '#t=0.6')} muted loop playsinline preload="metadata" style="aspect-ratio:${ar}"></video><b class="sound" aria-hidden="true">Tap for sound</b><b class="playmark" aria-hidden="true"></b></div>`
      : `<img ${srcAttr(m.src)} alt="${esc(m.caption || `Photograph, ${day(m.d || m.t)}`)}" decoding="async" style="aspect-ratio:${ar}">`
    const words = m.caption || m.said ? `<span class="says">${m.caption ? esc(m.caption) : ''}${quote(m)}</span>` : ''
    return `<figure class="print${m.solo ? ' solo' : ''}${m.lead ? ' lead' : ''}" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;width:${w.toFixed(2)}%;transform:rotate(${tilt}deg)" data-list="${list}" data-src="${esc(m.src)}" tabindex="0" role="button" aria-label="Open ${m.kind}, ${day(m.d || m.t)}">${tape}${inner}<figcaption>${words}<time>${day(m.d || m.t)}</time></figcaption></figure>`
  }).join('')
}

// One photograph across the whole page, edge to edge.
const bleed = (m, list) => `<figure class="print full" data-list="${list}" data-src="${esc(m.src)}" tabindex="0" role="button" aria-label="Open photograph, ${day(m.d || m.t)}"><img ${srcAttr(m.src)} alt="Photograph, ${day(m.d || m.t)}"><figcaption><time>${day(m.d || m.t)}</time></figcaption></figure>`

// The same shot can arrive through two albums; keep one. Also drop burst duplicates.
const unique = (items) => items.filter((m, i) => !m.dupOf && !items.slice(0, i).some((o) => Math.abs(Date.parse(o.t) - Date.parse(m.t)) < 2500 && o.kind === m.kind))
const inOrder = (x) => unique([...x.media].sort((a, b) => (a.t < b.t ? -1 : 1)))

// Prints are dealt out evenly, three or so to a page, so no page is crowded
// while the one facing it is nearly bare. `first` is how many share the
// opening page with the heading; `odd` asks for an odd or even page count.
function spread(items, k) {
  const out = []
  for (let p = 0, i = 0; p < k; p++) out.push(items.slice(i, (i += Math.round((items.length - i) / (k - p)))))
  return out.filter((c) => c.length)
}
function chunks(items, first, odd) {
  const lead = first ? [items.slice(0, first)] : []
  const rest = items.slice(first)
  if (!rest.length) return lead
  let k = Math.max(Math.ceil(rest.length / 4), Math.round(rest.length / 3))
  if (odd !== undefined && ((lead.length + k) % 2 === 1) !== odd) {
    if (k + 1 <= rest.length && rest.length / (k + 1) >= 1.5) k++
    else if (k > 1 && rest.length / (k - 1) <= 4) k--
    else if (k + 1 <= rest.length) k++
  }
  return [...lead, ...spread(rest, k)]
}

// A print the reader asked to see on its own gets a page to itself; the rest are dealt out around it.
function pagesOf(items, first, odd) {
  if (!items.some((m) => m.solo)) return chunks(items, first, odd)
  const out = []
  let run = []
  const flush = () => (run.length && out.push(...chunks(run, out.length ? 0 : Math.min(first, run.length))), (run = []))
  for (const m of items) m.solo ? (flush(), out.push([m])) : run.push(m)
  flush()
  return out
}
const midTime = (part) => part.reduce((sum, m) => sum + Date.parse(m.t), 0) / part.length

// Slips, texts home and notes are shared out across a section's pages, each
// on the page whose photographs are closest to it in time, at most two to a
// page (one on a crowded opening page). What will not fit is returned as `over`.
function place(words, times, crowded) {
  const n = times.length
  const per = times.map(() => [])
  const over = []
  const cap = (j) => (j === 0 && crowded ? 1 : 2)
  for (const w of words) {
    const order = w.page === 'first' ? [0] : w.page === 'last' ? [n - 1]
      : [...times.keys()].sort((a, c) => (w.t === undefined ? per[a].length - per[c].length || (a === 0) - (c === 0) : Math.abs(times[a] - w.t) - Math.abs(times[c] - w.t)))
    const page = order.find((j) => per[j].length < cap(j) || w.page)
    page === undefined ? over.push(w) : per[page].push(w)
  }
  return { per, over }
}
// Laid out off-stage at the size of a real page, to learn how tall a heading or a footer really is (in percent of the page).
const rig = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'page', innerHTML: '<div class="sheet"></div>' }))
rig.style.cssText = 'position:absolute;left:-9999px;top:0;width:740px;height:1000px;visibility:hidden'
function measure(html, sel, sea) {
  rig.className = `page${sea ? ' sea' : ''}`
  rig.firstChild.innerHTML = html
  const r = rig.querySelector(sel)?.getBoundingClientRect(), o = rig.getBoundingClientRect()
  return r ? { top: (r.top - o.top) / 10, bottom: (r.bottom - o.top) / 10, height: r.height / 10 } : { top: 0, bottom: 0, height: 0 }
}
// Room to leave at the foot of a page for its words.
const foot = (list = [], sea) => (list.length ? measure(footer(list), '.words', sea).height + 11 : 5)
const footer = (list = []) => (list.length ? `<footer class="words${list.length > 1 ? '' : ' one'}">${list.map((w) => w.html).join('')}</footer>` : '')
const afterHtml = (a) => `<div class="after"><p class="over">${esc(a.over)}</p><blockquote>${esc(a.text)}</blockquote>${a.by ? `<p class="by">${esc(a.by)}</p>` : ''}</div>`

// ---------- the book ----------
let story, pages = [], lists = {}, memories = [], messages = []

function notesFor(key, photo, from, to) {
  const mine = memories.filter((m) => m.stop === key && !m.chapter && (photo === undefined ? !m.photo : m.photo === photo) && !m.used && (!from || !m.date || (m.date >= from && m.date <= to))).slice(0, 1)
  for (const m of mine) m.used = true // a note is pasted in once, even if the ship called at the same city twice
  return mine.map((m) => ({ kind: 'hand', page: m.page, t: m.t ? Date.parse(m.t) : m.date ? Date.parse(`${m.date}T12:00:00Z`) : undefined, html: `<p class="hand" style="transform:rotate(${(hash(m.text) % 5) - 2}deg)">${esc(m.text)}</p>` }))
}

function miniMap(stop, trip) {
  const span = 1.6
  const box = [stop.lng - span * 1.5, stop.lat - span, stop.lng + span * 1.5, stop.lat + span]
  const legs = trip.legs.filter((l) => l.coords.some((c) => c[0] > box[0] && c[0] < box[2] && c[1] > box[1] && c[1] < box[3]))
  return `<div class="pasted mini" style="transform:rotate(${(hash(stop.key + stop.arrive) % 7) - 3}deg)">${mapSvg({ box, legs, dots: [{ ...stop, main: true }], width: 240 })}</div>`
}

function bigMap(stop, trip) {
  const box = [stop.lng - 4.2, stop.lat - 3.4, stop.lng + 4.2, stop.lat + 3.4]
  const legs = trip.legs.filter((l) => l.coords.some((c) => c[0] > box[0] && c[0] < box[2] && c[1] > box[1] && c[1] < box[3]))
  return `<div class="pasted placemap" style="transform:rotate(${(hash(stop.key) % 5) - 2}deg)">${mapSvg({ box, legs, dots: [{ ...stop, main: true, label: stop.name }], width: 420 })}</div>`
}

// The page facing the start of a sea passage: where the ship is about to go.
function crossing(sea, trip) {
  const legs = trip.legs.filter((l) => l.t1 > sea.from - 36e5 && l.t0 < sea.to + 36e5 && l.type !== 'ground' && l.type !== 'hop')
  const pts = legs.flatMap((l) => l.coords)
  if (!pts.length) return { kind: 'filler', html: `<div class="wake" aria-hidden="true"></div>` }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const pad = Math.max(3, (Math.max(...xs) - Math.min(...xs)) * 0.18, (Math.max(...ys) - Math.min(...ys)) * 0.18)
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
  const ends = [pts[0], pts.at(-1)].map((p, i) => ({ lng: p[0], lat: p[1], main: i === 1 }))
  const days = Math.max(1, Math.floor((sea.to - sea.from) / 864e5))
  return { kind: 'crossing', html: `<p class="over">Setting out · ${day(new Date(sea.from).toISOString())}</p><div class="pasted seamap" style="transform:rotate(${(hash(sea.title + sea.from) % 5) - 2}deg)">${mapSvg({ box, legs, dots: ends, width: 420 })}</div><p class="cap">${days} ${days === 1 ? 'day' : 'days'} to the next port</p>` }
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10)

const logged = new Set()
// A calendar entry is pasted in once, at the first place whose dates cover it.
const fresh = (log) => (log || []).filter((e) => !logged.has(e.date + e.title) && logged.add(e.date + e.title))
function slips(log) {
  return (log || []).slice(0, 4).map((e, i) => `<li style="transform:rotate(${((hash(e.title) + i) % 5) - 2}deg)"><b>${day(e.date)}</b>${esc(e.title)}</li>`).join('')
}

function build() {
  const trip = story.trip
  const add = (p) => pages.push(p)
  // Whether the next page falls on the right of a spread (the phone-only map page does not count).
  const odd = () => pages.filter((p) => p.only !== 'single').length % 2
  const ccs = trip.label.ccs

  add({ kind: 'endpaper', sea: true, html: `<div class="waves" aria-hidden="true"></div>` })
  add({
    kind: 'cover', id: 'cover', title: 'Cover',
    html: `<div class="coverin"><p class="over">Voyage 136 · Fall 2025</p><h1>Semester<br>at Sea</h1><p class="ship">MV World Odyssey</p>
      <p class="dates">${day(trip.label.start)} – ${day(trip.label.end)}, 2025</p>
      <p class="tally">${trip.label.nDays} days · ${ccs.length} countries · ${Math.round(trip.seaDays)} days at sea</p><p class="by">Olli Mulchandani</p></div>`,
  })

  const firstOf = (cc) => trip.stops.find((s) => s.cc === cc)
  add({
    kind: 'contents', id: 'route', title: 'The route',
    html: `<h2 class="head">The route</h2><ol class="toc">${ccs.map((cc) => {
      return `<li><a href="#${cc}"><span class="n">${esc(COUNTRY[cc]?.[1] || '')}</span><span class="c">${esc(countryName(cc))}</span><span class="d">${range(...inPort(cc))}</span></a></li>`
    }).join('')}</ol>`,
  })
  // In port from arrival until the ship sailed, which is when the next sea passage begins.
  function inPort(cc) {
    const mine = trip.stops.filter((s) => s.cc === cc)
    const sailed = trip.interludes.find((i) => i.from > mine.at(-1).t0)
    const from = mine[0].arrive < trip.label.start ? trip.label.start : mine[0].arrive
    return [from, sailed ? iso(sailed.from) : trip.label.end]
  }
  const ports = ccs.map((cc) => firstOf(cc))
  const miles = Math.round((trip.label.km * 0.621) / 100) * 100
  add({
    kind: 'numbers',
    html: `<dl class="figures"><div><dt>${trip.label.nDays}</dt><dd>days</dd></div><div><dt>${ccs.length}</dt><dd>countries</dd></div><div><dt>${Math.round(trip.seaDays)}</dt><dd>days at sea</dd></div><div><dt>${miles.toLocaleString('en-US')}</dt><dd>miles</dd></div></dl>`,
  })
  // The whole voyage across one spread: Semester at Sea's own map for the
  // voyage, pasted in like the poster it was. It shows the plan as published,
  // with Nantes, which became Porto.
  const poster = `<figure class="poster"><i class="tape" style="left:8%;transform:rotate(-4deg)"></i><i class="tape" style="left:78%;transform:rotate(3deg)"></i><img ${srcAttr('voyage-map.jpg')} alt="Semester at Sea's map of the Fall 2025 voyage, from IJmuiden to Bangkok"></figure><p class="maptitle">The plan, as published<span>Nantes became Porto · map by Semester at Sea</span></p>`
  // On a spread it is two ordinary pages, each showing its half, so it turns like any other.
  add({ kind: 'routemap half', only: 'spread', id: 'map', title: 'Map', html: `<div class="across">${poster}</div>` })
  add({ kind: 'routemap half', only: 'spread', html: `<div class="across">${poster}</div>` })
  add({ kind: 'routemap', wide: true, only: 'single', id: 'map', title: 'Map', html: poster })

  // Stops and sea passages, in the order they happened.
  const beats = [...trip.stops.map((s) => ({ t: s.t0, stop: s })), ...trip.interludes.map((s) => ({ t: s.from, sea: s }))].sort((a, b) => a.t - b.t)
  const been = new Set()
  const live = []
  for (const b of beats) {
    b.items = inOrder(b.stop || b.sea)
    // Back at a port already seen, with nothing photographed: the ship was only waiting to sail.
    if (b.stop && !b.items.length && been.has(b.stop.key)) continue
    if (b.stop) been.add(b.stop.key)
    Object.assign(b, { t0: b.stop ? b.stop.t0 : b.sea.from, t1: b.stop ? b.stop.t1 : b.sea.to, words: [] })
    live.push(b)
  }
  // Dates are shown as they were where you stood: the port's clock on land, the next port's at sea.
  for (const [i, b] of live.entries()) {
    b.off = b.stop ? b.stop.off : live.slice(i + 1).find((n) => n.stop)?.stop.off ?? 0
    for (const m of b.items) m.d = new Date(Date.parse(m.t) + b.off * 6e4).toISOString()
  }
  // Each text home goes to the place you were when you sent it.
  for (const m of messages) {
    if (m.photo) continue
    const sent = m.t ? Date.parse(m.t) : Date.parse(`${m.date}T12:00:00Z`)
    const t = m.show ? Date.parse(`${m.show}T12:00:00Z`) : sent
    const gap = (b) => (t < b.t0 ? b.t0 - t : t > b.t1 ? t - b.t1 : 0)
    const home = (m.stop && live.findLast((b) => b.stop?.key === m.stop)) || live.reduce((best, b) => (gap(b) < gap(best) ? b : best))
    const on = m.t ? new Date(sent + home.off * 6e4).toISOString() : m.date
    home.words.push({ kind: 'text', t, page: m.page, html: `<blockquote class="texthome" style="transform:rotate(${(hash(m.text) % 5) - 2}deg)"><b>Text home · ${day(on)}${m.label ? ` · ${esc(m.label)}` : ''}</b>${esc(m.text)}</blockquote>` })
  }
  const noteTime = (w, m) => ({ ...w, page: m.page, t: m.t ? Date.parse(m.t) : m.date ? Date.parse(`${m.date}T12:00:00Z`) : undefined })

  for (const b of live) {
    const { stop, sea, items } = b
    if (sea) {
      if (odd()) add(crossing(sea, trip))
      const key = sea.title + sea.from
      lists[key] = items
      const days = Math.max(1, Math.floor((sea.to - sea.from) / 864e5))
      const parts = pagesOf(items, 0, true) // an odd number of print pages, so the passage ends on a full spread
      const words = [...b.words, ...notesFor(sea.title)].sort((p, q) => (p.t ?? 0) - (q.t ?? 0))
      const opening = parts.length ? words.filter((w) => w.page === 'open') : words.slice(0, 3)
      const { per, over } = place(words.filter((w) => !opening.includes(w)), parts.map(midTime), false)
      add({
        kind: 'sea-open', sea: true, id: 'sea-' + pages.length, title: sea.title,
        html: `<p class="over">At sea · ${day(new Date(sea.from).toISOString())} – ${day(new Date(sea.to).toISOString())}</p><h2 class="seatitle">${esc(sea.title)}</h2>
          <p class="count"><b>${days}</b> ${days === 1 ? 'day' : 'days'} of open water</p><p class="lede">${esc(sea.text)}</p>
          <ul class="slips">${slips(fresh(sea.log))}</ul>${opening.map((w) => w.html).join('')}`,
      })
      for (const [n, part] of parts.entries()) add({ kind: 'prints', sea: true, label: sea.title, html: prints(part, [5, 5, 90, 95 - foot(per[n], true) - 5], hash(key) + n, key) + footer(per[n]) })
      if (over.length) add({ kind: 'notes', sea: true, label: sea.title, html: `<div class="wordspage">${over.map((w) => w.html).join('')}</div>` })
      if (odd()) add({ kind: 'filler', sea: true, html: `<div class="waves" aria-hidden="true"></div>` })
      continue
    }
    const key = stop.key + stop.arrive
    lists[key] = items
    const opens = stop.opens
    // The last stretch of a stop can be set apart under its own title, with the calendar entries that belong to it.
    const sections = (stop.sections || []).map((s, i, all) => ({ ...s, items: items.filter((m) => m.t >= s.from && (!all[i + 1] || m.t < all[i + 1].from)) })).filter((s) => s.items.length)
    const all = fresh(stop.log)
    for (const s of sections) s.log = s.slips ? all.filter((e) => new RegExp(s.slips).test(e.title)) : []
    const log = all.filter((e) => !sections.some((s) => s.log.includes(e)))
    const head = `<header class="stophead"><p class="over">${esc(countryName(stop.cc))}${stop.title ? ` · ${esc(stop.name)}` : ''} · ${[[stop.arrive, stop.depart], ...(stop.again || [])].map((r) => range(...r)).join(' & ')} · ${nights(stop.nights)}</p><h2>${esc(stop.title || stop.name)}</h2>
      ${stop.fact ? `<p class="margin">${esc(stop.fact)}</p>` : ''}${log.length ? `<ul class="slips row">${slips(log.slice(0, 2))}</ul>` : ''}</header>${miniMap(stop, trip)}`
    if (opens) {
      const [hello, native] = COUNTRY[stop.cc] || ['', '']
      const said = memories.filter((m) => m.chapter === stop.cc).map((m) => `<p class="hand">${esc(m.text)}</p>`).join('')
      add({
        kind: 'chapter', id: stop.cc, title: countryName(stop.cc),
        html: `<p class="over">Port of call · ${esc(stop.port || stop.name)}</p><h2 class="chapter">${esc(hello)},<br>${esc(countryName(stop.cc))}</h2><p class="native" lang="und">${esc(native)}</p>
          ${opens.text ? `<p class="lede">${esc(opens.text)}</p>` : ''}${said}${stamp(stop.cc, (stop.port || stop.name).split(' & ')[0], stop.arrive)}`,
      })
    }
    const words = [
      ...log.slice(2, 4).map((e) => ({ kind: 'slip', t: Date.parse(`${e.date}T12:00:00Z`), html: `<ul class="slips">${slips([e])}</ul>` })),
      ...b.words, ...notesFor(stop.key, undefined, stop.arrive, (stop.again || []).at(-1)?.[1] || stop.depart),
    ].sort((p, q) => (p.t ?? 0) - (q.t ?? 0))
    // The prints start below the heading, however many lines it runs to.
    const top = Math.max(measure(head, '.stophead').bottom, measure(head, '.mini').bottom) + 3
    const body = sections.length ? items.filter((m) => m.t < sections[0].from) : items
    // A titled section opens on a left-hand page, so its pages face each other.
    const parts = pagesOf(body, body.length ? Math.min(body.length > 4 ? 3 : 2, body.length) : 0, sections.length ? odd() === 1 : undefined)
    // The words are shared out over the stop's pages, each beside the photographs from its own day.
    const { per, over } = place(words, parts.length ? parts.map(midTime) : [stop.t0], parts.length > 1)
    // Nothing photographed here: the page becomes a map of the place instead.
    if (!parts.length) add({ kind: 'stop', html: head.replace(/<div class="pasted mini"[\s\S]*$/, '') + bigMap(stop, trip) + footer(per[0]) })
    for (const [n, part] of parts.entries()) {
      add(n === 0
        ? { kind: 'stop', label: stop.name, html: head + prints(part, [5, top, 90, 100 - foot(per[0]) - top], hash(key), key) + footer(per[0]) }
        : { kind: 'prints', label: stop.name, html: prints(part, [5, 5, 90, 95 - foot(per[n]) - 5], hash(key) + n, key) + footer(per[n]) })
    }
    if (over.length) add({ kind: 'notes', label: stop.name, html: `<div class="wordspage">${over.map((w) => w.html).join('')}</div>` })
    for (const sec of sections) {
      const flat = sec.items.filter((m) => !m.bleed)
      for (const [n, part] of spread(flat, Math.ceil(flat.length / 3)).entries()) {
        const lead = n ? '' : `<h3 class="sectitle">${esc(sec.title)}</h3>${sec.log.length ? `<ul class="slips secslips">${slips(sec.log)}</ul>` : ''}`
        add({ kind: 'prints feature', label: sec.title, html: lead + prints(part, n ? [6, 6, 88, 87] : [6, sec.log.length ? 25 : 17, 88, sec.log.length ? 69 : 76], hash(key + sec.title) + n, key) })
      }
      for (const m of sec.items.filter((m) => m.bleed)) add({ kind: 'bleed', label: sec.title, html: bleed(m, key) })
    }
  }

  if (trip.afterword) add({ kind: 'afterword', html: afterHtml(trip.afterword) })
  // With a note from the editor, the closing pages simply follow one another.
  if (odd() && !trip.afterword) add({ kind: 'filler', html: `<div class="wake" aria-hidden="true"></div>` })
  if (trip.ending) {
    add({ kind: 'ending', id: 'end', title: trip.ending.title, html: `<h2 class="head">${esc(trip.ending.title)}</h2><ol class="takeaways">${trip.ending.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` })
  }
  add({ kind: 'stamps', html: `<div class="stampsheet">${ccs.map((cc) => stamp(cc, (firstOf(cc).port || firstOf(cc).name).split(' & ')[0], firstOf(cc).arrive)).join('')}</div><p class="cap">${day(trip.label.start)} – ${day(trip.label.end)}, 2025</p>` })
  if (odd()) add({ kind: 'endpaper', sea: true, html: `<div class="waves" aria-hidden="true"></div>` })
}

// ---------- turning pages ----------
const book = document.getElementById('book')
const narrow = () => window.innerWidth < 820
let at = 0, playing = null

const step = () => (narrow() ? 1 : 2)
const shown = () => pages.filter((p) => !(narrow() && ['filler', 'endpaper'].includes(p.kind)) && p.only !== (narrow() ? 'spread' : 'single'))

function render(dir = 0, quick = false) {
  const list = shown()
  at = Math.max(0, Math.min(at - (at % step()), Math.floor((list.length - 1) / step()) * step()))
  const view = list.slice(at, at + step())
  const old = dir && !narrow() ? [...book.querySelectorAll(':scope > .page:not(.ghost)')] : []
  book.className = `book${narrow() ? ' single' : ''}`
  book.innerHTML = view.map((p, i) => `<section class="page ${p.kind}${p.sea ? ' sea' : ''}${p.wide ? ' wide' : ''} ${narrow() || p.wide ? '' : i ? 'right' : 'left'}"${p.id ? ` id="${p.id}"` : ''}><div class="sheet">${p.html}</div><span class="folio">${list.indexOf(p) + 1}</span></section>`).join('')
  document.getElementById('count').textContent = `${Math.floor(at / step()) + 1} / ${Math.ceil(list.length / step())}`
  document.getElementById('prev').disabled = at === 0
  document.getElementById('next').textContent = at + step() >= list.length ? 'Close the book' : 'Turn →'
  history.replaceState(null, '', `#p${at}`)
  const far = (at + step()) / list.length
  for (const [share, name] of [[0.25, 'read a quarter'], [0.5, 'read half'], [0.75, 'read three quarters'], [1, 'finished']]) if (dir && far >= share) mark(name)
  const tabs = document.querySelectorAll('#tabs a')
  let current = null
  for (const [i, p] of list.entries()) if (i <= at + step() - 1 && p.id && p.kind === 'chapter') current = p.id
  tabs.forEach((a) => a.classList.toggle('on', a.dataset.id === current))
  unlockMedia(book)
  // Two ordinary pages turning to two ordinary pages: lift the leaf over. Anything else simply fades in.
  const now = [...book.querySelectorAll(':scope > .page')]
  const plainSpread = (set) => set.length === 2 && !set.some((el) => el.classList.contains('wide'))
  // Leafing through quickly, the pages simply change: an animation per turn would pile up.
  if (quick) dir = 0
  else if (plainSpread(old) && plainSpread(now) && !matchMedia('(prefers-reduced-motion: reduce)').matches) flip(old, now, dir)
  else if (dir) book.classList.add(dir > 0 ? 'fwd' : 'back')
  // Only one video moves on a spread, so the still photographs can be looked at; the rest play while pointed at.
  const clips = now.flatMap((pg) => [...pg.querySelectorAll('video')])
  const main = clips.find((v) => v.closest('.lead')) || clips.find((v) => v.closest('.solo')) // a video given its own page is the one that plays
  if (main) clips.unshift(...clips.splice(clips.indexOf(main), 1))
  for (const [i, v] of clips.entries()) {
    if (!i) (v.autoplay = true), v.play?.().catch(() => {})
    else (v.closest('.print').onmouseenter = () => v.play().catch(() => {})), (v.closest('.print').onmouseleave = () => v.pause())
    v.closest('.print').classList.toggle('still', !!i)
  }
  if (DRAFT) (decorate(), paintDraft())
  warm(list)
}
// While a spread is being looked at, the pictures for the next two spreads
// (and the one before) are fetched quietly, one at a time, so they are ready
// by the time the page turns. Turning again drops whatever was still queued.
let warming = 0
async function warm(list) {
  const mine = ++warming
  const ahead = [...list.slice(at + step(), at + step() * 3), ...list.slice(Math.max(0, at - step()), at)]
  const files = ahead.flatMap((p) => [...(p.html || '').matchAll(/<img (?:src|data-enc)="([^"]+)"/g)].map((m) => m[1]))
  for (const f of files) {
    if (mine !== warming) return
    await (vault ? plain(f).catch(() => {}) : new Promise((done) => Object.assign(new Image(), { onload: done, onerror: done, src: f })))
  }
}
// Turning a page in two halves, the way a real leaf goes: the page being left
// swings up to the spine and out of sight, then the page arrived at swings
// down from the spine. Only pages already drawn are moved, never copies, so
// nothing has to be redrawn mid-turn.
function flip([oldL, oldR], [newL, newR], dir) {
  const fwd = dir > 0
  const still = fwd ? oldL : oldR, leaving = fwd ? oldR : oldL, arriving = fwd ? newL : newR
  for (const el of [still, leaving]) {
    el.removeAttribute('id')
    el.classList.add('ghost')
    el.querySelectorAll('.edit').forEach((x) => x.remove())
    for (const v of el.querySelectorAll('video')) v.pause()
  }
  still.classList.add(fwd ? 'at-left' : 'at-right')
  leaving.classList.add(fwd ? 'at-right' : 'at-left', fwd ? 'out-fwd' : 'out-back')
  arriving.classList.add(fwd ? 'in-fwd' : 'in-back')
  book.append(still, leaving)
  setTimeout(() => (still.remove(), leaving.remove(), arriving.classList.remove('in-fwd', 'in-back')), 800)
}
let lastTurn = 0
const turn = (dir) => {
  const before = at
  const quick = performance.now() - lastTurn < 850
  lastTurn = performance.now()
  // Past the last page the book closes, back to its cover.
  const closing = dir > 0 && at + step() >= shown().length
  at = closing ? 0 : at + dir * step()
  render(dir, quick)
  if ((at === before || closing) && playing) togglePlay()
}
function goTo(id) {
  const i = shown().findIndex((p) => p.id === id)
  if (i >= 0) {
    at = i
    render(1)
  }
}
function togglePlay() {
  playing = playing ? (clearInterval(playing), null) : setInterval(() => turn(1), 7000)
  document.getElementById('play').textContent = playing ? 'Pause' : 'Play'
  document.body.classList.toggle('playing', !!playing)
}

// ---------- looking at one print up close ----------
const box = document.getElementById('lightbox')
let open = null
function show(list, i) {
  open = { list, i }
  const m = lists[list][i]
  box.hidden = false
  box.querySelector('.stage').innerHTML = m.kind === 'video'
    ? `<video ${srcAttr(m.src)} controls autoplay playsinline></video>`
    : `<img ${srcAttr(m.src)} alt="Photograph, ${day(m.d || m.t)}">`
  unlockMedia(box)
  box.querySelector('.meta').textContent = `${day(m.d || m.t)}, 2025 · ${i + 1} of ${lists[list].length}`
  box.querySelector('.note').innerHTML = notesFor(null, m.src).map((w) => w.html).join('') || memories.filter((x) => x.photo === m.src).map((x) => `<p class="hand">${esc(x.text)}</p>`).join('')
}
const closeBox = () => {
  box.hidden = true
  box.querySelector('.stage').innerHTML = ''
  open = null
}
const stepBox = (d) => open && show(open.list, (open.i + d + lists[open.list].length) % lists[open.list].length)

book.addEventListener('click', (e) => {
  const fig = e.target.closest('.print')
  if (fig) return show(fig.dataset.list, lists[fig.dataset.list].findIndex((m) => m.src === fig.dataset.src))
  const link = e.target.closest('a[href^="#"]')
  if (link) {
    e.preventDefault()
    return goTo(link.getAttribute('href').slice(1))
  }
  // Clicking the outer margin of a page turns it, like lifting a corner.
  const r = book.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  if (x < 0.07) turn(-1)
  else if (x > 0.93) turn(1)
})
book.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('print')) {
    e.preventDefault()
    e.target.click()
  }
})
document.addEventListener('keydown', (e) => {
  if (e.target.isContentEditable) return
  if (!box.hidden) {
    if (e.key === 'Escape') closeBox()
    else if (e.key === 'ArrowRight') stepBox(1)
    else if (e.key === 'ArrowLeft') stepBox(-1)
    return
  }
  if (e.target.classList?.contains('print')) return
  if (e.key === 'ArrowRight' || e.key === 'PageDown') turn(1)
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') turn(-1)
  else if (e.key === 'Home') (at = 0), render(-1)
  else if (e.key.toLowerCase() === 'p') togglePlay()
})
let touchX = null
document.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true })
document.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchX
  if (Math.abs(dx) < 50) return
  box.hidden ? turn(dx < 0 ? 1 : -1) : stepBox(dx < 0 ? 1 : -1)
})
document.getElementById('prev').onclick = () => turn(-1)
document.getElementById('next').onclick = () => turn(1)
document.getElementById('play').onclick = togglePlay
box.querySelector('.close').onclick = closeBox
box.querySelector('.bprev').onclick = () => stepBox(-1)
box.querySelector('.bnext').onclick = () => stepBox(1)
box.addEventListener('click', (e) => e.target === box && closeBox())
let wasNarrow = narrow()
window.addEventListener('resize', () => wasNarrow !== narrow() && ((wasNarrow = narrow()), render()))

const get = (url) => (vault ? plain(url).then((u) => fetch(u)) : fetch(url)).then((r) => (r.ok ? r.json() : Promise.reject()))
const fonts = () => Promise.race([Promise.all(['500 20px Newsreader', 'italic 400 20px Newsreader', '600 20px "Barlow Condensed"', '500 20px Caveat'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))]).catch(() => {})
const openBook = () => Promise.all([get('data/story.json'), get('data/countries.json'), get('data/memories.json').catch(() => []), get('data/messages.json').catch(() => []), fonts()]).then(([s, topo, mem, msg]) => {
  messages = (Array.isArray(msg) ? msg : []).filter((m) => !m.off)
  story = s
  memories = Array.isArray(mem) ? mem : []
  loadLand(topo)
  build()
  document.getElementById('tabs').innerHTML = pages.filter((p) => p.kind === 'chapter').map((p) => `<a href="#${p.id}" data-id="${p.id}" style="--ink:${COUNTRY[p.id]?.[2] || '#333'}" title="${esc(p.title)}">${p.id}</a>`).join('')
  document.getElementById('tabs').addEventListener('click', (e) => {
    const a = e.target.closest('a')
    if (a) (e.preventDefault(), goTo(a.dataset.id))
  })
  const m = /^#p(\d+)$/.exec(location.hash)
  if (m) at = +m[1]
  else if (location.hash.length > 1) return goTo(location.hash.slice(1)) || render()
  render()
}).catch(() => (book.innerHTML = '<p class="fail">The book could not be opened.</p>'))

unlock().then(openBook)


// ---------- draft mode: leave notes and edits while reading (local only) ----------
// On your own Mac the book is a draft. Press N to leave a note on the open
// spread, or use the small pencil and cross on any print, slip or note to
// comment on it or ask for it to be removed. Everything is saved to
// public/data/draft-notes.json; nothing changes on the page until the notes
// are worked through. The published copy has none of this.
const DRAFT = ['localhost', '127.0.0.1'].includes(location.hostname) && !/locked/.test(location.pathname)
let draftNotes = []
const draftPost = (entry) => fetch('/__draft', { method: 'POST', body: JSON.stringify(entry) }).then((r) => r.json()).then((list) => ((draftNotes = list), paintDraft())).catch(() => {})
const whereNow = () => [...new Set(shown().slice(at, at + step()).map((p) => p.label || p.title || p.kind))].join(' / ')
const targetOf = (el) => el.classList.contains('print')
  ? { kind: 'photo', src: el.dataset.src, orig: lists[el.dataset.list]?.find((m) => m.src === el.dataset.src)?.orig }
  : { kind: el.classList.contains('texthome') ? 'text home' : el.classList.contains('hand') ? 'handwritten note' : el.classList.contains('margin') ? 'fact' : el.classList.contains('lede') ? 'chapter text' : 'calendar slip', text: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 200) }
const sameTarget = (a, b) => a && b && a.kind === b.kind && (a.src ? a.src === b.src : a.text === b.text)

// The note from the editor is yours to write: click it and type. It saves when you click away.
function editable() {
  const quote = book.querySelector('.after blockquote'), by = book.querySelector('.after .by')
  if (!quote) return
  for (const el of [quote, by].filter(Boolean)) {
    el.contentEditable = 'plaintext-only'
    el.title = 'Click to edit. Saves when you click away.'
    el.onblur = () => {
      const a = { ...story.trip.afterword, text: quote.innerText.trim(), by: by ? by.innerText.trim() : '' }
      story.trip.afterword = a
      pages.find((p) => p.kind === 'afterword').html = afterHtml(a)
      fetch('/__afterword', { method: 'POST', body: JSON.stringify(a) }).catch(() => {})
    }
  }
}
function decorate() {
  editable()
  for (const el of book.querySelectorAll('.print, .texthome, .hand, .margin, .slips li, .lede')) {
    const tools = document.createElement('span')
    tools.className = 'edit'
    tools.innerHTML = '<button data-act="note" title="Leave a note about this">✎</button><button data-act="remove" title="Remove this">✕</button>'
    el.appendChild(tools)
    if (draftNotes.some((n) => n.action === 'remove' && sameTarget(n.target, targetOf(el)))) el.classList.add('struck')
  }
}
function paintDraft() {
  const here = draftNotes.filter((n) => n.spread === at)
  document.getElementById('draft-count').textContent = `${draftNotes.length} ${draftNotes.length === 1 ? 'note' : 'notes'}`
  document.getElementById('draft-list').innerHTML = here.map((n) => `<li><span>${n.action === 'remove' ? 'Remove' : 'Note'}${n.target ? ` · ${esc(n.target.kind)}` : ''}</span>${esc(n.text || n.target?.text || n.target?.src || '')}<button data-del="${n.id}" title="Delete this note">✕</button></li>`).join('')
  for (const el of book.querySelectorAll('.print, .texthome, .hand, .margin, .slips li, .lede')) el.classList.toggle('struck', draftNotes.some((n) => n.action === 'remove' && sameTarget(n.target, targetOf(el))))
}
function openNote(target) {
  const panel = document.getElementById('draft')
  panel.classList.add('open')
  panel.dataset.target = target ? JSON.stringify(target) : ''
  document.getElementById('draft-about').textContent = target ? `About this ${target.kind}${target.text ? `: “${target.text.slice(0, 70)}…”` : ''}` : `About this spread: ${whereNow()}`
  document.getElementById('draft-text').focus()
}
if (DRAFT) {
  document.body.insertAdjacentHTML('beforeend', `<aside id="draft"><header><b>Draft</b><span id="draft-count"></span><button id="draft-new" title="Leave a note on this spread (N)">+ Note</button></header>
    <ul id="draft-list"></ul><div class="draft-form"><p id="draft-about"></p><textarea id="draft-text" rows="4" placeholder="Dictate or type what should change here."></textarea><div><button id="draft-cancel">Cancel</button><button id="draft-save">Save note</button></div></div></aside>`)
  const text = document.getElementById('draft-text')
  const close = () => (document.getElementById('draft').classList.remove('open'), (text.value = ''))
  const save = () => {
    const raw = document.getElementById('draft').dataset.target
    if (text.value.trim()) draftPost({ id: `${Date.now()}`, spread: at, where: whereNow(), target: raw ? JSON.parse(raw) : null, text: text.value.trim() })
    close()
  }
  document.getElementById('draft-new').onclick = () => openNote(null)
  document.getElementById('draft-cancel').onclick = close
  document.getElementById('draft-save').onclick = save
  text.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
    if (e.key === 'Escape') close()
  })
  document.getElementById('draft-list').onclick = (e) => e.target.dataset.del && draftPost({ remove: e.target.dataset.del })
  document.addEventListener('keydown', (e) => e.key.toLowerCase() === 'n' && box.hidden && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable && (e.preventDefault(), openNote(null)))
  // The pencil and cross on each item. Capture phase, so a click on them never opens the lightbox.
  book.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit button')
    if (!btn) return
    e.stopPropagation()
    e.preventDefault()
    const el = btn.closest('.print, .texthome, .hand, .margin, .slips li, .lede')
    const target = targetOf(el)
    if (btn.dataset.act === 'note') return openNote(target)
    const existing = draftNotes.find((n) => n.action === 'remove' && sameTarget(n.target, target))
    if (existing) return draftPost({ remove: existing.id }) // a second click undoes it
    draftPost({ id: `${Date.now()}`, spread: at, where: whereNow(), target, action: 'remove' })
    // A removed photograph is also dropped from the atlas itself, like a "no" in review.
    if (target.orig) fetch('/__curate', { method: 'POST', body: JSON.stringify({ src: target.orig, action: 'hide' }) }).catch(() => {})
  }, true)
  draftPost({})
}
