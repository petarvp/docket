function logRow(fields) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Logs');
  if (!sheet) return;
  sheet.appendRow([
    new Date().toISOString(),
    Utilities.getUuid(),
    fields.action || '',
    fields.model || '',
    fields.ms || '',
    fields.ok === undefined ? '' : fields.ok,
    fields.error_code || '',
    fields.tokens_in || '',
    fields.tokens_out || '',
    fields.tasks_proposed || '',
    fields.tasks_confirmed || '',
    fields.correction_round || '',
    fields.corrected_fields || '',
    fields.origin || '',
  ]);
}

function logEvent(payload) {
  logRow(payload);
  return { ok: true, data: {} };
}
