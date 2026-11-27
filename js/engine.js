/* Logica dei tornei: gironi, classifiche, eliminazione diretta.
   Usato sia dal sito pubblico (index.html) sia dalla pagina organizzatore (admin.html). */
(function (root) {
  'use strict';

  var GIOCHI = ['biliardino', 'pingpong', 'scacchi'];

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function uid(prefix) {
    return prefix + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- Iscrizioni ---------- */

  // Biliardino: righe "Nome + Nome" sono coppie, righe con un solo nome vengono abbinate a caso.
  // Restituisce { squadre: [nomi], spaiato: nome|null }
  function formaCoppie(righe) {
    var coppie = [], singoli = [];
    righe.forEach(function (r) {
      var pronta = r.match(/^(.*?)\s*\(team\)\s*$/i);
      if (pronta && pronta[1]) { coppie.push(pronta[1].trim()); return; }
      var parti = r.split('+').map(function (s) { return s.trim(); }).filter(Boolean);
      if (parti.length >= 2) coppie.push(parti.join(' + '));
      else if (parti.length === 1) singoli.push(parti[0]);
    });
    singoli = shuffle(singoli);
    var spaiato = null;
    if (singoli.length % 2 === 1) spaiato = singoli.pop();
    for (var i = 0; i < singoli.length; i += 2) coppie.push(singoli[i] + ' + ' + singoli[i + 1]);
    return { squadre: coppie, spaiato: spaiato };
  }

  /* ---------- Gironi ---------- */

  function numeroGironi(n, formato, forzato) {
    if (forzato) return forzato;
    if (formato === 'girone-unico' || n <= 5) return 1;
    return Math.ceil(n / 4);
  }

  // Tutti contro tutti, ordinato a "giornate" con il metodo del cerchio.
  function calendarioGirone(ids, nomeGirone) {
    var lista = ids.slice();
    if (lista.length % 2 === 1) lista.push(null);
    var n = lista.length, partite = [], k = 1;
    for (var g = 0; g < n - 1; g++) {
      for (var i = 0; i < n / 2; i++) {
        var a = lista[i], b = lista[n - 1 - i];
        if (a && b) partite.push({ id: nomeGirone + k++, a: a, b: b, ra: null, rb: null });
      }
      lista.splice(1, 0, lista.pop());
    }
    return partite;
  }

  function sorteggiaGironi(ids, formato, nGironi) {
    var mescolati = shuffle(ids);
    var g = numeroGironi(ids.length, formato, nGironi);
    var gironi = [];
    for (var i = 0; i < g; i++) gironi.push({ nome: String.fromCharCode(65 + i), membri: [] });
    mescolati.forEach(function (id, i) { gironi[i % g].membri.push(id); });
    gironi.forEach(function (gr) { gr.partite = calendarioGirone(gr.membri, gr.nome); });
    return gironi;
  }

  // Girone unico in cui ogni squadra gioca solo "perSquadra" partite contro avversari sorteggiati.
  function sorteggiaCampionato(ids, perSquadra) {
    var n = ids.length, d = perSquadra;
    if (d >= n || (n * d) % 2 === 1) throw new Error('Impossibile: ' + n + ' squadre con ' + d + ' avversari ciascuna');
    var coppie = [];
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) coppie.push([ids[i], ids[j]]);
    for (var tent = 0; tent < 5000; tent++) {
      var grado = {}; ids.forEach(function (id) { grado[id] = 0; });
      var scelte = [];
      shuffle(coppie).forEach(function (c) {
        if (grado[c[0]] < d && grado[c[1]] < d) { grado[c[0]]++; grado[c[1]]++; scelte.push(c); }
      });
      if (ids.every(function (id) { return grado[id] === d; })) {
        var partite = shuffle(scelte).map(function (c, k) {
          var inv = Math.random() < 0.5;
          return { id: 'A' + (k + 1), a: inv ? c[1] : c[0], b: inv ? c[0] : c[1], ra: null, rb: null };
        });
        return [{ nome: 'A', membri: ids.slice(), partite: partite }];
      }
    }
    throw new Error('Sorteggio non riuscito, riprova');
  }

  function giocata(p) {
    return p.ra !== null && p.ra !== undefined && p.ra !== '' && p.rb !== null && p.rb !== undefined && p.rb !== '';
  }

  // Punti in classifica: scacchi = somma dei punti di andata e ritorno (0–2); altri = 1 per vittoria.
  function puntiPartita(gioco, mio, suo) {
    if (gioco === 'scacchi') return mio;
    return mio > suo ? 1 : 0;
  }

  function classifica(gioco, girone) {
    var righe = {};
    girone.membri.forEach(function (id) {
      righe[id] = { id: id, g: 0, v: 0, p: 0, s: 0, fatti: 0, subiti: 0, punti: 0 };
    });
    girone.partite.forEach(function (m) {
      if (!giocata(m)) return;
      var ra = Number(m.ra), rb = Number(m.rb);
      [[m.a, ra, rb], [m.b, rb, ra]].forEach(function (x) {
        var r = righe[x[0]]; if (!r) return;
        r.g++; r.fatti += x[1]; r.subiti += x[2];
        if (x[1] > x[2]) r.v++; else if (x[1] < x[2]) r.s++; else r.p++;
        r.punti += puntiPartita(gioco, x[1], x[2]);
      });
    });
    // Bye (girone in cui non tutti possono giocare lo stesso numero di incontri): vale come incontro vinto.
    (girone.bye || []).forEach(function (id) {
      var r = righe[id]; if (!r) return;
      var vinti = gioco === 'scacchi' ? 2 : 1;
      r.g++; r.v++; r.fatti += vinti; r.punti += gioco === 'scacchi' ? 2 : 1;
    });
    var lista = Object.keys(righe).map(function (k) { return righe[k]; });

    function scontroDiretto(a, b) {
      for (var i = 0; i < girone.partite.length; i++) {
        var m = girone.partite[i];
        if (!giocata(m)) continue;
        if (m.a === a.id && m.b === b.id) return Number(m.rb) - Number(m.ra);
        if (m.a === b.id && m.b === a.id) return Number(m.ra) - Number(m.rb);
      }
      return 0;
    }

    lista.sort(function (a, b) {
      if (b.punti !== a.punti) return b.punti - a.punti;
      var pari = lista.filter(function (x) { return x.punti === a.punti; });
      if (pari.length === 2) {
        var sd = scontroDiretto(a, b);
        if (sd !== 0) return sd;
      }
      if (gioco === 'scacchi') {
        if (b.v !== a.v) return b.v - a.v;
      } else {
        var da = a.fatti - a.subiti, db = b.fatti - b.subiti;
        if (db !== da) return db - da;
        if (b.fatti !== a.fatti) return b.fatti - a.fatti;
      }
      return 0;
    });
    return lista;
  }

  function partiteMancanti(gironi) {
    var n = 0;
    (gironi || []).forEach(function (g) { g.partite.forEach(function (m) { if (!giocata(m)) n++; }); });
    return n;
  }

  /* ---------- Eliminazione diretta ---------- */

  // Ordine standard delle teste di serie in un tabellone di dimensione n (potenza di 2).
  function ordineTeste(n) {
    var o = [1];
    while (o.length < n) {
      var m = o.length * 2 + 1, nuovo = [];
      o.forEach(function (s) { nuovo.push(s, m - s); });
      o = nuovo;
    }
    return o;
  }

  // Dai gironi: i primi "q" di ogni girone. Girone unico: teste di serie in ordine di classifica.
  // Più gironi (q = 2): primi e secondi, senza scontri dello stesso girone al primo turno.
  // Schema fisso del primo turno con più gironi (numero di gironi potenza di 2, primi 2 di ogni girone):
  // metà alta 1°A–2°B, 1°C–2°D…; metà bassa 1°B–2°A, 1°D–2°C… Così due dello stesso girone
  // si possono incontrare solo in finale. Ritorna coppie di { girone, pos } oppure null.
  function schemaGironi(nomi, q) {
    var ng = nomi.length;
    if (ng < 2 || q !== 2 || (ng & (ng - 1)) !== 0) return null;
    var alta = [], bassa = [];
    for (var i = 0; i < ng; i += 2) {
      alta.push([{ girone: nomi[i], pos: 1 }, { girone: nomi[i + 1], pos: 2 }]);
      bassa.push([{ girone: nomi[i + 1], pos: 1 }, { girone: nomi[i], pos: 2 }]);
    }
    return alta.concat(bassa);
  }

  // Anteprima del tabellone prima della fine dei gironi: gli id sono etichette tipo "1A" (1° del girone A) o "3" (3° classificato).
  function anteprimaEliminazione(gironi, q) {
    q = q || 2;
    if (!gironi || !gironi.length) return null;
    var pt = [];
    if (gironi.length === 1) {
      var size = 1; while (size < q) size *= 2;
      var posti = ordineTeste(size).map(function (sd) { return sd <= q ? String(sd) : null; });
      for (var k = 0; k < posti.length; k += 2) pt.push([posti[k], posti[k + 1]]);
      return { primoTurno: pt, risultati: {} };
    }
    var sc = schemaGironi(gironi.map(function (g) { return g.nome; }), q);
    if (!sc) return null;
    return { primoTurno: sc.map(function (c) { return [c[0].pos + c[0].girone, c[1].pos + c[1].girone]; }), risultati: {} };
  }

  function creaEliminazione(gioco, gironi, q) {
    q = q || 2;
    var size, posti, migliore;
    var schema = gironi.length > 1 ? schemaGironi(gironi.map(function (g) { return g.nome; }), q) : null;
    if (schema) {
      var cls = {};
      gironi.forEach(function (g) { cls[g.nome] = classifica(gioco, g); });
      return {
        primoTurno: schema.map(function (c) {
          return c.map(function (x) { var r = cls[x.girone][x.pos - 1]; return r ? r.id : null; });
        }),
        risultati: {}
      };
    }
    if (gironi.length === 1) {
      var cl = classifica(gioco, gironi[0]).slice(0, q).map(function (r) { return r.id; });
      size = 1; while (size < cl.length) size *= 2;
      posti = ordineTeste(size).map(function (sd) { return cl[sd - 1] || null; });
      var pt = [];
      for (var k = 0; k < posti.length; k += 2) pt.push([posti[k], posti[k + 1]]);
      return { primoTurno: pt, risultati: {} };
    }
    var primi = [], secondi = [];
    gironi.forEach(function (g) {
      var c = classifica(gioco, g);
      if (c[0]) primi.push({ id: c[0].id, girone: g.nome });
      if (c[1]) secondi.push({ id: c[1].id, girone: g.nome });
    });
    var tot = primi.length + secondi.length;
    size = 1; while (size < tot) size *= 2;
    var ordine = ordineTeste(size);
    migliore = null;
    for (var tentativo = 0; tentativo < 300; tentativo++) {
      var teste = shuffle(primi).concat(shuffle(secondi));
      var pp = ordine.map(function (sd) { return teste[sd - 1] || null; });
      var conflitti = 0;
      for (var x = 0; x < pp.length; x += 2) {
        if (pp[x] && pp[x + 1] && pp[x].girone === pp[x + 1].girone) conflitti++;
      }
      if (!migliore || conflitti < migliore.c) migliore = { posti: pp, c: conflitti };
      if (conflitti === 0) break;
    }
    var primoTurno = [];
    for (var y = 0; y < migliore.posti.length; y += 2) {
      primoTurno.push([migliore.posti[y] ? migliore.posti[y].id : null, migliore.posti[y + 1] ? migliore.posti[y + 1].id : null]);
    }
    return { primoTurno: primoTurno, risultati: {} };
  }

  function nomeTurno(numPartite) {
    if (numPartite === 1) return 'Final';
    if (numPartite === 2) return 'Semi-finals';
    if (numPartite === 4) return 'Quarter-finals';
    if (numPartite === 8) return 'Round of 16';
    if (numPartite === 16) return 'Round of 32';
    return 'Round of ' + numPartite * 2;
  }

  // Ricostruisce tutti i turni dal primo turno e dai risultati salvati.
  // Ogni partita: { id, a, b, ra, rb, bye, vincitore, pronta }
  // a/b: id della squadra, null = bye (solo al primo turno) oppure "da definire".
  function turniEliminazione(el) {
    if (!el || !el.primoTurno) return [];
    var turni = [], corrente = [];
    el.primoTurno.forEach(function (coppia, i) {
      corrente.push({ id: 'r1m' + i, a: coppia[0], b: coppia[1], definitaA: true, definitaB: true });
    });
    var r = 1;
    while (true) {
      corrente.forEach(function (m) {
        var res = el.risultati[m.id] || {};
        m.ra = res.ra === undefined ? null : res.ra;
        m.rb = res.rb === undefined ? null : res.rb;
        m.sp = res.sp || null; m.l1 = res.l1; m.l2 = res.l2;
        m.vincitore = undefined;
        if (m.definitaA && m.definitaB) {
          if (m.a && !m.b) { m.bye = true; m.vincitore = m.a; }
          else if (!m.a && m.b) { m.bye = true; m.vincitore = m.b; }
          else if (!m.a && !m.b) { m.bye = true; m.vincitore = null; }
          else if (giocata(m) && Number(m.ra) !== Number(m.rb)) {
            m.vincitore = Number(m.ra) > Number(m.rb) ? m.a : m.b;
          } else if (giocata(m) && m.sp) {
            m.vincitore = m.sp === 'a' ? m.a : m.b; // spareggio dopo parità
          }
        }
        m.pronta = m.definitaA && m.definitaB && m.a && m.b;
      });
      turni.push({ nome: nomeTurno(corrente.length), partite: corrente });
      if (corrente.length === 1) break;
      var prossimo = [];
      r++;
      for (var i = 0; i < corrente.length; i += 2) {
        var x = corrente[i], y = corrente[i + 1];
        prossimo.push({
          id: 'r' + r + 'm' + (i / 2),
          a: x.vincitore === undefined ? null : x.vincitore,
          b: y.vincitore === undefined ? null : y.vincitore,
          definitaA: x.vincitore !== undefined,
          definitaB: y.vincitore !== undefined
        });
      }
      corrente = prossimo;
    }
    return turni;
  }

  function campione(gioco, g) {
    if (g.fase === 'eliminazione') {
      var t = turniEliminazione(g.eliminazione);
      var f = t.length ? t[t.length - 1].partite[0] : null;
      return f && f.vincitore ? f.vincitore : null;
    }
    if (g.formato === 'girone-unico' && g.gironi && g.gironi.length === 1 && partiteMancanti(g.gironi) === 0) {
      return classifica(gioco, g.gironi[0])[0].id;
    }
    return null;
  }

  /* ---------- Date ---------- */

  var MESI = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var GIORNI = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function parseData(s) {
    if (!s) return null;
    var p = s.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function dataLunga(s) {
    var d = parseData(s); if (!d) return '';
    return GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()];
  }
  function dataBreve(s) {
    var d = parseData(s); if (!d) return '';
    return d.getDate() + ' ' + MESI[d.getMonth()].slice(0, 3);
  }
  function isoData(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Scadenze proposte per i turni a eliminazione: dal giorno dopo la fine dei gironi alla data finale.
  function scadenzeEliminazione(fineGironi, finale, numTurni) {
    var a = parseData(fineGironi), b = parseData(finale);
    var giorni = Math.round((b - a) / 86400000);
    var out = [];
    for (var k = 1; k <= numTurni; k++) {
      var d = new Date(a); d.setDate(d.getDate() + Math.round(k * giorni / numTurni));
      out.push(isoData(d));
    }
    return out;
  }

  root.Tornei = {
    GIOCHI: GIOCHI,
    shuffle: shuffle, uid: uid,
    formaCoppie: formaCoppie,
    numeroGironi: numeroGironi,
    sorteggiaGironi: sorteggiaGironi, calendarioGirone: calendarioGirone, sorteggiaCampionato: sorteggiaCampionato,
    classifica: classifica, anteprimaEliminazione: anteprimaEliminazione,
    giocata: giocata,
    partiteMancanti: partiteMancanti,
    creaEliminazione: creaEliminazione,
    turniEliminazione: turniEliminazione,
    campione: campione,
    dataLunga: dataLunga, dataBreve: dataBreve, isoData: isoData, parseData: parseData,
    scadenzeEliminazione: scadenzeEliminazione
  };
})(typeof window !== 'undefined' ? window : globalThis);
