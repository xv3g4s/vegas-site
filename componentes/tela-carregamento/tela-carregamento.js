/**
 * Tela de carregamento — componente da Vegas Aceleradora.
 *
 * A logo do cliente aparece coberta por um brilho que corre por cima dela
 * enquanto a pagina carrega. Quando a pagina fica PRONTA de verdade, a logo
 * acende em branco e a tela sai. Da segunda carga em diante (navegacao
 * interna, voltar, abrir outra pagina) a mesma tela aparece em modo curto: a
 * logo entra na hora e a tela sai assim que a pagina esta pronta, sem espera
 * minima. Marca presente em toda navegacao sem cobrar segundos por clique.
 *
 * Instalacao: ver LEIA-ME.md. Resumo — uma linha no <head>:
 *
 *   <script src="/tela-carregamento.js" data-logo="/img/logo-mascara.webp"
 *           data-logo-w="720" data-logo-h="673" data-cor="#B79A6A"></script>
 *
 * Sem dependencia, sem build, ~6 KB. Sem JavaScript, o site aparece normal:
 * a tela so existe se este script rodar.
 *
 * z-index 2147483000: acima de header fixo, modal e widget de terceiro.
 */
(function () {
  if (window.__telaCarregamento) return;
  window.__telaCarregamento = true;

  var script = document.currentScript || (function () {
    var l = document.querySelectorAll('script[src*="tela-carregamento"]');
    return l[l.length - 1];
  })();
  var attr = (script && script.dataset) || {};

  var PADRAO = {
    logo: '',                  // imagem da logo (usada como MASCARA: so o alfa conta)
    logoW: 1,                  // proporcao da logo, para reservar o espaco certo
    logoH: 1,
    cor: '#B79A6A',            // cor do brilho que corre pela logo
    corBase: 'rgba(255,255,255,.24)',  // logo apagada, antes de acender
    corAcesa: '#FFFFFF',       // logo acesa, no fim do carregamento
    fundo: '',                 // vazio = degrade a partir de fundoSolido
    fundoSolido: '#080908',    // cor chapada (tambem vai no <html> contra o flash branco)
    texto: 'Carregando',       // lido por leitor de tela, nao aparece
    tamanho: 'clamp(140px,12vw,200px)',
    tamanhoCelular: 'clamp(120px,38vw,160px)',
    tempoMinimo: 1200,         // primeira carga: tempo minimo de tela, em ms
    tempoMaximo: 6000,         // rede de seguranca: nunca prender o site
    duracaoSaida: 560,
    repeticao: 'curto',        // 'curto' | 'fade' | 'completo' | 'nada'
    chaveSessao: 'tela_carregamento_vista',
    seletorHero: 'img[fetchpriority="high"]',  // imagem que precisa estar pronta
    aguardarClasse: '',        // ex.: 'mo-vivo' — espera essa classe no <html>
    evento: 'tela-carregamento:fim',
  };

  var C = {};
  for (var k in PADRAO) if (Object.prototype.hasOwnProperty.call(PADRAO, k)) C[k] = PADRAO[k];
  var dados = window.TELA_CARREGAMENTO || {};
  for (var k2 in dados) if (Object.prototype.hasOwnProperty.call(dados, k2)) C[k2] = dados[k2];
  // data-logo-w vira logoW; o atributo no HTML ganha do objeto, por ser mais perto da pagina
  var DE_ATRIBUTO = { logo: 'logo', logoW: 'logoW', logoH: 'logoH', cor: 'cor', corBase: 'corBase',
    corAcesa: 'corAcesa', fundo: 'fundo', fundoSolido: 'fundoSolido', texto: 'texto',
    tamanho: 'tamanho', tamanhoCelular: 'tamanhoCelular', tempoMinimo: 'tempoMinimo',
    tempoMaximo: 'tempoMaximo', duracaoSaida: 'duracaoSaida', repeticao: 'repeticao',
    chaveSessao: 'chaveSessao', seletorHero: 'seletorHero', aguardarClasse: 'aguardarClasse',
    evento: 'evento' };
  for (var a in DE_ATRIBUTO) {
    if (attr[a] === undefined || attr[a] === '') continue;
    var n = Number(attr[a]);
    C[DE_ATRIBUTO[a]] = (attr[a] !== '' && !isNaN(n) && /^-?[\d.]+$/.test(attr[a])) ? n : attr[a];
  }
  if (!C.logo) return;  // sem logo nao ha tela: melhor nada do que um quadrado preto

  var html = document.documentElement;
  var reduz = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function lerVisto() { try { return sessionStorage.getItem(C.chaveSessao); } catch (e) { return null; } }
  function marcarVisto() { try { sessionStorage.setItem(C.chaveSessao, '1'); } catch (e) {} }
  // ?intro na URL mostra a intro completa de novo (para apresentar ao cliente)
  try { if (/[?&]intro\b/.test(location.search)) sessionStorage.removeItem(C.chaveSessao); } catch (e) {}

  var curto = !!lerVisto();

  if (curto && C.repeticao === 'nada') { marcarVisto(); return; }
  if (curto && C.repeticao === 'fade') {
    marcarVisto();
    if (reduz) return;
    var f = document.createElement('style');
    f.textContent = '@keyframes tcPageIn{from{opacity:0}to{opacity:1}}body{animation:tcPageIn .22s ease both}';
    document.head.appendChild(f);
    return;
  }
  if (curto && C.repeticao === 'curto') {
    C.tempoMinimo = 0;        // sai no instante em que a pagina fica pronta
    C.tempoMaximo = Math.min(C.tempoMaximo, 2500);
    C.duracaoSaida = 260;
  } else {
    curto = false;            // 'completo': toda carga mostra a intro inteira
  }

  var mascara = 'url("' + C.logo + '") center/contain no-repeat';
  var fundo = C.fundo || ('radial-gradient(120% 90% at 50% 45%,' + C.fundoSolido + ' 55%,#000 160%)');
  var entradaLogo = curto
    ? 'tcLogoIn .42s cubic-bezier(.22,.61,.36,1) both'
    : 'tcLogoIn .95s cubic-bezier(.22,.61,.36,1) both,tcGrow 3.2s cubic-bezier(.33,0,.2,1) .95s forwards';

  var css = [
    ':root{--tc-logo:' + C.tamanho + ';--tc-saida:' + C.duracaoSaida + 'ms}',
    '@media (max-width:599px){:root{--tc-logo:' + C.tamanhoCelular + '}}',
    'html.tc-carregando,html.tc-carregando body{overscroll-behavior:none}',
    'html,body{background:' + C.fundoSolido + '}',
    '.tc{position:fixed;inset:0;z-index:2147483000;width:100vw;height:100vh;height:100dvh;' +
      'display:flex;align-items:center;justify-content:center;background:' + C.fundoSolido + ';background:' + fundo + ';' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);' +
      'pointer-events:none;opacity:1;transition:opacity var(--tc-saida) cubic-bezier(.4,0,.2,1) .1s;' +
      'will-change:opacity;contain:strict;transform:translateZ(0)}',
    '.tc__ambiente{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.45) 100%)}',
    '.tc__logo{position:relative;width:var(--tc-logo);max-width:calc(100vw - 48px);aspect-ratio:' + C.logoW + '/' + C.logoH + ';' +
      'will-change:transform,opacity;backface-visibility:hidden;animation:' + entradaLogo + '}',
    '.tc__camada{position:absolute;inset:0;-webkit-mask:' + mascara + ';mask:' + mascara + '}',
    '.tc__base{background:' + C.corBase + '}',
    '.tc__brilho{background:linear-gradient(45deg,transparent 36%,' + C.corAcesa + ' 46%,' + C.cor + ' 54%,transparent 64%);' +
      'background-size:300% 300%;animation:tcShine 2.2s linear ' + (curto ? '0s' : '.35s') + ' infinite}',
    '.tc__acesa{background:' + C.corAcesa + ';opacity:0;transition:opacity .45s ease}',
    '.tc--pronta .tc__acesa{opacity:1}',
    '.tc--pronta .tc__brilho{animation-play-state:paused;opacity:0;transition:opacity .3s ease}',
    '.tc__texto{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
    '.tc--saindo{opacity:0}',
    '.tc--saindo .tc__logo{animation:tcLogoOut .42s cubic-bezier(.55,0,.25,1) forwards}',
    '@keyframes tcShine{0%{background-position:100% 0%}100%{background-position:0% 100%}}',
    '@keyframes tcLogoIn{0%{opacity:0;transform:scale(.86) translateY(14px);filter:blur(6px)}100%{opacity:1;transform:scale(1) translateY(0);filter:blur(0)}}',
    '@keyframes tcGrow{from{transform:scale(1)}to{transform:scale(1.08)}}',
    '@keyframes tcLogoOut{0%{opacity:1;transform:scale(var(--tc-escala,1.08))}100%{opacity:0;transform:scale(.82)}}',
    '@media (prefers-reduced-motion:reduce){.tc__logo,.tc__brilho,.tc__ambiente{animation:none!important}' +
      '.tc__brilho{display:none}.tc__base{background:' + C.corAcesa + '}.tc{transition:opacity .25s ease}}',
  ].join('\n');

  var st = document.createElement('style');
  st.id = 'tela-carregamento-css';
  st.textContent = css;
  document.head.appendChild(st);

  var el = document.createElement('div');
  el.className = 'tc';
  el.setAttribute('role', 'status');
  el.innerHTML = '<div class="tc__ambiente"></div>' +
    '<div class="tc__logo"><div class="tc__camada tc__base"></div>' +
    '<div class="tc__camada tc__brilho"></div><div class="tc__camada tc__acesa"></div></div>' +
    '<span class="tc__texto"></span>';
  el.querySelector('.tc__texto').textContent = C.texto;
  (document.body || html).appendChild(el);

  // Trava a rolagem enquanto a tela cobre a pagina, sem mexer no layout:
  // overflow:hidden no <body> some com a barra e empurra tudo para o lado.
  html.classList.add('tc-carregando');
  var trava = function (e) { if (html.classList.contains('tc-carregando')) e.preventDefault(); };
  var teclas = [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
  var travaTecla = function (e) {
    if (html.classList.contains('tc-carregando') && teclas.indexOf(e.key) > -1) e.preventDefault();
  };
  window.addEventListener('wheel', trava, { passive: false, capture: true });
  window.addEventListener('touchmove', trava, { passive: false, capture: true });
  window.addEventListener('keydown', travaTecla, { capture: true });

  function conteudo() { return document.getElementById('conteudo') || document.querySelector('main') || document.body; }
  function ocupado(v) { var m = conteudo(); if (m) m.setAttribute('aria-busy', v); }
  ocupado('true');

  var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  var agora = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
  var espera = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // --- os sinais de "a pagina esta pronta" ---------------------------------
  var domPronto = document.readyState !== 'loading'
    ? Promise.resolve()
    : new Promise(function (r) { document.addEventListener('DOMContentLoaded', r, { once: true }); });

  // a mascara usa o mesmo arquivo: pre-carrega para a logo aparecer inteira
  var img = new Image(); img.decoding = 'async'; img.src = C.logo;
  var logoPronta = new Promise(function (r) { if (img.complete) return r(); img.onload = img.onerror = r; });

  var fontes = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();

  // window.load: folhas de estilo, scripts e as imagens que a pagina busca de
  // verdade. Imagem com loading="lazy" fora da dobra nao entra, entao isto nao
  // vira espera eterna — e o teto de tempo continua valendo de qualquer forma.
  var carregou = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise(function (r) { window.addEventListener('load', r, { once: true }); });

  // a imagem principal pode ser montada depois deste script: procura por 2s
  var hero = new Promise(function (resolve) {
    if (!C.seletorHero) return resolve();
    var tentativas = 0;
    (function procura() {
      var alvo = document.querySelector(C.seletorHero);
      if (alvo) {
        if (alvo.complete && alvo.naturalWidth) return resolve(alvo.decode ? alvo.decode().catch(function () {}) : null);
        alvo.addEventListener('load', function () { resolve(alvo.decode ? alvo.decode().catch(function () {}) : null); }, { once: true });
        alvo.addEventListener('error', resolve, { once: true });
        return;
      }
      if (++tentativas > 40) return resolve();
      setTimeout(procura, 50);
    })();
  });

  // sites que trocam a pagina estatica pela versao montada em JavaScript
  // avisam por uma classe no <html>; sem isso, a troca aconteceria na cara do
  // visitante depois da tela sair
  var montado = !C.aguardarClasse ? Promise.resolve() : new Promise(function (r) {
    if (html.classList.contains(C.aguardarClasse)) return r();
    if (typeof MutationObserver === 'undefined') return r();
    var obs = new MutationObserver(function () {
      if (html.classList.contains(C.aguardarClasse)) { obs.disconnect(); r(); }
    });
    obs.observe(html, { attributes: true, attributeFilter: ['class'] });
    setTimeout(function () { obs.disconnect(); r(); }, 6000);
  });

  var sinais = [domPronto, logoPronta, fontes, hero, carregou, montado];
  var tudo = Promise.allSettled
    ? Promise.allSettled(sinais)
    : Promise.all(sinais.map(function (p) { return Promise.resolve(p).catch(function () {}); }));

  // --- saida ----------------------------------------------------------------
  var saiu = false;
  function sair() {
    if (saiu) return; saiu = true;
    marcarVisto();
    var dur = reduz ? 250 : C.duracaoSaida;
    var pausa = reduz ? 0 : (curto ? 120 : 380);   // o tempo de logo acesa
    el.classList.add('tc--pronta');
    setTimeout(function () {
      // continua de onde a animacao de crescimento parou, sem solavanco
      var w = el.querySelector('.tc__logo');
      if (w && !reduz) {
        var m = getComputedStyle(w).transform, k = 1;
        if (m && m !== 'none') {
          var v = m.match(/matrix\(([^,]+),([^,]+)/);
          if (v) k = Math.sqrt(parseFloat(v[1]) * parseFloat(v[1]) + parseFloat(v[2]) * parseFloat(v[2]));
        }
        w.style.setProperty('--tc-escala', k.toFixed(4));
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.classList.add('tc--saindo'); entrada(); });
      });
    }, pausa);
    setTimeout(function () {
      // o <style> fica: tirar forcaria recalculo de estilo da pagina inteira
      el.remove();
      html.classList.remove('tc-carregando');
      window.removeEventListener('wheel', trava, { capture: true });
      window.removeEventListener('touchmove', trava, { capture: true });
      window.removeEventListener('keydown', travaTecla, { capture: true });
      ocupado('false');
      try { window.dispatchEvent(new CustomEvent(C.evento, { detail: { modo: curto ? 'curto' : 'completo' } })); } catch (e) {}
    }, dur + 140 + pausa);
  }

  function entrada() {
    if (reduz) return;
    var sec = document.querySelector('main section') || document.querySelector('header + *') || document.querySelector('main');
    if (!sec || !sec.animate) return;
    var titulo = sec.querySelector('h1');
    var bloco = titulo && titulo.parentElement;
    if (bloco) bloco.animate([{ transform: 'translateY(8px)' }, { transform: 'translateY(0)' }],
      { duration: 500, easing: 'cubic-bezier(.22,1,.36,1)' });
  }

  var minimo = reduz ? 0 : C.tempoMinimo;
  Promise.race([
    tudo.then(function () { var resto = minimo - (agora() - t0); return resto > 0 ? espera(resto) : null; }),
    espera(C.tempoMaximo),
  ]).then(sair, sair);

  setTimeout(sair, C.tempoMaximo + 800);   // rede de seguranca da rede de seguranca
})();
