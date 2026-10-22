/**
 * VEGAS ACELERADORA — uma planilha para todos os formulários do site
 * =============================================================================
 *
 * Planilha: Lista de Leads - SITE VEGAS
 * https://docs.google.com/spreadsheets/d/17k4B7ICp77WG0WzxdItou1DvciVViRMRbnYfPYCtu04/edit
 *
 * E a planilha que o script anterior ja alimentava: a aba "Leads" tem as 12
 * colunas dele e as linhas de teste de agosto. Este script PRESERVA essa
 * ordem e so acrescenta as colunas novas a direita, para nenhuma linha antiga
 * sair do lugar.
 *
 * COMO INSTALAR (5 minutos, uma vez só)
 * -----------------------------------------------------------------------------
 *  1. Abra a planilha pelo link acima.
 *  2. Extensões → Apps Script.
 *  3. Apague o que estiver lá e cole TODO este arquivo.
 *  4. Salve (ícone de disquete).
 *  5. No seletor de função, escolha `prepararPlanilha` e clique em Executar.
 *     O Google vai pedir autorização — é aqui que ela acontece, uma vez só.
 *     Essa execução cria as abas "Leads" e "Resumo" com os cabeçalhos.
 *  6. Implantar → Nova implantação → engrenagem → App da Web.
 *       Descrição:        Recebimento de leads do site
 *       Executar como:    Eu
 *       Quem pode acessar: Qualquer pessoa
 *  7. Copie a URL gerada (termina em /exec) e me mande.
 *     Eu coloco no site e o formulário passa a gravar aqui.
 *
 * SOBRE A URL /exec
 * -----------------------------------------------------------------------------
 * Ela fica visível no JavaScript do site, como qualquer endpoint de formulário.
 * Isso não é vazamento de credencial: a URL só aceita ESCRITA de lead. Quem a
 * descobrir consegue, no máximo, inserir uma linha falsa — não consegue ler a
 * planilha, nem acessar a sua conta Google. O limite é o mesmo de qualquer
 * formulário público.
 *
 * Se começar a chegar lixo, troque a implantação (nova URL) e me avise; dá
 * também para ligar o SEGREDO abaixo, que faz o script recusar quem não o
 * enviar. Deixei desligado porque um segredo que vive no front-end não
 * protege de quem lê o código — só de robô preguiçoso.
 *
 * O QUE ESTE SCRIPT ACEITA
 * -----------------------------------------------------------------------------
 * Duas formas, porque há dois remetentes:
 *   - JSON no corpo (text/plain), que é como o site novo envia por sendBeacon;
 *   - parâmetros de formulário, que é como a LP antiga enviava.
 * Os dois caem na mesma aba, separados pela coluna "Origem".
 */

// =============================================================== ajustes ====

var PLANILHA_ID = '17k4B7ICp77WG0WzxdItou1DvciVViRMRbnYfPYCtu04';

var EMAILS_NOTIFICACAO = [
  'vegasaceleradora@gmail.com'
];

// Vazio = desligado. Se preencher, o site precisa mandar o mesmo valor.
var SEGREDO = '';

var ABA_LEADS = 'Leads';
var ABA_RESUMO = 'Resumo';
var FUSO = 'America/Sao_Paulo';

/**
 * Campo do lead → título da coluna.
 *
 * As 12 primeiras repetem, NA MESMA ORDEM, o cabeçalho que a aba "Leads" já
 * tem. As seguintes são novas e entram à direita. A gravação procura cada
 * título no cabeçalho real da planilha em vez de contar posições, então
 * reordenar ou acrescentar coluna à mão não quebra nada — e as 8 linhas
 * antigas continuam onde estão.
 *
 * As três colunas de página respondem perguntas diferentes:
 *   Página            onde o formulário foi enviado  → o que CONVERTE
 *   Página de entrada a primeira página da visita    → o que ATRAI
 *   Veio de           o site anterior ao nosso       → de ONDE veio
 */
var COLUNAS = [
  ['data',            'Data'],
  ['nome',            'Nome'],
  ['email',           'Email'],
  ['whatsapp',        'WhatsApp'],
  ['utm_source',      'UTM Source'],
  ['utm_medium',      'UTM Medium'],
  ['utm_campaign',    'UTM Campaign'],
  ['utm_term',        'UTM Term'],
  ['utm_content',     'UTM Content'],
  ['gclid',           'GCLID'],
  ['fbclid',          'FBCLID'],
  ['pagina',          'Página'],
  // --- daqui para baixo, colunas novas ---
  ['estabelecimento', 'Estabelecimento'],
  ['tipo',            'Tipo'],
  ['desafio',         'Principal desafio'],
  ['origem',          'Formulário'],
  ['pagina_entrada',  'Página de entrada'],
  ['referrer',        'Veio de'],
  ['id',              'ID do envio']
];

// ================================================================ entrada ====

function doGet(e) { return processar(e); }
function doPost(e) { return processar(e); }

function processar(e) {
  try {
    var p = leitura(e);

    if (SEGREDO && String(p.segredo || '') !== SEGREDO) {
      return resposta({ ok: false, erro: 'segredo invalido' });
    }
    if (!p.nome && !p.email && !p.whatsapp) {
      return resposta({ ok: false, erro: 'envio vazio' });
    }

    // sendBeacon pode entregar duas vezes (aba fechando, rede instável). Sem
    // isto o mesmo lead viraria duas linhas e dois e-mails.
    if (p.id && jaRegistrado(p.id)) {
      return resposta({ ok: true, duplicado: true });
    }

    gravar(p);
    try {
      notificar(p);
    } catch (err) {
      // E-mail que falha não pode derrubar a gravação: o lead já está salvo.
      console.error('notificacao falhou: ' + err);
    }
    return resposta({ ok: true });
  } catch (err) {
    console.error(err);
    return resposta({ ok: false, erro: String(err) });
  }
}

/**
 * Normaliza os dois formatos de envio num objeto só.
 *
 * O site novo manda JSON com as chaves do GoHighLevel (full_name, phone...),
 * porque o mesmo payload serve aos dois destinos. A LP antiga mandava
 * parâmetros soltos. Aqui os dois viram o mesmo vocabulário.
 */
function leitura(e) {
  var bruto = {};

  if (e && e.postData && e.postData.contents) {
    try {
      bruto = JSON.parse(e.postData.contents) || {};
    } catch (err) {
      bruto = {};   // não era JSON; cai nos parâmetros abaixo
    }
  }
  if (e && e.parameter) {
    for (var k in e.parameter) {
      if (bruto[k] === undefined) bruto[k] = e.parameter[k];
    }
  }

  var pega = function () {
    for (var i = 0; i < arguments.length; i++) {
      var v = bruto[arguments[i]];
      if (v !== undefined && v !== null && String(v) !== '') return String(v);
    }
    return '';
  };

  return {
    data: new Date(),
    nome: pega('full_name', 'nome', 'name'),
    whatsapp: pega('phone', 'whatsapp', 'telefone'),
    email: pega('email'),
    estabelecimento: pega('estabelecimento', 'organization'),
    tipo: pega('tipo_estabelecimento', 'tipo'),
    desafio: pega('desafio', 'mensagem', 'message'),
    origem: pega('source', 'origem') || 'Não informada',
    utm_source: pega('utm_source'),
    utm_medium: pega('utm_medium'),
    utm_campaign: pega('utm_campaign'),
    utm_term: pega('utm_term'),
    utm_content: pega('utm_content'),
    gclid: pega('gclid'),
    fbclid: pega('fbclid'),
    // Só o caminho nas duas colunas de página. Com a query junto, a mesma
    // página vira uma linha diferente no resumo para cada combinação de UTM
    // — e agrupar por página, que é a pergunta toda, deixa de funcionar. Os
    // parâmetros não se perdem: cada um já tem a sua própria coluna.
    pagina: caminho(pega('pagina', 'landing_page')),
    pagina_entrada: caminho(pega('pagina_entrada', 'landing_page')),
    referrer: pega('referrer'),
    id: pega('id', 'idempotencia'),
    segredo: pega('segredo')
  };
}

// ================================================================ planilha ====

function planilha() {
  return SpreadsheetApp.openById(PLANILHA_ID);
}

function abaLeads() {
  var ss = planilha();
  var aba = ss.getSheetByName(ABA_LEADS);
  if (!aba) aba = ss.insertSheet(ABA_LEADS);
  return aba;
}

/**
 * Devolve {título da coluna: número da coluna} do cabeçalho REAL da planilha,
 * criando à direita as colunas de COLUNAS que ainda não existem.
 *
 * É assim, e não por posição fixa, porque a aba já tinha 12 colunas e 8 linhas
 * gravadas pelo script anterior. Escrever por posição deslocaria aquele
 * histórico; procurando pelo título, o que já existe fica no lugar e só o que
 * falta é criado.
 */
function mapaDeColunas(aba) {
  var largura = Math.max(aba.getLastColumn(), 1);
  var titulos = aba.getLastRow() === 0
    ? []
    : aba.getRange(1, 1, 1, largura).getValues()[0].map(function (t) { return String(t).trim(); });

  var mapa = {};
  titulos.forEach(function (t, i) { if (t) mapa[t] = i + 1; });

  var novas = COLUNAS.filter(function (c) { return !mapa[c[1]]; });
  if (novas.length) {
    var inicio = titulos.length + 1;
    aba.getRange(1, inicio, 1, novas.length)
      .setValues([novas.map(function (c) { return c[1]; })]);
    novas.forEach(function (c, i) { mapa[c[1]] = inicio + i; });
    estiloCabecalho(aba);
  }
  return mapa;
}

function estiloCabecalho(aba) {
  var n = aba.getLastColumn();
  aba.getRange(1, 1, 1, n)
    .setFontWeight('bold')
    .setBackground('#0A0908')
    .setFontColor('#F49E1D');
  aba.setFrozenRows(1);
}

function gravar(p) {
  var aba = abaLeads();
  var mapa = mapaDeColunas(aba);

  var largura = aba.getLastColumn();
  var linha = new Array(largura).fill('');
  COLUNAS.forEach(function (c) {
    var col = mapa[c[1]];
    if (col) linha[col - 1] = p[c[0]] !== undefined ? p[c[0]] : '';
  });

  var destino = aba.getLastRow() + 1;
  aba.getRange(destino, 1, 1, largura).setValues([linha]);
  if (mapa['Data']) {
    aba.getRange(destino, mapa['Data']).setNumberFormat('dd/MM/yyyy HH:mm');
  }
}

/** Procura o ID do envio na coluna que tiver esse título. */
function jaRegistrado(id) {
  var aba = abaLeads();
  var n = aba.getLastRow() - 1;
  if (n < 1) return false;
  var col = mapaDeColunas(aba)['ID do envio'];
  if (!col) return false;
  var vistos = aba.getRange(2, col, n, 1).getValues();
  for (var i = 0; i < vistos.length; i++) {
    if (String(vistos[i][0]) === String(id)) return true;
  }
  return false;
}

// ================================================================== e-mail ====

function notificar(p) {
  if (!EMAILS_NOTIFICACAO.length) return;

  var quando = Utilities.formatDate(p.data, FUSO, 'dd/MM/yyyy HH:mm');
  var digitos = String(p.whatsapp).replace(/\D/g, '');
  var linkZap = 'https://api.whatsapp.com/send?phone=' + digitos;
  var origem = p.utm_source
    ? p.utm_source + (p.utm_campaign ? ' — ' + p.utm_campaign : '')
    : 'Direta / não identificada';

  var linhas = ''
    + linha('WhatsApp', '<a href="' + linkZap + '" style="color:#F49E1D;text-decoration:none">' + esc(p.whatsapp) + '</a>')
    + linha('E-mail', '<a href="mailto:' + esc(p.email) + '" style="color:#F49E1D;text-decoration:none">' + esc(p.email) + '</a>')
    + (p.estabelecimento ? linha('Estabelecimento', esc(p.estabelecimento)) : '')
    + (p.tipo ? linha('Tipo', esc(p.tipo)) : '')
    + linha('Campanha', esc(origem))
    + linha('Enviou em', esc(caminho(p.pagina)))
    + (p.pagina_entrada && caminho(p.pagina_entrada) !== caminho(p.pagina)
        ? linha('Entrou por', esc(caminho(p.pagina_entrada))) : '')
    + (p.referrer ? linha('Veio de', esc(p.referrer)) : '')
    + linha('Recebido em', quando);

  var desafio = p.desafio
    ? '<div style="margin-top:20px;padding:16px;background:#141210;border-radius:12px">'
      + '<div style="font-size:12px;letter-spacing:1.5px;color:#9C968A;margin-bottom:6px">PRINCIPAL DESAFIO</div>'
      + '<div style="font-size:15px;line-height:1.6">' + esc(p.desafio) + '</div></div>'
    : '';

  var html = ''
    + '<div style="font-family:Arial,Helvetica,sans-serif;background:#0A0908;padding:28px;border-radius:16px;color:#F3EDE3;max-width:560px">'
    +   '<div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#F49E1D;margin-bottom:8px">NOVO LEAD — VEGAS ACELERADORA</div>'
    +   '<div style="font-size:24px;font-weight:bold;margin-bottom:20px">' + esc(p.nome) + '</div>'
    +   '<table style="width:100%;border-collapse:collapse;font-size:15px">' + linhas + '</table>'
    +   desafio
    +   '<a href="' + linkZap + '" style="display:inline-block;margin-top:22px;background:#25D366;color:#fff;padding:14px 26px;border-radius:100px;font-weight:bold;text-decoration:none;font-size:14px">Chamar no WhatsApp</a>'
    + '</div>';

  var texto = 'NOVO LEAD — VEGAS ACELERADORA\n\n'
    + 'Nome: ' + p.nome + '\n'
    + 'WhatsApp: ' + p.whatsapp + '\n'
    + 'E-mail: ' + p.email + '\n'
    + (p.estabelecimento ? 'Estabelecimento: ' + p.estabelecimento + '\n' : '')
    + (p.tipo ? 'Tipo: ' + p.tipo + '\n' : '')
    + (p.desafio ? 'Desafio: ' + p.desafio + '\n' : '')
    + 'Campanha: ' + origem + '\n'
    + 'Enviou em: ' + caminho(p.pagina) + '\n'
    + (p.pagina_entrada && caminho(p.pagina_entrada) !== caminho(p.pagina)
        ? 'Entrou por: ' + caminho(p.pagina_entrada) + '\n' : '')
    + (p.referrer ? 'Veio de: ' + p.referrer + '\n' : '')
    + 'Recebido em: ' + quando + '\n\n'
    + 'Chamar no WhatsApp: ' + linkZap;

  MailApp.sendEmail({
    to: EMAILS_NOTIFICACAO.join(','),
    subject: 'Novo lead: ' + p.nome + ' — ' + p.whatsapp,
    body: texto,
    htmlBody: html,
    name: 'Vegas Aceleradora'
  });
}

/** Só o caminho da URL: "/marketing-para-pizzarias/" em vez da URL inteira.
 *  No e-mail isso é o que se lê de relance. A planilha guarda a URL completa. */
function caminho(url) {
  var s = String(url || '');
  var m = s.match(/^https?:\/\/[^\/]+(\/[^?#]*)/);
  return m ? m[1] : s;
}

function linha(rotulo, valor) {
  return '<tr>'
    + '<td style="padding:8px 0;color:#9C968A;width:130px;vertical-align:top">' + rotulo + '</td>'
    + '<td style="padding:8px 0;font-weight:bold">' + valor + '</td>'
    + '</tr>';
}

function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================== instalacao ====

/**
 * Rode uma vez, pelo editor, antes de implantar.
 * Cria as abas, os cabeçalhos e o resumo. Rodar de novo não duplica nada.
 */
function prepararPlanilha() {
  var ss = planilha();
  var leads = abaLeads();
  var mapa = mapaDeColunas(leads);   // cria as colunas que faltarem
  estiloCabecalho(leads);
  leads.setColumnWidth(mapa['Nome'], 180);
  leads.setColumnWidth(mapa['Página'], 260);
  leads.setColumnWidth(mapa['Principal desafio'], 320);

  // Letra da coluna a partir do número, para montar as fórmulas sem supor
  // posição: se alguém mover uma coluna, basta rodar isto de novo.
  var L = function (titulo) {
    var n = mapa[titulo], s = '';
    while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
    return s;
  };
  var cData = L('Data'), cNome = L('Nome'), cUtm = L('UTM Source');
  var cPag = L('Página'), cEntrada = L('Página de entrada');
  var cTipo = L('Tipo'), cForm = L('Formulário');

  var resumo = ss.getSheetByName(ABA_RESUMO) || ss.insertSheet(ABA_RESUMO, 0);
  resumo.clear();
  resumo.getRange('A1').setValue('Resumo — leads do site')
    .setFontWeight('bold').setFontSize(14);
  resumo.getRange('A2').setValue('Atualiza sozinho. A aba Leads é a fonte.')
    .setFontColor('#666666');

  resumo.getRange('A4:B4').setValues([['Indicador', 'Leads']])
    .setFontWeight('bold').setBackground('#0A0908').setFontColor('#F49E1D');
  resumo.getRange('A5:B10').setValues([
    ['Total',               '=MAX(0; COUNTA(Leads!' + cNome + '2:' + cNome + '))'],
    ['Hoje',                '=COUNTIFS(Leads!' + cData + '2:' + cData + '; ">="&TODAY(); Leads!' + cData + '2:' + cData + '; "<"&TODAY()+1)'],
    ['Últimos 7 dias',      '=COUNTIF(Leads!' + cData + '2:' + cData + '; ">="&TODAY()-7)'],
    ['Últimos 30 dias',     '=COUNTIF(Leads!' + cData + '2:' + cData + '; ">="&TODAY()-30)'],
    ['Com campanha (UTM)',  '=COUNTIF(Leads!' + cUtm + '2:' + cUtm + '; "<>")'],
    ['Sem campanha',        '=MAX(0; COUNTA(Leads!' + cNome + '2:' + cNome + ') - COUNTIF(Leads!' + cUtm + '2:' + cUtm + '; "<>"))']
  ]);

  // As duas perguntas de página, lado a lado. "Converteu" é onde a pessoa
  // mandou o formulário; "trouxe" é por onde ela entrou no site. Quase sempre
  // são páginas diferentes, e a diferença é a informação útil.
  // Montada por partes porque a fórmula tem três níveis de aspas — a do
  // Apps Script, a da string QUERY e a dos rótulos. Concatenando a mão eu já
  // perdi a aspa final do último rótulo, e a fórmula inteira quebrava.
  var query = function (col, rotuloA, rotuloB) {
    var sql = [
      'select ' + col + ', count(' + col + ')',
      'where ' + col + " is not null and " + col + " <> ''",
      'group by ' + col,
      'order by count(' + col + ') desc',
      'limit 15',
      "label " + col + " '" + rotuloA + "', count(" + col + ") '" + rotuloB + "'"
    ].join(' ');
    var faixa = 'Leads!' + col + '2:' + col;
    return '=IFERROR(QUERY(' + faixa + '; "' + sql + '"); "sem dados ainda")';
  };

  resumo.getRange('D4').setValue('Página que CONVERTEU (onde enviou o formulário)')
    .setFontWeight('bold');
  resumo.getRange('D5').setFormula(query(cPag, 'Página', 'Leads'));

  resumo.getRange('D22').setValue('Página que TROUXE (primeira da visita)')
    .setFontWeight('bold');
  resumo.getRange('D23').setFormula(query(cEntrada, 'Página de entrada', 'Leads'));

  resumo.getRange('A13').setValue('Por campanha').setFontWeight('bold');
  resumo.getRange('A14').setFormula(query(cUtm, 'UTM source', 'Leads'));

  resumo.getRange('A24').setValue('Por tipo de operação').setFontWeight('bold');
  resumo.getRange('A25').setFormula(query(cTipo, 'Tipo', 'Leads'));

  resumo.getRange('A34').setValue('Por formulário').setFontWeight('bold');
  resumo.getRange('A35').setFormula(query(cForm, 'Formulário', 'Leads'));

  resumo.setColumnWidth(1, 240);
  resumo.setColumnWidth(4, 420);

  SpreadsheetApp.flush();
  return 'Planilha pronta. Agora: Implantar → Nova implantação → App da Web.';
}

/**
 * Teste sem precisar do site: grava um lead falso e manda o e-mail.
 * Apague a linha da planilha depois.
 */
function testarEnvio() {
  processar({
    postData: {
      contents: JSON.stringify({
        full_name: 'Teste Vegas',
        phone: '+5527999999999',
        email: 'teste@exemplo.com',
        estabelecimento: 'Pizzaria de Teste',
        tipo_estabelecimento: 'Pizzaria',
        desafio: 'Linha de teste — pode apagar.',
        source: 'Teste manual pelo editor',
        pagina: 'https://vegasaceleradora.com.br/diagnostico/',
        id: 'teste-' + Date.now()
      })
    }
  });
}
