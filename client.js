/**
 * Client half of Nexera, a DSH workspace plugin. First feature: shared sticky notes.
 *
 * Registers one sidebar panel row and the board it opens in the main column:
 * a wall of taped-up note cards, plus an editor that saves and returns.
 * All note data lives on the Host, so every open page shares the same wall.
 */
window.__ModuleLoader__.load({
  id: '@local/nexera',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const API_PATH = '/sticky-notes/state'
    // Kept from the 1.0.0-beta rename so an existing display name is not lost.
    const CLIENT_KEY = 'dsh.sticky-notes.client'
    const NAME_KEY = 'dsh.sticky-notes.name'
    const PANEL_ID = 'nexera'
    const OPEN_POLL_MS = 2000
    const IDLE_POLL_MS = 15000
    const SAVE_DELAY_MS = 700
    const MAX_SAVE_RETRIES = 4

    /** Candy paper palette: every note keeps its own pastel sheet in both themes. */
    const PAPERS = [
      { zh: '奶油黄', en: 'Butter', bg: '#FFF3C4', ink: '#5A4413', edge: '#FFD666', tint: 'rgba(255,214,102,.18)' },
      { zh: '樱花粉', en: 'Sakura', bg: '#FFE3EE', ink: '#5C2542', edge: '#FFB3D1', tint: 'rgba(255,179,209,.18)' },
      { zh: '天空蓝', en: 'Sky', bg: '#DFF3FF', ink: '#12415C', edge: '#9BDBFF', tint: 'rgba(155,219,255,.18)' },
      { zh: '抹茶绿', en: 'Matcha', bg: '#E2F8E0', ink: '#1F4A25', edge: '#A8E6A3', tint: 'rgba(168,230,163,.18)' },
      { zh: '香芋紫', en: 'Taro', bg: '#EFE3FF', ink: '#3D2559', edge: '#C7A8FF', tint: 'rgba(199,168,255,.18)' },
      { zh: '蜜桃橙', en: 'Peach', bg: '#FFE8D6', ink: '#5C2E13', edge: '#FFBB8A', tint: 'rgba(255,187,138,.18)' },
    ]

    const DICT = {
      zh: {
        button: '便利贴',
        title: '便利贴',
        add: '新建',
        addLong: '新建便利贴',
        editTitle: '写便利贴',
        empty: '还没有便利贴',
        emptyHint: '点右上角「新建便利贴」，写下要记住的事。',
        emptyBody: '还没有内容',
        titlePlaceholder: '标题',
        bodyPlaceholder: '写点什么，让以后还记得…',
        done: '完成',
        back: '返回',
        delete: '删除',
        confirmDelete: '再点一次删除',
        invite: '邀请',
        inviteTitle: '一起写',
        inviteBody: '对方在能访问这个 DSH 页面的另一台设备或另一个浏览器里打开这个链接，就能和你编辑同一批便利贴。',
        inviteLocal: '当前地址只在本机有效，别人的浏览器打不开。要邀请别人，请先把 DSH 绑定到局域网地址再分享。',
        copy: '复制链接',
        copied: '已复制',
        copyFailed: '复制失败，请手动选中地址',
        save: '已保存',
        saving: '保存中…',
        unsaved: '未保存',
        offline: '未连接，保存已暂停',
        onlineOne: '另有 1 人在线',
        onlineMany: '另有 {n} 人在线',
        alone: '只有你在编辑',
        conflictTitle: '有人先改了这张便利贴',
        conflictBody: '为了不覆盖对方，你的这次修改还没有保存。',
        conflictLoad: '载入对方的版本',
        conflictOverwrite: '仍用我的覆盖',
        deletedTitle: '这张便利贴被其他人删除了',
        deletedBody: '你的内容还在，可以把它另存为一张新的便利贴。',
        deletedKeep: '另存为新便利贴',
        deletedDiscard: '放弃内容',
        nameLabel: '我的名字',
        colorLabel: '颜色',
        kindNote: '普通',
        kindMemory: '记忆',
        kindHint: '记忆便签用来记你的性格和最喜欢做的事，每个对话里 AI 都会读到。',
        scopeLabel: 'AI 读取范围',
        scopeHint: '这张便利贴对哪些对话里的 AI 可见。',
        scopeOff: '不读取',
        scopeAll: '所有对话',
        scopeWorkspace: '仅某个工作区',
        scopePick: '选择工作区…',
        justNow: '刚刚',
        minutesAgo: '{n} 分钟前',
        hoursAgo: '{n} 小时前',
        noteCount: '{n} 张',
        untitled: '未命名',
        retry: '重试',
      },
      en: {
        button: 'Sticky notes',
        title: 'Sticky notes',
        add: 'New',
        addLong: 'New note',
        editTitle: 'Write a note',
        empty: 'No notes yet',
        emptyHint: 'Use "New note" in the top right and write down what you want to remember.',
        emptyBody: 'No content yet',
        titlePlaceholder: 'Title',
        bodyPlaceholder: 'Write something to remember…',
        done: 'Done',
        back: 'Back',
        delete: 'Delete',
        confirmDelete: 'Click again to delete',
        invite: 'Invite',
        inviteTitle: 'Write together',
        inviteBody: 'Someone on another device or in another browser that can reach this DSH page will edit the same notes when they open this link.',
        inviteLocal: 'This address only works on this machine. To invite someone, expose DSH on a network address first.',
        copy: 'Copy link',
        copied: 'Copied',
        copyFailed: 'Copy failed — select the address manually',
        save: 'Saved',
        saving: 'Saving…',
        unsaved: 'Unsaved',
        offline: 'Offline, saving paused',
        onlineOne: '1 other person online',
        onlineMany: '{n} other people online',
        alone: "You're the only one here",
        conflictTitle: 'Someone changed this note first',
        conflictBody: 'Your change was not saved, so theirs is not overwritten.',
        conflictLoad: 'Load their version',
        conflictOverwrite: 'Overwrite with mine',
        deletedTitle: 'Someone deleted this note',
        deletedBody: 'Your text is still here — you can keep it as a new note.',
        deletedKeep: 'Save as a new note',
        deletedDiscard: 'Discard',
        nameLabel: 'My name',
        colorLabel: 'Colour',
        kindNote: 'Note',
        kindMemory: 'Memory',
        kindHint: 'Memory notes hold your personality and what you love doing; the assistant reads them in every conversation.',
        scopeLabel: 'AI scope',
        scopeHint: 'Which conversations may read this note.',
        scopeOff: 'Private',
        scopeAll: 'All chats',
        scopeWorkspace: 'One workspace',
        scopePick: 'Pick a workspace…',
        justNow: 'just now',
        minutesAgo: '{n} min ago',
        hoursAgo: '{n} h ago',
        noteCount: '{n} notes',
        untitled: 'Untitled',
        retry: 'Retry',
      },
    }

    let localeService = null
    let clientId = ''

    function currentLang() {
      let active = null
      try {
        active = localeService?.getLocale?.()?.active ?? null
      } catch {
        active = null
      }
      const id = typeof active === 'string' ? active : String(active?.id ?? active?.locale ?? '')
      return id.toLowerCase().startsWith('zh') ? 'zh' : 'en'
    }

    function t(key, params) {
      const lang = currentLang()
      let text = DICT[lang]?.[key] ?? DICT.en[key] ?? key
      if (params !== undefined) {
        for (const [name, value] of Object.entries(params)) {
          text = text.split(`{${name}}`).join(String(value))
        }
      }
      return text
    }

    function readStored(key) {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    }

    function writeStored(key, value) {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        /* private mode: keep the in-memory value only */
      }
    }

    function ensureClientId() {
      const stored = readStored(CLIENT_KEY)
      if (stored !== null && stored !== '') return stored
      const generated = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      writeStored(CLIENT_KEY, generated)
      return generated
    }

    function defaultName() {
      const stored = readStored(NAME_KEY)
      if (stored !== null && stored.trim() !== '') return stored.trim().slice(0, 60)
      const tag = Math.random().toString(36).slice(2, 5).toUpperCase()
      const generated = currentLang() === 'zh' ? `访客 ${tag}` : `Guest ${tag}`
      writeStored(NAME_KEY, generated)
      return generated
    }

    function newNoteId() {
      return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }

    /** Stable tilt, so a note hangs at the same angle on every page and reload. */
    function tiltOf(note) {
      const id = String(note?.id ?? '')
      let acc = 3
      for (let i = 0; i < id.length; i += 1) acc = (acc * 31 + id.charCodeAt(i)) % 9973
      return ((acc % 9) - 4) * 0.55
    }

    /** Stable paper tint even before the Host learns about a colour. */
    function colorOf(note) {
      if (Number.isInteger(note?.color) && note.color >= 0 && note.color < PAPERS.length) return note.color
      const id = String(note?.id ?? '')
      let acc = 7
      for (let i = 0; i < id.length; i += 1) acc = (acc * 31 + id.charCodeAt(i)) % 9973
      return acc % PAPERS.length
    }

    // ---------------------------------------------------------------- store

    function createStore() {
      let state = {
        mounted: false,
        view: 'wall',
        ready: false,
        notes: [],
        peers: [],
        activeId: null,
        title: '',
        body: '',
        color: 0,
        kind: 'note',
        aiMode: 'off',
        aiWorkspaceId: '',
        workspaces: [],
        baseRev: 0,
        dirty: false,
        status: 'idle',
        /** @type {null | {current: object}} */
        conflict: null,
        deletedNotice: false,
        error: '',
        unread: 0,
        me: '',
        seenAt: 0,
      }
      const listeners = new Set()
      let saveTimer = 0
      let pollTimer = 0
      let retries = 0

      function get() {
        return state
      }

      function emit() {
        for (const listener of [...listeners]) listener()
      }

      function patch(next) {
        state = { ...state, ...next }
        emit()
      }

      function subscribe(listener) {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      }

      function latestUpdate(notes) {
        let max = 0
        for (const note of notes) max = Math.max(max, Number(note.updatedAt) || 0)
        return max
      }

      function resetDraft() {
        return {
          activeId: null,
          title: '',
          body: '',
          color: 0,
          kind: 'note',
          aiMode: 'off',
          aiWorkspaceId: '',
          baseRev: 0,
          dirty: false,
          conflict: null,
          deletedNotice: false,
        }
      }

      function isBlankDraft() {
        return state.baseRev === 0 && state.title.trim() === '' && state.body.trim() === ''
      }

      function accept(data) {
        const notes = Array.isArray(data.notes) ? data.notes : []
        const peers = Array.isArray(data.peers) ? data.peers : []
        const next = {
          ready: true,
          notes,
          peers,
          workspaces: Array.isArray(data.workspaces) ? data.workspaces : state.workspaces,
          error: '',
          status: state.status === 'offline' ? 'idle' : state.status,
        }

        if (state.activeId !== null) {
          const active = notes.find((note) => note.id === state.activeId) ?? null
          if (active === null) {
            // A never-saved draft is not missing: it simply is not on the Host yet.
            if (state.baseRev > 0) {
              if (state.dirty) next.deletedNotice = true
              else Object.assign(next, resetDraft())
            }
          } else if (state.deletedNotice) {
            next.deletedNotice = false
          } else if (state.dirty) {
            if (active.rev !== state.baseRev) next.conflict = { current: { ...active } }
          } else if (state.conflict === null) {
            next.title = active.title
            next.body = active.body
            next.color = colorOf(active)
            next.kind = active.kind === 'memory' ? 'memory' : 'note'
            next.aiMode = active.aiMode ?? 'off'
            next.aiWorkspaceId = active.aiWorkspaceId ?? ''
            next.baseRev = active.rev
          }
        }

        const newest = latestUpdate(notes)
        if (newest > state.seenAt) {
          if (!state.mounted) next.unread = 1
          next.seenAt = newest
        }
        patch(next)
      }

      async function refresh() {
        if (clientId === '') return
        const url = `${API_PATH}?client=${encodeURIComponent(clientId)}&name=${encodeURIComponent(state.me)}`
        try {
          const response = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          accept(await response.json())
        } catch (error) {
          patch({ status: 'offline', error: String(error?.message ?? error) })
        }
      }

      function scheduleRetry() {
        if (retries >= MAX_SAVE_RETRIES) return
        retries += 1
        if (saveTimer !== 0) window.clearTimeout(saveTimer)
        saveTimer = window.setTimeout(() => {
          saveTimer = 0
          void saveNow({ retry: true })
        }, 1500 * retries)
      }

      /** Returns whether the draft is now safe on the Host. */
      async function saveNow(options = {}) {
        if (state.activeId === null) return true
        if (state.conflict !== null) return false
        if (isBlankDraft()) return true

        const target = state.activeId
        const sent = {
          title: state.title,
          body: state.body,
          color: state.color,
          kind: state.kind,
          aiMode: state.aiMode,
          aiWorkspaceId: state.aiWorkspaceId,
          baseRev: state.baseRev,
        }
        patch({ status: 'saving' })

        try {
          const response = await fetch(API_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              client: clientId,
              name: state.me,
              op: {
                type: 'save',
                note: {
                  id: target,
                  title: sent.title,
                  body: sent.body,
                  color: sent.color,
                  kind: sent.kind,
                  aiMode: sent.aiMode,
                  aiWorkspaceId: sent.aiWorkspaceId,
                  baseRev: sent.baseRev,
                },
              },
            }),
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          if (data.failed !== undefined) throw new Error(String(data.failed))

          retries = 0
          const shared = {
            notes: Array.isArray(data.notes) ? data.notes : state.notes,
            peers: Array.isArray(data.peers) ? data.peers : state.peers,
            error: '',
          }

          if (data.deleted === true) {
            if (state.activeId === target) patch({ ...shared, status: 'saved', deletedNotice: true, dirty: true })
            else patch(shared)
            return false
          }

          if (data.conflict === true && data.current !== undefined) {
            if (state.activeId === target) {
              patch({ ...shared, status: 'unsaved', conflict: { current: { ...data.current } } })
            } else {
              patch(shared)
            }
            return false
          }

          if (state.activeId !== target) {
            patch({ ...shared, status: 'saved' })
            return true
          }

          const stillSame = state.title === sent.title
            && state.body === sent.body
            && state.color === sent.color
            && state.kind === sent.kind
            && state.aiMode === sent.aiMode
            && state.aiWorkspaceId === sent.aiWorkspaceId
          patch({
            ...shared,
            status: stillSame ? 'saved' : 'unsaved',
            dirty: !stillSame,
            baseRev: Number(data.note?.rev ?? state.baseRev),
            conflict: null,
          })
          if (!stillSame) scheduleSave()
          return true
        } catch (error) {
          patch({ status: 'offline', error: String(error?.message ?? error) })
          if (!options.retry || retries < MAX_SAVE_RETRIES) scheduleRetry()
          return false
        }
      }

      function scheduleSave() {
        if (saveTimer !== 0) window.clearTimeout(saveTimer)
        saveTimer = window.setTimeout(() => {
          saveTimer = 0
          void saveNow()
        }, SAVE_DELAY_MS)
      }

      function schedulePoll() {
        if (pollTimer !== 0) window.clearTimeout(pollTimer)
        const delay = state.mounted ? OPEN_POLL_MS : IDLE_POLL_MS
        pollTimer = window.setTimeout(() => {
          pollTimer = 0
          if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void refresh()
          schedulePoll()
        }, delay)
      }

      return {
        get,
        subscribe,
        bump() {
          emit()
        },
        init(name) {
          clientId = ensureClientId()
          patch({ me: name })
        },
        start() {
          schedulePoll()
          if (typeof window !== 'undefined') {
            window.addEventListener('pagehide', () => {
              if (state.dirty && state.activeId !== null) void saveNow()
            })
          }
        },
        stop() {
          if (pollTimer !== 0) window.clearTimeout(pollTimer)
          if (saveTimer !== 0) window.clearTimeout(saveTimer)
          pollTimer = 0
          saveTimer = 0
        },
        /** The board page mounts while its sidebar row is the selected panel. */
        setMounted(mounted) {
          if (state.mounted === mounted) return
          patch({ mounted, unread: mounted ? 0 : state.unread, seenAt: mounted ? latestUpdate(state.notes) : state.seenAt })
          if (mounted) void refresh()
          schedulePoll()
        },
        openNote(id) {
          const note = state.notes.find((item) => item.id === id)
          if (note === undefined) return
          patch({
            view: 'edit',
            activeId: id,
            title: note.title,
            body: note.body,
            color: colorOf(note),
            kind: note.kind === 'memory' ? 'memory' : 'note',
            aiMode: note.aiMode ?? 'off',
            aiWorkspaceId: note.aiWorkspaceId ?? '',
            baseRev: note.rev,
            dirty: false,
            conflict: null,
            deletedNotice: false,
          })
        },
        create() {
          const id = newNoteId()
          patch({
            view: 'edit',
            activeId: id,
            title: '',
            body: '',
            color: colorOf({ id }),
            kind: 'note',
            aiMode: 'all',
            aiWorkspaceId: '',
            baseRev: 0,
            dirty: false,
            conflict: null,
            deletedNotice: false,
          })
        },
        editTitle(value) {
          patch({ title: value, dirty: true, status: 'unsaved' })
          scheduleSave()
        },
        editBody(value) {
          patch({ body: value, dirty: true, status: 'unsaved' })
          scheduleSave()
        },
        setColor(color) {
          if (color === state.color) return
          patch({ color, dirty: true, status: 'unsaved' })
          scheduleSave()
        },
        setAiMode(aiMode, aiWorkspaceId) {
          const nextMode = aiMode === 'all' || aiMode === 'workspace' ? aiMode : 'off'
          const nextWorkspace = nextMode === 'workspace' ? (aiWorkspaceId ?? state.aiWorkspaceId) : ''
          if (nextMode === state.aiMode && nextWorkspace === state.aiWorkspaceId) return
          patch({ aiMode: nextMode, aiWorkspaceId: nextWorkspace, dirty: true, status: 'unsaved' })
          scheduleSave()
        },
        setKind(kind) {
          const nextKind = kind === 'memory' ? 'memory' : 'note'
          if (nextKind === state.kind) return
          patch({
            kind: nextKind,
            aiMode: nextKind === 'memory' ? 'all' : state.aiMode,
            dirty: true,
            status: 'unsaved',
          })
          scheduleSave()
        },
        /** Finish the editor: persist, then come back to the wall. */
        async done() {
          if (state.view !== 'edit') return
          if (isBlankDraft()) {
            patch({ ...resetDraft(), view: 'wall' })
            return
          }
          if (state.conflict !== null || state.deletedNotice) return
          const saved = await saveNow()
          if (!saved) return
          patch({ view: 'wall', dirty: false })
        },
        resolveConflict(choice) {
          const pending = state.conflict
          if (pending === null) return
          if (choice === 'theirs') {
            patch({
              title: pending.current.title,
              body: pending.current.body,
              color: colorOf(pending.current),
              kind: pending.current.kind === 'memory' ? 'memory' : 'note',
              aiMode: pending.current.aiMode ?? 'off',
              aiWorkspaceId: pending.current.aiWorkspaceId ?? '',
              baseRev: pending.current.rev,
              dirty: false,
              conflict: null,
              status: 'saved',
            })
          } else {
            patch({ baseRev: pending.current.rev, conflict: null, status: 'unsaved' })
            void saveNow()
          }
        },
        reviveDraft() {
          patch({
            activeId: newNoteId(),
            kind: 'note',
            aiMode: 'all',
            aiWorkspaceId: '',
            baseRev: 0,
            dirty: true,
            deletedNotice: false,
            status: 'unsaved',
          })
          scheduleSave()
        },
        dropDraft() {
          patch({ ...resetDraft(), view: 'wall' })
        },
        async remove() {
          const id = state.activeId
          if (id === null) return
          patch({ ...resetDraft(), view: 'wall' })
          try {
            const response = await fetch(API_PATH, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ client: clientId, name: state.me, op: { type: 'delete', id } }),
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = await response.json()
            patch({ notes: Array.isArray(data.notes) ? data.notes : state.notes })
          } catch (error) {
            patch({ status: 'offline', error: String(error?.message ?? error) })
          }
        },
        setMe(name) {
          const trimmed = String(name).slice(0, 60)
          patch({ me: trimmed })
          writeStored(NAME_KEY, trimmed)
        },
        retry() {
          retries = 0
          void saveNow()
          void refresh()
        },
        refresh,
      }
    }

    const store = createStore()

    function useSnapshot() {
      const [value, setValue] = React.useState(store.get)
      React.useEffect(() => store.subscribe(() => setValue(store.get())), [])
      return value
    }

    function effectiveStatus(state) {
      if (state.status === 'offline') return 'offline'
      if (state.dirty) return 'unsaved'
      if (state.status === 'saving') return 'saving'
      return 'saved'
    }

    function statusText(state) {
      const status = effectiveStatus(state)
      if (status === 'offline') return t('offline')
      if (status === 'unsaved') return t('unsaved')
      if (status === 'saving') return t('saving')
      return t('save')
    }

    function timeLabel(ms) {
      const diff = Date.now() - ms
      if (!Number.isFinite(diff) || diff < 60_000) return t('justNow')
      if (diff < 3_600_000) return t('minutesAgo', { n: Math.floor(diff / 60_000) })
      if (diff < 86_400_000) return t('hoursAgo', { n: Math.floor(diff / 3_600_000) })
      return new Date(ms).toLocaleDateString()
    }

    function isLocalOrigin() {
      try {
        const host = window.location.hostname
        return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
      } catch {
        return true
      }
    }

    // ------------------------------------------------------------------ CSS

    const PALETTE_CSS = PAPERS.map((paper, index) => (
      `.dsn-surface [data-color="${index}"],.dsn-surface[data-color="${index}"]{--paper-bg:${paper.bg};--paper-ink:${paper.ink};--paper-edge:${paper.edge};--paper-tint:${paper.tint}}`
    )).join('\n')

    const CSS = `
.dsn-surface{--dsn-r-md:20px;--dsn-r-sm:14px;--dsn-bounce:cubic-bezier(.34,1.56,.64,1);--dsn-line:var(--dsw-alias-border-l1,rgba(0,0,0,.09));--dsn-ink:var(--dsw-alias-label-primary,#1a1a1a);--dsn-ink2:var(--dsw-alias-label-secondary,#666);--dsn-ink3:var(--dsw-alias-label-tertiary,#999);--dsn-surface-1:var(--dsw-alias-bg-layer-1,rgba(0,0,0,.035));font-family:var(--dsw-font-family,inherit)}
${PALETTE_CSS}

.dsn-icon-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center}
.dsn-icon-dot{position:absolute;top:-2px;right:-3px;width:7px;height:7px;border-radius:50%;background:#FF9F68;box-shadow:0 0 0 2px var(--dsw-specific-sidebar-fill,transparent)}
.dsn-icon-dot[data-tone="error"]{background:#FF6B6B}

.dsn-page{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fff);color:var(--dsn-ink);font:inherit;font-size:13px;line-height:1.55}
.dsn-page-head{display:flex;align-items:center;gap:12px;padding:14px 22px 13px;border-bottom:1px solid var(--dsn-line);background:linear-gradient(180deg,rgba(255,214,102,.20),rgba(255,214,102,0));flex:none}
.dsn-badge{width:30px;height:30px;flex:none;border-radius:11px;display:flex;align-items:center;justify-content:center;background:linear-gradient(140deg,#FFD666,#FF9F68);color:#fff;box-shadow:0 4px 12px rgba(255,159,104,.42)}
.dsn-head-main{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.dsn-heading{margin:0;font-size:15.5px;font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.dsn-pill{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 10px;border-radius:999px;background:rgba(255,214,102,.24);font-size:11.5px;font-weight:600;color:var(--dsn-ink2);max-width:100%;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.dsn-pill-dot{width:6px;height:6px;border-radius:50%;background:var(--dsn-ink3);flex:none}
.dsn-pill[data-live="true"]{background:rgba(63,196,124,.18)}
.dsn-pill[data-live="true"] .dsn-pill-dot{background:#3FC47C;box-shadow:0 0 0 3px rgba(63,196,124,.22)}
.dsn-head-actions{display:flex;align-items:center;gap:8px;flex:none}

.dsn-btn{height:30px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--dsn-line);border-radius:999px;background:transparent;color:var(--dsn-ink);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:transform .18s var(--dsn-bounce),box-shadow .18s ease,background .16s ease}
.dsn-btn:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(0,0,0,.12)}
.dsn-btn:focus-visible{outline:3px solid rgba(255,214,102,.9);outline-offset:2px}
.dsn-btn-primary{background:linear-gradient(135deg,#FFD24D,#FF9F68);border-color:transparent;color:#4A2B00;box-shadow:0 4px 14px rgba(255,159,104,.38)}
.dsn-btn-primary:hover{box-shadow:0 8px 20px rgba(255,159,104,.5)}
.dsn-btn-danger{background:rgba(229,72,77,.12);border-color:rgba(229,72,77,.38);color:var(--dsw-alias-state-error-primary,#E5484D)}
.dsn-btn-danger:hover{background:rgba(229,72,77,.2)}
.dsn-icon-btn{width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;border:0;border-radius:12px;background:transparent;color:var(--dsn-ink2);font:inherit;font-size:18px;line-height:1;cursor:pointer;transition:background .15s ease,color .15s ease}
.dsn-icon-btn:hover{background:var(--dsn-surface-1);color:var(--dsn-ink)}
.dsn-icon-btn:focus-visible{outline:3px solid rgba(255,214,102,.9);outline-offset:2px}

.dsn-banner{padding:11px 13px;border-radius:var(--dsn-r-sm);border:1px solid rgba(255,159,104,.5);background:rgba(255,187,138,.18);color:var(--dsn-ink);font-size:12px}
.dsn-banner-title{font-weight:700;margin-bottom:3px;color:#D97706}
.dsn-banner-body{color:var(--dsn-ink2);line-height:1.55}
.dsn-banner-actions{display:flex;gap:8px;margin-top:10px}

.dsn-screen{flex:1;min-height:0;display:flex;flex-direction:column;animation:dsn-fade .18s ease both}
@keyframes dsn-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.dsn-toolbar{display:flex;align-items:center;gap:10px;padding:14px 22px 2px;flex:none}
.dsn-toolbar .dsn-count{margin-right:auto;font-size:11.5px;font-weight:600;color:var(--dsn-ink2)}

.dsn-grid{flex:1;min-height:0;overflow-y:auto;padding:26px 22px 34px;display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:24px 18px;align-content:start;scrollbar-width:thin;background:radial-gradient(circle at 50% -16%,rgba(255,214,102,.17),rgba(255,214,102,0) 62%)}
.dsn-grid::-webkit-scrollbar{width:8px}
.dsn-grid::-webkit-scrollbar-thumb{background:rgba(0,0,0,.16);border-radius:99px}

.dsn-card{position:relative;display:block;aspect-ratio:1/1;padding:0;border:0;border-radius:var(--dsn-r-md);background:linear-gradient(178deg,rgba(255,255,255,.55),rgba(255,255,255,0) 26%,rgba(0,0,0,.05)),var(--paper-bg,#FFF3C4);color:var(--paper-ink,#5A4413);font:inherit;cursor:pointer;box-shadow:1px 5px 12px rgba(0,0,0,.17),0 1px 2px rgba(0,0,0,.10);rotate:var(--tilt,0deg);translate:0 0;scale:1;transform-origin:50% 10%;transition:rotate .28s var(--dsn-bounce),translate .28s var(--dsn-bounce),scale .28s var(--dsn-bounce),box-shadow .22s ease;animation:dsn-drop .42s var(--dsn-bounce) backwards;animation-delay:var(--delay,0ms)}
@keyframes dsn-drop{0%{opacity:0;translate:0 -22px;scale:.9}70%{opacity:1}100%{opacity:1;translate:0 0;scale:1}}
.dsn-card-tape{position:absolute;top:-8px;left:50%;width:64px;height:19px;translate:-50% 0;rotate:-2.6deg;border-radius:3px;background:linear-gradient(180deg,rgba(255,255,255,.88),rgba(255,255,255,.52));border-left:1px solid rgba(255,255,255,.65);border-right:1px solid rgba(255,255,255,.65);box-shadow:0 2px 6px rgba(0,0,0,.16);pointer-events:none}
.dsn-card-inner{position:relative;display:flex;flex-direction:column;height:100%;padding:16px 15px 12px;border-radius:inherit;overflow:hidden}
.dsn-card-inner::after{content:'';position:absolute;right:0;bottom:0;width:26px;height:26px;border-radius:0 0 var(--dsn-r-md) 0;background:linear-gradient(315deg,rgba(0,0,0,.10),rgba(0,0,0,0) 62%);pointer-events:none}
.dsn-card:hover{rotate:calc(var(--tilt,0deg) * .2);translate:0 -7px;scale:1.035;box-shadow:3px 18px 32px rgba(0,0,0,.22),0 2px 4px rgba(0,0,0,.12)}
.dsn-card:focus-visible{outline:3px solid var(--paper-edge,#FFD666);outline-offset:5px}
.dsn-card-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13.5px;font-weight:700;line-height:1.4;word-break:break-word}
.dsn-card-body{margin-top:7px;flex:1;min-height:0;font-size:12px;line-height:1.6;opacity:.74;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.dsn-card-body[data-empty="true"]{opacity:.42;font-style:italic}
.dsn-card-foot{display:block;margin-top:8px;font-size:10.5px;font-weight:600;opacity:.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsn-card-ai{margin-left:6px;padding:0 4px;border:1px solid currentColor;border-radius:4px;font-size:9px;font-weight:800;letter-spacing:.04em;vertical-align:1px;opacity:.85}
.dsn-card-ai[data-mode="workspace"]{border-style:dashed;opacity:.6}
.dsn-card-ai[data-mode="memory"]{font-size:10px;letter-spacing:0;opacity:.95}

.dsn-edit{flex:1;min-height:0;display:flex;flex-direction:column;padding:16px 26px 18px;gap:12px;background:linear-gradient(180deg,var(--paper-tint,rgba(255,214,102,.18)),rgba(0,0,0,0) 170px)}
.dsn-edit-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none;flex-wrap:wrap}
.dsn-edit-swatches{display:flex;align-items:center;gap:9px;flex:none}
.dsn-edit-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.dsn-kind{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 11px;border-radius:999px;border:1.5px solid var(--dsn-line);background:transparent;color:var(--dsn-ink2);font:inherit;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,color .15s ease}
.dsn-kind:hover{border-color:var(--dsn-ink3)}
.dsn-kind:focus-visible{outline:3px solid rgba(255,214,102,.9);outline-offset:2px}
.dsn-kind[data-memory="true"]{background:rgba(255,193,7,.2);border-color:rgba(255,193,7,.65);color:var(--dsn-ink)}
.dsn-scope{height:26px;padding:0 8px;border-radius:8px;border:1.5px solid var(--dsn-line);background:var(--dsn-surface-1);color:var(--dsn-ink);font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;max-width:190px}
.dsn-scope:focus{outline:none;border-color:#FFD666}
.dsn-scope:disabled{opacity:.45;cursor:default}
.dsn-swatch{width:24px;height:24px;padding:0;border:2.5px solid #fff;border-radius:50%;cursor:pointer;background:var(--paper-bg,#FFF3C4);box-shadow:0 3px 9px rgba(0,0,0,.18);transition:transform .2s var(--dsn-bounce),box-shadow .18s ease}
.dsn-swatch:hover{transform:scale(1.16)}
.dsn-swatch:focus-visible{outline:3px solid rgba(255,214,102,.95);outline-offset:2px}
.dsn-swatch[aria-pressed="true"]{transform:scale(1.2);box-shadow:0 0 0 3px var(--paper-edge,#FFD666),0 4px 10px rgba(0,0,0,.18)}

.dsn-edit-title,.dsn-edit-body{width:100%;box-sizing:border-box;border:2px solid transparent;border-radius:var(--dsn-r-sm);background:transparent;color:var(--dsn-ink);font:inherit;transition:background .16s ease,border-color .16s ease}
.dsn-edit-title{padding:8px 12px;font-size:24px;font-weight:800;letter-spacing:-.02em;flex:none}
.dsn-edit-body{flex:1;min-height:0;resize:none;padding:10px 12px;font-size:14px;line-height:1.8}
.dsn-edit-title::placeholder,.dsn-edit-body::placeholder{color:var(--dsn-ink3)}
.dsn-edit-title:hover,.dsn-edit-body:hover{background:var(--dsn-surface-1)}
.dsn-edit-title:focus,.dsn-edit-body:focus{outline:none;border-color:var(--paper-edge,#FFD666);background:var(--dsn-surface-1)}
.dsn-edit-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11.5px;font-weight:600;color:var(--dsn-ink2);min-height:30px;flex:none}

.dsn-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:var(--dsn-ink2);padding:24px}
.dsn-empty-art{filter:drop-shadow(0 8px 18px rgba(255,159,104,.28))}
.dsn-empty-title{font-size:14px;color:var(--dsn-ink);font-weight:700}
.dsn-empty-hint{font-size:12.5px;max-width:270px;line-height:1.6}

.dsn-page-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 22px;border-top:1px solid var(--dsn-line);font-size:11.5px;font-weight:600;color:var(--dsn-ink2);background:linear-gradient(0deg,rgba(255,214,102,.14),rgba(0,0,0,0));flex:none}
.dsn-status{display:inline-flex;align-items:center;gap:7px}
.dsn-status-dot{width:7px;height:7px;border-radius:50%;background:#3FC47C}
.dsn-status[data-state="saving"] .dsn-status-dot,.dsn-status[data-state="unsaved"] .dsn-status-dot{background:#FFB13D}
.dsn-status[data-state="offline"] .dsn-status-dot{background:#FF6B6B}
.dsn-retry{margin-left:6px;padding:0;border:0;background:transparent;color:#D97706;font:inherit;font-size:11.5px;font-weight:700;cursor:pointer;text-decoration:underline}
.dsn-retry:focus-visible{outline:3px solid rgba(255,214,102,.9);outline-offset:2px;border-radius:4px}
.dsn-name{display:inline-flex;align-items:center;gap:7px;min-width:0}
.dsn-name input{width:120px;padding:5px 10px;border:1.5px solid var(--dsn-line);border-radius:999px;background:var(--dsn-surface-1);color:var(--dsn-ink);font:inherit;font-size:11.5px;font-weight:600}
.dsn-name input:focus{outline:none;border-color:#FFD666}

.dsn-invite{margin:12px 22px 0;padding:13px 15px;border:1.5px solid var(--dsn-line);border-radius:var(--dsn-r-sm);background:var(--dsn-surface-1);flex:none}
.dsn-invite-title{font-weight:700;margin-bottom:4px;font-size:12.5px}
.dsn-invite-body{color:var(--dsn-ink2);margin-bottom:10px;font-size:12px;line-height:1.6}
.dsn-invite-warn{margin-bottom:10px;color:#D97706;font-size:11.5px;line-height:1.55;font-weight:600}
.dsn-invite-row{display:flex;align-items:center;gap:8px}
.dsn-invite-url{flex:1;min-width:0;padding:7px 12px;border:1.5px solid var(--dsn-line);border-radius:999px;background:var(--dsw-alias-bg-base,transparent);color:var(--dsn-ink2);font-family:var(--dsw-font-markdown-code-font-family,ui-monospace,monospace);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

@media (prefers-reduced-motion:reduce){.dsn-screen,.dsn-card{animation:none !important}.dsn-btn,.dsn-swatch,.dsn-card{transition:none}}
@media (max-width:700px){
.dsn-page-head{padding:12px 14px 11px;gap:8px}
.dsn-heading{font-size:14px}
.dsn-grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:20px 12px;padding:22px 14px 26px}
.dsn-edit{padding:12px 14px 14px}
.dsn-edit-title{font-size:19px}
.dsn-toolbar{padding:10px 14px 2px}
.dsn-page-foot{flex-wrap:wrap;gap:8px;padding:9px 14px}
.dsn-invite{margin:10px 14px 0}
}
`

    // ----------------------------------------------------------- components

    function NoteIcon({ size }) {
      return h(
        'svg',
        {
          viewBox: '0 0 20 20',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M4.2 3.6h11.6a1 1 0 0 1 1 1v7.4l-4.2 4.2H4.2a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1Z' }),
        h('path', { d: 'M16.8 12h-3.4a.8.8 0 0 0-.8.8v3.4' }),
        h('path', { d: 'M6.4 7.4h7.2' }),
        h('path', { d: 'M6.4 10.2h4.6' }),
      )
    }

    function EmptyArt() {
      return h(
        'svg',
        {
          viewBox: '0 0 120 120',
          width: 114,
          height: 114,
          fill: 'none',
          className: 'dsn-empty-art',
          'aria-hidden': true,
          focusable: false,
        },
        h('rect', { x: 20, y: 18, width: 78, height: 78, rx: 20, fill: '#FFF3C4', stroke: '#FFD666', strokeWidth: 3 }),
        h('path', { d: 'M98 70 70 98', stroke: '#F2C243', strokeWidth: 3, strokeLinecap: 'round' }),
        h('circle', { cx: 46, cy: 52, r: 5, fill: '#5A4413' }),
        h('circle', { cx: 72, cy: 52, r: 5, fill: '#5A4413' }),
        h('path', { d: 'M48 67q11 10 22 0', stroke: '#5A4413', strokeWidth: 3.6, strokeLinecap: 'round' }),
        h('circle', { cx: 34, cy: 63, r: 6, fill: '#FFB3D1', opacity: 0.8 }),
        h('circle', { cx: 84, cy: 63, r: 6, fill: '#FFB3D1', opacity: 0.8 }),
        h('path', { d: 'M100 22l2.6 5.2 5.2 2.6-5.2 2.6-2.6 5.2-2.6-5.2-5.2-2.6 5.2-2.6Z', fill: '#FFD666' }),
      )
    }

    /** The sidebar row icon; the shell owns the button, label, and selected state. */
    function PanelIcon({ size }) {
      const state = useSnapshot()
      const status = effectiveStatus(state)
      const badge = state.unread > 0 || status === 'offline'
      return h(
        'span',
        { className: 'dsn-surface dsn-icon-wrap' },
        h('style', null, CSS),
        h(NoteIcon, { size: size ?? 16 }),
        badge
          ? h('span', {
            className: 'dsn-icon-dot',
            'data-tone': status === 'offline' && state.unread === 0 ? 'error' : 'accent',
          })
          : null,
      )
    }

    function Presence({ peers }) {
      const live = peers.length > 0
      const label = !live
        ? t('alone')
        : peers.length === 1
          ? t('onlineOne')
          : t('onlineMany', { n: peers.length })
      return h(
        'span',
        { className: 'dsn-pill', 'data-live': live ? 'true' : 'false', title: peers.map((peer) => peer.name).join(', ') },
        h('span', { className: 'dsn-pill-dot' }),
        label,
      )
    }

    function InviteBar() {
      const [state, setState] = React.useState('idle')
      const href = typeof window === 'undefined' ? '' : window.location.href
      const local = isLocalOrigin()

      function copy() {
        const done = () => {
          setState('copied')
          window.setTimeout(() => setState('idle'), 1800)
        }
        try {
          const pending = navigator.clipboard.writeText(href)
          if (pending && typeof pending.then === 'function') pending.then(done, () => setState('failed'))
          else done()
        } catch {
          setState('failed')
        }
      }

      return h(
        'div',
        { className: 'dsn-invite' },
        h('div', { className: 'dsn-invite-title' }, t('inviteTitle')),
        h('div', { className: 'dsn-invite-body' }, t('inviteBody')),
        local ? h('div', { className: 'dsn-invite-warn' }, t('inviteLocal')) : null,
        h(
          'div',
          { className: 'dsn-invite-row' },
          h('code', { className: 'dsn-invite-url' }, href),
          h('button', { type: 'button', className: 'dsn-btn dsn-btn-primary', onClick: copy }, t(state === 'copied' ? 'copied' : 'copy')),
        ),
        state === 'failed' ? h('div', { className: 'dsn-invite-warn' }, t('copyFailed')) : null,
      )
    }

    function Banner({ title, body, actions }) {
      return h(
        'div',
        { className: 'dsn-banner', role: 'status' },
        h('div', { className: 'dsn-banner-title' }, title),
        body === '' ? null : h('div', { className: 'dsn-banner-body' }, body),
        actions.length === 0 ? null : h('div', { className: 'dsn-banner-actions' }, actions),
      )
    }

    function Wall({ state }) {
      return h(
        'div',
        { className: 'dsn-screen' },
        h(
          'div',
          { className: 'dsn-toolbar' },
          h('span', { className: 'dsn-count' }, t('noteCount', { n: state.notes.length })),
          h('button', { type: 'button', className: 'dsn-btn dsn-btn-primary', onClick: () => store.create() }, t('addLong')),
        ),
        state.notes.length === 0
          ? h(
            'div',
            { className: 'dsn-empty' },
            h(EmptyArt),
            h('div', { className: 'dsn-empty-title' }, t('empty')),
            h('div', { className: 'dsn-empty-hint' }, t('emptyHint')),
          )
          : h(
            'div',
            { className: 'dsn-grid' },
            state.notes.map((note, index) => {
              const preview = String(note.body ?? '').replace(/\s+/g, ' ').trim()
              return h(
                'button',
                {
                  key: note.id,
                  type: 'button',
                  className: 'dsn-card',
                  'data-color': colorOf(note),
                  style: {
                    '--tilt': `${tiltOf(note)}deg`,
                    '--delay': `${Math.min(index, 12) * 46}ms`,
                  },
                  onClick: () => store.openNote(note.id),
                },
                h('span', { className: 'dsn-card-tape', 'aria-hidden': true }),
                h(
                  'span',
                  { className: 'dsn-card-inner' },
                  h('span', { className: 'dsn-card-title' }, note.title === '' ? t('untitled') : note.title),
                  h(
                    'span',
                    { className: 'dsn-card-body', 'data-empty': preview === '' ? 'true' : 'false' },
                    preview === '' ? t('emptyBody') : preview,
                  ),
                  h(
                    'span',
                    { className: 'dsn-card-foot' },
                    `${note.updatedBy || '—'} · ${timeLabel(note.updatedAt)}`,
                    note.kind === 'memory' || note.aiMode === 'all' || note.aiMode === 'workspace'
                    ? h(
                      'span',
                      {
                        className: 'dsn-card-ai',
                        'data-mode': note.kind === 'memory' ? 'memory' : note.aiMode,
                        title: note.kind === 'memory' ? t('kindHint') : t('scopeHint'),
                      },
                      note.kind === 'memory' ? '★' : 'AI',
                    )
                    : null,
                  ),
                ),
              )
            }),
          ),
      )
    }

    function Editor({ state }) {
      const [confirming, setConfirming] = React.useState(false)
      const activeNote = state.notes.find((note) => note.id === state.activeId) ?? null
      const names = PAPERS.map((paper) => (currentLang() === 'zh' ? paper.zh : paper.en))

      React.useEffect(() => {
        setConfirming(false)
      }, [state.activeId])

      return h(
        'div',
        { className: 'dsn-screen dsn-edit', 'data-color': state.color },
        h(
          'div',
          { className: 'dsn-edit-bar' },
          h(
            'div',
            { className: 'dsn-edit-swatches', role: 'group', 'aria-label': t('colorLabel') },
            PAPERS.map((paper, index) => h('button', {
              key: index,
              type: 'button',
              className: 'dsn-swatch',
              'data-color': index,
              title: names[index] ?? String(index + 1),
              'aria-label': names[index] ?? `${t('colorLabel')} ${index + 1}`,
              'aria-pressed': state.color === index ? 'true' : 'false',
              onClick: () => store.setColor(index),
            })),
          ),
          h(
            'div',
            { className: 'dsn-edit-controls' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsn-kind',
                'data-memory': state.kind === 'memory' ? 'true' : 'false',
                'aria-pressed': state.kind === 'memory' ? 'true' : 'false',
                title: t('kindHint'),
                onClick: () => store.setKind(state.kind === 'memory' ? 'note' : 'memory'),
              },
              '★',
              t(state.kind === 'memory' ? 'kindMemory' : 'kindNote'),
            ),
            h(
              'select',
              {
                className: 'dsn-scope',
                value: state.kind === 'memory' ? 'all' : state.aiMode,
                'aria-label': t('scopeLabel'),
                title: t('scopeHint'),
                disabled: state.kind === 'memory',
                onChange: (event) => store.setAiMode(event.target.value),
              },
              h('option', { value: 'off' }, t('scopeOff')),
              h('option', { value: 'all' }, t('scopeAll')),
              h('option', { value: 'workspace' }, t('scopeWorkspace')),
            ),
            state.aiMode === 'workspace' && state.kind !== 'memory'
              ? h(
                'select',
                {
                  className: 'dsn-scope',
                  value: state.aiWorkspaceId,
                  'aria-label': t('scopeWorkspace'),
                  onChange: (event) => store.setAiMode('workspace', event.target.value),
                },
                h('option', { value: '' }, t('scopePick')),
                state.workspaces.map((workspace) => h(
                  'option',
                  { key: workspace.id, value: workspace.id },
                  workspace.title,
                )),
              )
              : null,
          ),
        ),
        state.deletedNotice
          ? h(Banner, {
            title: t('deletedTitle'),
            body: t('deletedBody'),
            actions: [
              h('button', { key: 'keep', type: 'button', className: 'dsn-btn dsn-btn-primary', onClick: () => store.reviveDraft() }, t('deletedKeep')),
              h('button', { key: 'drop', type: 'button', className: 'dsn-btn', onClick: () => store.dropDraft() }, t('deletedDiscard')),
            ],
          })
          : null,
        state.conflict !== null
          ? h(Banner, {
            title: t('conflictTitle'),
            body: t('conflictBody'),
            actions: [
              h('button', { key: 'theirs', type: 'button', className: 'dsn-btn dsn-btn-primary', onClick: () => store.resolveConflict('theirs') }, t('conflictLoad')),
              h('button', { key: 'mine', type: 'button', className: 'dsn-btn', onClick: () => store.resolveConflict('mine') }, t('conflictOverwrite')),
            ],
          })
          : null,
        h('input', {
          className: 'dsn-edit-title',
          value: state.title,
          placeholder: t('titlePlaceholder'),
          'aria-label': t('titlePlaceholder'),
          onChange: (event) => store.editTitle(event.target.value),
        }),
        h('textarea', {
          className: 'dsn-edit-body',
          value: state.body,
          placeholder: t('bodyPlaceholder'),
          'aria-label': t('bodyPlaceholder'),
          onChange: (event) => store.editBody(event.target.value),
        }),
        h(
          'div',
          { className: 'dsn-edit-foot' },
          h('span', null, activeNote === null ? '' : `${activeNote.updatedBy || '—'} · ${timeLabel(activeNote.updatedAt)}`),
          h(
            'button',
            {
              type: 'button',
              className: confirming ? 'dsn-btn dsn-btn-danger' : 'dsn-btn',
              onClick: () => {
                if (confirming) {
                  void store.remove()
                  setConfirming(false)
                } else {
                  setConfirming(true)
                }
              },
              onBlur: () => setConfirming(false),
            },
            confirming ? t('confirmDelete') : t('delete'),
          ),
        ),
      )
    }

    /** The main-column page the sidebar row selects. */
    function BoardPage() {
      const state = useSnapshot()
      const [inviteOpen, setInviteOpen] = React.useState(false)

      React.useEffect(() => {
        store.setMounted(true)
        return () => store.setMounted(false)
      }, [])

      const status = effectiveStatus(state)
      const editing = state.view === 'edit'

      return h(
        'div',
        { className: 'dsn-surface dsn-page' },
        h('style', null, CSS),
        h(
          'header',
          { className: 'dsn-page-head' },
          editing
            ? h('button', {
              type: 'button',
              className: 'dsn-icon-btn',
              'aria-label': t('back'),
              title: t('back'),
              onClick: () => { void store.done() },
            }, '←')
            : h('div', { className: 'dsn-badge' }, h(NoteIcon, { size: 17 })),
          h(
            'div',
            { className: 'dsn-head-main' },
            h('h2', { className: 'dsn-heading' }, editing ? t('editTitle') : t('title')),
            editing ? null : h(Presence, { peers: state.peers }),
          ),
          h(
            'div',
            { className: 'dsn-head-actions' },
            editing
              ? h('button', {
                type: 'button',
                className: 'dsn-btn dsn-btn-primary',
                onClick: () => { void store.done() },
              }, t('done'))
              : [
                h('button', {
                  key: 'invite',
                  type: 'button',
                  className: inviteOpen ? 'dsn-btn dsn-btn-primary' : 'dsn-btn',
                  onClick: () => setInviteOpen(!inviteOpen),
                }, t('invite')),
              ],
          ),
        ),
        !editing && inviteOpen ? h(InviteBar) : null,
        editing ? h(Editor, { state }) : h(Wall, { state }),
        h(
          'footer',
          { className: 'dsn-page-foot' },
          h(
            'span',
            { className: 'dsn-status', 'data-state': status },
            h('span', { className: 'dsn-status-dot' }),
            statusText(state),
            status === 'offline'
              ? h('button', { type: 'button', className: 'dsn-retry', onClick: () => store.retry() }, t('retry'))
              : null,
          ),
          editing
            ? null
            : h(
              'label',
              { className: 'dsn-name' },
              t('nameLabel'),
              h('input', {
                value: state.me,
                onChange: (event) => store.setMe(event.target.value),
                'aria-label': t('nameLabel'),
                maxLength: 60,
              }),
            ),
        ),
      )
    }

    // ----------------------------------------------------------------- apply

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        localeService = ctx.locale
        store.init(defaultName())

        // Sidebar row: the shell owns the button and label, this slot owns the icon.
        ctx.effect(
          () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            label: () => t('button'),
          }, PanelIcon)),
          'nexera: sidebar row',
        )

        // The panel the row selects.
        ctx.effect(
          () => ctx.slots.inject('main', () => ctx.slots.register({
            name: 'main',
            key: PANEL_ID,
          }, BoardPage)),
          'nexera: main panel',
        )

        ctx.effect(() => {
          store.start()
          void store.refresh()
          return () => store.stop()
        }, 'nexera: sync loop')

        ctx.effect(
          () => ctx.locale.subscribe(() => store.bump()),
          'nexera: locale subscription',
        )
      },
    }
  },
})
