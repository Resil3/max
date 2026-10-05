import { chatIdFromPhone, credentials, extractIncomingText, greenApi, toClientMessage } from './green-api.js'

function respond(res, status, value) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(value)
}

function method(req, expected, res) {
  if (req.method !== expected) {
    res.setHeader('Allow', expected)
    respond(res, 405, { error: 'Метод запроса не поддерживается.' })
    return false
  }
  return true
}

function getConfig(req, res) {
  try { return credentials(req.body) }
  catch (error) { respond(res, 400, { error: error.message }); return null }
}

export async function statusHandler(req, res) {
  if (!method(req, 'POST', res)) return
  const config = getConfig(req, res)
  if (!config) return
  try {
    const result = await greenApi(config, 'getStateInstance')
    respond(res, 200, { connected: result?.stateInstance === 'authorized', state: result?.stateInstance || 'unknown' })
  } catch (error) { respond(res, 502, { error: error.message }) }
}

export async function messagesHandler(req, res) {
  if (!method(req, 'POST', res)) return
  const config = getConfig(req, res)
  if (!config) return
  const message = String(req.body?.message || '').trim()
  if (!message) return respond(res, 400, { error: 'Сообщение не может быть пустым.' })
  if (message.length > 4000) return respond(res, 400, { error: 'Максимальная длина сообщения — 4000 символов.' })
  try {
    const result = await greenApi(config, 'sendMessage', { body: { chatId: chatIdFromPhone(req.body?.phone), message } })
    respond(res, 200, result)
  } catch (error) { respond(res, 502, { error: error.message }) }
}

export async function notificationsHandler(req, res) {
  if (!method(req, 'POST', res)) return
  const config = getConfig(req, res)
  if (!config) return
  try {
    const notification = await greenApi(config, 'receiveNotification', { timeout: 9_000, query: '?receiveTimeout=5' })
    if (!notification) return respond(res, 200, { message: null })
    const text = extractIncomingText(notification)
    if (notification.receiptId !== undefined && notification.receiptId !== null) {
      await greenApi(config, 'deleteNotification', { httpMethod: 'DELETE', pathSuffix: `/${encodeURIComponent(notification.receiptId)}` })
    }
    respond(res, 200, { message: text ? toClientMessage(notification, text) : null })
  } catch (error) { respond(res, 502, { error: error.message }) }
}
