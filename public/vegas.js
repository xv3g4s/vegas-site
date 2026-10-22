/* Vegas Aceleradora — interatividade do site institucional.
 *
 * Um arquivo, todas as paginas, em cache a partir da segunda visita.
 *
 * Premissa: a pagina ja chega pronta do servidor. Nada aqui desenha conteudo.
 * Se este arquivo nao carregar, o site continua legivel, navegavel e o
 * formulario continua enviavel — e por isso que o menu usa <details> nativo e
 * o conteudo nasce visivel.
 *
 * A copia dos formularios para o Painel de Sites NAO esta aqui: quem faz e o
 * f.js, que escuta o submit no documento em fase de captura e reconhece os
 * campos sozinho. Um envio proprio daqui chegaria com outra chave de
 * idempotencia e viraria lead duplicado.
 */
(function () {
  'use strict';

  // Inbound Webhook do GoHighLevel. Vazio = o lead fica so no localStorage.
  var GHL_WEBHOOK = '';

  var d = document;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || d).querySelectorAll(s)); };

  // ============================================================== menu ====
  var menu = $('.sanduiche');
  if (menu) {
    var fecha = function () { menu.removeAttribute('open'); };
    var painel = $('.sanduiche-painel', menu);
    if (painel) {
      // Os links sao ancoras da propria pagina: sem isto o painel ficaria
      // aberto por cima do destino.
      painel.addEventListener('click', function (ev) {
        var a = ev.target && ev.target.closest && ev.target.closest('a');
        if (a) fecha();
      });
    }
    d.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' || ev.keyCode === 27) fecha();
    });
    d.addEventListener('click', function (ev) {
      if (menu.hasAttribute('open') && !menu.contains(ev.target)) fecha();
    });
    if (window.matchMedia) {
      // Acima de 1000px os links voltam para a barra: o painel aberto viraria
      // um bloco solto no meio da tela.
      var largo = window.matchMedia('(min-width: 1001px)');
      var aoMudar = function (e) { if (e.matches) fecha(); };
      if (largo.addEventListener) largo.addEventListener('change', aoMudar);
      else if (largo.addListener) largo.addListener(aoMudar);
    }
  }

  // ---- submenus do desktop ----
  // O CSS ja abre no :hover e no :focus-within, o que cobre mouse e teclado.
  // O clique existe para toque: em tela sensivel nao ha hover, e o primeiro
  // toque precisa abrir em vez de navegar.
  $$('.tem-sub').forEach(function (item) {
    var botao = $('button', item);
    if (!botao) return;
    botao.addEventListener('click', function () {
      var abrindo = !item.hasAttribute('data-aberto');
      $$('.tem-sub[data-aberto]').forEach(function (o) {
        o.removeAttribute('data-aberto');
        var b = $('button', o);
        if (b) b.setAttribute('aria-expanded', 'false');
      });
      if (abrindo) {
        item.setAttribute('data-aberto', '');
        botao.setAttribute('aria-expanded', 'true');
      }
    });
  });
  d.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('.tem-sub')) return;
    $$('.tem-sub[data-aberto]').forEach(function (o) {
      o.removeAttribute('data-aberto');
      var b = $('button', o);
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  });

  // ========================================================= cabecalho ====
  var topo = $('.topo');
  if (topo) {
    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset || d.documentElement.scrollTop;
        topo.style.boxShadow = y > 40 ? '0 10px 30px rgba(0,0,0,0.45)' : '';
        tick = false;
      });
    }, { passive: true });
  }

  // ============================================================== UTM =====
  var utm = (function () {
    var p = new URLSearchParams(location.search);
    var o = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']
      .forEach(function (k) { o[k] = p.get(k) || ''; });
    o.landing_page = location.href;
    o.referrer = d.referrer || '';
    // Quem chega por anuncio costuma navegar antes de converter: guardamos a
    // origem da PRIMEIRA visita para o lead nao virar "direto".
    try {
      var salvo = JSON.parse(sessionStorage.getItem('vegas-utm') || 'null');
      if (salvo && !o.utm_source && !o.gclid && !o.fbclid) return salvo;
      if (o.utm_source || o.gclid || o.fbclid) sessionStorage.setItem('vegas-utm', JSON.stringify(o));
    } catch (e) { /* modo privado */ }
    return o;
  })();

  // ======================================================= formulario =====
  // Uma funcao por formulario, e nao um formulario por pagina: o popup de CTA
  // traz um segundo formulario para a mesma pagina, e ele precisa da mesma
  // validacao e do mesmo envio. Antes isto era um bloco solto que so pegava o
  // primeiro `[data-form-diagnostico]` que encontrasse.
  function ligaFormulario(form) {
    if (!form || form.dataset.ligado) return;
    form.dataset.ligado = '1';

    var erro = $('[data-form-erro]', form);
    var ok = $('[data-form-ok]', form);
    var botao = $('button[type="submit"]', form);
    var textoBotao = botao ? botao.textContent : '';
    var campo = function (n) { return form.elements[n]; };

    var valida = function () {
      var v = {};
      ['nome', 'whatsapp', 'email', 'estabelecimento', 'tipo', 'desafio'].forEach(function (n) {
        var c = campo(n);
        v[n] = c ? (c.value || '').trim() : '';
      });
      if (v.nome.length < 2) return { msg: 'Informe o seu nome.', foco: campo('nome') };
      if (v.whatsapp.replace(/\D/g, '').length < 10) {
        return { msg: 'Informe um WhatsApp válido com DDD.', foco: campo('whatsapp') };
      }
      if (v.email.indexOf('@') < 1 || v.email.indexOf('.') < 0) {
        return { msg: 'Informe um e-mail válido.', foco: campo('email') };
      }
      if (!v.estabelecimento) {
        return { msg: 'Informe o nome do estabelecimento.', foco: campo('estabelecimento') };
      }
      return { valores: v };
    };

    form.addEventListener('submit', function (ev) {
      var r = valida();
      if (r.msg) {
        // So cancela quando ha erro. Num envio valido o evento segue, e e ele
        // que o f.js escuta para mandar a copia ao painel.
        ev.preventDefault();
        erro.textContent = r.msg;
        ok.style.display = 'none';
        if (r.foco) { r.foco.focus(); r.foco.setAttribute('aria-invalid', 'true'); }
        return;
      }
      ev.preventDefault();
      erro.textContent = '';
      $$('input, textarea, select', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });

      var v = r.valores;
      // E.164: formato que o GHL precisa para conseguir enviar mensagem depois.
      var digitos = v.whatsapp.replace(/\D/g, '');
      var telefone = digitos.length <= 11 ? '+55' + digitos : '+' + digitos;
      var partes = v.nome.split(/\s+/);

      var payload = {
        full_name: v.nome,
        first_name: partes[0],
        last_name: partes.slice(1).join(' '),
        email: v.email,
        phone: telefone,
        estabelecimento: v.estabelecimento,
        tipo_estabelecimento: v.tipo,
        desafio: v.desafio,
        source: 'Site — diagnóstico gratuito',
        utm_source: utm.utm_source, utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign, utm_term: utm.utm_term,
        utm_content: utm.utm_content, gclid: utm.gclid, fbclid: utm.fbclid,
        pagina: utm.landing_page, referrer: utm.referrer,
        enviado_em: new Date().toISOString()
      };

      if (botao) { botao.disabled = true; botao.textContent = 'Enviando...'; }

      if (GHL_WEBHOOK) {
        var corpo = JSON.stringify(payload);
        // text/plain evita o preflight: com application/json o navegador manda
        // um OPTIONS antes, que o webhook do GHL nao responde.
        var TIPO = 'text/plain;charset=UTF-8';
        var enfileirado = false;
        try {
          if (navigator.sendBeacon) {
            enfileirado = navigator.sendBeacon(GHL_WEBHOOK, new Blob([corpo], { type: TIPO }));
          }
        } catch (e) { /* segue para o fetch */ }
        if (!enfileirado) {
          try {
            fetch(GHL_WEBHOOK, {
              method: 'POST', mode: 'no-cors', keepalive: true,
              headers: { 'Content-Type': TIPO }, body: corpo
            })['catch'](function () {});
          } catch (e) { /* segue */ }
        }
      }

      try {
        var leads = JSON.parse(localStorage.getItem('vegas-leads') || '[]');
        leads.push(payload);
        localStorage.setItem('vegas-leads', JSON.stringify(leads));
      } catch (e) { /* modo privado */ }

      // O webhook do GHL responde sem CORS, entao o navegador nao consegue ler
      // a resposta: nao da para afirmar "recebemos". A mensagem diz o que de
      // fato aconteceu e oferece o WhatsApp como caminho direto.
      if (botao) { botao.disabled = false; botao.textContent = textoBotao; }
      ok.innerHTML = 'Pedido enviado. Se preferir falar agora, ' +
        '<a href="https://api.whatsapp.com/send?phone=5527992246343&amp;text=' +
        encodeURIComponent('Olá! Acabei de solicitar um diagnóstico pelo site.') +
        '" target="_blank" rel="noopener">chame a Vegas no WhatsApp</a>.';
      ok.style.display = 'block';
      form.reset();
      if (ok.focus) ok.focus();
    });
  }

  $$('[data-form-diagnostico]').forEach(ligaFormulario);

  // ================================================ popup de diagnostico ==
  // A LP abria o formulario em popup no clique do CTA; o site passou a mandar
  // o visitante para /diagnostico/. Tirar a pagina de baixo dos pes de quem ja
  // estava lendo custa conversao, entao o popup volta — sem perder o link.
  //
  // O <a> continua apontando para /diagnostico/ de verdade. Sem JavaScript, ou
  // se algo aqui falhar, o clique navega e o visitante encontra o mesmo
  // formulario na pagina. O popup e enfeite por cima de um caminho que ja
  // funciona, nunca a unica saida.
  var molde = $('#tpl-diagnostico');
  var naPaginaDoForm = /\/diagnostico\/?$/.test(location.pathname);

  if (molde && molde.content && !naPaginaDoForm) {
    var caixa = null;
    var devolveFoco = null;

    var fechaPopup = function () {
      if (!caixa) return;
      caixa.hidden = true;
      d.documentElement.style.overflow = '';
      if (devolveFoco && devolveFoco.focus) devolveFoco.focus();
    };

    var montaPopup = function () {
      if (caixa) return caixa;
      caixa = d.createElement('div');
      caixa.className = 'popup';
      caixa.hidden = true;
      caixa.innerHTML =
        '<div class="popup-fundo" data-fecha></div>' +
        '<div class="popup-cartao" role="dialog" aria-modal="true"' +
        ' aria-labelledby="popup-titulo">' +
        '<button type="button" class="popup-x" data-fecha aria-label="Fechar">&times;</button>' +
        '<span class="rotulo">Diagnóstico gratuito</span>' +
        '<h2 id="popup-titulo">Conte sobre a sua operação</h2>' +
        '<p class="popup-apoio">Uma conversa para entender o que já existe e onde ' +
        'está o gargalo. Sem compromisso.</p>' +
        '</div>';
      caixa.querySelector('.popup-cartao').appendChild(molde.content.cloneNode(true));
      d.body.appendChild(caixa);

      ligaFormulario($('[data-form-diagnostico]', caixa));

      caixa.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-fecha]')) fechaPopup();
      });
      d.addEventListener('keydown', function (ev) {
        if (caixa.hidden) return;
        if (ev.key === 'Escape' || ev.keyCode === 27) { fechaPopup(); return; }
        if (ev.key !== 'Tab') return;
        // Foco presa no cartao enquanto o popup esta aberto.
        var foco = $$('a[href], button, input, select, textarea', caixa)
          .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
        if (!foco.length) return;
        var primeiro = foco[0], ultimo = foco[foco.length - 1];
        if (ev.shiftKey && d.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
        else if (!ev.shiftKey && d.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
      });
      return caixa;
    };

    d.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest && ev.target.closest('a[href]');
      if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
      if (a.target === '_blank') return;
      // Compara o caminho, nao o href: na previa ele vem prefixado (/v3/...).
      var caminho;
      try { caminho = new URL(a.href, location.href).pathname; } catch (e) { return; }
      if (!/\/diagnostico\/?$/.test(caminho)) return;

      ev.preventDefault();
      var p = montaPopup();
      devolveFoco = a;
      p.hidden = false;
      d.documentElement.style.overflow = 'hidden';
      var primeiro = $('input, select, textarea', p);
      if (primeiro && primeiro.focus) primeiro.focus();
    });
  }

  // =========================================================== reveals ====
  // O conteudo nasce VISIVEL no HTML; e o JavaScript que esconde para animar.
  // Assim nenhuma falha aqui deixa a pagina em branco.
  var querMenos = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!querMenos && 'IntersectionObserver' in window) {
    var alvos = $$('[data-reveal]');

    // 1. O que JA esta na tela no carregamento nao anima.
    //    Antes todo alvo era escondido e revelado em seguida, inclusive o que
    //    estava acima da dobra: dava um piscar no primeiro quadro, bem no
    //    conteudo que o visitante olha primeiro. Animacao de entrada so faz
    //    sentido em quem entra na tela.
    var alturaJanela = window.innerHeight || d.documentElement.clientHeight;
    alvos = alvos.filter(function (el) {
      return el.getBoundingClientRect().top > alturaJanela * 0.9;
    });

    if (alvos.length) {
      // 2. Os filhos entram em cascata, nao o bloco inteiro de uma vez.
      //    Uma grade de seis cards aparecendo como um retangulo unico nao
      //    parece animacao, parece carregamento lento. Em cascata o olho
      //    acompanha. O atraso e limitado para a ultima peca nao demorar.
      var pecasDe = function (el) {
        var filhos = [].slice.call(el.children);
        return filhos.length > 1 && filhos.length <= 12 ? filhos : [el];
      };
      var CURVA = 'cubic-bezier(.22,.61,.36,1)';

      alvos.forEach(function (el) {
        pecasDe(el).forEach(function (peca, i) {
          peca.style.opacity = '0';
          peca.style.transform = 'translateY(14px)';
          peca.style.transition =
            'opacity .55s ' + CURVA + ' ' + Math.min(i * 70, 420) + 'ms, ' +
            'transform .55s ' + CURVA + ' ' + Math.min(i * 70, 420) + 'ms';
        });
      });

      var mostra = function (el) {
        pecasDe(el).forEach(function (peca) {
          peca.style.opacity = '1';
          peca.style.transform = 'none';
        });
      };

      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) {
          if (!e.isIntersecting) return;
          mostra(e.target);
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      alvos.forEach(function (el) { io.observe(el); });

      // 3. Rede de seguranca, agora mais curta e tambem ligada ao print.
      //    O que nunca entra na tela — porque o visitante nao rolou ate la, ou
      //    porque um rastreador so carrega a pagina — ficava invisivel por
      //    quatro segundos. Em impressao ficava invisivel para sempre.
      var revelaTudo = function () { alvos.forEach(mostra); };
      setTimeout(revelaTudo, 2500);
      window.addEventListener('beforeprint', revelaTudo);
    }
  }
})();
