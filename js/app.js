/* AI помощник КМ — логика прототипа.
   Состояния для просмотра/переноса в Figma: ?screen=1|2|3|4|5 (5 — ошибка ответа), ?theme=light|dark */
(function () {
  'use strict';

  var MAX_LEN = 1000;
  var COUNTER_FROM = 800;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  var root = document.documentElement;
  var app = document.getElementById('app');
  var log = document.querySelector('[data-log]');
  var chatCard = document.querySelector('[data-chat]');
  var homeBlocks = document.querySelectorAll('[data-home]');
  var tplUser = document.getElementById('tpl-user');
  var tplBot = document.getElementById('tpl-bot');
  var tplLoading = document.getElementById('tpl-loading');
  var tplError = document.getElementById('tpl-error');
  var toastEl = document.querySelector('[data-toast]');
  var busy = false;

  /* ---------- Тема ---------- */
  var themeToggle = document.querySelector('[data-theme-toggle]');
  function applyTheme(theme, save) {
    root.dataset.theme = theme;
    themeToggle.setAttribute('aria-checked', String(theme === 'dark'));
    if (save) { try { localStorage.setItem('km-theme', theme); } catch (e) {} }
  }
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light', false);
  themeToggle.addEventListener('click', function () {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });

  /* ---------- Дата ---------- */
  var fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  function stamp(el, date) {
    date = date || new Date();
    el.dateTime = date.toISOString();
    el.textContent = fmt.format(date).replace(' в ', ', ');
  }

  /* ---------- Поле ввода ---------- */
  var composers = [];
  document.querySelectorAll('[data-composer]').forEach(function (form) {
    var field = form.querySelector('.field');
    var input = form.querySelector('textarea');
    var btn = form.querySelector('button[type="submit"]');
    var counter = form.querySelector('.field__counter');
    var msg = form.querySelector('.field__msg');

    // растёт под текст и возвращается к высоте из CSS, когда текст стёрт
    function autosize() {
      input.style.height = '';
      if (input.scrollHeight > input.clientHeight) input.style.height = input.scrollHeight + 'px';
    }

    function validate() {
      var value = input.value;
      var len = value.length;
      var tooLong = len > MAX_LEN;
      var empty = value.trim() === '';
      field.classList.toggle('is-error', tooLong);
      field.classList.toggle('is-filled', !empty && !tooLong);
      input.setAttribute('aria-invalid', String(tooLong));
      counter.textContent = len >= COUNTER_FROM ? len + ' / ' + MAX_LEN : '';
      msg.innerHTML = tooLong
        ? '<svg class="icon" aria-hidden="true"><use href="#i-alert"/></svg><span>Сообщение длиннее ' + MAX_LEN + ' символов — сократите его</span>'
        : '';
      // кнопка всегда активна; неактивна только при ошибке длины и во время ответа
      btn.disabled = tooLong || busy;
    }

    input.addEventListener('input', function () { autosize(); validate(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!btn.disabled && input.value.trim()) form.requestSubmit();
      }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      var q = input.value.trim();
      if (!q) { input.focus(); return; }
      input.value = '';
      autosize();
      validate();
      ask(q);
    });

    composers.push({ form: form, input: input, btn: btn, validate: validate, autosize: autosize });
    validate();
  });

  function setBusy(state) {
    busy = state;
    composers.forEach(function (c) {
      c.btn.classList.toggle('is-loading', state);
      c.btn.setAttribute('aria-busy', String(state));
      c.validate();
    });
  }

  /* ---------- Вид: старт / чат ---------- */
  function showView(view) {
    app.dataset.view = view;
    var isChat = view === 'chat';
    chatCard.hidden = !isChat;
    homeBlocks.forEach(function (el) { el.hidden = isChat; });
    if (isChat) closeSkills(true);
  }

  document.querySelector('[data-action="home"]').addEventListener('click', function (e) {
    if (app.dataset.view === 'chat' && !busy) {
      e.preventDefault();
      log.innerHTML = '';
      showView('home');
      history.replaceState(null, '', location.pathname + themeQuery());
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });

  function themeQuery() {
    var t = new URLSearchParams(location.search).get('theme');
    return t ? '?theme=' + t : '';
  }

  /* ---------- «Что ты умеешь?» ---------- */
  var skillsBtn = document.querySelector('[data-skills-toggle]');
  var skills = document.getElementById('skills');
  var closeTimer;

  // Видно ровно 4 темы целиком: высота списка — до низа 4-й темы (темы бывают в 1–2 строки)
  var topicList = skills.querySelector('.popup__list');
  var VISIBLE_TOPICS = 4;
  function fitTopics() {
    var items = topicList.children;
    if (skills.hidden || items.length <= VISIBLE_TOPICS) return;
    topicList.style.maxHeight = 'none';
    // offset* не зависят от transform анимации появления
    var last = items[VISIBLE_TOPICS - 1];
    topicList.style.maxHeight = (last.offsetTop + last.offsetHeight - topicList.offsetTop) + 'px';
  }
  window.addEventListener('resize', fitTopics);

  function openSkills(instant) {
    clearTimeout(closeTimer);
    skills.hidden = false;
    fitTopics();
    skillsBtn.setAttribute('aria-expanded', 'true');
    if (instant) { skills.classList.add('is-open'); return; }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { skills.classList.add('is-open'); });
    });
  }
  function closeSkills(instant) {
    if (skills.hidden) return;
    skillsBtn.setAttribute('aria-expanded', 'false');
    skills.classList.remove('is-open');
    if (instant || reduceMotion) { skills.hidden = true; return; }
    closeTimer = setTimeout(function () { skills.hidden = true; }, 200);
  }

  skillsBtn.addEventListener('click', function () {
    if (skillsBtn.getAttribute('aria-expanded') === 'true') closeSkills();
    else { openSkills(); skills.querySelector('.topic').focus({ preventScroll: true }); }
  });
  skills.querySelector('[data-skills-close]').addEventListener('click', function () {
    closeSkills();
    skillsBtn.focus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && skillsBtn.getAttribute('aria-expanded') === 'true') {
      closeSkills();
      skillsBtn.focus();
    }
  });
  skills.querySelectorAll('[data-topic]').forEach(function (b) {
    b.addEventListener('click', function () {
      var c = composers[0];
      c.input.value = 'Расскажи о теме «' + b.textContent.trim() + '»';
      c.autosize();
      c.validate();
      closeSkills();
      c.input.focus();
    });
  });

  /* ---------- Популярные вопросы ---------- */
  document.querySelectorAll('[data-question]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!busy) ask(b.textContent.trim());
    });
  });

  /* ---------- Сообщения ---------- */
  function addUser(text, date) {
    var node = tplUser.content.firstElementChild.cloneNode(true);
    node.querySelector('.msg__bubble').textContent = text;
    stamp(node.querySelector('.msg__time'), date);
    node.classList.add('is-new');
    log.appendChild(node);
    return node;
  }

  function addBot(html, date) {
    var node = tplBot.content.firstElementChild.cloneNode(true);
    node.querySelector('.answer').innerHTML = html;
    stamp(node.querySelector('.msg__time'), date);
    node.classList.add('is-new');
    log.appendChild(node);
    return node;
  }

  function addLoading() {
    var node = tplLoading.content.firstElementChild.cloneNode(true);
    node.classList.add('is-new');
    log.appendChild(node);
    return node;
  }

  function typingIndicator() {
    var el = document.createElement('p');
    el.className = 'typing';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="dots"><i></i><i></i><i></i></span><span>AI помощник КМ печатает…</span>';
    return el;
  }

  function scrollToEnd(el, block) {
    el.scrollIntoView({ block: block || 'end', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function setProgress(node, value) {
    var bar = node.querySelector('.progress');
    bar.setAttribute('aria-valuenow', String(Math.round(value)));
    bar.querySelector('.progress__bar').style.setProperty('--p', String(value / 100));
  }

  // Ответ появляется блоками с индикатором набора
  function stream(node, html, done) {
    var answer = node.querySelector('.answer');
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var blocks = Array.prototype.slice.call(tmp.children);
    if (reduceMotion) { answer.innerHTML = html; done(); return; }
    answer.innerHTML = '';
    node.classList.add('is-streaming');
    var typing = typingIndicator();
    answer.appendChild(typing);
    var i = 0;
    (function next() {
      if (i >= blocks.length) {
        typing.remove();
        node.classList.remove('is-streaming');
        done();
        return;
      }
      answer.insertBefore(blocks[i++], typing);
      setTimeout(next, 280);
    })();
  }

  function addError(q, date) {
    var node = tplError.content.firstElementChild.cloneNode(true);
    stamp(node.querySelector('.msg__time'), date);
    node.dataset.question = q;
    node.classList.add('is-new');
    log.appendChild(node);
    return node;
  }

  function ask(q) {
    if (busy) return;
    showView('chat');
    addUser(q);
    request(q, DEMO_FAIL.test(q));
  }

  // Демо: вопрос со словом «ошибка» показывает сбой ответа; «Повторить» отвечает штатно
  var DEMO_FAIL = /ошибк/i;

  function request(q, fail) {
    setBusy(true);
    var loading = addLoading();
    scrollToEnd(loading);

    var p = 0;
    var tick = setInterval(function () {
      p = Math.min(p + 8 + Math.random() * 14, 92);
      setProgress(loading, p);
    }, 220);

    setTimeout(function () {
      clearInterval(tick);
      setProgress(loading, 100);
      setTimeout(function () {
        loading.remove();
        if (fail) {
          var err = addError(q);
          setBusy(false);
          scrollToEnd(err);
          if (finePointer) err.querySelector('[data-retry]').focus({ preventScroll: true });
          return;
        }
        var node = addBot('');
        stream(node, window.KM_ANSWERS.get(q), function () {
          setBusy(false);
          // на тач-устройствах не открываем клавиатуру сами
          if (finePointer) composers[1].input.focus({ preventScroll: true });
        });
        scrollToEnd(node, 'start');
      }, reduceMotion ? 0 : 200);
    }, reduceMotion ? 400 : 1800);
  }

  /* ---------- Копирование ---------- */
  var toastTimer;
  function toast(text) {
    toastEl.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg><span>' + text + '</span>';
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 2000);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      ta.remove();
    });
  }

  log.addEventListener('click', function (e) {
    var retry = e.target.closest('[data-retry]');
    if (retry && !busy) {
      var errNode = retry.closest('.msg');
      var q = errNode.dataset.question;
      errNode.remove();
      request(q, false);
      return;
    }
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var text = btn.closest('.msg').querySelector('.answer').innerText.trim();
    var label = btn.querySelector('span');
    var icon = btn.querySelector('use');
    copyText(text).then(function () {
      label.textContent = 'Скопировано';
      icon.setAttribute('href', '#i-check');
      toast('Ответ скопирован');
      setTimeout(function () {
        label.textContent = 'Скопировать';
        icon.setAttribute('href', '#i-copy');
      }, 2000);
    }, function () { toast('Не удалось скопировать'); });
  });

  /* ---------- Статичные состояния для макетов: ?screen=N ---------- */
  var screen = new URLSearchParams(location.search).get('screen');
  var Q1 = 'Какие есть тарифы на продукт «Профи»?';
  var Q2 = 'Как обрабатывать возражения клиентов?';
  var t0 = new Date();
  var t1 = new Date(t0.getTime() - 4 * 60000);

  if (screen === '2') {
    openSkills(true);
  } else if (screen === '3') {
    showView('chat');
    addUser(Q1, t1);
    addBot(window.KM_ANSWERS.get(Q1), t1);
    addUser(Q2, t0);
    var streaming = addBot('', t0);
    var tmp = document.createElement('div');
    tmp.innerHTML = window.KM_ANSWERS.get(Q2);
    var a = streaming.querySelector('.answer');
    a.appendChild(tmp.children[0]);
    a.appendChild(tmp.children[0]);
    a.appendChild(typingIndicator());
    streaming.classList.add('is-streaming');
    log.querySelectorAll('.is-new').forEach(function (n) { n.classList.remove('is-new'); });
  } else if (screen === '4') {
    showView('chat');
    addUser(Q1, t1);
    addBot(window.KM_ANSWERS.get(Q1), t1);
    addUser(Q2, t0);
    var l = addLoading();
    setProgress(l, 64);
    log.querySelectorAll('.is-new').forEach(function (n) { n.classList.remove('is-new'); });
  } else if (screen === '5') {
    showView('chat');
    addUser(Q1, t1);
    addBot(window.KM_ANSWERS.get(Q1), t1);
    addUser(Q2, t0);
    addError(Q2, t0);
    log.querySelectorAll('.is-new').forEach(function (n) { n.classList.remove('is-new'); });
  }
})();
