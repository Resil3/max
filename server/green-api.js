export function credentials(body = {}) {
  const apiUrl = String(body.apiUrl || '').trim().replace(/\/$/, '')
  const idInstance = String(body.idInstance || '').trim()
  const apiToken = String(body.apiTokenInstance || '').trim()
  let parsed
  try { parsed = new URL(apiUrl) } catch { throw new Error('Укажи корректный URL GREEN-API.') }
  if (parsed.protocol !== 'https:' || (parsed.hostname !== 'api.green-api.com' && !parsed.hostname.endsWith('.api.green-api.com')) || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error('URL должен быть адресом GREEN-API вида https://номер.api.green-api.com.')
  }
  if (!/^\d+$/.test(idInstance) || idInstance.length > 32) throw new Error('Проверь idInstance.')
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(apiToken)) throw new Error('Проверь apiTokenInstance.')
  return { apiUrl, idInstance, apiToken }
}

export function chatIdFromPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) throw new Error('Проверь номер: укажи код страны и номер телефона.')
  return `${digits}@c.us`
}

export async function greenApi(config, method, { body, timeout = 12_000, httpMethod, pathSuffix = '', query = '' } = {}) {
  const endpoint = `${config.apiUrl}/waInstance${encodeURIComponent(config.idInstance)}/${method}/${encodeURIComponent(config.apiToken)}${pathSuffix}${query}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(endpoint, {
      method: httpMethod || (body === undefined ? 'GET' : 'POST'),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const raw = await response.text()
    let data
    try { data = raw ? JSON.parse(raw) : {} } catch { data = { error: raw } }
    if (!response.ok) {
      const detail = data?.message || data?.error || data?.description || response.statusText
      throw new Error(`GREEN-API (${response.status}): ${detail}`)
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

export function extractIncomingText(notification) {
  const body = notification?.body || {}
  if (body.typeWebhook !== 'incomingMessageReceived') return null
  const data = body.messageData || {}
  if (data.typeMessage === 'textMessage') return data.textMessageData?.textMessage || null
  if (data.typeMessage === 'extendedTextMessage') return data.extendedTextMessageData?.text || null
  return null
}

export function toClientMessage(notification, text) {
  const body = notification.body || {}
  const timestamp = body.timestamp ? Number(body.timestamp) * 1000 : Date.now()
  return {
    id: String(body.idMessage || notification.receiptId || `${timestamp}-${Math.random()}`),
    text,
    direction: 'incoming',
    chatId: body.senderData?.chatId || '',
    timestamp,
    time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp)),
    status: 'sent',
  }
}
