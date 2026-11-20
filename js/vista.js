/* Rendering condiviso: usato dal sito pubblico e come anteprima nella pagina organizzatore. */
(function (root) {
  'use strict';
  var T = root.Tornei;

  var META = {
    biliardino: { nome: 'Table football', colore: 'var(--biliardino)', formula: '2 vs 2', unita: 'goals', descr: 'Teams of two, first to 10 goals' },
    pingpong: { nome: 'Table tennis', colore: 'var(--pingpong)', formula: '1 vs 1', unita: 'sets', descr: 'Singles, best of 3 sets to 11' },
    scacchi: { nome: 'Chess', colore: 'var(--scacchi)', formula: '1 vs 1', unita: 'points', descr: '15 minutes each + 10 seconds per move' }
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function nomi(g) {
    var m = {};
    (g.iscritti || []).forEach(function (e) { m[e.id] = e.nome; });
    return m;
  }

  function fmtPunti(x) {
    if (x % 1 === 0) return String(x);
    var intero = Math.floor(x);
    return (intero ? intero : '') + '½';
  }

  function fmtRis(gioco, v) {
    if (gioco === 'scacchi') return Number(v) === 0.5 ? '½' : String(v);
    return String(v);
  }

  function formatoEffettivo(g) {
    if (g.formatoUsato) return g.formatoUsato;
    if (g.formato === 'automatico') return (g.iscritti || []).length <= 8 ? 'girone-unico' : 'gironi';
    return g.formato;
  }

  function descrFormato(gioco, g) {
    var f = formatoEffettivo(g);
    if (f === 'girone-unico') return 'Single round robin';
    if (g.formato === 'automatico' && g.fase === 'iscrizioni') return 'Up to 8 players round robin, more than 8 groups + knockout';
    return 'Groups + knockout';
  }

  function statoGioco(gioco, g) {
    var c = T.campione(gioco, g);
    if (c) return { testo: 'Finished', cls: 'ok' };
    if (g.fase === 'iscrizioni') return { testo: 'Sign-up open', cls: 'live' };
    if (g.fase === 'gironi') return { testo: formatoEffettivo(g) === 'girone-unico' ? 'Round robin in progress' : 'Group stage', cls: 'live' };
    if (g.fase === 'eliminazione') return { testo: 'Knockout stage', cls: 'live' };
    return { testo: g.fase, cls: '' };
  }

  function tabellaClassifica(gioco, girone, n, qualificati) {
    var cl = T.classifica(gioco, girone);
    var scacchi = gioco === 'scacchi';
    var h = '<div class="table-wrap"><table><thead><tr><th>#</th><th>' + (gioco === 'biliardino' ? 'Team' : 'Player') + '</th>' +
      '<th class="num" title="Played">P</th><th class="num" title="Won">W</th>' +
      (scacchi ? '<th class="num" title="Drawn">D</th>' : '') +
      '<th class="num" title="Lost">L</th>' +
      (scacchi ? '' : '<th class="num" title="' + META[gioco].unita + ' difference">Diff</th>') +
      '<th class="num">Pts</th></tr></thead><tbody>';
    cl.forEach(function (r, i) {
      var diff = r.fatti - r.subiti;
      h += '<tr' + (i < qualificati ? ' class="qual"' : '') + '><td class="num">' + (i + 1) + '</td><td class="name">' + esc(n[r.id]) + '</td>' +
        '<td class="num">' + r.g + '</td><td class="num">' + r.v + '</td>' +
        (scacchi ? '<td class="num">' + r.p + '</td>' : '') +
        '<td class="num">' + r.s + '</td>' +
        (scacchi ? '' : '<td class="num">' + (diff > 0 ? '+' : '') + diff + '</td>') +
        '<td class="num"><strong>' + fmtPunti(r.punti) + '</strong></td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function listaPartite(gioco, partite, n, scadenza) {
    var h = '<ul class="matches">';
    partite.forEach(function (m) {
      var fatta = T.giocata(m);
      var ra = Number(m.ra), rb = Number(m.rb);
      var ca = fatta ? (ra > rb ? 'win' : ra < rb ? 'lose' : '') : '';
      var cb = fatta ? (rb > ra ? 'win' : rb < ra ? 'lose' : '') : '';
      h += '<li><span class="a ' + ca + '">' + esc(n[m.a]) + '</span>' +
        (fatta ? '<span class="score">' + fmtRis(gioco, m.ra) + ' – ' + fmtRis(gioco, m.rb) + '</span>'
          : '<span class="score pending">' + (scadenza ? 'by ' + T.dataBreve(scadenza) : 'to play') + '</span>') +
        '<span class="' + cb + '">' + esc(n[m.b]) + '</span></li>';
    });
    return h + '</ul>';
  }

  function gironiHtml(gioco, g, n) {
    var unico = g.gironi.length === 1;
    var qual = formatoEffettivo(g) === 'girone-unico' ? 1 : 2;
    var h = '<div class="' + (unico ? 'stack' : 'grid gironi') + '">';
    g.gironi.forEach(function (gr) {
      var mancano = gr.partite.filter(function (m) { return !T.giocata(m); }).length;
      h += '<section class="card stack" style="--c:' + META[gioco].colore + '">' +
        '<div class="row" style="justify-content:space-between"><h3>' + (unico ? 'Round robin' : 'Group ' + esc(gr.nome)) + '</h3>' +
        '<span class="chip' + (mancano ? '' : ' ok') + '">' + (mancano ? mancano + ' to play' : 'Complete') + '</span></div>' +
        tabellaClassifica(gioco, gr, n, qual) +
        listaPartite(gioco, gr.partite, n, g.scadenze && g.scadenze.gironi) +
        '</section>';
    });
    return h + '</div>';
  }

  function tabelloneHtml(gioco, g, n) {
    var turni = T.turniEliminazione(g.eliminazione);
    var scad = (g.scadenze && g.scadenze.eliminazione) || [];
    var h = '<div class="bracket">';
    turni.forEach(function (t, ti) {
      h += '<div class="col"><div class="colhead"><h3>' + esc(t.nome) + '</h3>' +
        (scad[ti] ? '<span class="muted mono" style="font-size:.8rem">by ' + T.dataBreve(scad[ti]) + '</span>' : '') + '</div>';
      t.partite.forEach(function (m) {
        if (ti === 0 && m.bye) {
          h += '<div class="bm bye"><div class="side"><span>' + esc(n[m.vincitore] || '') + '</span><span class="muted">bye</span></div></div>';
          return;
        }
        h += '<div class="bm">' + lato(m, 'a', ti) + lato(m, 'b', ti) + '</div>';
      });
      h += '</div>';
    });
    return h + '</div>';

    function lato(m, k, ti) {
      var id = m[k], definita = k === 'a' ? m.definitaA : m.definitaB;
      var nome = id ? esc(n[id]) : (definita ? '<span class="tbd">bye</span>' : '<span class="tbd">TBD</span>');
      var cls = m.vincitore !== undefined && m.vincitore !== null ? (m.vincitore === id ? 'win' : 'lose') : '';
      var r = T.giocata(m) ? '<span class="score">' + fmtRis(gioco, m['r' + k]) + '</span>' : '';
      return '<div class="side ' + cls + '"><span>' + nome + '</span>' + r + '</div>';
    }
  }

  function giocoHtml(gioco, g, dati) {
    var meta = META[gioco], n = nomi(g), stato = statoGioco(gioco, g);
    var h = '<div class="stack-lg" style="--c:' + meta.colore + '">';
    h += '<div class="stack"><div class="row"><span class="dot"></span><span class="eyebrow">' + esc(meta.formula) + ' · ' + esc(descrFormato(gioco, g)) + '</span></div>' +
      '<div class="row" style="justify-content:space-between"><h2>' + esc(meta.nome) + '</h2><span class="chip ' + stato.cls + '">' + esc(stato.testo) + '</span></div>' +
      '<p class="muted">' + esc(meta.descr) + '.</p></div>';

    var c = T.campione(gioco, g);
    if (c) {
      h += '<div class="card champion"><span class="eyebrow">' + (gioco === 'biliardino' ? 'Winners' : 'Winner') + '</span><strong>' + esc(n[c]) + '</strong></div>';
    }

    if (g.fase === 'iscrizioni') {
      var cal = dati.calendario || {};
      h += '<div class="card stack"><h3>Sign-up open until ' + esc(T.dataLunga(cal.chiusuraIscrizioni)) + '</h3>' +
        '<p>The draw takes place on ' + esc(T.dataLunga(cal.sorteggio)) + '. ' +
        (gioco === 'biliardino' ? 'Sign up with a partner or on your own: players on their own are paired at random.' : '') + '</p>' +
        bottoneIscrizione(dati) + '</div>';
      if ((g.iscritti || []).length) {
        h += '<section class="stack"><h3>Signed up (' + g.iscritti.length + ')</h3><div class="card"><ul class="matches">' +
          g.iscritti.map(function (e) { return '<li style="grid-template-columns:1fr"><span>' + esc(e.nome) + '</span></li>'; }).join('') +
          '</ul></div></section>';
      }
      return h + '</div>';
    }

    if (g.fase === 'eliminazione' && g.eliminazione) {
      h += '<section class="stack"><h3>Knockout</h3><p class="muted">Each match can be played as soon as both opponents are known, before the round deadline.</p>' + tabelloneHtml(gioco, g, n) + '</section>';
      h += '<details><summary>Group stage results</summary><div style="margin-top:12px">' + gironiHtml(gioco, g, n) + '</div></details>';
    } else if (g.gironi && g.gironi.length) {
      var unico = formatoEffettivo(g) === 'girone-unico';
      h += '<section class="stack"><div class="stack" style="gap:4px"><h3>' + (unico ? 'Standings and matches' : 'Groups') + '</h3>' +
        '<p class="muted">Matches can be played in any order' + (g.scadenze && g.scadenze.gironi ? ', all by ' + esc(T.dataLunga(g.scadenze.gironi)) : '') + '.' +
        (unico ? '' : ' The top 2 of each group go through to the knockout stage.') + '</p></div>' +
        gironiHtml(gioco, g, n) + '</section>';
    }
    return h + '</div>';
  }

  function bottoneIscrizione(dati) {
    if (dati.linkIscrizioni) {
      return '<div><a class="btn" style="background:var(--accent);color:var(--accent-ink);border-color:var(--accent)" href="' + esc(dati.linkIscrizioni) + '" target="_blank" rel="noopener">Sign up</a></div>';
    }
    return '<p class="muted">To sign up, message ' + esc(dati.contatto || 'the organiser') + ' with your name, room number and game.</p>';
  }

  root.Vista = {
    META: META, esc: esc, nomi: nomi, fmtPunti: fmtPunti, fmtRis: fmtRis,
    formatoEffettivo: formatoEffettivo, statoGioco: statoGioco, tabellaClassifica: tabellaClassifica,
    giocoHtml: giocoHtml, gironiHtml: gironiHtml, tabelloneHtml: tabelloneHtml,
    bottoneIscrizione: bottoneIscrizione
  };
})(window);
