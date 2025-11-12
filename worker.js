export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', message: 'worker running' }), { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed, use POST' }), { status: 405, headers: corsHeaders });
    }

    // parse JSON body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body', details: String(err) }), { status: 400, headers: corsHeaders });
    }

    if (!body || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: 'Request must include messages array' }), { status: 400, headers: corsHeaders });
    }

    // simple out-of-scope keyword check
    const outKeywords = ["politics","vote","election","tax","bank","investment","stock","crypto","lawyer","legal","prescription","diagnose","suicide","weapon","bomb","crime","hack","password","ssn","social security","loan"];
    const combined = body.messages.map(m => (m.content || "")).join(" ").toLowerCase();
    if (outKeywords.some(k => combined.includes(k))) {
      return new Response(JSON.stringify({
        error: 'out_of_scope',
        message: "I'm sorry — I can only answer questions about beauty and health care. Please ask about skincare, haircare, makeup, or related healthy beauty routines."
      }), { status: 200, headers: corsHeaders });
    }

    const apiKey = env.OPEN_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: OPEN_API_KEY not set' }), { status: 500, headers: corsHeaders });
    }

    // system instruction to keep assistant in-domain
    const system = {
      role: 'system',
      content: "You are a specialist assistant for beauty and health-care topics only. Answer only questions about skincare, haircare, makeup, cosmetic products, and healthy beauty routines. For any question outside this domain, refuse politely with: 'I'm sorry — I can only answer questions about beauty and health care.' Keep answers concise and practical."
    };

    const openaiRequest = {
      model: 'gpt-4o',
      messages: [system, ...body.messages],
      max_tokens: 600
    };

    try {
      const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(openaiRequest)
      });

      const data = await openaiResp.json();
      if (!openaiResp.ok) {
        return new Response(JSON.stringify({ error: 'OpenAI API error', status: openaiResp.status, details: data }), { status: openaiResp.status, headers: corsHeaders });
      }

      return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Internal worker error', message: String(err) }), { status: 500, headers: corsHeaders });
    }
  }
};

