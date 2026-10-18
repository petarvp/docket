function getAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    categories: readSheetAsObjects(ss, 'Categories'),
    tasks: readSheetAsObjects(ss, 'Tasks'),
  };
}

function readSheetAsObjects(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values
    .slice(1)
    .filter(function (row) {
      return row[0] !== '';
    })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        obj[h] = row[i];
      });
      return obj;
    });
}

/**
 * Всички нови редове от една заявка се пишат с ПО ЕДНО извикване на setValues
 * за Categories и ПО ЕДНО за Tasks — поотделните извиквания към Sheets са бавни,
 * а при имейл с няколко задачи операциите бързо се трупат.
 */
function applyChanges(payload) {
  var ops = payload.ops || [];
  var applied = [];
  var conflicts = [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var categoryRows = [];
  var taskRows = [];

  ops.forEach(function (op) {
    try {
      if (op.type === 'create' && op.entity === 'category') {
        categoryRows.push(buildCategoryRow(op));
        applied.push(op.op_id);
      } else if (op.type === 'create' && op.entity === 'task') {
        taskRows.push(buildTaskRow(op));
        applied.push(op.op_id);
      } else if (op.type === 'update' && op.entity === 'task') {
        var result = updateTaskRow(ss, op);
        if (result.conflict) {
          conflicts.push({ op_id: op.op_id, id: op.id, server_record: result.server_record, your_fields: op.fields });
        } else {
          applied.push(op.op_id);
        }
      } else if (op.type === 'delete' && op.entity === 'task') {
        deleteTaskRow(ss, op);
        applied.push(op.op_id);
      } else if (op.type === 'archiveCategory' && op.entity === 'category') {
        setCategoryStatus(ss, op.id, 'archived');
        applied.push(op.op_id);
      } else if (op.type === 'reactivateCategory' && op.entity === 'category') {
        setCategoryStatus(ss, op.id, 'active');
        applied.push(op.op_id);
      } else {
        conflicts.push({ op_id: op.op_id, error: 'unsupported_op' });
      }
    } catch (err) {
      conflicts.push({ op_id: op.op_id, error: err.message });
    }
  });

  if (categoryRows.length) {
    writeRows(ss, 'Categories', categoryRows, [2]); // name
  }
  if (taskRows.length) {
    writeRows(ss, 'Tasks', taskRows, [2, 3, 4, 6, 7]); // category_id, title, details, due_date, source_excerpt
  }

  return { applied: applied, conflicts: conflicts };
}

function buildCategoryRow(op) {
  var f = op.fields;
  var now = new Date().toISOString();
  return [op.id, f.name, 'active', now, '', now, 1];
}

function buildTaskRow(op) {
  var f = op.fields;
  var now = new Date().toISOString();
  return [
    op.id,
    f.category_id,
    f.title,
    f.details || '',
    f.priority || 'medium',
    f.due_date || '',
    f.source_excerpt || '',
    f.origin || 'ai',
    false,
    '',
    now,
    now,
    1,
  ];
}

function writeRows(ss, sheetName, rows, textColumns) {
  var sheet = ss.getSheetByName(sheetName);
  var startRow = sheet.getLastRow() + 1;

  // Текстовият формат се задава ПРЕДИ записа, иначе Sheets разпознава
  // низове като "15 септември" като дата.
  textColumns.forEach(function (col) {
    sheet.getRange(startRow, col, rows.length, 1).setNumberFormat('@');
  });

  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

var TASK_TEXT_FIELDS = ['category_id', 'title', 'details', 'due_date', 'source_excerpt'];

/**
 * Връща { conflict: false } при успешен запис, или { conflict: true, server_record }
 * ако версията на устройството (op.base_version) е по-стара от тази в таблицата —
 * тогава НЕ пренаписва нищо, а връща текущия запис за диалога "коя версия".
 */
function updateTaskRow(ss, op) {
  var sheet = ss.getSheetByName('Tasks');
  var rowIndex = findRowIndexById(sheet, op.id);
  if (rowIndex === -1) throw new Error('not_found');

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var versionCol = headers.indexOf('version') + 1;
  var currentVersion = sheet.getRange(rowIndex, versionCol).getValue() || 0;

  if (op.base_version != null && currentVersion > op.base_version) {
    return { conflict: true, server_record: readRowAsObject(sheet, headers, rowIndex) };
  }

  var fields = op.fields || {};

  Object.keys(fields).forEach(function (key) {
    var col = headers.indexOf(key) + 1;
    if (col === 0) return;
    var cell = sheet.getRange(rowIndex, col);
    if (TASK_TEXT_FIELDS.indexOf(key) !== -1) cell.setNumberFormat('@');
    cell.setValue(fields[key]);
  });

  if (fields.done === true) {
    sheet.getRange(rowIndex, headers.indexOf('done_at') + 1).setValue(new Date().toISOString());
  } else if (fields.done === false) {
    sheet.getRange(rowIndex, headers.indexOf('done_at') + 1).setValue('');
  }

  sheet.getRange(rowIndex, headers.indexOf('updated_at') + 1).setValue(new Date().toISOString());
  sheet.getRange(rowIndex, versionCol).setValue(currentVersion + 1);

  return { conflict: false };
}

function readRowAsObject(sheet, headers, rowIndex) {
  var values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  var obj = {};
  headers.forEach(function (h, i) {
    obj[h] = values[i];
  });
  return obj;
}

function deleteTaskRow(ss, op) {
  var sheet = ss.getSheetByName('Tasks');
  var rowIndex = findRowIndexById(sheet, op.id);
  if (rowIndex === -1) return; // вече изтрита — нищо да се прави
  sheet.deleteRow(rowIndex);
}

function setCategoryStatus(ss, id, status) {
  var sheet = ss.getSheetByName('Categories');
  var rowIndex = findRowIndexById(sheet, id);
  if (rowIndex === -1) throw new Error('not_found');

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var now = new Date().toISOString();

  sheet.getRange(rowIndex, headers.indexOf('status') + 1).setValue(status);
  sheet.getRange(rowIndex, headers.indexOf('archived_at') + 1).setValue(status === 'archived' ? now : '');
  sheet.getRange(rowIndex, headers.indexOf('updated_at') + 1).setValue(now);

  var versionCol = headers.indexOf('version') + 1;
  var currentVersion = sheet.getRange(rowIndex, versionCol).getValue();
  sheet.getRange(rowIndex, versionCol).setValue((currentVersion || 0) + 1);
}

function findRowIndexById(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return -1;
}
