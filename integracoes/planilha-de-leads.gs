/**
 * VEGAS ACELERADORA — uma planilha para todos os formulários do site
 * =============================================================================
 *
 * Planilha: [VEGAS] Leads do site
 * https://docs.google.com/spreadsheets/d/1J8sv8EKTM0iFdaqwEmaeCdvZLTIxeY2I2EuXw6I6drY/edit
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

var PLANILHA_ID = '1J8sv8EKTM0iFdaqwEmaeCdvZLTIxeY2I2EuXw6I6drY';

var EMAILS_NOTIFICACAO = [
  'vegasaceleradora@gmail.com'
];

// Vazio = desligado. Se preencher, o site precisa mandar o mesmo valor.
var SEGREDO = '';

var ABA_LEADS = 'Leads';
var ABA_RESUMO = 'Resumo';
var FUSO = 'America/Sao_Paulo';

// A ordem aqui é a ordem das colunas. Para acrescentar um campo, basta
// incluir na lista: o cabeçalho e a gravação acompanham sozinhos.
var COLUNAS = [
  ['data',          'Data'],
  ['nome',          'Nome'],
  ['whatsapp',      'WhatsApp'],
  ['email',         'E-mail'],
  ['estabelecimento', 'Estabelecimento'],
  ['tipo',          'Tipo'],
  ['desafio',       'Principal desafio'],
  ['origem',        'Origem'],
  ['utm_source',    'UTM source'],
  ['utm_medium',    'UTM medium'],
  ['utm_campaign',  'UTM campaign'],
  ['utm_term',      'UTM term'],
  ['utm_content',   'UTM content'],
  ['gclid',         'GCLID'],
  ['fbclid',        'FBCLID'],
  ['pagina',        'Página'],
  ['referrer',      'Veio de'],
  ['id',            'ID do envio']
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
    pagina: pega('pagina', 'landing_page'),
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
  if (aba.getLastRow() === 0) cabecalho(aba);
  return aba;
}

function cabecalho(aba) {
  var titulos = COLUNAS.map(function (c) { return c[1]; });
  aba.getRange(1, 1, 1, titulos.length).setValues([titulos]);
  aba.getRange(1, 1, 1, titulos.length)
    .setFontWeight('bold')
    .setBackground('#0A0908')
    .setFontColor('#F49E1D');
  aba.setFrozenRows(1);
  aba.setColumnWidth(1, 140);   // Data
  aba.setColumnWidth(2, 180);   // Nome
  aba.setColumnWidth(7, 320);   // Desafio
}

function gravar(p) {
  var aba = abaLeads();
  var linha = COLUNAS.map(function (c) { return p[c[0]] !== undefined ? p[c[0]] : ''; });
  aba.appendRow(linha);
  aba.getRange(aba.getLastRow(), 1).setNumberFormat('dd/MM/yyyy HH:mm');
}

/** O ID do envio é a última coluna; procura só nela. */
function jaRegistrado(id) {
  var aba = abaLeads();
  var n = aba.getLastRow() - 1;
  if (n < 1) return false;
  var col = COLUNAS.length;
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
    + linha('Origem', esc(origem))
    + linha('Página', esc(p.pagina))
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
    + 'Origem: ' + origem + '\n'
    + 'Página: ' + p.pagina + '\n'
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

  var leads = ss.getSheetByName(ABA_LEADS) || ss.insertSheet(ABA_LEADS);
  if (leads.getLastRow() === 0) cabecalho(leads);

  var resumo = ss.getSheetByName(ABA_RESUMO) || ss.insertSheet(ABA_RESUMO, 0);
  resumo.clear();
  resumo.getRange('A1').setValue('Resumo — leads do site')
    .setFontWeight('bold').setFontSize(14);
  resumo.getRange('A3:B3').setValues([['Indicador', 'Valor']])
    .setFontWeight('bold').setBackground('#0A0908').setFontColor('#F49E1D');
  resumo.getRange('A4:B9').setValues([
    ['Total de leads',      '=MAX(0; COUNTA(Leads!B2:B))'],
    ['Hoje',                '=COUNTIFS(Leads!A2:A; ">="&TODAY(); Leads!A2:A; "<"&TODAY()+1)'],
    ['Últimos 7 dias',      '=COUNTIF(Leads!A2:A; ">="&TODAY()-7)'],
    ['Últimos 30 dias',     '=COUNTIF(Leads!A2:A; ">="&TODAY()-30)'],
    ['Com UTM identificada','=COUNTIF(Leads!I2:I; "<>")'],
    ['Sem UTM (direto)',    '=MAX(0; COUNTA(Leads!B2:B) - COUNTIF(Leads!I2:I; "<>"))']
  ]);
  resumo.getRange('A11').setValue('Por origem de campanha').setFontWeight('bold');
  resumo.getRange('A12').setFormula(
    '=IFERROR(QUERY(Leads!I2:I; "select I, count(I) where I is not null group by I order by count(I) desc label I \'UTM source\', count(I) \'Leads\'"); "sem dados ainda")');
  resumo.getRange('D11').setValue('Por tipo de estabelecimento').setFontWeight('bold');
  resumo.getRange('D12').setFormula(
    '=IFERROR(QUERY(Leads!F2:F; "select F, count(F) where F is not null group by F order by count(F) desc label F \'Tipo\', count(F) \'Leads\'"); "sem dados ainda")');
  resumo.setColumnWidth(1, 220);
  resumo.setColumnWidth(4, 220);

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
