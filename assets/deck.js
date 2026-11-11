/* Slide deck engine: adds progress bar, logo and footer to numbered slides,
   mounts the countdown timer of each slide's block, handles navigation, and
   runs a two-window setup: the audience window (projector) shows slides only,
   the presenter window (opened with P) adds the timer controls and the notes.
   Needs assets/timers.js loaded first. */
(function () {
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var std = slides.filter(function (s) { return !s.classList.contains('nochrome'); });
  std.forEach(function (s, i) {
    var n = i + 1, t = std.length;
    s.insertAdjacentHTML('afterbegin', '<div class="prog"><i style="width:' + (n / t * 100).toFixed(2) + '%"></i></div><img class="logo" src="assets/vinuni-logo.png" alt="VinUniversity">');
    s.insertAdjacentHTML('beforeend', '<div class="foot"><span>AI20K K5 · L3 · VinUniversity</span><span>' + (s.dataset.sec || '') + '</span><span class="pg">' + n + ' / ' + t + '</span></div>');
  });
  slides.forEach(function (s) { if (s.classList.contains('div')) s.insertAdjacentHTML('afterbegin', '<img class="logo" src="assets/vinuni-logo.png" alt="VinUniversity">'); });

  // every slide of a block shares that block's timer; a slide may give it its own slot (shown large)
  slides.forEach(function (s) {
    var id = s.dataset.timer; if (!id) return;
    s.classList.add('has-timer');
    var slot = s.querySelector('.tslot');
    LabTimers.mount(slot || s, id, !!slot);
  });

  // stage chips (visual decks): one chip per timed block, the current block highlighted, click to jump there
  if (document.body.classList.contains('vz')) {
    var blocks = [];
    slides.forEach(function (s, i) { var id = s.dataset.timer; if (id && !blocks.some(function (b) { return b.id === id; })) blocks.push({ id: id, at: i }); });
    slides.forEach(function (s) {
      var hd = s.querySelector('.hd'); if (!hd) return;
      hd.insertAdjacentHTML('afterbegin', '<div class="cpnav">' + blocks.map(function (b) {
        return '<button data-at="' + b.at + '"' + (s.dataset.timer === b.id ? ' class="cur"' : '') + '>' + LabTimers.name(b.id) + '</button>';
      }).join('') + '</div>');
    });
  }

  // ---- presenter window -------------------------------------------------------------------------
  // The audience window never shows notes. P opens this same page with ?presenter in a second window;
  // the two windows mirror slide changes and timer state through postMessage (works on file:// too).
  var presenter = /[?&]presenter\b/.test(location.search);
  var peer = presenter ? window.opener : null;
  function trusted(src) { try { return !!src && (src === window.opener || src === peer || src.opener === window); } catch (e) { return false; } }
  function send(msg) { msg.lab5 = 1; try { if (peer && !peer.closed) peer.postMessage(msg, '*'); } catch (e) {} }
  LabTimers.onChange = function (T) { send({ timers: T }); };

  // side panel (timer + notes + next slide): always on in the presenter window; in the audience window
  // it exists only as an N-key fallback for presenting from a single screen
  var side = null;
  if (presenter || document.querySelector('.slide .sn')) {
    document.body.insertAdjacentHTML('beforeend', '<aside id="side"><div class="sh"><span class="lab">' + (presenter ? 'Màn hình người dẫn' : 'Ghi chú') + '</span><span class="pg"></span></div><div class="st"></div><div class="sb"></div><div class="nx"></div><div class="keys">T bấm giờ · R đặt lại · ← → chuyển slide · N ẩn/hiện cột này</div></aside>');
    side = document.getElementById('side');
    if (presenter) { document.body.classList.add('side-on', 'presenter'); document.title = '[Người dẫn] ' + document.title; }
  }
  function paintSide() {
    if (!side) return;
    var s = slides[cur], id = s.dataset.timer, n = s.querySelector('.sn'), st = side.querySelector('.st');
    var nx = slides[cur + 1], h = nx && nx.querySelector('h2,h1');
    side.querySelector('.pg').textContent = (cur + 1) + ' / ' + slides.length;
    st.innerHTML = ''; if (id && !s.querySelector('.tslot')) LabTimers.mount(st, id, 'mid');   // a slide with its own large clock keeps it
    var sb = side.querySelector('.sb');
    sb.innerHTML = n ? n.innerHTML : '';
    side.querySelector('.nx').innerHTML = nx ? 'Tiếp theo: <b>' + (h ? h.textContent : 'slide ' + (cur + 2)) + '</b>' : 'Hết deck.';
    fitNotes();
  }
  // long notes: step the type down until they fit the panel (floor 14px, then the panel scrolls)
  function fitNotes() {
    var sb = side && side.querySelector('.sb'); if (!sb) return;
    sb.style.fontSize = '';
    if (!sb.clientHeight) return;   // panel hidden
    var px = parseFloat(getComputedStyle(sb).fontSize);
    while (sb.scrollHeight > sb.clientHeight + 1 && px > 14) { px -= 0.5; sb.style.fontSize = px + 'px'; }
  }

  var cur = Math.min(slides.length - 1, Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  // quiet = the change came from the other window, so do not send it back
  function show(i, quiet) {
    cur = Math.min(slides.length - 1, Math.max(0, i));
    slides.forEach(function (s, j) { s.classList.toggle('on', j === cur); });
    history.replaceState(null, '', location.pathname + location.search + '#' + (cur + 1));
    paintSide();
    if (!quiet) send({ slide: cur });
  }
  // with the panel open the stage is slide (1280) + panel (400) wide
  function fit() { var w = document.body.classList.contains('side-on') ? 1680 : 1280; document.documentElement.style.setProperty('--k', Math.min(innerWidth / w, innerHeight / 720)); }
  addEventListener('resize', fit); fit(); show(cur, true);

  addEventListener('message', function (e) {
    var d = e.data; if (!d || d.lab5 !== 1 || !trusted(e.source)) return;
    if (!presenter) peer = e.source;                                  // re-link after the audience window was reloaded
    if (d.hello) send({ slide: cur, timers: LabTimers.dump() });      // a presenter window just opened: bring it up to date
    if (typeof d.slide === 'number') show(d.slide, true);
    if (d.timers) LabTimers.load(d.timers);
  });
  if (presenter) send({ hello: 1 });

  function openPresenter() {
    if (presenter) return;
    peer = window.open(location.href.split('#')[0].split('?')[0] + '?presenter#' + (cur + 1), 'lab5-presenter', 'width=1500,height=680');
  }

  addEventListener('keydown', function (e) {
    var tid = slides[cur].dataset.timer;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].indexOf(e.key) > -1) { show(cur + 1); e.preventDefault(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].indexOf(e.key) > -1) { show(cur - 1); e.preventDefault(); }
    else if (e.key === 'Home') show(0); else if (e.key === 'End') show(slides.length - 1);
    else if ((e.key === 't' || e.key === 'T') && tid) LabTimers.toggle(tid);
    else if ((e.key === 'r' || e.key === 'R') && tid) LabTimers.reset(tid);
    else if (e.key === 'p' || e.key === 'P') openPresenter();
    else if ((e.key === 'n' || e.key === 'N') && side) { document.body.classList.toggle('side-on'); fit(); fitNotes(); }
    else if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }
  });
  addEventListener('click', function (e) {
    var chip = e.target.closest('.cpnav button');
    if (chip) { show(+chip.dataset.at); return; }   // stage chip: jump to that stage
    if (e.target.closest('.timer,#side')) return;   // clicks on a timer or the side panel never change slide
    if (e.clientX > innerWidth / 2) show(cur + 1); else show(cur - 1);
  });
})();
