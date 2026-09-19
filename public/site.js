/* Vegas Aceleradora — interatividade da pagina estatica.
 *
 * A pagina e pre-renderizada no build (prerender.mjs), entao o conteudo ja
 * chega pronto. Este arquivo devolve so o que dependia de JavaScript, sem
 * framework: popup de lead, balao de chat, captura de UTM e as animacoes
 * de rolagem.
 *
 * Progressive enhancement: os CTAs sao <a href="https://api.whatsapp.com/...">
 * de verdade. Se este arquivo falhar, o clique leva o visitante direto para o
 * WhatsApp — a conversao continua acontecendo, so sem o popup.
 */
(function () {
  'use strict';

  // Inbound Webhook do GoHighLevel. Vazio = lead so no localStorage + WhatsApp.
  var GHL_WEBHOOK = '';

  // Painel de Sites: copia do lead, em PARALELO ao destino principal. O GHL
  // continua sendo quem recebe o lead de verdade — nada aqui pode atrapalhar
  // aquele envio nem o WhatsApp que abre em seguida, entao toda falha desta
  // parte e engolida de proposito.
  var PAINEL_FORMS = 'https://app.johnyweb.com/api/forms/sit_6c66a1f9deba';

  var d = document;
  var $ = function (s, ctx) { return (ctx || d).querySelector(s); };
  var $$ = function (s, ctx) { return [].slice.call((ctx || d).querySelectorAll(s)); };

  // ------------------------------------------------- copia para o painel ---
  // UUID v4 de verdade: o servidor valida a chave com z.string().uuid() e
  // recusa o envio INTEIRO com 422 se ela nao tiver esse formato.
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // Uma chave por formulario PREENCHIDO, nao por tentativa: e ela que impede
  // que um retry de rede vire um segundo lead. So troca depois de uma entrega
  // confirmada pelo servidor.
  var chaveEnvio = null;
  function idempotencia() {
    if (!chaveEnvio) chaveEnvio = uuid();
    return chaveEnvio;
  }

  // O popup de lead nao e tocado: continua com os mesmos campos e o mesmo
  // destino. Ele nem tem um <form> de verdade — sao tres <input> soltos e um
  // <button> —, entao a traducao para os nomes que o painel espera acontece
  // aqui, montando um FormData na mao na hora do envio.
  //
  // FormData de proposito: o endpoint aceita multipart, e assim o navegador
  // nao precisa de preflight.
  function enviaAoPainel(dados) {
    // Respeita o mesmo interruptor de consentimento que o coletor observa.
    if (window.painelConsentimento === false) return;

    var fd = new FormData();
    // Campo vazio NAO vai. Os opcionais do servidor tem formato proprio
    // (visitante e min(8), diagnostico casa /^diag_[a-f0-9]{8,64}$/), entao
    // mandar string vazia derruba a submissao inteira com 422.
    var junta = function (chave, valor) { if (valor) fd.append(chave, valor); };

    junta('nome', dados.nome);
    junta('email', dados.email);
    junta('telefone', dados.telefone);
    junta('mensagem', dados.mensagem);
    junta('formulario', dados.formulario);
    junta('caminho', location.pathname || '/');
    // Vem do coletor quando ele existe. Sem coletor — bloqueador, consentimento
    // negado, arquivo fora do ar — o campo simplesmente nao vai, e o contato
    // continua valendo.
    junta('visitante', window.painel && window.painel.visitante && window.painel.visitante());
    junta('diagnostico', window.painel && window.painel.diagnostico && window.painel.diagnostico());
    junta('idempotencia', idempotencia());

    try {
      // keepalive e essencial aqui: logo depois deste envio a pagina navega
      // para o WhatsApp, e sem isso o pedido morreria no meio.
      fetch(PAINEL_FORMS, { method: 'POST', body: fd, keepalive: true })
        .then(function (r) {
          // So o servidor confirma. O evento de submit do navegador nao prova
          // que alguem recebeu, entao a chave so troca a partir daqui.
          if (r && r.ok) chaveEnvio = null;
        })['catch'](function () {
          // A chave fica de pe: a proxima tentativa repete a mesma e o painel
          // deduplica, em vez de abrir um segundo lead.
        });
    } catch (e) { /* o lead principal ja saiu para o GHL */ }
  }

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

  // ------------------------------------------------- popup e chat ----------
  var guarda = $('[data-partes]');
  var lead = null, chat = null;
  var displayLead = 'flex', displayChat = 'block';

  if (guarda) {
    lead = guarda.querySelector('[data-parte="lead"] > *');
    chat = guarda.querySelector('[data-parte="chat"] > *');
    // `hidden` perde para style inline, entao guardamos o display original
    if (lead) {
      displayLead = lead.style.display || 'flex';
      lead.style.display = 'none';
      d.body.appendChild(lead);
    }
    if (chat) {
      displayChat = chat.style.display || 'block';
      chat.style.display = 'none';
      d.body.appendChild(chat);
    }
    guarda.parentNode.removeChild(guarda);
  }

  // -------------------------------------------------------- popup ----------
  var ultimoFoco = null;

  function preencheUTM() {
    Object.keys(utm).forEach(function (k) {
      var el = lead && lead.querySelector('input[name="' + k + '"]');
      if (el) el.value = utm[k];
    });
  }

  function erroEl() {
    if (!lead) return null;
    var e = lead.querySelector('[data-lead-erro]');
    if (e) return e;
    e = d.createElement('p');
    e.setAttribute('data-lead-erro', '');
    e.setAttribute('role', 'alert');
    e.style.cssText = 'margin:10px 0 0;font-size:14px;line-height:1.5;color:#FF9B7A;text-align:center';
    var btn = botaoEnviar();
    if (btn && btn.parentNode) btn.parentNode.insertBefore(e, btn);
    return e;
  }

  function botaoEnviar() {
    if (!lead) return null;
    return $$('button', lead).filter(function (b) {
      return (b.getAttribute('aria-label') || '') !== 'Fechar';
    })[0];
  }

  function abreLead(origem) {
    if (!lead) return false;
    ultimoFoco = origem || d.activeElement;
    preencheUTM();
    lead.style.display = displayLead;
    lead.removeAttribute('aria-hidden');
    lead.setAttribute('role', 'dialog');
    lead.setAttribute('aria-modal', 'true');
    d.documentElement.style.overflow = 'hidden';
    var primeiro = lead.querySelector('input[type="text"]');
    if (primeiro) setTimeout(function () { primeiro.focus(); }, 60);
    return true;
  }

  function fechaLead() {
    if (!lead) return;
    lead.style.display = 'none';
    d.documentElement.style.overflow = '';
    var e = lead.querySelector('[data-lead-erro]');
    if (e) e.textContent = '';
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function valida(nome, email, whats) {
    if (!nome || !email || !whats) return 'Preencha todos os campos para continuar.';
    if (email.indexOf('@') < 1 || email.indexOf('.') < 0) return 'Informe um email válido.';
    if (whats.replace(/\D/g, '').length < 10) return 'Informe um WhatsApp válido com DDD.';
    return '';
  }

  function envia() {
    if (!lead) return;
    var campos = {
      nome: lead.querySelector('input[type="text"]'),
      email: lead.querySelector('input[type="email"]'),
      whats: lead.querySelector('input[type="tel"]')
    };
    var nome = (campos.nome && campos.nome.value || '').trim();
    var email = (campos.email && campos.email.value || '').trim();
    var whats = (campos.whats && campos.whats.value || '').trim();

    var msg = valida(nome, email, whats);
    var alvo = erroEl();
    if (msg) {
      if (alvo) alvo.textContent = msg;
      var foco = !nome ? campos.nome : (msg.indexOf('email') > -1 ? campos.email : campos.whats);
      if (foco && foco.focus) foco.focus();
      return;
    }
    if (alvo) alvo.textContent = '';

    // E.164: o GHL so consegue disparar mensagem depois com o numero assim
    var digitos = whats.replace(/\D/g, '');
    var telefone = digitos.length <= 11 ? '+55' + digitos : '+' + digitos;
    var partes = nome.split(/\s+/);

    var payload = {
      full_name: nome,
      first_name: partes[0],
      last_name: partes.slice(1).join(' '),
      email: email,
      phone: telefone,
      source: 'Site — popup Vegas Aceleradora',
      utm_source: utm.utm_source, utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign, utm_term: utm.utm_term,
      utm_content: utm.utm_content, gclid: utm.gclid, fbclid: utm.fbclid,
      pagina: utm.landing_page, referrer: utm.referrer,
      enviado_em: new Date().toISOString()
    };

    if (GHL_WEBHOOK) {
      var corpo = JSON.stringify(payload);
      // text/plain evita o preflight de CORS: com application/json o navegador
      // manda um OPTIONS antes, que o webhook do GHL nao responde.
      var TIPO = 'text/plain;charset=UTF-8';
      var entregue = false;
      try {
        if (navigator.sendBeacon) {
          entregue = navigator.sendBeacon(GHL_WEBHOOK, new Blob([corpo], { type: TIPO }));
        }
      } catch (e) { /* segue */ }
      if (!entregue) {
        try {
          fetch(GHL_WEBHOOK, {
            method: 'POST', mode: 'no-cors', keepalive: true,
            headers: { 'Content-Type': TIPO }, body: corpo
          })['catch'](function () {});
        } catch (e) { /* segue */ }
      }
    }

    enviaAoPainel({
      nome: nome, email: email, telefone: telefone,
      mensagem: '', formulario: 'Popup de lead — Home'
    });

    try {
      var leads = JSON.parse(localStorage.getItem('vegas-leads') || '[]');
      leads.push(payload);
      localStorage.setItem('vegas-leads', JSON.stringify(leads));
    } catch (e) { /* modo privado */ }

    // A aba do WhatsApp abre SINCRONAMENTE dentro do clique: enviaAoPainel so
    // dispara o fetch e retorna, sem esperar. Se algum dia alguem colocar um
    // await antes daqui, o bloqueador de pop-up barra a aba.
    fechaLead();
    var wa = 'https://api.whatsapp.com/send?phone=5527992246343&text=' +
      encodeURIComponent('Olá! Vim pelo seu site e quero escalar meu Restaurante/Delivery.');
    window.open(wa, '_blank', 'noopener');
  }

  // Todo CTA de WhatsApp abre o popup antes; o botao flutuante vai direto.
  d.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href*="api.whatsapp.com"]');
    if (a && !a.hasAttribute('data-wa-float')) {
      if (abreLead(a)) ev.preventDefault();
      return;
    }
    if (lead && lead.style.display !== 'none') {
      // clique fora do cartao fecha
      var cartao = lead.querySelector('[data-lead-modal]');
      if (cartao && !cartao.contains(ev.target)) { fechaLead(); return; }
      var fechar = ev.target.closest && ev.target.closest('button[aria-label="Fechar"]');
      if (fechar && lead.contains(fechar)) { ev.preventDefault(); fechaLead(); return; }
      var enviar = ev.target.closest && ev.target.closest('button');
      if (enviar && lead.contains(enviar) && enviar.getAttribute('aria-label') !== 'Fechar') {
        ev.preventDefault(); envia(); return;
      }
    }
    if (chat && chat.contains(ev.target)) {
      var fecharChat = ev.target.closest && ev.target.closest('button[aria-label="Fechar"]');
      if (fecharChat) { ev.preventDefault(); chat.style.display = 'none'; }
    }
  });

  d.addEventListener('keydown', function (ev) {
    if (!lead || lead.style.display === 'none') return;
    if (ev.key === 'Escape') { fechaLead(); return; }
    if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') { ev.preventDefault(); envia(); return; }
    // foco preso dentro do popup enquanto ele estiver aberto
    if (ev.key === 'Tab') {
      var focaveis = $$('input:not([type=hidden]), button, a[href]', lead)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!focaveis.length) return;
      var primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
      if (ev.shiftKey && d.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && d.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
    }
  });

  // ---------------------------------------------------------- chat ---------
  if (chat) {
    setTimeout(function () {
      if (lead && lead.style.display !== 'none') return;
      chat.style.display = displayChat;
    }, 9000);
  }

  // ------------------------------------------------------- reveals ---------
  // As animacoes de rolagem sao enfeite: so ligam se o visitante nao pediu
  // menos movimento, e nunca escondem conteudo quando nao ha suporte.
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

  // -------------------------------------------- header e barra de topo -----
  var header = $('header');
  var barra = $('[data-progress]');
  if (header || barra) {
    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset || d.documentElement.scrollTop;
        if (header) {
          var on = y > 40;
          header.style.paddingTop = on ? '10px' : '';
          header.style.paddingBottom = on ? '10px' : '';
          header.style.boxShadow = on ? '0 10px 30px rgba(0,0,0,0.45)' : '';
        }
        if (barra) {
          var max = d.documentElement.scrollHeight - window.innerHeight;
          barra.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + '%';
        }
        tick = false;
      });
    }, { passive: true });
  }
})();
