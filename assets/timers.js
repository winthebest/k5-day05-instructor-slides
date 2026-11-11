/* Countdown timers shared by the decks and the run board.
   One timer per block of the lab schedule; every widget mounted with the same id shows the same clock.
   Exposes window.LabTimers = { DUR, name, mount, toggle, reset, state }. */
(function () {
  // minutes per block, from README "Lịch — 240 phút"
  var DUR = { 1: 10, 2: 35, 3: 45, 4: 35, nghi: 15, 5: 60, 6: 10, demo: 30 };
  var NAME = { nghi: 'Nghỉ', demo: 'Demo' };
  var KEY = 'lab5-checkpoint-timers', T = {}, actx = null;
  try { T = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { T = {}; }   // survives an accidental reload

  function name(id) { return NAME[id] || 'Chặng ' + id; }
  function st(id) { return T[id] || (T[id] = { left: DUR[id] * 60000, end: 0, run: false, done: false }); }
  var api = {};
  function store() { try { sessionStorage.setItem(KEY, JSON.stringify(T)); } catch (e) {} }
  function save() { store(); if (api.onChange) api.onChange(T); }   // local change: persist it and tell the other window
  // state pushed from the other window (audience <-> presenter): adopt it without echoing it back
  function load(state) {
    var next = {};
    Object.keys(DUR).forEach(function (id) {
      var t = state && state[id];
      if (t && typeof t.left === 'number' && typeof t.end === 'number') next[id] = { left: t.left, end: t.end, run: !!t.run, done: !!t.done };
    });
    T = next; store(); paint();
  }
  // remaining time comes from an end timestamp, so a throttled background tab stays correct
  function left(id) { var t = st(id); return t.run ? Math.max(0, t.end - Date.now()) : t.left; }

  function toggle(id) {
    var t = st(id); if (t.done) return;
    if (t.run) { t.left = left(id); t.run = false; }
    else {
      t.end = Date.now() + t.left; t.run = true;
      try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    save(); paint();
  }
  function reset(id) { T[id] = { left: DUR[id] * 60000, end: 0, run: false, done: false }; save(); paint(); }

  function beep() {
    if (!actx) return;
    try {
      for (var i = 0; i < 3; i++) {
        var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.35;
        o.frequency.value = 880; o.connect(g); g.connect(actx.destination);
        g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.start(t); o.stop(t + 0.26);
      }
    } catch (e) {}
  }

  // finish any timer whose time ran out, whether or not a widget for it is on screen
  function settle() {
    Object.keys(T).forEach(function (id) {
      var t = T[id];
      if (t.run && t.end - Date.now() <= 0) { t.run = false; t.left = 0; t.done = true; save(); beep(); }
    });
  }

  function paint() {
    settle();
    [].forEach.call(document.querySelectorAll('.timer'), function (w) {
      var id = w.dataset.t, t = st(id), ms = left(id);
      var sec = Math.ceil(ms / 1000), m = Math.floor(sec / 60), ss = sec % 60;
      w.querySelector('.tt').textContent = (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
      w.querySelector('.tl').textContent = t.done ? 'Hết giờ · ' + name(id).toLowerCase() : name(id) + ' · ' + DUR[id] + ' phút';
      w.classList.toggle('run', t.run);
      w.classList.toggle('warn', !t.done && ms <= Math.min(300000, DUR[id] * 12000));   // last 5 minutes, or last 20% of a short block
      w.classList.toggle('done', t.done);
    });
  }

  // size: true or 'big' for the large clock, 'mid' for the side panel, falsy for the small corner pill
  function mount(host, id, size) {
    var cls = size === true ? ' big' : (size ? ' ' + size : '');
    host.insertAdjacentHTML('beforeend',
      '<div class="timer' + cls + '" data-t="' + id + '"><div class="tl"></div><div class="tr2"><span class="tt">--:--</span>'
      + '<button class="go" title="Bắt đầu / tạm dừng (phím T)" aria-label="Bắt đầu hoặc tạm dừng"><svg class="iplay" viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg><svg class="ipause" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg></button>'
      + '<button class="rs" title="Đặt lại (phím R)" aria-label="Đặt lại"><svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg></button></div></div>');
    paint();
  }

  document.addEventListener('click', function (e) {
    var w = e.target.closest('.timer'), btn = w && e.target.closest('button');
    if (btn) { if (btn.classList.contains('go')) toggle(w.dataset.t); else reset(w.dataset.t); }
  });
  setInterval(paint, 250);

  api.DUR = DUR; api.name = name; api.mount = mount; api.toggle = toggle; api.reset = reset; api.load = load;
  api.dump = function () { return T; };
  api.state = function (id) { var t = st(id); return { run: t.run, done: t.done, left: left(id) }; };
  api.onChange = null;   // set by the deck to mirror timer changes into the other window
  window.LabTimers = api;
})();
