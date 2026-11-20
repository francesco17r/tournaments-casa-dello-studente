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

  function numeroGironi(n, formato) {
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

  function sorteggiaGironi(ids, formato) {
    var mescolati = shuffle(ids);
    var g = numeroGironi(ids.length, formato);
    var gironi = [];
    for (var i = 0; i < g; i++) gironi.push({ nome: String.fromCharCode(65 + i), membri: [] });
    mescolati.forEach(function (id, i) { gironi[i % g].membri.push(id); });
    gironi.forEach(function (gr) { gr.partite = calendarioGirone(gr.membri, gr.nome); });
    return gironi;
  }

  function giocata(p) {
    return p.ra !== null && p.ra !== undefined && p.ra !== '' && p.rb !== null && p.rb !== undefined && p.rb !== '';
  }

  // Punti in classifica: scacchi = punti partita (1, ½, 0); altri = 3 per vittoria.
  function puntiPartita(gioco, mio, suo) {
    if (gioco === 'scacchi') return mio;
    return mio > suo ? 3 : 0;
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

  // Dai gironi: primi e secondi qualificati, tabellone con bye e senza scontri tra squadre dello stesso girone al primo turno.
  function creaEliminazione(gioco, gironi) {
    var primi = [], secondi = [];
    gironi.forEach(function (g) {
      var c = classifica(gioco, g);
      if (c[0]) primi.push({ id: c[0].id, girone: g.nome });
      if (c[1]) secondi.push({ id: c[1].id, girone: g.nome });
    });
    var q = primi.length + secondi.length;
    var size = 1; while (size < q) size *= 2;
    var ordine = ordineTeste(size);
    var migliore = null;
    for (var tentativo = 0; tentativo < 300; tentativo++) {
      var teste = shuffle(primi).concat(shuffle(secondi));
      var posti = ordine.map(function (s) { return teste[s - 1] || null; });
      var conflitti = 0;
      for (var i = 0; i < posti.length; i += 2) {
        if (posti[i] && posti[i + 1] && posti[i].girone === posti[i + 1].girone) conflitti++;
      }
      if (!migliore || conflitti < migliore.c) migliore = { posti: posti, c: conflitti };
      if (conflitti === 0) break;
    }
    var primoTurno = [];
    for (var j = 0; j < migliore.posti.length; j += 2) {
      primoTurno.push([migliore.posti[j] ? migliore.posti[j].id : null, migliore.posti[j + 1] ? migliore.posti[j + 1].id : null]);
    }
    if (size === 1) primoTurno = [[migliore.posti[0] ? migliore.posti[0].id : null, null]];
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
        m.vincitore = undefined;
        if (m.definitaA && m.definitaB) {
          if (m.a && !m.b) { m.bye = true; m.vincitore = m.a; }
          else if (!m.a && m.b) { m.bye = true; m.vincitore = m.b; }
          else if (!m.a && !m.b) { m.bye = true; m.vincitore = null; }
          else if (giocata(m) && Number(m.ra) !== Number(m.rb)) {
            m.vincitore = Number(m.ra) > Number(m.rb) ? m.a : m.b;
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
    sorteggiaGironi: sorteggiaGironi,
    classifica: classifica,
    giocata: giocata,
    partiteMancanti: partiteMancanti,
    creaEliminazione: creaEliminazione,
    turniEliminazione: turniEliminazione,
    campione: campione,
    dataLunga: dataLunga, dataBreve: dataBreve, isoData: isoData, parseData: parseData,
    scadenzeEliminazione: scadenzeEliminazione
  };
})(typeof window !== 'undefined' ? window : globalThis);
