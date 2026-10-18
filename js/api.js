/**
 * Единственото място, което прави fetch към Apps Script.
 * Content-Type: text/plain избягва допълнителна CORS проверка (виж spec.md > Stack).
 */
export async function callScript(scriptUrl, token, action, payload) {
  let res;
  try {
    res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, action, payload: payload || {} }),
    });
  } catch (err) {
    throw new Error('network');
  }
  if (!res.ok) {
    throw new Error('http_' + res.status);
  }
  return res.json();
}
