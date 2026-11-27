/* Queen Bee's — shared client layer: config, API, helpers, Bee chat */
window.QB = (function () {
  const CONFIG = {
    API: 'https://superagent-c4c9cb88.base44.app/functions/queenBee',
    PORTAL_KEY: 'qb2026',
    PHONE: '(602) 555-0142',
    PHONE_TEL: '+16025550142',
    EMAIL: 'hello@queenbeespainting.com',
    AREAS: ['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Gilbert', 'Glendale', 'Peoria', 'Ahwatukee', 'Paradise Valley', 'Queen Creek', 'Laveen'],
    HOURS: 'Mon–Sat, 7am – 6pm',
  };

  /* ---------- tiny helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };
  const ago = (iso) => {
    if (!iso) return '—';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (isNaN(s)) return '—';
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    if (s < 604800) return Math.round(s / 86400) + 'd ago';
    return fmtDate(iso);
  };
  const initials = (name) =>
    String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

  function toast(msg, ms = 2600) {
    let t = $('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('on'), ms);
  }

  /* ---------- api ---------- */
  async function api(action, payload = {}, opts = {}) {
    const body = Object.assign({ action }, payload);
    if (action !== 'submit') body.key = CONFIG.PORTAL_KEY;
    const res = await fetch(CONFIG.API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = {};
    try { data = await res.json(); } catch (e) { data = { ok: false, error: 'Bad response' }; }
    if (!res.ok && !opts.allowFail) throw new Error(data.error || 'Request failed');
    return data;
  }

  /* ---------- photo compression ---------- */
  function compressImage(file, maxDim = 1400, quality = 0.72) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('not an image'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode failed'));
        img.onload = () => {
          let { width: w, height: h } = img;
          const scale = Math.min(1, maxDim / Math.max(w, h));
          w = Math.round(w * scale); h = Math.round(h * scale);
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ data: c.toDataURL('image/jpeg', quality), width: w, height: h, name: file.name || 'photo.jpg' });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- estimate slots ---------- */
  function nextSlots(count = 3) {
    const out = [];
    const times = ['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM'];
    const d = new Date();
    let guard = 0;
    while (out.length < count && guard < 20) {
      d.setDate(d.getDate() + 1);
      guard++;
      if (d.getDay() === 0) continue;
      out.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
        time: times[out.length % times.length],
      });
    }
    return out;
  }

  /* ---------- Bee chat ---------- */
  const PRICE = {
    'interior painting': 'Interior painting in the Valley usually lands between $2,300 and $8,200 depending on square footage, ceiling height and how much prep the walls need. Most single-family homes we do are $3,400–$5,600.',
    'exterior painting': 'Exterior painting runs $1,900–$7,600, with most Phoenix-area homes at $3,200–$4,800 including pressure wash, stucco patching and two coats of elastomeric.',
    'cabinet refinishing': 'Cabinet painting is $1,400–$5,700 per kitchen, and most of ours sit around $2,600–$3,400 with doors sprayed off-site and new hardware.',
    'kitchen remodel': 'Kitchen remodels start around $18,000 for a cosmetic refresh and climb from there. I would rather see photos before I put a number on it.',
    'bathroom remodel': 'Bathroom remodels typically start near $12,000 for a full tear-out with new tile, vanity and fixtures.',
    'drywall and texture': 'Drywall repair and texture matching is usually $350–$1,800 depending on how much is damaged.',
    default: 'Every job is priced from the actual walls, so I do not guess. Send three photos through the quote form and you will get a real number, usually same day.',
  };

  function priceFor(services) {
    const list = Array.isArray(services) ? services : [services];
    const hits = list.map((s) => String(s || '').toLowerCase());
    for (const k of Object.keys(PRICE)) {
      if (k !== 'default' && hits.some((h) => h.includes(k.split(' ')[0]))) return PRICE[k];
    }
    return PRICE.default;
  }

  function mountChat(opts = {}) {
    const autoOpen = opts.autoOpen !== false;
    const launcher = document.createElement('button');
    launcher.className = 'qb-chat-launch';
    launcher.setAttribute('aria-label', 'Chat with Bee');
    launcher.innerHTML = '<img src="assets/img/logo.svg" alt=""><span class="dot"></span>';

    const panel = document.createElement('div');
    panel.className = 'qb-chat';
    panel.innerHTML = `
      <div class="qb-chat-head">
        <img src="assets/img/logo.svg" alt="">
        <div><b>Bee</b><small>Queen Bee's assistant</small></div>
        <button aria-label="Close chat">&times;</button>
      </div>
      <div class="qb-chat-body" id="qbBody"></div>
      <div class="qb-quick" id="qbQuick"></div>
      <form class="qb-chat-form" id="qbForm">
        <input id="qbInput" placeholder="Type your question…" autocomplete="off">
        <button type="submit" aria-label="Send">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>
        </button>
      </form>`;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    const body = $('#qbBody', panel);
    const quick = $('#qbQuick', panel);
    const input = $('#qbInput', panel);
    const state = { step: null, lead: {}, opened: false, messages: [] };

    const push = (text, who = 'bot') => {
      const d = document.createElement('div');
      d.className = 'msg ' + who;
      d.textContent = text;
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
      state.messages.push({ who, text, at: new Date().toISOString() });
      return d;
    };
    const typing = () => {
      const d = document.createElement('div');
      d.className = 'msg bot typing';
      d.innerHTML = '<i></i><i></i><i></i>';
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
      return d;
    };
    const bot = (text, delay = 620) =>
      new Promise((res) => {
        const t = typing();
        setTimeout(() => { t.remove(); push(text, 'bot'); res(); }, delay);
      });

    const setQuick = (arr) => {
      quick.innerHTML = '';
      (arr || []).forEach((label) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.onclick = () => { handle(label); };
        quick.appendChild(b);
      });
    };

    async function submitLead() {
      const lead = {
        name: state.lead.name || 'Website visitor',
        phone: state.lead.phone || '',
        email: state.lead.email || '',
        city: state.lead.city || '',
        zip: state.lead.zip || '',
        services: state.lead.services || [],
        timeline: state.lead.timeline || '',
        notes: state.lead.notes || '',
        source: 'Bee chat',
        chat: state.messages.map((m) => `${m.who === 'me' ? 'Visitor' : 'Bee'}: ${m.text}`).join('\n').slice(0, 7000),
      };
      try {
        const r = await api('submit', { lead, photos: [] });
        if (r.ok) {
          push('You are in. Your reference is ' + r.ref + '. I have your request in front of the team and someone will text you shortly.', 'bot');
          const slots = nextSlots(3);
          state.lead.ref = r.ref;
          state.slots = slots;
          state.step = 'slot';
          await bot('Want to lock the walkthrough right now? I have ' + slots.map((x) => x.label + ' at ' + x.time).join(', ') + '.', 520);
          setQuick(slots.map((x) => x.label + ' · ' + x.time).concat(['Not yet']));
          return;
        } else {
          push('I could not file that automatically. Call or text ' + CONFIG.PHONE + ' and we will pick it right up.', 'bot');
        }
      } catch (e) {
        push('I could not file that automatically. Call or text ' + CONFIG.PHONE + ' and we will pick it right up.', 'bot');
      }
      setQuick(['Get a photo quote', 'What does painting cost?', 'Do you serve my area?']);
      state.step = null;
    }

    async function handle(raw) {
      const text = String(raw || '').trim();
      if (!text) return;
      push(text, 'me');
      input.value = '';
      const t = text.toLowerCase();

      // booking a slot after the request is filed
      if (state.step === 'slot') {
        const slots = state.slots || [];
        const hit = slots.find((x) => (x.label + ' · ' + x.time).toLowerCase() === t);
        if (hit) {
          state.step = null;
          try {
            const r = await api('book', { ref: state.lead.ref, when: slotToDate(hit.date, hit.time).toISOString() });
            if (r.ok) {
              push('Booked. ' + hit.label + ' at ' + hit.time + ' is on our calendar, reference ' + state.lead.ref + '. I will text you the morning of.', 'bot');
              setQuick(['What should I have ready?', 'What does painting cost?']);
              return;
            }
          } catch (e) { /* fall through */ }
          push('I could not hold that slot. Call or text ' + CONFIG.PHONE + ' and we will book it by hand.', 'bot');
          return;
        }
        if (/(not yet|later|no thanks|no)/.test(t)) {
          state.step = null;
          push('No problem. Your request is filed and we will text you to find a time.', 'bot');
          return;
        }
        state.step = null;
      }

      // flow steps
      if (state.step === 'name') {
        state.lead.name = text;
        state.step = 'phone';
        return bot('Thanks ' + text.split(' ')[0] + '. What is the best mobile number for you?');
      }
      if (state.step === 'phone') {
        state.lead.phone = text;
        state.step = 'zip';
        return bot('Got it. Which city or ZIP is the project in?');
      }
      if (state.step === 'zip') {
        const zip = (text.match(/\b9\d{4}\b/) || [])[0] || '';
        const cityHit = CONFIG.AREAS.find((a) => t.includes(a.toLowerCase()));
        state.lead.zip = zip;
        state.lead.city = cityHit || text;
        const inArea = zip ? /^85\d{3}$/.test(zip) : !!cityHit;
        if (!inArea) {
          await bot('We stay inside the Phoenix metro, so I want to check that one with the owner before promising a time. What is the project?');
        } else {
          await bot('Perfect, that is inside our service area. What are we doing — interior, exterior, cabinets, or a remodel?');
        }
        state.step = 'project';
        return;
      }
      if (state.step === 'project') {
        state.lead.services = [text];
        state.step = null;
        await bot(priceFor(text));
        await bot('I can put you on the estimate calendar. Would you like me to file this request now?', 500);
        setQuick(['Yes, file my request', 'Send 3 photos instead']);
        state.step = 'confirm';
        return;
      }
      if (state.step === 'confirm') {
        if (/yes|file|sure|ok|please/i.test(t)) {
          state.step = null;
          return submitLead();
        }
        state.step = null;
      }

      // intent detection
      if (/(photo|picture|upload|send.*pic)/.test(t)) {
        await bot('Photos are the fastest way to a real number. Use the quote form, add up to 8 photos of the space, and you will get a written estimate, usually the same day.');
        setQuick(['Open the quote form', 'What does painting cost?']);
        return;
      }
      if (/(price|cost|how much|quote|estimate|budget)/.test(t)) {
        const svc = /cabinet/.test(t) ? 'cabinet refinishing'
          : /exterior|outside|stucco/.test(t) ? 'exterior painting'
          : /kitchen/.test(t) ? 'kitchen remodel'
          : /bath/.test(t) ? 'bathroom remodel'
          : /drywall|texture|patch/.test(t) ? 'drywall and texture'
          : /interior|inside|room/.test(t) ? 'interior painting' : null;
        await bot(svc ? priceFor(svc) : 'Painting is priced by the room and the prep, not by the hour. As a guide: interior $2,300–$8,200, exterior $1,900–$7,600, cabinets $1,400–$5,700 per kitchen, and remodels from $12,000.');
        await bot('If you tell me what you are doing, I can narrow that down. Or send three photos and skip the guessing.', 480);
        setQuick(['Interior painting', 'Exterior painting', 'Cabinet refinishing', 'Kitchen remodel']);
        return;
      }
      if (/(area|serve|city|location|travel|where.*you)/.test(t)) {
        await bot('We work the whole Phoenix metro: ' + CONFIG.AREAS.join(', ') + '. If you are just outside that, ask and we will tell you straight.');
        return;
      }
      if (/(insur|licens|bond|warrant|guarantee)/.test(t)) {
        await bot('Queen Bee\'s has been an Arizona LLC since 2018, fully licensed and insured, and every job carries a two-year workmanship warranty in writing.');
        return;
      }
      if (/(book|schedule|appointment|available|when can|come out|visit)/.test(t)) {
        const slots = nextSlots(3);
        await bot('I can hold a walkthrough. Next openings are ' + slots.map((s) => s.label + ' at ' + s.time).join(', ') + '.');
        state.step = 'name';
        return bot('What is your name?');
      }
      if (/(talk|call|human|owner|phone|text)/.test(t)) {
        await bot('Call or text ' + CONFIG.PHONE + ' and you will get a person, ' + CONFIG.HOURS + '.');
        return;
      }
      if (/(remodel|kitchen|bath|renovat)/.test(t)) {
        await bot(priceFor(/kitchen/.test(t) ? 'kitchen remodel' : /bath/.test(t) ? 'bathroom remodel' : 'kitchen remodel'));
        await bot('Remodels start with a walkthrough so nothing is guessed at. Want me to set that up?', 480);
        setQuick(['Book a walkthrough', 'Open the quote form']);
        return;
      }
      if (/(hi|hello|hey|good morning|good afternoon)/.test(t) && t.length < 22) {
        await bot('Hi, I am Bee. I can price a job, book a walkthrough, or take your photos and get you a written estimate. What are you working on?');
        setQuick(['Get a photo quote', 'What does painting cost?', 'Book a walkthrough']);
        return;
      }
      if (/(thank|thanks|appreciate)/.test(t)) {
        await bot('Any time. If you send photos through the quote form, I will make sure the team sees them today.');
        return;
      }
      if (/(interior|exterior|cabinet|drywall|paint)/.test(t)) {
        await bot(priceFor(t));
        setQuick(['Book a walkthrough', 'Open the quote form']);
        return;
      }

      // default
      await bot('I can help with pricing, scheduling a walkthrough, service area, or getting your photos to the estimator. Which one do you need?');
      setQuick(['Get a photo quote', 'What does painting cost?', 'Book a walkthrough', 'Do you serve my area?']);
    }

    $('#qbForm', panel).addEventListener('submit', (e) => {
      e.preventDefault();
      handle(input.value);
    });
    $('.qb-chat-head button', panel).addEventListener('click', () => panel.classList.remove('open'));
    launcher.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        input.focus();
        if (!state.opened) {
          state.opened = true;
          setTimeout(() => {
            push('Hi, I am Bee, the Queen Bee\'s assistant. I can price a job, book a walkthrough, or take your photos and get you a written estimate.', 'bot');
            setQuick(['Get a photo quote', 'What does painting cost?', 'Book a walkthrough', 'Do you serve my area?']);
            state.messages.push({ who: 'bot', text: 'greeting', at: new Date().toISOString() });
          }, 260);
        }
      }
    });

    // quick replies on open (before greeting) so the panel never looks empty
    setQuick(['Get a photo quote', 'What does painting cost?', 'Book a walkthrough']);

    if (autoOpen) {
      setTimeout(() => {
        if (!panel.classList.contains('open')) launcher.click();
      }, 4200);
    }

    // let other pages drive the chat
    window.QB.chat = {
      open: () => { if (!panel.classList.contains('open')) launcher.click(); },
      say: (m) => push(m, 'bot'),
      ask: (m) => handle(m),
    };
  }

  /* ---------- shared chrome ---------- */
  function initReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) return els.forEach((e) => e.classList.add('in'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }

  function initFaq() {
    $$('.acc-item').forEach((item) => {
      $('.acc-q', item).addEventListener('click', () => item.classList.toggle('open'));
    });
  }


  /* ---------- calendar ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  function slotToDate(dateStr, timeStr) {
    const m = String(timeStr || '9:00 AM').match(/(\d+):(\d+)\s*(AM|PM)/i);
    const d = new Date(dateStr + 'T09:00:00');
    if (m) {
      let h = Number(m[1]) % 12;
      if (/pm/i.test(m[3])) h += 12;
      d.setHours(h, Number(m[2]), 0, 0);
    }
    return d;
  }
  function gcalUrl(o) {
    const start = new Date(o.start);
    const end = new Date(start.getTime() + (o.minutes || 60) * 60000);
    const fmt = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
      pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
    const q = new URLSearchParams({
      action: 'TEMPLATE',
      text: o.title,
      details: o.details || '',
      dates: fmt(start) + '/' + fmt(end),
      location: o.location || '',
    });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }
  function icsString(o) {
    const start = new Date(o.start);
    const end = new Date(start.getTime() + (o.minutes || 60) * 60000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Queen Bee\'s//Estimate//EN',
      'BEGIN:VEVENT', 'UID:' + Date.now() + '@queenbeespainting.com',
      'DTSTAMP:' + fmt(new Date()), 'DTSTART:' + fmt(start), 'DTEND:' + fmt(end),
      'SUMMARY:' + String(o.title).replace(/\n/g, ' '),
      'DESCRIPTION:' + String(o.details || '').replace(/\n/g, '\\n'),
      'LOCATION:' + String(o.location || ''),
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
  }
  function downloadIcs(o, filename) {
    const blob = new Blob([icsString(o)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'queen-bee-walkthrough.ics';
    a.click();
  }

  /* ---------- booking widget ---------- */
  function renderBooking(box, ref, opts = {}) {
    if (!box) return;
    const slots = nextSlots(4);
    box.innerHTML =
      '<div style="text-align:left;border:1px solid var(--line);border-radius:16px;padding:20px;background:#fff;margin:6px 0 18px">' +
        '<div class="eyebrow gold" style="margin-bottom:6px">Next step</div>' +
        '<h3 style="font-family:var(--display);font-size:20px;margin-bottom:4px">Book your walkthrough now</h3>' +
        '<p style="font-size:13.5px;color:var(--muted);margin-bottom:14px">Pick a window and it goes straight onto our calendar. You get a confirmation you can add to yours.</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          slots.map((s, i) => '<button type="button" class="btn btn-outline btn-sm" data-slot="' + i + '" style="justify-content:flex-start">' + esc(s.label) + ' · ' + esc(s.time) + '</button>').join('') +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:10px">No time works? Call or text ' + esc(CONFIG.PHONE) + ' and we will fit you in.</div>' +
      '</div>';
    box.querySelectorAll('button[data-slot]').forEach((b) => {
      b.onclick = async () => {
        const s = slots[Number(b.dataset.slot)];
        const start = slotToDate(s.date, s.time);
        b.textContent = 'Booking…';
        b.disabled = true;
        try {
          const r = await api('book', { ref, when: start.toISOString() });
          if (!r.ok) throw new Error(r.error || 'failed');
          const ev = {
            title: "Queen Bee's walkthrough",
            details: 'Your painting and remodeling estimate. Reference ' + ref + '. Call ' + CONFIG.PHONE + ' to change it.',
            start,
            minutes: 60,
            location: opts.address || '',
          };
          box.innerHTML =
            '<div style="text-align:left;border:1px solid #E7D6A8;border-radius:16px;padding:20px;background:linear-gradient(180deg,#FFFDF6,#fff);margin:6px 0 18px">' +
              '<div style="font-size:22px;margin-bottom:6px">✅</div>' +
              '<h3 style="font-family:var(--display);font-size:20px;margin-bottom:4px">You are on the calendar</h3>' +
              '<p style="font-size:14px;color:var(--muted);margin-bottom:14px">' + esc(s.label) + ' at ' + esc(s.time) + '. Reference ' + esc(ref) + '.</p>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                '<a class="btn btn-dark btn-sm" href="' + gcalUrl(ev) + '" target="_blank" rel="noopener">Add to Google Calendar</a>' +
                '<button type="button" class="btn btn-outline btn-sm" id="icsBtn">Download .ics</button>' +
              '</div>' +
            '</div>';
          const icsBtn = box.querySelector('#icsBtn');
          if (icsBtn) icsBtn.onclick = () => downloadIcs(ev, 'queen-bee-walkthrough.ics');
          toast('Walkthrough booked for ' + s.label);
        } catch (e) {
          b.disabled = false;
          b.textContent = s.label + ' · ' + s.time;
          toast('Could not book that slot. Call or text ' + CONFIG.PHONE + '.');
        }
      };
    });
  }

  return { CONFIG, $, $$, money, esc, fmtDate, fmtDateTime, ago, initials, toast, api, compressImage, nextSlots, priceFor, mountChat, initReveal, initFaq, shrink: compressImage, gcalUrl, icsString, downloadIcs, slotToDate, renderBooking };
})();
