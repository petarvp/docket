function propose(payload) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY');
  if (!apiKey) {
    return { ok: false, error: 'missing_key', message: 'Няма зададен Groq ключ. Върни се в настройката.' };
  }

  var model = PropertiesService.getScriptProperties().getProperty('GROQ_MODEL') || 'openai/gpt-oss-20b';
  var schema = buildProposalSchema();
  var messages = buildMessages(payload);

  var requestBody = {
    model: model,
    messages: messages,
    temperature: 0.2,
    max_completion_tokens: 1024,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'docket_proposal', strict: true, schema: schema },
    },
  };

  var startedAt = Date.now();
  var resp;
  try {
    resp = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true,
    });
  } catch (err) {
    logRow({ action: 'propose', ok: false, error_code: 'network', ms: Date.now() - startedAt, model: model });
    return { ok: false, error: 'ai_unavailable', message: 'AI не отговаря, опитай пак.' };
  }

  var code = resp.getResponseCode();
  if (code !== 200) {
    logRow({ action: 'propose', ok: false, error_code: 'http_' + code, ms: Date.now() - startedAt, model: model });
    return { ok: false, error: 'ai_unavailable', message: 'AI не отговаря, опитай пак.' };
  }

  var data = JSON.parse(resp.getContentText());
  var parsed;
  try {
    parsed = JSON.parse(data.choices[0].message.content);
  } catch (err) {
    logRow({ action: 'propose', ok: false, error_code: 'bad_json', ms: Date.now() - startedAt, model: model });
    return { ok: false, error: 'ai_unavailable', message: 'AI не отговаря, опитай пак.' };
  }

  logRow({
    action: 'propose',
    ok: true,
    ms: Date.now() - startedAt,
    model: model,
    tokens_in: data.usage ? data.usage.prompt_tokens : '',
    tokens_out: data.usage ? data.usage.completion_tokens : '',
    tasks_proposed: parsed.tasks.length,
    correction_round: payload.correction ? 1 : 0,
  });

  return { ok: true, data: parsed };
}

function buildMessages(payload) {
  var messages = [
    { role: 'system', content: buildSystemPrompt(payload) },
    { role: 'user', content: payload.text },
  ];
  if (payload.previous_proposal) {
    messages.push({ role: 'assistant', content: JSON.stringify(payload.previous_proposal) });
  }
  if (payload.correction) {
    messages.push({ role: 'user', content: payload.correction });
  }
  return messages;
}

function buildSystemPrompt(payload) {
  var activeList = (payload.active_categories || []).join(', ') || '(няма активни колони)';
  return [
    'Ти си AI асистент в Docket — kanban приложение за лични задачи. Отговаряй на български.',
    'Днешна дата: ' + payload.today + '.',
    'Активни колони в момента: ' + activeList + '.',
    'Правило за категориите: категорията е ПОВОД или ПРОЕКТ (конкретно събитие, дата или инициатива) — не темата на отделната задача.',
    'Ако няколко задачи идват от един и същ текст/имейл и се отнасят до един и същ повод (например едно събитие на определена дата), групирай ги в ЕДНА колона, именувана по повода (напр. "15 септември"). НЕ създавай отделна колона за всяка задача по нейната собствена тема (например "Лаптоп", "Сценарий").',
    'Нова, отделна колона само когато задачите реално принадлежат на различни, несвързани поводи.',
    'Ако някоя тема пасва на съществуваща активна колона, предложи нея с is_new_category=false. Иначе предложи нова колона с is_new_category=true.',
    'Архивираните колони никога не се предлагат, дори темата да съвпада — винаги нова колона в този случай.',
    'Ако последното съобщение е корекция от потребителя след предходно предложение, тя има предимство пред първоначалния текст и трябва да се приложи точно (например ако потребителят поиска по-малко или различни колони).',
    'Ако текстът не съдържа задача за вършене, върни has_tasks=false, кратко message обясняващо това, и tasks=[].',
    'Ако няма конкретен краен срок за задача, due_date трябва да е null.',
    'source_excerpt е кратък (до 15 думи) откъс от оригиналния текст, от който произлиза задачата.',
    'Бъди кратък — message до едно изречение.',
  ]
    .concat(
      payload.gen_z_mode
        ? ['„Gen Z mode" е включен: добави по едно подходящо emoji в НАЧАЛОТО на всяко заглавие на задача (title), за по-бърз преглед с поглед.']
        : []
    )
    .join(' ');
}

function buildProposalSchema() {
  return {
    type: 'object',
    properties: {
      has_tasks: { type: 'boolean' },
      message: { type: 'string' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            details: { type: 'string' },
            category: { type: 'string' },
            is_new_category: { type: 'boolean' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            due_date: { type: ['string', 'null'] },
            source_excerpt: { type: 'string' },
          },
          required: ['title', 'details', 'category', 'is_new_category', 'priority', 'due_date', 'source_excerpt'],
          additionalProperties: false,
        },
      },
    },
    required: ['has_tasks', 'message', 'tasks'],
    additionalProperties: false,
  };
}
