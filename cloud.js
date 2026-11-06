(function () {
  if (window.Cloud) return;
  var URL_ = 'https://uvlrmvhdogfimjwcjray.supabase.co';
  var KEY_ = 'sb_publishable_NgWMdnUyrJA0PJ7ee6S_4w_f5-SeqLQ';
  var subs = [];
  var C = window.Cloud = { canEdit: false, user: null, sb: null };
  var PUBLIC = /[?&]eleves\b/.test(location.search);
  if (!PUBLIC) { var lk = document.createElement('style'); lk.id = 'cl-lock'; lk.textContent = 'body>*:not([data-cl-gate]){visibility:hidden!important}'; document.head.appendChild(lk); }
  var gateEl, gateMsg;
  var gate = function (err) {
    if (PUBLIC || !document.body) return;
    var l = document.getElementById('cl-lock');
    if (C.canEdit) { if (l) l.remove(); if (gateEl) { gateEl.remove(); gateEl = null; } return; }
    if (!l) { l = document.createElement('style'); l.id = 'cl-lock'; l.textContent = 'body>*:not([data-cl-gate]){visibility:hidden!important}'; document.head.appendChild(l); }
    if (!gateEl) {
      gateEl = document.createElement('div'); gateEl.setAttribute('data-cl-gate', '1');
      gateEl.style.cssText = "position:fixed;inset:0;z-index:40;background:#f5f3ee;color:#1d1c1a;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'IBM Plex Sans',sans-serif";
      gateEl.innerHTML = '<div style="max-width:380px;display:flex;flex-direction:column;gap:16px"><div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6b675e">Espace enseignant</div><div style="font-family:Newsreader,serif;font-size:34px;line-height:1.05">Ce document est réservé à l’enseignant.</div><div data-gm style="font-size:15px;line-height:1.5;color:#4a4740"></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button data-gl style="font:inherit;font-weight:500;padding:11px 18px;border:0;border-radius:4px;background:#1d1c1a;color:#f5f3ee;cursor:pointer"></button><a href="Espace etudiant.dc.html" style="font:inherit;padding:11px 18px;border:1px solid #bfb8a8;border-radius:4px;color:#1d1c1a;text-decoration:none">Espace étudiant →</a></div></div>';
      document.body.appendChild(gateEl);
      gateEl.querySelector('[data-gl]').onclick = function () { if (C.user) C.sb.auth.signOut(); else openLogin(); };
    }
    gateEl.querySelector('[data-gm]').textContent = err ? 'Connexion au serveur impossible. Vérifiez le réseau puis rechargez la page.' : C.user ? 'Le compte connecté n’a pas les droits enseignant.' : 'Connectez-vous avec votre compte enseignant pour l’afficher.';
    gateEl.querySelector('[data-gl]').textContent = C.user ? 'Changer de compte' : 'Se connecter';
  };
  C.onAuth = function (fn) { subs.push(fn); };
  var emit = function () { subs.forEach(function (f) { try { f(); } catch (e) {} }); paintBtn(); gate(); };
  var load = function () { return new Promise(function (res, rej) {
    if (window.supabase && window.supabase.createClient) return res();
    var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  }); };
  var refresh = function (session) {
    C.user = session ? session.user : null;
    if (!C.user) { C.canEdit = false; return Promise.resolve(); }
    return C.sb.from('editors').select('user_id').eq('user_id', C.user.id).maybeSingle().then(function (r) { C.canEdit = !!(r.data); });
  };
  C.ready = load().then(function () {
    C.sb = window.supabase.createClient(URL_, KEY_);
    C.sb.auth.onAuthStateChange(function (_e, session) { setTimeout(function () { refresh(session).then(emit); }, 0); });
    return C.sb.auth.getSession().then(function (r) { return refresh(r.data.session); });
  }).then(function () { paintBtn(); gate(); }).catch(function (e) { console.warn('Cloud indisponible', e); gate(true); });

  C.get = function (key) { return C.sb.from('kv').select('value').eq('key', key).maybeSingle().then(function (r) { return r.data ? r.data.value : null; }); };
  C.set = function (key, value) { if (!C.canEdit) return Promise.resolve(); return C.sb.from('kv').upsert({ key: key, value: value, updated_at: new Date().toISOString() }).then(function (r) { if (r.error) console.warn(r.error); }); };
  C.listFiles = function (key) { return C.sb.from('files').select('*').eq('key', key).order('fid').then(function (r) { return r.data || []; }); };
  C.url = function (path) { return C.sb.storage.from('pj').getPublicUrl(path).data.publicUrl; };
  var safe = function (n) { return n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]+/g, '_'); };
  C.addFiles = function (key, item, files) {
    return Promise.all(files.map(function (f, i) {
      var path = safe(key) + '/' + safe(item) + '/' + Date.now() + i + '-' + safe(f.name);
      return C.sb.storage.from('pj').upload(path, f, { contentType: f.type || undefined }).then(function (r) {
        if (r.error) throw r.error;
        return C.sb.from('files').insert({ key: key, item: item, name: f.name, type: f.type, size: f.size, path: path }).then(function (q) { if (q.error) throw q.error; });
      });
    }));
  };
  C.removeFile = function (fid) {
    return C.sb.from('files').select('path').eq('fid', fid).maybeSingle().then(function (r) {
      var p = r.data && r.data.path;
      return C.sb.from('files').delete().eq('fid', fid).then(function () { if (p) return C.sb.storage.from('pj').remove([p]); });
    });
  };

  // Édition des textes : surcharges enregistrées dans kv sous « edits:<page> », appliquées pour tous
  var EK = 'edits:' + decodeURIComponent(location.pathname.split('/').pop() || 'index');
  var edits = {}, editing = false, sched = 0, edBtn, edCss;
  var norm = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
  var SKIP = '[data-cl-gate],[data-cl-ed],script,style,button,select,option,input,textarea,svg,label';
  var leaves = function () { return Array.prototype.filter.call(document.body.querySelectorAll('*'), function (el) {
    return !el.children.length && el.firstChild && el.firstChild.nodeType === 3 && norm(el.textContent) && !el.closest(SKIP);
  }); };
  var setText = function (el, v) { if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) el.firstChild.nodeValue = v; else el.textContent = v; };
  var apply = function () {
    sched = 0; if (!document.body) return;
    var seen = {};
    leaves().forEach(function (el) {
      if (el === document.activeElement && el.isContentEditable) return;
      var cur = norm(el.textContent);
      if (el.__clNew === undefined || cur !== el.__clNew) { el.__clOrig = cur; el.__clNew = undefined; }
      var o = el.__clOrig, n = seen[o] = (seen[o] || 0) + 1, k = o + '#' + n;
      el.__clKey = k;
      if (edits[k] !== undefined && edits[k] !== cur) { setText(el, edits[k]); el.__clNew = edits[k]; }
      if (editing) { if (el.contentEditable !== 'plaintext-only' && el.contentEditable !== 'true') { try { el.contentEditable = 'plaintext-only'; } catch (e) { el.contentEditable = 'true'; } } }
      else if (el.isContentEditable && el.__clWasEd) el.removeAttribute('contenteditable');
      if (editing) el.__clWasEd = true;
    });
  };
  var schedule = function () { if (!sched) sched = requestAnimationFrame(apply); };
  var commit = function (el) {
    var k = el.__clKey; if (!k) return;
    var v = norm(el.innerText || el.textContent), o = el.__clOrig;
    if (!v || v === o) { delete edits[k]; v = o; setText(el, o); el.__clNew = undefined; } else { edits[k] = v; el.__clNew = v; }
    C.set(EK, edits);
  };
  var setEditing = function (on) {
    editing = on;
    if (!edCss) { edCss = document.createElement('style'); document.head.appendChild(edCss); }
    edCss.textContent = on ? '[contenteditable]{outline:1px dashed rgba(255,61,127,.55);outline-offset:2px;cursor:text;border-radius:2px}[contenteditable]:hover{background:rgba(198,244,50,.25)}[contenteditable]:focus{outline:2px solid #ff3d7f;background:#fff}' : '';
    apply(); paintBtn();
  };
  C.editMode = function (on) { if (C.canEdit) setEditing(on); };
  document.addEventListener('focusout', function (e) { if (editing && e.target.__clKey && e.target.isContentEditable) commit(e.target); }, true);
  document.addEventListener('keydown', function (e) {
    var el = e.target; if (!editing || !el.isContentEditable || !el.__clKey) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { setText(el, edits[el.__clKey] !== undefined ? edits[el.__clKey] : el.__clOrig); el.blur(); }
  }, true);
  document.addEventListener('click', function (e) { if (editing && e.target.closest && e.target.closest('[contenteditable]') && e.target.closest('a')) e.preventDefault(); }, true);
  C.ready.then(function () { return C.get(EK); }).then(function (v) {
    edits = v || {}; apply();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  }).catch(function () {});

  var btn;
  var paintBtn = function () {
    if (!document.body || PUBLIC) return;
    if (!edBtn) {
      edBtn = document.createElement('div');
      edBtn.setAttribute('data-noprint', '1'); edBtn.setAttribute('data-cl-ed', '1');
      edBtn.style.cssText = "position:fixed;right:14px;bottom:54px;z-index:50;display:none;gap:6px;align-items:center;font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase";
      edBtn.innerHTML = '<button data-r style="font:inherit;padding:9px 12px;border-radius:999px;border:1px solid #bfb8a8;background:rgba(245,243,238,.94);color:#8a3b2b;cursor:pointer">Tout rétablir</button><button data-t style="font:inherit;padding:9px 12px;border-radius:999px;border:1px solid #1d1c1a;cursor:pointer"></button>';
      document.body.appendChild(edBtn);
      edBtn.querySelector('[data-t]').onclick = function () { setEditing(!editing); };
      edBtn.querySelector('[data-r]').onclick = function () {
        var n = Object.keys(edits).length; if (!n) return alert('Aucune modification sur cette page.');
        if (!confirm('Annuler les ' + n + ' modification(s) de texte de cette page ?')) return;
        edits = {}; C.set(EK, edits).then(function () { location.reload(); });
      };
    }
    edBtn.style.display = C.canEdit ? 'flex' : 'none';
    var t = edBtn.querySelector('[data-t]');
    t.textContent = editing ? '✓ Terminer' : '✎ Modifier les textes';
    t.style.background = editing ? '#c6f432' : '#1d1c1a'; t.style.color = editing ? '#1d1c1a' : '#f5f3ee';
    edBtn.querySelector('[data-r]').style.display = editing ? '' : 'none';
    if (!C.canEdit && editing) setEditing(false);
    if (!btn) {
      btn = document.createElement('button');
      btn.setAttribute('data-noprint', '1'); btn.setAttribute('data-cl-gate', '1');
      btn.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:50;font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;padding:9px 12px;border-radius:999px;border:1px solid #bfb8a8;background:rgba(245,243,238,.94);color:#4a4740;cursor:pointer";
      btn.onclick = function () { if (C.user) { if (confirm('Se déconnecter ?')) C.sb.auth.signOut(); } else openLogin(); };
      document.body.appendChild(btn);
    }
    btn.textContent = C.user ? (C.canEdit ? '● Édition' : 'Connecté · lecture') : 'Connexion';
  };
  var openLogin = function () {
    var ov = document.createElement('div'); ov.setAttribute('data-cl-gate', '1');
    ov.style.cssText = 'position:fixed;inset:0;z-index:70;background:rgba(29,28,26,.4);display:flex;align-items:center;justify-content:center;padding:20px';
    ov.innerHTML = '<form style="background:#f5f3ee;color:#1d1c1a;border-radius:8px;padding:24px;width:100%;max-width:340px;display:flex;flex-direction:column;gap:12px;font-family:\'IBM Plex Sans\',sans-serif">' +
      '<div style="font-family:Newsreader,serif;font-size:24px">Connexion</div>' +
      '<input name="e" type="email" autocomplete="email" placeholder="E-mail" required style="font:inherit;font-size:16px;padding:10px;border:1px solid #bfb8a8;border-radius:4px;background:#fff">' +
      '<input name="p" type="password" autocomplete="current-password" placeholder="Mot de passe (6 caractères min.)" required minlength="6" style="font:inherit;font-size:16px;padding:10px;border:1px solid #bfb8a8;border-radius:4px;background:#fff">' +
      '<div data-m style="font-size:13px;color:#8a3b2b;min-height:1em"></div>' +
      '<div style="display:flex;gap:8px"><button style="flex:1;font:inherit;font-weight:500;padding:11px;border:0;border-radius:4px;background:#1d1c1a;color:#f5f3ee">Se connecter</button>' +
      '<button type="button" data-x style="font:inherit;padding:11px 14px;border:1px solid #bfb8a8;border-radius:4px;background:none;color:#1d1c1a">Annuler</button></div>' +
      '<button type="button" data-s style="font:inherit;font-size:13px;border:0;background:none;color:#4a4740;text-decoration:underline;padding:0;align-self:flex-start">Créer le compte (première fois)</button></form>';
    document.body.appendChild(ov);
    var f = ov.querySelector('form'), m = ov.querySelector('[data-m]');
    var close = function () { ov.remove(); };
    ov.querySelector('[data-x]').onclick = close;
    f.onsubmit = function (ev) { ev.preventDefault(); m.textContent = '…';
      C.sb.auth.signInWithPassword({ email: f.e.value.trim(), password: f.p.value }).then(function (r) { if (r.error) m.textContent = 'Identifiants incorrects.'; else close(); }); };
    ov.querySelector('[data-s]').onclick = function () { if (!f.reportValidity()) return; m.textContent = '…';
      C.sb.auth.signUp({ email: f.e.value.trim(), password: f.p.value }).then(function (r) {
        if (r.error) { m.textContent = r.error.message; return; }
        C.sb.auth.signInWithPassword({ email: f.e.value.trim(), password: f.p.value }).then(function (q) { if (q.error) m.textContent = 'Compte créé. Confirmez l’e-mail reçu puis connectez-vous.'; else close(); });
      }); };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintBtn); else paintBtn();
})();
