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

  /** @type {Map<string, {id: string, title: string, body: string, rev: number, color: number, aiEnabled: boolean, createdAt: number, updatedAt: number, updatedBy: string}>} */
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

  function normalizeNote(raw) {
    if (raw === null || typeof raw !== 'object') return null
    const id = clip(raw.id, MAX_ID_LENGTH)
    if (id === '') return null
    const updatedAt = Number.isFinite(raw.updatedAt) ? Math.trunc(raw.updatedAt) : Date.now()
    return {
      id,
      title: clip(raw.title, MAX_TITLE_LENGTH),
      body: clip(raw.body, MAX_BODY_LENGTH),
      rev: Number.isFinite(raw.rev) ? Math.max(1, Math.trunc(raw.rev)) : 1,
      color: normalizeColor(raw.color, 0),
      aiEnabled: raw.aiEnabled === true,
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
      const aiEnabled = typeof incoming.aiEnabled === 'boolean'
        ? incoming.aiEnabled
        : (existing?.aiEnabled ?? false)

      if (existing !== null && existing.rev !== baseRev) {
        // Someone edited it first: hand the current version back instead of overwriting it.
        return { ...stateFor(client), saved: false, conflict: true, current: { ...existing }, note: null }
      }

      if (
        existing !== null
        && existing.title === title
        && existing.body === body
        && existing.color === color
        && existing.aiEnabled === aiEnabled
      ) {
        return { ...stateFor(client), saved: false, conflict: false, current: null, note: { ...existing } }
      }

      const now = Date.now()
      const next = {
        id,
        title,
        body,
        color,
        aiEnabled,
        rev: (existing?.rev ?? 0) + 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        updatedBy: name === '' ? '访客' : name,
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

  /** Notes the user marked as readable by the model, newest first. */
  function sharedNotes() {
    return sortedNotes().filter((note) => note.aiEnabled)
  }

  function buildContextText() {
    const shared = sharedNotes()
    if (shared.length === 0) return ''
    const lines = [
      '## Sticky notes the user shared with you',
      'These notes live on the user\'s sticky-note board and have their "AI may read" switch on.',
      'Treat them as durable memory the user wants you to know. Use the `sticky_notes` tool to read or update them.',
      '',
    ]
    for (const note of shared.slice(0, MAX_CONTEXT_NOTES)) {
      lines.push(`### ${note.title === '' ? '(untitled)' : note.title}  [id: ${note.id}]`)
      const body = note.body.length > MAX_CONTEXT_BODY
        ? `${note.body.slice(0, MAX_CONTEXT_BODY)}\n… (truncated)`
        : note.body
      lines.push(body === '' ? '(empty)' : body)
      lines.push('')
    }
    if (shared.length > MAX_CONTEXT_NOTES) {
      lines.push(`(${shared.length - MAX_CONTEXT_NOTES} more shared note(s) are not shown; call \`sticky_notes\` with action "list" to see them.)`)
    }
    return lines.join('\n')
  }

  function summarize(note) {
    return {
      id: note.id,
      title: note.title,
      aiEnabled: note.aiEnabled,
      updatedAt: note.updatedAt,
      updatedBy: note.updatedBy,
      preview: note.body.replace(/\s+/g, ' ').slice(0, 160),
    }
  }

  async function runTool(args) {
    await ensureLoaded()
    const action = clip(args?.action, 40)

    if (action === 'list') {
      const all = sortedNotes()
      return {
        result: all.length === 0
          ? 'The board is empty.'
          : `${all.length} note(s); ${all.filter((note) => note.aiEnabled).length} readable by you.`,
        notes: all.map(summarize),
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
        aiEnabled: args?.aiEnabled === false ? false : true,
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
        aiEnabled: typeof args?.aiEnabled === 'boolean' ? args.aiEnabled : note.aiEnabled,
        rev: note.rev + 1,
        updatedAt: Date.now(),
        updatedBy: AI_AUTHOR,
      }
      notes.set(id, next)
      revision += 1
      await persist()
      return { result: `Updated note ${id}.`, id, notes: [summarize(next)] }
    }

    if (action === 'set_ai') {
      const id = clip(args?.id, MAX_ID_LENGTH)
      const note = notes.get(id)
      if (note === undefined) return { result: 'No note with that id.', notes: [] }
      const aiEnabled = args?.aiEnabled === true
      if (note.aiEnabled === aiEnabled) {
        return { result: `Note ${id} already has its AI switch ${aiEnabled ? 'on' : 'off'}.`, id, notes: [summarize(note)] }
      }
      const next = { ...note, aiEnabled, rev: note.rev + 1, updatedAt: Date.now(), updatedBy: AI_AUTHOR }
      notes.set(id, next)
      revision += 1
      await persist()
      return {
        result: `Turned the AI switch ${aiEnabled ? 'on' : 'off'} for note ${id}.`,
        id,
        notes: [summarize(next)],
      }
    }

    return { result: `Unknown action ${JSON.stringify(action)}. Use list, read, create, update, or set_ai.`, notes: [] }
  }

  function registerAgentBridge(scope) {
    const disposeContext = scope.systemPrompt.context({
      name: CONTEXT_NAME,
      order: 600,
      text: () => buildContextText(),
    })

    const disposeTool = scope.tools.register({
      name: 'sticky_notes',
      description: [
        'Read and write the shared sticky-note board the user sees in the DSH sidebar.',
        'Notes whose "AI may read" switch is on are already included in your context; use this tool for anything else.',
        'Actions: `list` every note, `read` one note, `create` a note, `update` a note, `set_ai` to flip the readable switch.',
        'When the user asks you to remember something for later, create a note with aiEnabled=true so it comes back in later turns.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'read', 'create', 'update', 'set_ai'],
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
          aiEnabled: {
            type: 'boolean',
            description: 'Whether the note may be read by you in later turns. Defaults to true on create.',
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
                  aiEnabled: { type: 'boolean' },
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
            lines.push(`- ${note.title === '' ? '(untitled)' : note.title} [${note.id}]${note.aiEnabled ? ' · AI can read' : ''}`)
            if (note.preview) lines.push(`  ${note.preview}`)
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
        disposeTool()
      } catch {
        /* already gone */
      }
      try {
        disposeContext()
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
