/**
 * Host half of the shared sticky-notes plugin.
 *
 * Owns one JSON document under DSH_HOME and answers it over one exact HTTP route,
 * so every browser page served by this Host reads and writes the same notes.
 * The Client half renders the sidebar entry and the board.
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
const MAX_BODY_BYTES = 256 * 1024
/** Palette size the Client half offers; the Host only validates the range. */
const NOTE_COLOR_COUNT = 6

export const inject = ['webServer']

export function apply(ctx, config = {}) {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const file = typeof config.file === 'string' && config.file !== ''
    ? config.file
    : join(home, 'sticky-notes', 'notes.json')

  /** @type {Map<string, {id: string, title: string, body: string, rev: number, createdAt: number, updatedAt: number, updatedBy: string}>} */
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
            console.warn(`[sticky-notes] could not read ${file}: ${error?.message ?? error}`)
          }
        }
        loaded = true
      })()
    }
    await loading
  }

  function snapshot() {
    return {
      version: 2,
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

  function stateFor(client) {
    const list = [...notes.values()]
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((note) => ({ ...note }))
    return { rev: revision, notes: list, peers: onlinePeers(client), now: Date.now() }
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

  async function applyOperation(payload) {
    const client = clip(payload?.client, MAX_ID_LENGTH)
    const name = clip(payload?.name, 60)
    touchPeer(client, name)

    const operation = payload?.op ?? {}

    if (operation.type === 'save') {
      const incoming = operation.note ?? {}
      const id = clip(incoming.id, MAX_ID_LENGTH) || `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

      if (tombstones.has(id)) {
        // The note was deleted while this page still held a draft of it.
        return { ...stateFor(client), saved: false, deleted: true, note: null }
      }

      const existing = notes.get(id) ?? null
      const baseRev = Number.isFinite(incoming.baseRev) ? Math.trunc(incoming.baseRev) : 0
      const title = clip(incoming.title, MAX_TITLE_LENGTH)
      const body = clip(incoming.body, MAX_BODY_LENGTH)
      const color = normalizeColor(incoming.color, existing?.color ?? 0)

      if (existing !== null && existing.rev !== baseRev) {
        // Someone edited it first: hand the current version back instead of overwriting it.
        return { ...stateFor(client), saved: false, conflict: true, current: { ...existing }, note: null }
      }

      if (existing !== null && existing.title === title && existing.body === body && existing.color === color) {
        return { ...stateFor(client), saved: false, conflict: false, current: null, note: { ...existing } }
      }

      const now = Date.now()
      const next = {
        id,
        title,
        body,
        color,
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
      const url = new URL(request.url ?? ROUTE_PATH, 'http://sticky-notes.invalid')

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

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: ROUTE_PATH, handler }),
    'sticky-notes: http route',
  )
}
