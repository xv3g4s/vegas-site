/* Vegas Aceleradora — interatividade da Home nova.
 *
 * A pagina e pre-renderizada, entao o conteudo ja chega pronto. Aqui fica so o
 * que depende de JavaScript: envio do formulario, captura de UTM, animacoes de
 * rolagem e a sombra do cabecalho.
 *
 * O acordeao de duvidas usa <details>/<summary> nativo: acessivel de graca,
 * funciona sem JavaScript e ja vem no HTML renderizado.
 */
(function () {
  'use strict';

  // Inbound Webhook do GoHighLevel. Vazio = o lead fica so no localStorage.
  var GHL_WEBHOOK = '';

  // A copia para o Painel de Sites NAO e feita aqui. Quem faz e o f.js, que
  // escuta o submit no documento em fase de captura — ou seja, antes do
  // preventDefault logo abaixo. Ele reconhece os campos deste formulario sem
  // renomear nada: nome, whatsapp (o padrao dele inclui /whats/), o input de
  // e-mail e o <textarea>.
  //
  // Um envio proprio daqui chegaria com OUTRA chave de idempotencia, e duas
  // chaves diferentes para o mesmo contato viram dois leads no painel.

  var d = document;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || d).querySelectorAll(s)); };

  // ---------------------------------------------------------------- UTM ----
  var utm = (function () {
    var p = new URLSearchParams(location.search);
    var o = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']
      .forEach(function (k) { o[k] = p.get(k) || ''; });
    o.landing_page = location.href;
    o.referrer = d.referrer || '';
    // Quem chega por anuncio costuma navegar antes de converter: guardamos a
    // origem da primeira visita para o lead nao virar "direto".
    try {
      var salvo = JSON.parse(sessionStorage.getItem('vegas-utm') || 'null');
      if (salvo && !o.utm_source && !o.gclid && !o.fbclid) return salvo;
      if (o.utm_source || o.gclid || o.fbclid) sessionStorage.setItem('vegas-utm', JSON.stringify(o));
    } catch (e) { /* modo privado */ }
    return o;
  })();

  // ----------------------------------------------------------- formulario --
  var form = $('[data-form-analise]');
  if (form) {
    var erro = $('[data-form-erro]', form);
    var ok = $('[data-form-ok]', form);
    var botao = $('button[type="submit"]', form);
    var textoBotao = botao ? botao.textContent : '';

    var campo = function (nome) { return form.elements[nome]; };

    var valida = function () {
      var v = {
        nome: (campo('nome').value || '').trim(),
        whatsapp: (campo('whatsapp').value || '').trim(),
        email: (campo('email').value || '').trim(),
        estabelecimento: (campo('estabelecimento').value || '').trim(),
        desafio: (campo('desafio').value || '').trim()
      };
      if (!v.nome) return { msg: 'Informe o seu nome.', foco: campo('nome') };
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
      ev.preventDefault();
      var r = valida();
      if (r.msg) {
        erro.textContent = r.msg;
        ok.style.display = 'none';
        if (r.foco) { r.foco.focus(); r.foco.setAttribute('aria-invalid', 'true'); }
        return;
      }
      erro.textContent = '';
      $$('input, textarea', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });

      var v = r.valores;
      // E.164: e o formato que o GHL precisa para conseguir enviar mensagem depois
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
        desafio: v.desafio,
        source: 'Site — formulário de análise gratuita',
        utm_source: utm.utm_source, utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign, utm_term: utm.utm_term,
        utm_content: utm.utm_content, gclid: utm.gclid, fbclid: utm.fbclid,
        pagina: utm.landing_page, referrer: utm.referrer,
        enviado_em: new Date().toISOString()
      };

      if (botao) { botao.disabled = true; botao.textContent = 'Enviando...'; }

      if (GHL_WEBHOOK) {
        var corpo = JSON.stringify(payload);
        // text/plain evita o preflight de CORS: com application/json o navegador
        // manda um OPTIONS antes, que o webhook do GHL nao responde.
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

      // O webhook responde sem CORS, entao o navegador nao consegue ler a
      // resposta: nao da para afirmar "recebemos". A mensagem diz o que de fato
      // aconteceu — o pedido saiu — e oferece o WhatsApp como caminho direto.
      if (botao) { botao.disabled = false; botao.textContent = textoBotao; }
      ok.innerHTML = 'Pedido enviado. Se preferir falar agora, ' +
        '<a href="https://api.whatsapp.com/send?phone=5527992246343&amp;text=' +
        encodeURIComponent('Olá! Acabei de solicitar uma análise pelo site.') +
        '" target="_blank" rel="noopener">chame a Vegas no WhatsApp</a>.';
      ok.style.display = 'block';
      form.reset();
      ok.focus && ok.focus();
    });
  }

  // --------------------------------------------------------- menu mobile --
  // O <details> ja abre e fecha sozinho. O que falta e o comportamento que o
  // nativo nao tem: como os links sao ancoras da propria pagina, sem isso o
  // painel ficaria aberto por cima do destino.
  var menu = $('.sanduiche');
  if (menu) {
    var fechaMenu = function () { menu.removeAttribute('open'); };
    var painelMenu = $('.sanduiche-painel', menu);
    if (painelMenu) {
      painelMenu.addEventListener('click', function (ev) {
        var a = ev.target && ev.target.closest && ev.target.closest('a');
        if (a) fechaMenu();
      });
    }
    d.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' || ev.keyCode === 27) fechaMenu();
    });
    d.addEventListener('click', function (ev) {
      if (menu.hasAttribute('open') && !menu.contains(ev.target)) fechaMenu();
    });
    // acima de 900px os links voltam para a barra: o painel aberto viraria
    // um bloco solto no meio da tela
    if (window.matchMedia) {
      var largo = window.matchMedia('(min-width: 901px)');
      var aoMudar = function (e) { if (e.matches) fechaMenu(); };
      if (largo.addEventListener) largo.addEventListener('change', aoMudar);
      else if (largo.addListener) largo.addListener(aoMudar);
    }
  }

  // -------------------------------------------------------------- reveals --
  var querMenos = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!querMenos && 'IntersectionObserver' in window) {
    var alvos = $$('[data-reveal]');
    if (alvos.length) {
      alvos.forEach(function (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(18px)';
        el.style.transition = 'opacity .7s cubic-bezier(.22,.61,.36,1), transform .7s cubic-bezier(.22,.61,.36,1)';
      });
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.style.opacity = '1';
          e.target.style.transform = 'none';
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      alvos.forEach(function (el) { io.observe(el); });
      // rede de seguranca: se algo falhar, o conteudo reaparece
      setTimeout(function () {
        alvos.forEach(function (el) {
          if (el.style.opacity === '0') { el.style.opacity = '1'; el.style.transform = 'none'; }
        });
      }, 4000);
    }
  }

  // ------------------------------------------------------------- cabecalho -
  var header = $('header');
  if (header) {
    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset || d.documentElement.scrollTop;
        header.style.boxShadow = y > 40 ? '0 10px 30px rgba(0,0,0,0.45)' : '';
        tick = false;
      });
    }, { passive: true });
  }
})();
