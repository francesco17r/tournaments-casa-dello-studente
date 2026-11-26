/* Rendering condiviso: usato dal sito pubblico e come anteprima nella pagina organizzatore. */
(function (root) {
  'use strict';
  var T = root.Tornei;

  var META = {
    biliardino: { nome: 'Table football', colore: 'var(--biliardino)', formula: '2 vs 2', unita: 'games', descr: 'Teams of two. A match is best of 3 games, each game to 10 goals' },
    pingpong: { nome: 'Ping pong', colore: 'var(--pingpong)', formula: '1 vs 1', unita: 'sets', descr: 'Singles. A match is best of 3 sets, each set to 11' },
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

  // Numero di iscritti: dall'elenco nomi se c'è, altrimenti dal conteggio inserito a mano.
  function numIscritti(g) {
    var n = (g.iscritti || []).length;
    return n || Number(g.numeroIscritti) || 0;
  }

  function formatoEffettivo(g) {
    if (g.formatoUsato) return g.formatoUsato;
    if (g.formato === 'automatico') return numIscritti(g) <= 8 ? 'girone-unico' : 'gironi';
    return g.formato;
  }

  function qualificatiDi(g) {
    if (g.qualificati) return g.qualificati;
    var f = formatoEffettivo(g);
    return f === 'girone-unico' ? 1 : f === 'campionato' ? 4 : 2;
  }

  function unitaIscritti(gioco) { return gioco === 'biliardino' ? 'teams' : 'players'; }

  function descrFormato(gioco, g) {
    if (g.formato === 'automatico' && g.fase === 'iscrizioni') return 'Format to be announced';
    var f = formatoEffettivo(g);
    if (f === 'campionato') return 'One league of ' + numIscritti(g) + ' + knockout for the top ' + qualificatiDi(g);
    if (f === 'gironi' && g.numGironi) return g.numGironi + ' groups + knockout for the top ' + qualificatiDi(g) + ' of each';
    if (f === 'girone-unico') return 'Single round robin';
    if (g.formato === 'automatico' && g.fase === 'iscrizioni') return 'Up to 8 players round robin, more than 8 groups + knockout';
    return 'Groups + knockout';
  }

  function statoGioco(gioco, g, dati) {
    var c = T.campione(gioco, g);
    if (c) return { testo: 'Finished', cls: 'ok' };
    var chiusura = dati && dati.calendario && dati.calendario.chiusuraIscrizioni;
    if (g.fase === 'iscrizioni' && chiusura && T.isoData(new Date()) > chiusura) return { testo: 'Draw coming soon', cls: '' };
    if (g.fase === 'iscrizioni') return { testo: 'Sign-up open', cls: 'live' };
    if (g.fase === 'gironi') return { testo: formatoEffettivo(g) === 'girone-unico' ? 'Round robin in progress' : formatoEffettivo(g) === 'campionato' ? 'League stage' : 'Group stage', cls: 'live' };
    if (g.fase === 'eliminazione') return { testo: 'Knockout stage', cls: 'live' };
    return { testo: g.fase, cls: '' };
  }

  function tabellaClassifica(gioco, girone, n, qualificati) {
    var cl = T.classifica(gioco, girone);
    var scacchi = gioco === 'scacchi';
    var h = '<div class="table-wrap"><table><thead><tr><th>#</th><th>' + (gioco === 'biliardino' ? 'Team' : 'Player') + '</th>' +
      '<th class="num" title="Matches played">P</th><th class="num" title="Won">W</th>' +
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
    var qual = qualificatiDi(g);
    var h = '<div class="' + (unico ? 'stack' : 'grid gironi') + '">';
    g.gironi.forEach(function (gr) {
      var mancano = gr.partite.filter(function (m) { return !T.giocata(m); }).length;
      h += '<section class="card stack" style="--c:' + META[gioco].colore + '">' +
        '<div class="row" style="justify-content:space-between"><h3>' + (unico ? (formatoEffettivo(g) === 'campionato' ? 'League table' : 'Round robin') : 'Group ' + esc(gr.nome)) + '</h3>' +
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

  /* Illustrazioni dall'alto dei due tavoli. Colori fissi: sono scene con il loro fondo. */
  function banner(gioco, mini) {
    var cls = 'banner' + (mini ? ' mini' : '');
    if (gioco === 'biliardino') {
      var aste = [70, 160, 250, 350, 440, 530], h = '';
      aste.forEach(function (x, i) {
        var col = i % 2 === 0 ? '#e5484d' : '#3b82f6';
        var cnt = i === 0 || i === 5 ? 1 : i === 2 || i === 3 ? 5 : 3;
        h += '<line x1="' + x + '" y1="8" x2="' + x + '" y2="152" stroke="#c9d1d9" stroke-width="3" stroke-linecap="round"/>';
        for (var k = 0; k < cnt; k++) {
          var y = 80 + (k - (cnt - 1) / 2) * (cnt === 5 ? 26 : cnt === 3 ? 38 : 0);
          h += '<rect x="' + (x - 7) + '" y="' + (y - 11) + '" width="14" height="22" rx="6" fill="' + col + '"/><circle cx="' + x + '" cy="' + (y - 14) + '" r="5" fill="#f1d5b8"/>';
        }
      });
      return '<svg class="' + cls + '" viewBox="0 0 600 160" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Table football pitch seen from above">' +
        '<rect width="600" height="160" fill="#1f7a4d"/><rect x="6" y="6" width="588" height="148" rx="10" fill="none" stroke="#e8f5ee" stroke-width="2.5"/>' +
        '<line x1="300" y1="6" x2="300" y2="154" stroke="#e8f5ee" stroke-width="2.5"/><circle cx="300" cy="80" r="26" fill="none" stroke="#e8f5ee" stroke-width="2.5"/>' +
        '<rect x="6" y="52" width="40" height="56" fill="none" stroke="#e8f5ee" stroke-width="2.5"/><rect x="554" y="52" width="40" height="56" fill="none" stroke="#e8f5ee" stroke-width="2.5"/>' +
        h + '<circle cx="318" cy="92" r="8" fill="#fff"/><circle cx="318" cy="92" r="8" fill="none" stroke="#222" stroke-width="1.5"/></svg>';
    }
    if (gioco === 'pingpong') {
      return '<svg class="' + cls + '" viewBox="0 0 600 160" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ping pong table seen from above">' +
        '<rect width="600" height="160" fill="#16385e"/>' +
        '<rect x="60" y="22" width="480" height="116" rx="6" fill="#1f5fa6"/><rect x="60" y="22" width="480" height="116" rx="6" fill="none" stroke="#fff" stroke-width="4"/>' +
        '<line x1="60" y1="80" x2="540" y2="80" stroke="#fff" stroke-width="2"/>' +
        '<line x1="300" y1="14" x2="300" y2="146" stroke="#fff" stroke-width="5" stroke-dasharray="3 3"/>' +
        '<circle cx="30" cy="62" r="22" fill="#e5484d"/><rect x="48" y="58" width="22" height="8" rx="3" fill="#b5834f"/>' +
        '<circle cx="570" cy="100" r="22" fill="#222831"/><rect x="530" y="96" width="22" height="8" rx="3" fill="#b5834f"/>' +
        '<path d="M205 104 Q 255 40 345 70" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-dasharray="5 6"/>' +
        '<circle cx="345" cy="70" r="7" fill="#ffb454"/></svg>';
    }
    return '';
  }

  function formatoCard(gioco, g) {
    var f = formatoEffettivo(g), q = qualificatiDi(g), u = unitaIscritti(gioco), n = numIscritti(g);
    var righe = [];
    if (f === 'campionato') {
      righe.push('One league with all ' + n + ' ' + u + '.');
      righe.push('Each team plays ' + (g.avversari || 4) + ' matches against opponents drawn at random by the organiser.');
    } else if (f === 'gironi') {
      var ng = g.numGironi || T.numeroGironi(n, f);
      righe.push(ng + ' groups' + (n % ng === 0 ? ' of ' + (n / ng) : '') + '. Everyone plays everyone in their own group.');
    } else {
      righe.push('One group. Everyone plays everyone.');
    }
    righe.push('A match is best of 3 ' + (gioco === 'biliardino' ? 'games (each to 10 goals)' : 'sets (each to 11 points)') + '. A win is worth 1 point, a loss 0.');
    if (f === 'campionato') righe.push('The top ' + q + ' go through to the knockout stage.');
    else if (f === 'gironi') righe.push('The top ' + q + ' of each group go through to the knockout stage.');
    return '<div class="card stack"><h3>How this tournament works</h3><ul style="margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:4px">' +
      righe.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';
  }

  function giocoHtml(gioco, g, dati) {
    var meta = META[gioco], n = nomi(g), stato = statoGioco(gioco, g, dati);
    var h = '<div class="stack-lg" style="--c:' + meta.colore + '">';
    h += '<div class="stack"><div class="row"><span class="dot"></span><span class="eyebrow">' + esc(meta.formula) + ' · ' + esc(descrFormato(gioco, g)) + '</span></div>' +
      '<div class="row" style="justify-content:space-between"><h2>' + esc(meta.nome) + '</h2><span class="chip ' + stato.cls + '">' + esc(stato.testo) + '</span></div>' +
      '<p class="muted">' + esc(meta.descr) + '.</p></div>' + banner(gioco, false);

    var c = T.campione(gioco, g);
    if (c) {
      h += '<div class="card champion"><span class="eyebrow">' + (gioco === 'biliardino' ? 'Winners' : 'Winner') + '</span><strong>' + esc(n[c]) + '</strong></div>';
    }

    if (g.fase === 'iscrizioni') {
      var cal = dati.calendario || {};
      var chiuso = T.isoData(new Date()) > cal.chiusuraIscrizioni;
      if (gioco !== 'scacchi' || g.formato !== 'automatico') h += formatoCard(gioco, g);
      if (chiuso) {
        h += '<div class="card stack"><h3>Sign-up closed</h3>' +
          '<p><strong>' + numIscritti(g) + '</strong> ' + unitaIscritti(gioco) + ' signed up.</p>' +
          '<p>' + (g.formato === 'automatico' ? 'The format will be announced soon.' : 'The draw will be published here soon.') + '</p></div>';
      } else {
        h += '<div class="card stack"><h3>Sign-up open until ' + esc(T.dataLunga(cal.chiusuraIscrizioni)) + ' at 23:59</h3>' +
          '<p><strong>' + numIscritti(g) + '</strong> ' + unitaIscritti(gioco) + ' signed up so far.</p>' +
          '<p>The draw takes place on ' + esc(T.dataLunga(cal.sorteggio)) + '. ' +
          (gioco === 'biliardino' ? 'Sign up with a partner or on your own: players on their own are paired at random.' : '') + '</p>' +
          bottoneIscrizione(dati) + '</div>';
      }
      if ((g.iscritti || []).length) {
        h += '<section class="stack"><h3>Signed up (' + g.iscritti.length + ')</h3><div class="card"><ul class="matches">' +
          g.iscritti.map(function (e) {
            var eq = /\(team\)\s*$/i.test(e.nome);
            return '<li style="grid-template-columns:1fr"><span>' + esc(e.nome.replace(/\s*\(team\)\s*$/i, '')) + (eq ? ' <span class="muted">· team</span>' : '') + '</span></li>';
          }).join('') + '</ul></div></section>';
      }
      return h + '</div>';
    }

    if (g.fase === 'eliminazione' && g.eliminazione) {
      h += '<section class="stack"><h3>Knockout</h3><p class="muted">Each match can be played as soon as both opponents are known, before the round deadline.</p>' + tabelloneHtml(gioco, g, n) + '</section>';
      h += '<details><summary>Group stage results</summary><div style="margin-top:12px">' + gironiHtml(gioco, g, n) + '</div></details>';
    } else if (g.gironi && g.gironi.length) {
      var unico = g.gironi.length === 1;
      h += formatoCard(gioco, g);
      h += '<section class="stack"><div class="stack" style="gap:4px"><h3>' + (unico ? 'Standings and matches' : 'Groups') + '</h3>' +
        '<p class="muted">Matches can be played in any order' + (g.scadenze && g.scadenze.gironi ? ', all by ' + esc(T.dataLunga(g.scadenze.gironi)) : '') + '.' +
        (formatoEffettivo(g) === 'girone-unico' ? '' : ' The top ' + qualificatiDi(g) + (unico ? '' : ' of each group') + ' go through to the knockout stage.') + '</p></div>' +
        gironiHtml(gioco, g, n) + '</section>';
    }
    return h + '</div>';
  }

  function bottoneIscrizione(dati) {
    if (dati.linkIscrizioni) {
      return '<div><a class="btn" style="background:var(--accent);color:var(--accent-ink);border-color:var(--accent)" href="' + esc(dati.linkIscrizioni) + '" target="_blank" rel="noopener">Sign up</a></div><p class="muted">One form per tournament: if you want to play more than one, fill it in once for each.</p>';
    }
    return '<p class="muted">To sign up, message ' + esc(dati.contatto || 'the organiser') + ' with your name, room number and game. Sign up once for each tournament you want to join.</p>';
  }

  root.Vista = {
    META: META, esc: esc, nomi: nomi, fmtPunti: fmtPunti, fmtRis: fmtRis,
    formatoEffettivo: formatoEffettivo, qualificatiDi: qualificatiDi, unitaIscritti: unitaIscritti, banner: banner, formatoCard: formatoCard, numIscritti: numIscritti, statoGioco: statoGioco, tabellaClassifica: tabellaClassifica,
    giocoHtml: giocoHtml, gironiHtml: gironiHtml, tabelloneHtml: tabelloneHtml,
    bottoneIscrizione: bottoneIscrizione
  };
})(window);
