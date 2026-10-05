import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { messagesHandler, notificationsHandler, statusHandler } from './handlers.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
app.use(express.json({ limit: '16kb' }))

app.post('/api/status', statusHandler)
app.post('/api/messages', messagesHandler)
app.post('/api/notifications', notificationsHandler)

app.use(express.static(path.join(root, 'dist')))
app.get('*', (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))

app.listen(port, () => {
  console.log(`MAX Chat запущен на http://localhost:${port}`)
  console.log('Подключи личный инстанс GREEN-API в настройках чата.')
})
