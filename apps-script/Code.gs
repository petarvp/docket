/**
 * Docket — Apps Script рутер.
 * Всяка заявка от страницата идва като POST с JSON тяло: { token, action, payload }.
 */

function doPost(e) {
  var response;
  try {
    var body = JSON.parse(e.postData.contents);
    response = route(body);
  } catch (err) {
    response = { ok: false, error: 'bad_request', message: 'Невалидна заявка: ' + err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function route(body) {
  var token = body.token;
  var action = body.action;
  var payload = body.payload || {};

  if (!checkToken(token)) {
    return { ok: false, error: 'unauthorized', message: 'Грешен код за достъп.' };
  }

  switch (action) {
    case 'ping':
      return { ok: true, data: { pong: true } };
    case 'saveSettings':
      return saveSettings(payload);
    default:
      return { ok: false, error: 'unknown_action', message: 'Неизвестно действие: ' + action };
  }
}

function checkToken(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
  return !!expected && token === expected;
}

function saveSettings(payload) {
  if (!payload.groq_api_key) {
    return { ok: false, error: 'missing_field', message: 'Липсва Groq ключ.' };
  }
  PropertiesService.getScriptProperties().setProperty('GROQ_API_KEY', payload.groq_api_key);
  return { ok: true, data: {} };
}

/**
 * Пуска се РЪЧНО, веднъж, от редактора на Apps Script (избери функцията setup
 * от падащото меню и натисни Run). Създава листовете и код за достъп, ако го няма.
 * Кодът за достъп се вижда само в логовете на това изпълнение — копирай го оттам.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  createSheetWithHeaders(ss, 'Categories', ['id', 'name', 'status', 'created_at', 'archived_at', 'updated_at', 'version']);
  createSheetWithHeaders(ss, 'Tasks', ['id', 'category_id', 'title', 'details', 'priority', 'due_date', 'source_excerpt', 'origin', 'done', 'done_at', 'created_at', 'updated_at', 'version']);
  createSheetWithHeaders(ss, 'Logs', ['ts', 'request_id', 'action', 'model', 'ms', 'ok', 'error_code', 'tokens_in', 'tokens_out', 'tasks_proposed', 'tasks_confirmed', 'correction_round', 'corrected_fields', 'origin']);

  var props = PropertiesService.getScriptProperties();
  var existingToken = props.getProperty('ACCESS_TOKEN');
  if (!existingToken) {
    var token = Utilities.getUuid();
    props.setProperty('ACCESS_TOKEN', token);
    Logger.log('Нов код за достъп (копирай го — вижда се само тук): ' + token);
  } else {
    Logger.log('Код за достъп вече има (не се показва повторно). Виж Project Settings > Script Properties, ако го изгубиш.');
  }
}

function createSheetWithHeaders(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getRange(1, 1).getValue() === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}
