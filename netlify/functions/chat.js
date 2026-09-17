// Netlify Function: keeps your Groq API key on the server.
// The browser never sees it — only requests to THIS function, which
// then adds the real key before talking to Groq.
//
// Deploy: put this file at netlify/functions/chat.js in your site,
// then in Netlify's dashboard set an environment variable:
//   GROQ_API_KEY = <your real Groq key>
// Redeploy after adding the env var.

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: { message: 'Server is missing GROQ_API_KEY env var' } }) };
  }

  // Very basic abuse guard: cap prompt size and force a fixed, cheap model
  // regardless of what the client asks for, so a demo visitor can't run up cost.
  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Bad JSON' } }) };
  }
  const messages = Array.isArray(payload.messages) ? payload.messages.slice(-4) : [];
  const totalChars = messages.reduce((n, m) => n + (m.content ? m.content.length : 0), 0);
  if (totalChars > 6000) {
    return { statusCode: 413, body: JSON.stringify({ error: { message: 'Message too long for the demo.' } }) };
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', // fixed on purpose — the demo endpoint ignores whatever model the client requests
        messages,
        response_format: { type: 'json_object' },
        max_tokens: 500
      })
    });
    const data = await res.json();
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: { message: e.message } }) };
  }
};
