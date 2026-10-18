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
