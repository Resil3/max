import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowUp, Check, CheckCheck, Eye, EyeOff, MessageCircle, MoreHorizontal, Paperclip, Phone, Search, Settings2, ShieldCheck, Smile, UserRound, X } from 'lucide-react'
import './styles.css'

const STORAGE_KEY = 'max-chat-messages-v2'

function readStoredMessages() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function normalisePhone(value) {
  return value.replace(/\D/g, '')
}

function formatTime(value) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(value instanceof Date ? value : new Date(value))
}

function Avatar({ small = false, label = 'MAX' }) {
  return <div className={`avatar ${small ? 'avatar-small' : ''}`}><span>{label.trim().charAt(0).toLocaleUpperCase('ru') || 'M'}</span><i /></div>
}

function MessageBubble({ message }) {
  const mine = message.direction === 'outgoing'
  return (
    <div className={`message-row ${mine ? 'message-row-mine' : ''}`}>
      {!mine && <Avatar small />}
      <div className={`bubble ${mine ? 'bubble-mine' : 'bubble-theirs'}`}>
        <div className="bubble-text">{message.text}</div>
        <div className="bubble-meta"><span>{message.time || formatTime(message.timestamp)}</span>{mine && (message.status === 'error' ? <span className="delivery-error" title={message.error}>!</span> : message.status === 'sent' ? <CheckCheck size={14} /> : <Check size={14} />)}</div>
      </div>
    </div>
  )
}

function App() {
  const [messages, setMessages] = useState(readStoredMessages)
  const [phone, setPhone] = useState(import.meta.env.VITE_DEFAULT_CHAT_PHONE || '')
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [apiUrl, setApiUrl] = useState('https://7103.api.green-api.com')
  const [showToken, setShowToken] = useState(false)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connected, setConnected] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const contactLabel = phone.trim() || 'Новый чат'
  const listRef = useRef(null)
  const textareaRef = useRef(null)
  const pollingRef = useRef(false)

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)) }, [messages])

  const credentials = useCallback(() => ({ idInstance, apiTokenInstance, apiUrl }), [apiTokenInstance, apiUrl, idInstance])

  useEffect(() => {
    if (!connected || !configured || !apiTokenInstance) return undefined
    let active = true
    const poll = async () => {
      if (pollingRef.current) return
      pollingRef.current = true
      try {
        const response = await fetch('/api/notifications', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...credentials(), phone }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Не удалось получить сообщения')
        if (active && result.message && result.message.chatId === `${normalisePhone(phone)}@c.us`) {
          setMessages((current) => current.some((item) => item.id === result.message.id) ? current : [...current, result.message])
        }
      } catch (pollError) {
        if (active) setError(pollError.message)
      } finally { pollingRef.current = false }
    }
    poll()
    const timer = setInterval(poll, 6500)
    return () => { active = false; clearInterval(timer) }
  }, [apiTokenInstance, connected, configured, credentials, phone])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const visibleMessages = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru')
    return query ? messages.filter((message) => message.text.toLocaleLowerCase('ru').includes(query)) : messages
  }, [messages, search])

  const sendMessage = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    if (!configured) {
      setSettingsOpen(true)
      setError('Сначала подключи инстанс GREEN-API в настройках.')
      return
    }
    if (!normalisePhone(phone)) {
      setError('Введи номер получателя в настройках чата.')
      setSettingsOpen(true)
      return
    }
    setSending(true)
    setError('')
    const localMessage = { id: `local-${Date.now()}`, text, time: formatTime(new Date()), timestamp: Date.now(), direction: 'outgoing', status: 'sending' }
    setMessages((current) => [...current, localMessage])
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = '24px'
    try {
      const response = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials(), phone: normalisePhone(phone), message: text }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Не удалось отправить сообщение')
      setMessages((current) => current.map((message) => message.id === localMessage.id ? { ...message, id: result.idMessage || message.id, status: 'sent' } : message))
    } catch (sendError) {
      setMessages((current) => current.map((message) => message.id === localMessage.id ? { ...message, status: 'error', error: sendError.message } : message))
      setError(sendError.message)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [configured, credentials, draft, phone, sending])

  const connectInstance = async () => {
    setError('')
    try {
      const response = await fetch('/api/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials()),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Не удалось подключиться к GREEN-API')
      setConfigured(true)
      setConnected(Boolean(result.connected))
      setSettingsOpen(false)
      if (!result.connected) setError(`Инстанс не авторизован (статус: ${result.state}). Отсканируй QR-код в GREEN-API и попробуй снова.`)
    } catch (connectError) {
      setConnected(false)
      setError(connectError.message)
    }
  }

  const handleInput = (event) => {
    setDraft(event.target.value)
    event.target.style.height = '24px'
    event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`
  }

  return (
    <main className="app-shell">
      <section className="messenger" aria-label="MAX messenger">
        <aside className="rail">
          <div className="rail-brand"><MessageCircle size={23} strokeWidth={2.6} /></div>
          <button className="rail-button rail-button-active" aria-label="Сообщения"><MessageCircle size={21} /><span /></button>
          <button className="rail-button" aria-label="Контакты"><UserRound size={21} /></button>
          <div className="rail-spacer" />
          <button className="rail-button" aria-label="Настройки" onClick={() => setSettingsOpen(true)}><Settings2 size={20} /></button>
          <Avatar small label="MAX" />
        </aside>

        <aside className="conversation-panel">
          <header className="list-header">
            <div className="list-title-row"><h1>Сообщения</h1><button className="icon-button add-chat" aria-label="Новый чат" onClick={() => setSettingsOpen(true)}><span>＋</span></button></div>
            <button className="search-box" onClick={() => setSearchOpen(true)}><Search size={17} /><span>Поиск</span><kbd>⌘ K</kbd></button>
          </header>
          <div className="filter-tabs"><button className="filter-active">Все <span>1</span></button><button>Непрочитанные</button><button>Избранное</button></div>
          <div className="conversation-list">
            <button className="conversation-item conversation-selected">
              <Avatar label={contactLabel} />
              <span className="conversation-copy"><span className="conversation-name">{contactLabel}</span><span className="conversation-preview">{messages.at(-1)?.text || 'Начните переписку'}</span></span>
              <span className="conversation-side"><span>{messages.at(-1)?.time || '10:43'}</span></span>
            </button>
          </div>
          <footer className="list-footer"><span className={`online-dot ${connected ? '' : 'offline-dot'}`} />{connected ? 'Подключено к GREEN-API' : 'Ожидание подключения'}</footer>
        </aside>

        <section className="chat-panel">
          <header className="chat-header">
            <button className="mobile-back icon-button" aria-label="Назад"><ArrowLeft size={20} /></button>
            <Avatar label={contactLabel} />
            <div className="chat-person"><div className="chat-name">{contactLabel}</div><div className="chat-status"><span className={`online-dot ${connected ? '' : 'offline-dot'}`} />{connected ? 'GREEN-API подключён' : 'ожидание подключения'}</div></div>
            <div className="header-actions"><button className="icon-button" aria-label="Поиск по чату" onClick={() => setSearchOpen(true)}><Search size={19} /></button><button className="icon-button" aria-label="Позвонить"><Phone size={19} /></button><button className="icon-button" aria-label="Ещё"><MoreHorizontal size={22} /></button></div>
          </header>

          <div className="chat-content" ref={listRef}>
            <div className="date-divider"><span>Сегодня</span></div>
            {!configured && <div className="setup-note"><div className="setup-icon"><ShieldCheck size={17} /></div><div><strong>Подключи свой аккаунт</strong><span>Добавь данные GREEN-API, чтобы отправлять и получать сообщения.</span></div><button onClick={() => setSettingsOpen(true)}>Настроить</button></div>}
            <div className="message-list">
              {visibleMessages.map((message) => <MessageBubble key={message.id} message={message} />)}
              {visibleMessages.length === 0 && search && <p className="no-results">Совпадений не найдено</p>}
            </div>
            {messages.length === 0 && <div className="empty-chat"><div className="empty-chat-icon"><MessageCircle size={22} /></div><strong>{phone ? 'Начните переписку' : 'Создайте чат'}</strong><span>{phone ? `Отправьте первое сообщение на ${phone}.` : 'Укажите номер собеседника в настройках чата.'}</span></div>}
          </div>

          <div className="composer-wrap">
            {error && <div className="inline-error"><span>{error}</span><button onClick={() => setError('')} aria-label="Закрыть"><X size={14} /></button></div>}
            <div className="composer">
              <button className="composer-tool" aria-label="Прикрепить файл" title="В тестовом задании поддерживается только текст"><Paperclip size={20} /></button>
              <textarea ref={textareaRef} rows="1" value={draft} onChange={handleInput} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }} placeholder="Написать сообщение…" aria-label="Текст сообщения" maxLength={4000} />
              <div className="composer-end"><button className="composer-tool smile-button" aria-label="Эмодзи"><Smile size={20} /></button><span className="char-count">{draft.length > 3500 ? `${draft.length}/4000` : ''}</span><button className={`send-button ${draft.trim() ? 'send-ready' : ''}`} onClick={sendMessage} disabled={!draft.trim() || sending} aria-label="Отправить сообщение">{sending ? <span className="spinner" /> : <ArrowUp size={19} strokeWidth={2.5} />}</button></div>
            </div>
            <div className="composer-hint">Enter — отправить <span>·</span> Shift + Enter — новая строка</div>
          </div>
        </section>
      </section>

      {settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header><div><span className="modal-eyebrow">ПАРАМЕТРЫ ЧАТА</span><h2 id="settings-title">Подключение</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Закрыть"><X size={20} /></button></header><p>Введи учётные данные из личного кабинета GREEN-API. Они передаются по защищённому соединению и не сохраняются в приложении.</p><label htmlFor="instance">idInstance</label><div className="phone-input"><input id="instance" value={idInstance} onChange={(event) => setIdInstance(event.target.value)} placeholder="1101000000" autoComplete="off" /></div><label htmlFor="api-token" className="settings-label-spaced">apiTokenInstance</label><div className="phone-input"><input id="api-token" type={showToken ? 'text' : 'password'} value={apiTokenInstance} onChange={(event) => setApiTokenInstance(event.target.value)} placeholder="Введите токен инстанса" autoComplete="new-password" /><button className="token-toggle" type="button" onClick={() => setShowToken((value) => !value)} aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}>{showToken ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><label htmlFor="api-url" className="settings-label-spaced">URL API</label><div className="phone-input"><input id="api-url" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="https://7103.api.green-api.com" autoComplete="url" /></div><div className="modal-hint">Скопируй URL из карточки своего инстанса, включая https://.</div><label htmlFor="phone">Телефон собеседника</label><div className="phone-input"><Phone size={17} /><input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7 999 123-45-67" inputMode="tel" /></div><div className="modal-hint">Код страны и номер, без добавочных символов.</div><div className="modal-actions"><button className="cancel-button" onClick={() => setSettingsOpen(false)}>Закрыть</button><button className="save-button" onClick={connectInstance}>{configured ? 'Переподключить' : 'Подключить'}</button></div></section></div>}

      {searchOpen && <div className="search-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) { setSearchOpen(false); setSearch('') } }}><div className="search-dialog"><Search size={20} /><input autoFocus placeholder="Поиск в сообщениях…" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && (setSearchOpen(false), setSearch(''))} /><button onClick={() => { setSearchOpen(false); setSearch('') }} aria-label="Закрыть"><X size={18} /></button></div></div>}
    </main>
  )
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
