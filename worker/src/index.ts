interface Env {
  DEEPSEEK_API_KEY: string
  FIREBASE_PROJECT_ID: string
  FIREBASE_API_KEY: string
}

const ALLOWED_MODELS = new Set(['deepseek-chat', 'deepseek-reasoner'])

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    // Verify Firebase ID token
    const authHeader = request.headers.get('Authorization') ?? ''
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!idToken) return json({ error: 'Unauthorized' }, 401)

    const uid = await verifyFirebaseToken(idToken, env)
    if (!uid) return json({ error: 'Invalid token' }, 401)

    // Parse and validate request body
    let body: { prompt?: unknown; model?: unknown }
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const { prompt, model } = body
    if (typeof prompt !== 'string' || !prompt) return json({ error: 'prompt required' }, 400)
    if (typeof model !== 'string' || !ALLOWED_MODELS.has(model)) {
      return json({ error: 'Invalid model' }, 400)
    }

    // Call DeepSeek
    let deepseekRes: Response
    try {
      deepseekRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      })
    } catch {
      return json({ error: 'Upstream network error' }, 502)
    }

    if (!deepseekRes.ok) {
      return json({ error: `Upstream error ${deepseekRes.status}` }, 502)
    }

    const data = await deepseekRes.json() as { choices: { message: { content: string } }[] }
    const text = data.choices?.[0]?.message?.content ?? ''

    return json({ text }, 200)
  },
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// Verify a Firebase ID token using Firebase's public JWKS (RS256)
async function verifyFirebaseToken(token: string, env: Env): Promise<string | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')))
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

    // Check expiry and audience
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) return null
    if (payload.aud !== env.FIREBASE_PROJECT_ID) return null
    if (payload.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`) return null

    // Fetch Firebase public keys
    const keysRes = await fetch(
      'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
      { cf: { cacheTtl: 3600 } } as RequestInit,
    )
    const { keys } = await keysRes.json() as { keys: JsonWebKey[] }
    const jwk = (keys as (JsonWebKey & { kid?: string })[]).find(k => k.kid === header.kid)
    if (!jwk) return null

    // Import the public key and verify signature
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    const encoder = new TextEncoder()
    const data = encoder.encode(`${parts[0]}.${parts[1]}`)
    const signature = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0),
    )

    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, data)
    return valid ? (payload.sub as string) : null
  } catch {
    return null
  }
}
