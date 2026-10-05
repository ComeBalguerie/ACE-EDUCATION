(function () {
  if (window.QuizCloud) return;
  var URL_ = 'https://uvlrmvhdogfimjwcjray.supabase.co';
  var KEY_ = 'sb_publishable_NgWMdnUyrJA0PJ7ee6S_4w_f5-SeqLQ';
  var DOMAIN = 'eleves.cours-ace.fr', PK = 'quiz-pending-v1';
  var Q = window.QuizCloud = {};
  var lib = function () { return new Promise(function (res, rej) {
    if (window.supabase && window.supabase.createClient) return res();
    var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.onload = res; s.onerror = function () { rej(new Error('Connexion au serveur impossible. Vérifiez le réseau.')); }; document.head.appendChild(s);
  }); };
  Q.ready = lib().then(function () { Q.sb = (window.Cloud && window.Cloud.sb) || window.supabase.createClient(URL_, KEY_); });

  var slug = function (s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
  var emailOf = function (cls, pseudo) { return slug(pseudo) + '.' + slug(cls) + '@' + DOMAIN; };
  var pwOf = function (pin) { return 'ace-' + pin + '-quiz'; };
  var nice = function (e) {
    var m = (e && e.message) || String(e);
    if (/rate|too many|429/i.test(m)) return new Error('Trop de connexions en même temps. Réessayez dans une minute.');
    if (/relation|does not exist|schema cache|function/i.test(m)) return new Error('Serveur du quiz non configuré (script SQL à exécuter).');
    if (/fetch|network/i.test(m)) return new Error('Connexion au serveur impossible. Vérifiez le réseau.');
    return new Error(m);
  };
  var uid = async function () { var s = await Q.sb.auth.getSession(); return s.data.session ? s.data.session.user.id : null; };
  var getP = function () { try { return JSON.parse(localStorage.getItem(PK) || '[]'); } catch (e) { return []; } };
  var setP = function (a) { try { localStorage.setItem(PK, JSON.stringify(a)); } catch (e) {} };

  Q.me = async function () {
    await Q.ready;
    var id = await uid(); if (!id) return null;
    var ed = await Q.sb.from('editors').select('user_id').eq('user_id', id).maybeSingle();
    if (ed.data) return { prof: true, id: id };
    var st = await Q.sb.from('quiz_students').select('cls,pseudo').eq('user_id', id).maybeSingle();
    if (st.error) throw nice(st.error);
    return st.data ? { cls: st.data.cls, pseudo: st.data.pseudo, id: id } : null;
  };
  Q.CLASSES = ['B1 EIDM', 'B2 EIDM', 'B3 EIDM', 'B1 ESDAC', 'B2 ESDAC', 'B3 ESDAC'];
  Q.setClass = async function (userId, cls) {
    await Q.ready;
    var r = await Q.sb.from('quiz_students').update({ cls: cls }).eq('user_id', userId);
    if (r.error) throw r.error.code === '23505' ? new Error('Ce pseudo existe déjà dans la classe ' + cls + '.') : nice(r.error);
  };

  Q.studentLogin = async function (cls, pseudo, pin, nom) {
    await Q.ready;
    var password = pwOf(pin), r, email;
    var ex = await Q.sb.rpc('quiz_login_email', { p_cls: cls, p_pseudo: pseudo });
    if (ex.error) throw nice(ex.error);
    email = ex.data || emailOf(cls, pseudo).replace('@', '.' + Math.random().toString(36).slice(2, 6) + '@');
    if (!ex.data) {
      if (!nom || nom.length < 3) throw new Error('Première connexion : indiquez votre nom et prénom.');
      r = await Q.sb.auth.signUp({ email: email, password: password });
      if (r.error && !/registered|exists/i.test(r.error.message)) throw nice(r.error);
      if (!r.error && !r.data.session) throw new Error('Compte créé mais non activé : désactivez « Confirm email » dans Supabase.');
    }
    if (!r || r.error) {
      r = await Q.sb.auth.signInWithPassword({ email: email, password: password });
      if (r.error) throw /invalid/i.test(r.error.message) ? new Error('Ce pseudo existe déjà dans cette classe avec un autre code.') : nice(r.error);
    }
    var id = r.data.user.id;
    var has = await Q.sb.from('quiz_students').select('user_id').eq('user_id', id).maybeSingle();
    if (!has.data) {
      var ins = await Q.sb.from('quiz_students').insert({ user_id: id, cls: cls, pseudo: pseudo, nom: nom || null });
      if (ins.error) { await Q.sb.auth.signOut(); throw ins.error.code === '23505' ? new Error('Ce pseudo est déjà pris dans cette classe.') : nice(ins.error); }
    }
    return Q.me();
  };

  Q.teacherLogin = async function (email, password) {
    await Q.ready;
    var r = await Q.sb.auth.signInWithPassword({ email: email, password: password });
    if (r.error) throw /invalid/i.test(r.error.message) ? new Error('Identifiants incorrects.') : nice(r.error);
    var me = await Q.me();
    if (!me || !me.prof) { await Q.sb.auth.signOut(); throw new Error('Ce compte n’a pas les droits enseignant.'); }
    return me;
  };

  Q.logout = async function () { await Q.ready; await Q.sb.auth.signOut(); };

  Q.config = async function (module) {
    await Q.ready;
    var r = await Q.sb.from('quiz_config').select('open,qedit').eq('module', module).maybeSingle();
    if (r.error) throw nice(r.error);
    return r.data || { open: {}, qedit: {} };
  };
  Q.saveConfig = async function (module, open, qedit) {
    await Q.ready;
    var r = await Q.sb.from('quiz_config').upsert({ module: module, open: open || {}, qedit: qedit || {}, updated_at: new Date().toISOString() });
    if (r.error) throw nice(r.error);
  };

  Q.myAttempts = async function (module) {
    await Q.ready;
    var id = await uid();
    var r = await Q.sb.from('quiz_attempts').select('sid,note,pts,training,created_at').eq('module', module).eq('user_id', id).order('created_at');
    if (r.error) throw nice(r.error);
    return r.data;
  };
  Q.pending = function (module, id) { return getP().filter(function (p) { return p.module === module && p.uid === id; }); };

  var insert = function (row) { return Q.sb.from('quiz_attempts').insert(row).select('sid,note,pts,training,created_at').single().then(function (r) { return r; }, function (e) { return { error: e }; }); };
  Q.addAttempt = async function (a) {
    await Q.ready;
    var id = await uid();
    var row = { module: a.module, sid: a.sid, note: a.note, pts: a.pts, detail: { scores: a.scores, client_at: new Date().toISOString() } };
    var r = await insert(row);
    if (r.error) { var L = getP(); L.push(Object.assign({ uid: id, training: a.training, created_at: row.detail.client_at }, row)); setP(L); return null; }
    return r.data;
  };
  Q.flush = async function () {
    await Q.ready;
    var id = await uid(), L = getP(); if (!L.length || !id) return 0;
    var keep = [], sent = 0;
    for (var i = 0; i < L.length; i++) {
      var p = L[i];
      if (p.uid !== id) { keep.push(p); continue; }
      var r = await insert({ module: p.module, sid: p.sid, note: p.note, pts: p.pts, detail: p.detail });
      if (r.error) keep.push(p); else sent++;
    }
    setP(keep); return sent;
  };

  Q.allData = async function (module) {
    await Q.ready;
    var a = await Q.sb.from('quiz_attempts').select('user_id,sid,note,pts,training,created_at').eq('module', module).order('created_at').range(0, 9999);
    if (a.error) throw nice(a.error);
    var s = await Q.sb.from('quiz_students').select('user_id,cls,pseudo,nom').range(0, 9999);
    if (s.error) throw nice(s.error);
    var ids = {}, classes = {};
    a.data.forEach(function (x) { ids[x.user_id] = 1; });
    s.data.forEach(function (x) { if (ids[x.user_id]) classes[x.cls] = 1; });
    return { students: s.data.filter(function (x) { return classes[x.cls]; }), attempts: a.data };
  };
})();
