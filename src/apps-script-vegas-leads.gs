/**
 * VEGAS ACELERADORA — Recebimento de leads da landing page
 *
 * COMO INSTALAR
 * 1. Abra a planilha da Vegas no Google Sheets
 * 2. Extensões → Apps Script
 * 3. Apague o conteúdo e cole TODO este arquivo
 * 4. Implantar → Nova implantação → Tipo: App da Web
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 * 5. Copie a URL gerada (termina em /exec) e me envie
 */

var EMAILS_NOTIFICACAO = [
  'recjohny091@gmail.com',
  'vegasaceleradora@gmail.com'
];

var NOME_ABA = 'Leads';

function doGet(e) {
  return processar(e);
}

function doPost(e) {
  return processar(e);
}

function processar(e) {
  try {
    var p = (e && e.parameter) || {};

    var dados = {
      data: new Date(),
      nome: p.nome || '',
      email: p.email || '',
      whatsapp: p.whatsapp || '',
      utm_source: p.utm_source || '',
      utm_medium: p.utm_medium || '',
      utm_campaign: p.utm_campaign || '',
      utm_term: p.utm_term || '',
      utm_content: p.utm_content || '',
      gclid: p.gclid || '',
      fbclid: p.fbclid || '',
      pagina: p.pagina || ''
    };

    salvarNaPlanilha(dados);
    notificarPorEmail(dados);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function salvarNaPlanilha(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(NOME_ABA);

  if (!aba) {
    aba = ss.insertSheet(NOME_ABA);
  }

  if (aba.getLastRow() === 0) {
    aba.appendRow([
      'Data', 'Nome', 'Email', 'WhatsApp',
      'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term', 'UTM Content',
      'GCLID', 'FBCLID', 'Página'
    ]);
    aba.getRange(1, 1, 1, 12)
      .setFontWeight('bold')
      .setBackground('#0A0908')
      .setFontColor('#F49E1D');
    aba.setFrozenRows(1);
  }

  aba.appendRow([
    d.data, d.nome, d.email, d.whatsapp,
    d.utm_source, d.utm_medium, d.utm_campaign, d.utm_term, d.utm_content,
    d.gclid, d.fbclid, d.pagina
  ]);
}

function notificarPorEmail(d) {
  var quando = Utilities.formatDate(d.data, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
  var whatsLimpo = String(d.whatsapp).replace(/\D/g, '');
  var linkWhats = 'https://api.whatsapp.com/send?phone=55' + whatsLimpo;

  var origem = d.utm_source
    ? d.utm_source + (d.utm_campaign ? ' — ' + d.utm_campaign : '')
    : 'Direto / não identificada';

  var html = ''
    + '<div style="font-family:Arial,Helvetica,sans-serif;background:#0A0908;padding:28px;border-radius:16px;color:#F3EDE3;max-width:520px">'
    +   '<div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#F49E1D;margin-bottom:8px">NOVO LEAD — VEGAS ACELERADORA</div>'
    +   '<div style="font-size:24px;font-weight:bold;margin-bottom:20px">' + escapar(d.nome) + '</div>'
    +   '<table style="width:100%;border-collapse:collapse;font-size:15px">'
    +     linha('WhatsApp', '<a href="' + linkWhats + '" style="color:#F49E1D;text-decoration:none">' + escapar(d.whatsapp) + '</a>')
    +     linha('Email', '<a href="mailto:' + escapar(d.email) + '" style="color:#F49E1D;text-decoration:none">' + escapar(d.email) + '</a>')
    +     linha('Origem', escapar(origem))
    +     linha('Recebido em', quando)
    +   '</table>'
    +   '<a href="' + linkWhats + '" style="display:inline-block;margin-top:22px;background:#25D366;color:#fff;padding:14px 26px;border-radius:100px;font-weight:bold;text-decoration:none;font-size:14px">Chamar no WhatsApp</a>'
    + '</div>';

  var texto = 'NOVO LEAD — VEGAS ACELERADORA\n\n'
    + 'Nome: ' + d.nome + '\n'
    + 'WhatsApp: ' + d.whatsapp + '\n'
    + 'Email: ' + d.email + '\n'
    + 'Origem: ' + origem + '\n'
    + 'Recebido em: ' + quando + '\n\n'
    + 'Chamar no WhatsApp: ' + linkWhats;

  MailApp.sendEmail({
    to: EMAILS_NOTIFICACAO.join(','),
    subject: '🔥 Novo lead: ' + d.nome + ' — ' + d.whatsapp,
    body: texto,
    htmlBody: html,
    name: 'Vegas Aceleradora'
  });
}

function linha(rotulo, valor) {
  return '<tr>'
    + '<td style="padding:8px 0;color:#9C968A;width:120px">' + rotulo + '</td>'
    + '<td style="padding:8px 0;font-weight:bold">' + valor + '</td>'
    + '</tr>';
}

function escapar(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
