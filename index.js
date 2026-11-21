/**
 * Host half of Nexera, a DSH workspace plugin.
 *
 * First feature: shared sticky notes. Owns one JSON document under DSH_HOME and
 * answers it over one exact HTTP route, so every browser page served by this Host
 * reads and writes the same notes.
 *
 * It also joins the agent: a `sticky_notes` tool lets the model list, read, create
 * and update notes, and notes whose "AI may read" switch is on are injected into
 * the runtime context of every step.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Exact route the Client half polls. */
const ROUTE_PATH = '/sticky-notes/state'
/** A peer that has not polled for this long is no longer listed as online. */
const PEER_TTL_MS = 45_000
/** Hard cap so one run of the plugin cannot grow the document without bound. */
const MAX_NOTES = 300
const MAX_TOMBSTONES = 500
const MAX_ID_LENGTH = 80
const MAX_TITLE_LENGTH = 120
const MAX_BODY_LENGTH = 20_000
const MAX_BODY_UTF8_BYTES = 512_000
const MAX_BODY_BYTES = 256 * 1024
const MAX_CONTEXT_BODY = 4_000
const MAX_CONTEXT_NOTES = 20
/** Palette size the Client half offers; the Host only validates the range. */
const NOTE_COLOR_COUNT = 6
/** Name of the runtime-context contribution that carries AI-readable notes. */
const CONTEXT_NAME = 'nexera-sticky-notes'
/** Label the agent's own writes carry in the board. */
const AI_AUTHOR = 'AI'

export const inject = ['webServer']

export function apply(ctx, config = {}) {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const file = typeof config.file === 'string' && config.file !== ''
    ? config.file
    : join(home, 'sticky-notes', 'notes.json')

  /** @type {Map<string, {id: string, title: string, body: string, rev: number, color: number, kind: 'note'|'memory', aiMode: 'off'|'all'|'workspace', aiWorkspaceId: string, createdAt: number, updatedAt: number, updatedBy: string}>} */
  const notes = new Map()
  /** Deleted ids, so a late autosave from another page cannot bring a note back. */
  const tombstones = new Map()
  /** @type {Map<string, {name: string, lastSeen: number}>} */
  const peers = new Map()

  let revision = 0
  let loaded = false
  let loading = null
  let writeChain = Promise.resolve()

  function clip(value, limit) {
    if (typeof value !== 'string') return ''
    return value.slice(0, limit)
  }

  function normalizeColor(raw, fallback) {
    if (Number.isInteger(raw) && raw >= 0 && raw < NOTE_COLOR_COUNT) return raw
    return fallback
  }

  function normalizeKind(raw) {
    if (raw === 'memory' || raw === 'task' || raw === 'link') return raw
    return 'note'
  }

  function normalizeMode(raw, fallback) {
    if (raw === 'off' || raw === 'all' || raw === 'workspace') return raw
    return fallback
  }

  function normalizeStatus(raw) {
    if (raw === 'doing' || raw === 'done') return raw
    return 'todo'
  }

  function normalizePriority(raw) {
    if (raw === 'low' || raw === 'high') return raw
    return 'normal'
  }

  function normalizeTimestamp(raw) {
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0
  }

  /** Accepts an ISO date/datetime string or an epoch millisecond number. */
  function parseDueAt(raw, fallback) {
    if (typeof raw === 'string') {
      if (raw.trim() === '') return 0
      const parsed = Date.parse(raw)
      if (Number.isFinite(parsed)) return parsed
      return fallback
    }
    if (Number.isFinite(raw)) return normalizeTimestamp(raw)
    return fallback
  }

  function normalizeNote(raw) {
    if (raw === null || typeof raw !== 'object') return null
    const id = clip(raw.id, MAX_ID_LENGTH)
    if (id === '') return null
    const updatedAt = Number.isFinite(raw.updatedAt) ? Math.trunc(raw.updatedAt) : Date.now()
    const legacyEnabled = raw.aiEnabled === true
    return {
      id,
      title: clip(raw.title, MAX_TITLE_LENGTH),
      body: clip(raw.body, MAX_BODY_LENGTH),
      rev: Number.isFinite(raw.rev) ? Math.max(1, Math.trunc(raw.rev)) : 1,
      color: normalizeColor(raw.color, 0),
      kind: normalizeKind(raw.kind),
      aiMode: normalizeMode(raw.aiMode, legacyEnabled ? 'all' : 'off'),
      aiWorkspaceId: clip(raw.aiWorkspaceId, MAX_ID_LENGTH),
      status: normalizeStatus(raw.status),
      priority: normalizePriority(raw.priority),
      dueAt: normalizeTimestamp(raw.dueAt),
      estimateMin: Number.isFinite(raw.estimateMin) && raw.estimateMin > 0
        ? Math.trunc(raw.estimateMin)
        : 0,
      url: clip(raw.url, 2000),
      read: raw.read === true,
      createdAt: Number.isFinite(raw.createdAt) ? Math.trunc(raw.createdAt) : updatedAt,
      updatedAt,
      updatedBy: clip(raw.updatedBy, 60),
    }
  }

  async function ensureLoaded() {
    if (loaded) return
    if (loading === null) {
      loading = (async () => {
        try {
          const text = await readFile(file, 'utf8')
          const parsed = JSON.parse(text)
          revision = Number.isFinite(parsed?.rev) ? Math.trunc(parsed.rev) : 0
          const stored = Array.isArray(parsed?.notes) ? parsed.notes : []
          for (const raw of stored) {
            const note = normalizeNote(raw)
            if (note !== null) notes.set(note.id, note)
          }
          const deleted = Array.isArray(parsed?.tombstones) ? parsed.tombstones : []
          for (const entry of deleted) {
            const id = clip(entry?.id, MAX_ID_LENGTH)
            if (id !== '') tombstones.set(id, Number.isFinite(entry?.at) ? Math.trunc(entry.at) : Date.now())
          }
        } catch (error) {
          if (error?.code !== 'ENOENT') {
            console.warn(`[nexera] could not read ${file}: ${error?.message ?? error}`)
          }
        }
        loaded = true
      })()
    }
    await loading
  }

  function snapshot() {
    return {
      version: 3,
      rev: revision,
      notes: [...notes.values()],
      tombstones: [...tombstones].map(([id, at]) => ({ id, at })),
    }
  }

  /**
   * Durably write the document. Resolves after the medium acknowledged the write
   * and rejects when it did not, so a caller can report a truthful failure.
   */
  function persist() {
    const body = JSON.stringify(snapshot())
    const run = writeChain.then(async () => {
      await mkdir(dirname(file), { recursive: true })
      const temporary = `${file}.${process.pid}.tmp`
      await writeFile(temporary, body, 'utf8')
      await rename(temporary, file)
    })
    writeChain = run.then(() => {}, () => {})
    return run
  }

  function touchPeer(client, name) {
    if (client === '') return
    peers.set(client, { name: name === '' ? '访客' : name, lastSeen: Date.now() })
  }

  function onlinePeers(client) {
    const now = Date.now()
    const online = []
    for (const [id, peer] of peers) {
      if (now - peer.lastSeen > PEER_TTL_MS) {
        peers.delete(id)
        continue
      }
      if (id === client) continue
      online.push({ id, name: peer.name })
    }
    return online
  }

  function sortedNotes() {
    return [...notes.values()].sort((left, right) => right.createdAt - left.createdAt)
  }

  function stateFor(client) {
    return {
      rev: revision,
      notes: sortedNotes().map((note) => ({ ...note })),
      peers: onlinePeers(client),
      workspaces: workspaceList(),
      now: Date.now(),
    }
  }

  function readBody(request) {
    return new Promise((resolve, reject) => {
      const chunks = []
      let size = 0
      request.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_BODY_BYTES) {
          reject(new Error('body-too-large'))
          request.destroy()
          return
        }
        chunks.push(chunk)
      })
      request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      request.on('error', reject)
    })
  }

  function send(response, status, value) {
    const body = JSON.stringify(value)
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    })
    response.end(body)
  }

  function rememberTombstone(id) {
    tombstones.set(id, Date.now())
    while (tombstones.size > MAX_TOMBSTONES) {
      let oldestId = null
      let oldestAt = Infinity
      for (const [key, at] of tombstones) {
        if (at < oldestAt) {
          oldestAt = at
          oldestId = key
        }
      }
      if (oldestId === null) break
      tombstones.delete(oldestId)
    }
  }

  function trimToCap() {
    if (notes.size <= MAX_NOTES) return
    const oldestFirst = [...notes.values()].sort((left, right) => left.updatedAt - right.updatedAt)
    for (const note of oldestFirst.slice(0, notes.size - MAX_NOTES)) notes.delete(note.id)
  }

  function makeId() {
    return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  async function applyOperation(payload) {
    const client = clip(payload?.client, MAX_ID_LENGTH)
    const name = clip(payload?.name, 60)
    touchPeer(client, name)

    const operation = payload?.op ?? {}

    if (operation.type === 'save') {
      const incoming = operation.note ?? {}
      const id = clip(incoming.id, MAX_ID_LENGTH) || makeId()

      if (tombstones.has(id)) {
        // The note was deleted while this page still held a draft of it.
        return { ...stateFor(client), saved: false, deleted: true, note: null }
      }

      const existing = notes.get(id) ?? null
      const baseRev = Number.isFinite(incoming.baseRev) ? Math.trunc(incoming.baseRev) : 0
      const title = clip(incoming.title, MAX_TITLE_LENGTH)
      const body = clip(incoming.body, MAX_BODY_LENGTH)
      const color = normalizeColor(incoming.color, existing?.color ?? 0)
      const kind = normalizeKind(incoming.kind ?? existing?.kind)
      const legacyEnabled = typeof incoming.aiEnabled === 'boolean' ? incoming.aiEnabled : null
      const aiMode = normalizeMode(
        incoming.aiMode,
        legacyEnabled === null
          ? (existing?.aiMode ?? 'off')
          : (legacyEnabled ? 'all' : 'off'),
      )
      const aiWorkspaceId = typeof incoming.aiWorkspaceId === 'string'
        ? clip(incoming.aiWorkspaceId, MAX_ID_LENGTH)
        : (existing?.aiWorkspaceId ?? '')
      const status = normalizeStatus(incoming.status ?? existing?.status)
      const priority = normalizePriority(incoming.priority ?? existing?.priority)
      const dueAt = incoming.dueAt === undefined
        ? (existing?.dueAt ?? 0)
        : normalizeTimestamp(incoming.dueAt)
      const estimateMin = incoming.estimateMin === undefined
        ? (existing?.estimateMin ?? 0)
        : (Number.isFinite(incoming.estimateMin) && incoming.estimateMin > 0
          ? Math.trunc(incoming.estimateMin)
          : 0)
      const url = typeof incoming.url === 'string' ? clip(incoming.url, 2000) : (existing?.url ?? '')
      const read = typeof incoming.read === 'boolean' ? incoming.read : (existing?.read ?? false)

      if (existing !== null && existing.rev !== baseRev) {
        // Someone edited it first: hand the current version back instead of overwriting it.
        return { ...stateFor(client), saved: false, conflict: true, current: { ...existing }, note: null }
      }

      const now = Date.now()
      const next = {
        id,
        title,
        body,
        color,
        kind,
        aiMode,
        aiWorkspaceId,
        status,
        priority,
        dueAt,
        estimateMin,
        url,
        read,
        rev: (existing?.rev ?? 0) + 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        updatedBy: name === '' ? '访客' : name,
      }

      if (existing !== null) {
        const unchanged = existing.title === next.title
          && existing.body === next.body
          && existing.color === next.color
          && existing.kind === next.kind
          && existing.aiMode === next.aiMode
          && existing.aiWorkspaceId === next.aiWorkspaceId
          && existing.status === next.status
          && existing.priority === next.priority
          && existing.dueAt === next.dueAt
          && existing.estimateMin === next.estimateMin
          && existing.url === next.url
          && existing.read === next.read
        if (unchanged) {
          return { ...stateFor(client), saved: false, conflict: false, current: null, note: { ...existing } }
        }
      }
      notes.set(id, next)
      trimToCap()
      revision += 1
      await persist()
      return { ...stateFor(client), saved: true, conflict: false, current: null, note: { ...next } }
    }

    if (operation.type === 'delete') {
      const id = clip(operation.id, MAX_ID_LENGTH)
      const existed = notes.delete(id)
      rememberTombstone(id)
      revision += 1
      await persist()
      return { ...stateFor(client), deleted: existed }
    }

    return { ...stateFor(client), failed: 'unknown-operation' }
  }

  async function handler(request, response) {
    try {
      await ensureLoaded()
      const url = new URL(request.url ?? ROUTE_PATH, 'http://nexera.invalid')

      if (request.method === 'OPTIONS') {
        response.writeHead(204, { allow: 'GET, POST, OPTIONS', 'cache-control': 'no-store' })
        response.end()
        return
      }

      if (request.method === 'GET') {
        const client = clip(url.searchParams.get('client') ?? '', MAX_ID_LENGTH)
        touchPeer(client, clip(url.searchParams.get('name') ?? '', 60))
        send(response, 200, stateFor(client))
        return
      }

      if (request.method === 'POST') {
        const raw = await readBody(request)
        let payload
        try {
          payload = JSON.parse(raw)
        } catch {
          send(response, 400, { failed: 'invalid-json' })
          return
        }
        send(response, 200, await applyOperation(payload))
        return
      }

      response.writeHead(405, { allow: 'GET, POST, OPTIONS' })
      response.end()
    } catch (error) {
      const message = error?.message ?? String(error)
      try {
        send(response, message === 'body-too-large' ? 413 : 503, { failed: message })
      } catch {
        response.destroy()
      }
    }
  }

  // ----------------------------------------------------------- agent side

  /** Workspace list for the scope picker in the board. */
  function workspaceList() {
    const registry = ctx.get('workspaceRegistry')
    if (!registry) return []
    try {
      return registry.list().map((workspace) => ({ id: workspace.id, title: workspace.title }))
    } catch {
      return []
    }
  }

  /** Which workspace a session belongs to, or '' when unknown. */
  function workspaceOfSession(sessionId) {
    if (sessionId === '') return ''
    const registry = ctx.get('workspaceRegistry')
    if (!registry) return ''
    try {
      for (const workspace of registry.list()) {
        if (workspace.sessionIds.includes(sessionId)) return String(workspace.id)
      }
    } catch {
      /* registry unavailable: fall back to no workspace match */
    }
    return ''
  }

  function truncateBody(body) {
    if (body === '') return '(empty)'
    return body.length > MAX_CONTEXT_BODY ? `${body.slice(0, MAX_CONTEXT_BODY)}\n… (truncated)` : body
  }

  /** Memory notes: permanent facts about the user, read in every conversation. */
  function memoryNotes() {
    return sortedNotes().filter((note) => note.kind === 'memory')
  }

  /** Ordinary notes whose AI scope matches this session. */
  function scopedNotes(workspaceId) {
    return sortedNotes().filter((note) => {
      if (note.kind === 'memory') return false
      if (note.aiMode === 'all') return true
      if (note.aiMode === 'workspace') return note.aiWorkspaceId !== '' && note.aiWorkspaceId === workspaceId
      return false
    })
  }

  function buildContextText(sessionId) {
    const workspaceId = workspaceOfSession(sessionId)
    const memory = memoryNotes()
    const shared = scopedNotes(workspaceId)
    if (memory.length === 0 && shared.length === 0) return ''

    const lines = []

    if (memory.length > 0) {
      lines.push('## Long-term memory about the user')
      lines.push('The user keeps these as permanent facts about themselves: their personality and what they most love doing.')
      lines.push('They apply to every conversation, so let them shape tone, suggestions, and defaults.')
      lines.push('')
      for (const note of memory.slice(0, MAX_CONTEXT_NOTES)) {
        lines.push(`### ${note.title === '' ? '(untitled)' : note.title}  [id: ${note.id}]`)
        lines.push(truncateBody(note.body))
        lines.push('')
      }
    }

    if (shared.length > 0) {
      lines.push('## Sticky notes shared with you')
      lines.push('The user opened these notes to the assistant for this scope. Use the `sticky_notes` tool to read or update them.')
      lines.push('')
      for (const note of shared.slice(0, MAX_CONTEXT_NOTES)) {
        lines.push(`### ${note.title === '' ? '(untitled)' : note.title}  [id: ${note.id}]`)
        lines.push(truncateBody(note.body))
        lines.push('')
      }
      if (shared.length > MAX_CONTEXT_NOTES) {
        lines.push(`(${shared.length - MAX_CONTEXT_NOTES} more shared note(s) are not shown; call \`sticky_notes\` with action "list".)`)
      }
    }

    return lines.join('\n')
  }

  function summarize(note) {
    return {
      id: note.id,
      title: note.title,
      kind: note.kind,
      aiMode: note.aiMode,
      aiWorkspaceId: note.aiWorkspaceId,
      status: note.status,
      priority: note.priority,
      dueAt: note.dueAt,
      estimateMin: note.estimateMin,
      url: note.url,
      read: note.read,
      updatedAt: note.updatedAt,
      updatedBy: note.updatedBy,
      preview: note.body.replace(/\s+/g, ' ').slice(0, 160),
    }
  }

  async function runTool(args) {
    await ensureLoaded()
    const action = clip(args?.action, 40)

    if (action === 'list') {
      const filterKind = typeof args?.kind === 'string' ? normalizeKind(args.kind) : null
      const pool = sortedNotes().filter((note) => filterKind === null || note.kind === filterKind)
      const readable = pool.filter((note) => note.kind === 'memory' || note.aiMode !== 'off').length
      return {
        result: pool.length === 0
          ? 'Nothing on the board.'
          : `${pool.length} item(s); ${readable} readable by you.`,
        notes: pool.map(summarize),
      }
    }

    if (action === 'read') {
      const note = notes.get(clip(args?.id, MAX_ID_LENGTH))
      if (note === undefined) return { result: 'No note with that id.', notes: [] }
      return { result: `Note ${note.id}.`, id: note.id, notes: [summarize(note)], body: note.body }
    }

    if (action === 'create') {
      const now = Date.now()
      const id = makeId()
      const note = {
        id,
        title: clip(args?.title, MAX_TITLE_LENGTH),
        body: clip(args?.body, MAX_BODY_LENGTH),
        color: normalizeColor(args?.color, notes.size % NOTE_COLOR_COUNT),
        kind: normalizeKind(args?.kind),
        aiMode: normalizeMode(args?.aiMode, 'all'),
        aiWorkspaceId: clip(args?.aiWorkspaceId, MAX_ID_LENGTH),
        status: normalizeStatus(args?.status),
        priority: normalizePriority(args?.priority),
        dueAt: parseDueAt(args?.dueAt, 0),
        estimateMin: Number.isFinite(args?.estimateMin) && args.estimateMin > 0
          ? Math.trunc(args.estimateMin)
          : 0,
        url: clip(args?.url, 2000),
        read: args?.read === true,
        rev: 1,
        createdAt: now,
        updatedAt: now,
        updatedBy: AI_AUTHOR,
      }
      notes.set(id, note)
      trimToCap()
      revision += 1
      await persist()
      return { result: `Created note ${id}.`, id, notes: [summarize(note)] }
    }

    if (action === 'update') {
      const id = clip(args?.id, MAX_ID_LENGTH)
      const note = notes.get(id)
      if (note === undefined) return { result: 'No note with that id.', notes: [] }
      const next = {
        ...note,
        title: typeof args?.title === 'string' ? clip(args.title, MAX_TITLE_LENGTH) : note.title,
        body: typeof args?.body === 'string' ? clip(args.body, MAX_BODY_LENGTH) : note.body,
        color: normalizeColor(args?.color, note.color),
        kind: normalizeKind(args?.kind ?? note.kind),
        aiMode: normalizeMode(args?.aiMode, note.aiMode),
        aiWorkspaceId: typeof args?.aiWorkspaceId === 'string'
          ? clip(args.aiWorkspaceId, MAX_ID_LENGTH)
          : note.aiWorkspaceId,
        status: typeof args?.status === 'string' ? normalizeStatus(args.status) : note.status,
        priority: typeof args?.priority === 'string' ? normalizePriority(args.priority) : note.priority,
        dueAt: args?.dueAt === undefined ? note.dueAt : parseDueAt(args.dueAt, note.dueAt),
        estimateMin: typeof args?.estimateMin === 'number'
          ? (args.estimateMin > 0 ? Math.trunc(args.estimateMin) : 0)
          : note.estimateMin,
        url: typeof args?.url === 'string' ? clip(args.url, 2000) : note.url,
        read: typeof args?.read === 'boolean' ? args.read : note.read,
        rev: note.rev + 1,
        updatedAt: Date.now(),
        updatedBy: AI_AUTHOR,
      }
      notes.set(id, next)
      revision += 1
      await persist()
      return { result: `Updated note ${id}.`, id, notes: [summarize(next)] }
    }

    if (action === 'set_status') {
      const id = clip(args?.id, MAX_ID_LENGTH)
      const note = notes.get(id)
      if (note === undefined) return { result: 'No item with that id.', notes: [] }
      const status = normalizeStatus(args?.status)
      if (note.status === status) {
        return { result: `Item ${id} is already ${status}.`, id, notes: [summarize(note)] }
      }
      const next = { ...note, status, rev: note.rev + 1, updatedAt: Date.now(), updatedBy: AI_AUTHOR }
      notes.set(id, next)
      revision += 1
      await persist()
      return { result: `Item ${id} is now ${status}.`, id, notes: [summarize(next)] }
    }

    if (action === 'set_ai') {
      const id = clip(args?.id, MAX_ID_LENGTH)
      const note = notes.get(id)
      if (note === undefined) return { result: 'No note with that id.', notes: [] }
      const aiMode = normalizeMode(args?.aiMode, note.aiMode)
      const aiWorkspaceId = typeof args?.aiWorkspaceId === 'string'
        ? clip(args.aiWorkspaceId, MAX_ID_LENGTH)
        : note.aiWorkspaceId
      if (note.aiMode === aiMode && note.aiWorkspaceId === aiWorkspaceId) {
        return { result: `Note ${id} already reads in mode ${aiMode}.`, id, notes: [summarize(note)] }
      }
      const next = { ...note, aiMode, aiWorkspaceId, rev: note.rev + 1, updatedAt: Date.now(), updatedBy: AI_AUTHOR }
      notes.set(id, next)
      revision += 1
      await persist()
      return {
        result: `Note ${id} now reads in mode ${aiMode}${aiWorkspaceId === '' ? '' : ` for workspace ${aiWorkspaceId}`}.`,
        id,
        notes: [summarize(next)],
      }
    }

    return { result: `Unknown action ${JSON.stringify(action)}. Use list, read, create, update, or set_ai.`, notes: [] }
  }

  function registerAgentBridge(scope) {
    /** @type {Map<string, () => void>} */
    const boundAgents = new Map()

    /**
     * Give one agent its own context contribution so the text can be scoped to
     * that session's workspace instead of leaking every readable note everywhere.
     */
    function bind(agent) {
      if (!agent?.ctx?.systemPrompt || typeof agent.id !== 'string') return
      const key = agent.id
      if (boundAgents.has(key)) return
      try {
        const dispose = agent.ctx.effect(() => agent.ctx.systemPrompt.context({
          name: CONTEXT_NAME,
          order: 600,
          text: () => buildContextText(key),
        }))
        boundAgents.set(key, dispose)
      } catch (error) {
        console.warn(`[nexera] could not bind agent ${key}: ${error?.message ?? error}`)
      }
    }

    // Agents that already exist (this session included) never fire agent/created.
    try {
      const agentsService = scope.get('agents')
      if (agentsService && typeof agentsService.list === 'function') {
        for (const agent of agentsService.list()) bind(agent)
      }
    } catch (error) {
      console.warn(`[nexera] could not enumerate agents: ${error?.message ?? error}`)
    }

    const disposeListener = scope.on('agent/created', (payload) => {
      bind(payload?.agent ?? payload)
    })

    const disposeTool = scope.tools.register({
      name: 'sticky_notes',
      description: [
        'Read and write the Nexera workbench the user sees in the DSH sidebar: sticky notes, memory facts, tasks, and a reading list.',
        'Every item has a kind: "note", "memory", "task", or "link".',
        'Note items have an AI scope: `off` (yours alone), `all` (every conversation), or `workspace` (only one workspace).',
        'Items marked kind "memory" are permanent facts about the user — their personality and what they love doing — and are read in every conversation.',
        'Task items carry a status (todo/doing/done), a priority, an optional due date, and an optional estimate in minutes.',
        'Actions: `list` (optionally filtered by kind), `read`, `create`, `update`, `set_status`, `set_ai`.',
        'When the user asks you to remember something about themselves, create a kind "memory" item.',
        'When they mention something to do later, create a "task"; when they share something to read later, create a "link".',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'read', 'create', 'update', 'set_status', 'set_ai'],
            description: 'What to do with the board.',
          },
          id: {
            type: 'string',
            description: 'Target note id, for read / update / set_ai.',
          },
          title: {
            type: 'string',
            description: 'Note title, for create / update.',
          },
          body: {
            type: 'string',
            description: 'Note body, for create / update.',
          },
          aiMode: {
            type: 'string',
            enum: ['off', 'all', 'workspace'],
            description: 'Who may read this note. Defaults to "all" on create.',
          },
          aiWorkspaceId: {
            type: 'string',
            description: 'Workspace id, required when aiMode is "workspace".',
          },
          kind: {
            type: 'string',
            enum: ['note', 'memory', 'task', 'link'],
            description: 'note = a sticky note; memory = a permanent fact about the user; task = a tracked to-do; link = a reading-list entry.',
          },
          status: {
            type: 'string',
            enum: ['todo', 'doing', 'done'],
            description: 'Task status.',
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high'],
            description: 'Task priority.',
          },
          dueAt: {
            type: 'string',
            description: 'Task due date as an ISO date ("2026-11-25") or datetime ("2026-11-25T18:00:00+08:00"). Empty string clears it.',
          },
          estimateMin: {
            type: 'integer',
            description: 'Estimated effort in minutes. 0 clears it.',
          },
          url: {
            type: 'string',
            description: 'Link URL, for kind "link".',
          },
          read: {
            type: 'boolean',
            description: 'Whether a reading-list entry is already read.',
          },
          color: {
            type: 'integer',
            description: 'Optional paper colour index 0-5.',
          },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            result: { type: 'string', description: 'Human-readable outcome.' },
            id: { type: 'string', description: 'Affected note id, when there is one.' },
            body: { type: 'string', description: 'Full body for a read.' },
            notes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  kind: { type: 'string' },
                  aiMode: { type: 'string' },
                  aiWorkspaceId: { type: 'string' },
                  status: { type: 'string' },
                  priority: { type: 'string' },
                  dueAt: { type: 'integer' },
                  estimateMin: { type: 'integer' },
                  url: { type: 'string' },
                  read: { type: 'boolean' },
                  updatedAt: { type: 'integer' },
                  updatedBy: { type: 'string' },
                  preview: { type: 'string' },
                },
              },
            },
          },
        },
        render: (_args, value) => {
          const lines = [String(value?.result ?? 'Done.')]
          const list = Array.isArray(value?.notes) ? value.notes : []
          for (const note of list) {
            const title = note.title === '' ? '(untitled)' : note.title
            let meta = ''
            if (note.kind === 'task') {
              const parts = [`task:${note.status}`]
              if (note.priority === 'high') parts.push('high')
              if (note.dueAt > 0) parts.push(`due ${new Date(note.dueAt).toISOString().slice(0, 10)}`)
              if (note.estimateMin > 0) parts.push(`${note.estimateMin}m`)
              meta = ` · ${parts.join(' · ')}`
            } else if (note.kind === 'link') {
              meta = note.read ? ' · link · read' : ' · link · unread'
            } else if (note.kind === 'memory') {
              meta = ' · memory'
            } else if (note.aiMode === 'all') {
              meta = ' · all chats'
            } else if (note.aiMode === 'workspace') {
              meta = ' · one workspace'
            } else {
              meta = ' · private'
            }
            lines.push(`- ${title} [${note.id}]${meta}`)
            if (note.kind === 'link' && note.url !== '') lines.push(`  ${note.url}`)
            else if (note.preview) lines.push(`  ${note.preview}`)
          }
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      execute(args) {
        return runTool(args)
      },
      presentCall(args) {
        const action = String(args?.action ?? 'board')
        return { card: 'generic', title: `Sticky notes · ${action}`, kind: 'other', rawInput: args }
      },
    })

    return () => {
      try {
        disposeListener()
      } catch {
        /* already gone */
      }
      for (const dispose of boundAgents.values()) {
        try {
          dispose()
        } catch {
          /* already gone */
        }
      }
      boundAgents.clear()
      try {
        disposeTool()
      } catch {
        /* already gone */
      }
    }
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: ROUTE_PATH, handler }),
    'nexera: http route',
  )

  // Optional: only joins the agent when this profile mounts the tool and prompt
  // registries, so a plain web composition still gets the board.
  ctx.effect(
    () => ctx.inject(['tools', 'systemPrompt'], (scope) => registerAgentBridge(scope)),
    'nexera: agent bridge',
  )
}
