/**
 * Client half of Nexera, a DSH workspace plugin.
 *
 * One sidebar row opens a workbench with four tabs: sticky notes (with AI memory),
 * tasks (a three-column board), a reading list, and a workday view that shows the
 * live clock plus what is due and what changed today.
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

    const PAPERS = [
      { zh: '奶油黄', en: 'Butter', bg: '#FFF3C4', ink: '#5A4413', edge: '#FFD666', tint: 'rgba(255,214,102,.18)' },
      { zh: '樱花粉', en: 'Sakura', bg: '#FFE3EE', ink: '#5C2542', edge: '#FFB3D1', tint: 'rgba(255,179,209,.18)' },
      { zh: '天空蓝', en: 'Sky', bg: '#DFF3FF', ink: '#12415C', edge: '#9BDBFF', tint: 'rgba(155,219,255,.18)' },
      { zh: '抹茶绿', en: 'Matcha', bg: '#E2F8E0', ink: '#1F4A25', edge: '#A8E6A3', tint: 'rgba(168,230,163,.18)' },
      { zh: '香芋紫', en: 'Taro', bg: '#EFE3FF', ink: '#3D2559', edge: '#C7A8FF', tint: 'rgba(199,168,255,.18)' },
      { zh: '蜜桃橙', en: 'Peach', bg: '#FFE8D6', ink: '#5C2E13', edge: '#FFBB8A', tint: 'rgba(255,187,138,.18)' },
    ]

    const STATUSES = ['todo', 'doing', 'done']
    const PRIORITIES = ['low', 'normal', 'high']

    const DICT = {
      zh: {
        button: '便利贴',
        title: '工作台',
        tabNotes: '便利贴',
        tabTasks: '任务',
        tabLinks: '阅读',
        tabToday: '工作日',
        add: '新建',
        addNote: '新建便利贴',
        addTask: '新建任务',
        addLink: '新建阅读',
        editNote: '写便利贴',
        editTask: '写任务',
        editLink: '收藏链接',
        emptyNotes: '还没有便利贴',
        emptyNotesHint: '点右上角「新建便利贴」，写下要记住的事。',
        emptyTasks: '还没有任务',
        emptyTasksHint: '点右上角「新建任务」，把要做的事记下来。',
        emptyLinks: '阅读清单是空的',
        emptyLinksHint: '点右上角「新建阅读」，收藏一个链接。',
        emptyBody: '还没有内容',
        titlePlaceholder: '标题',
        bodyPlaceholder: '写点什么…',
        urlPlaceholder: 'https://…',
        done: '完成',
        back: '返回',
        delete: '删除',
        confirmDelete: '再点一次删除',
        invite: '邀请',
        inviteTitle: '一起写',
        inviteBody: '对方在能访问这个 DSH 页面的另一台设备或另一个浏览器里打开这个链接，就能和你编辑同一个工作台。',
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
        conflictTitle: '有人先改了这条',
        conflictBody: '为了不覆盖对方，你的这次修改还没有保存。',
        conflictLoad: '载入对方的版本',
        conflictOverwrite: '仍用我的覆盖',
        deletedTitle: '这条被其他人删除了',
        deletedBody: '你的内容还在，可以把它另存为新的一条。',
        deletedKeep: '另存为新的',
        deletedDiscard: '放弃内容',
        nameLabel: '我的名字',
        colorLabel: '颜色',
        kindNote: '普通',
        kindMemory: '记忆',
        kindHint: '记忆用来记你的性格和最喜欢做的事，每个对话里 AI 都会读到。',
        scopeLabel: 'AI 读取范围',
        scopeHint: '这条对哪些对话里的 AI 可见。',
        scopeOff: '不读取',
        scopeAll: '所有对话',
        scopeWorkspace: '仅某个工作区',
        scopePick: '选择工作区…',
        statusLabel: '状态',
        statusTodo: '待办',
        statusDoing: '进行中',
        statusDone: '已完成',
        priorityLabel: '优先级',
        priorityLow: '低',
        priorityNormal: '普通',
        priorityHigh: '高',
        dueLabel: '截止日期',
        estimateLabel: '预计用时（分钟）',
        urlLabel: '链接',
        readLabel: '已读',
        unread: '未读',
        read: '已读',
        overdue: '已逾期',
        dueToday: '今天到期',
        minutes: '{n} 分钟',
        todayTitle: '今天',
        todayDue: '今天到期',
        todayOverdue: '已逾期',
        todayChanged: '今天有改动',
        nothing: '没有',
        justNow: '刚刚',
        minutesAgo: '{n} 分钟前',
        hoursAgo: '{n} 小时前',
        untitled: '未命名',
        items: '{n} 项',
        retry: '重试',
        weekdays: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
      },
      en: {
        button: 'Sticky notes',
        title: 'Workbench',
        tabNotes: 'Notes',
        tabTasks: 'Tasks',
        tabLinks: 'Reading',
        tabToday: 'Workday',
        add: 'New',
        addNote: 'New note',
        addTask: 'New task',
        addLink: 'New link',
        editNote: 'Write a note',
        editTask: 'Write a task',
        editLink: 'Save a link',
        emptyNotes: 'No notes yet',
        emptyNotesHint: 'Use "New note" in the top right.',
        emptyTasks: 'No tasks yet',
        emptyTasksHint: 'Use "New task" in the top right.',
        emptyLinks: 'The reading list is empty',
        emptyLinksHint: 'Use "New link" in the top right.',
        emptyBody: 'No content yet',
        titlePlaceholder: 'Title',
        bodyPlaceholder: 'Write something…',
        urlPlaceholder: 'https://…',
        done: 'Done',
        back: 'Back',
        delete: 'Delete',
        confirmDelete: 'Click again to delete',
        invite: 'Invite',
        inviteTitle: 'Write together',
        inviteBody: 'Someone on another device or in another browser that can reach this DSH page will edit the same workbench.',
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
        conflictTitle: 'Someone changed this first',
        conflictBody: 'Your change was not saved, so theirs is not overwritten.',
        conflictLoad: 'Load their version',
        conflictOverwrite: 'Overwrite with mine',
        deletedTitle: 'Someone deleted this',
        deletedBody: 'Your text is still here — you can keep it as a new item.',
        deletedKeep: 'Save as new',
        deletedDiscard: 'Discard',
        nameLabel: 'My name',
        colorLabel: 'Colour',
        kindNote: 'Note',
        kindMemory: 'Memory',
        kindHint: 'Memory holds your personality and what you love doing; the assistant reads it in every conversation.',
        scopeLabel: 'AI scope',
        scopeHint: 'Which conversations may read this.',
        scopeOff: 'Private',
        scopeAll: 'All chats',
        scopeWorkspace: 'One workspace',
        scopePick: 'Pick a workspace…',
        statusLabel: 'Status',
        statusTodo: 'To do',
        statusDoing: 'Doing',
        statusDone: 'Done',
        priorityLabel: 'Priority',
        priorityLow: 'Low',
        priorityNormal: 'Normal',
        priorityHigh: 'High',
        dueLabel: 'Due date',
        estimateLabel: 'Estimate (min)',
        urlLabel: 'Link',
        readLabel: 'Read',
        unread: 'Unread',
        read: 'Read',
        overdue: 'Overdue',
        dueToday: 'Due today',
        minutes: '{n} min',
        todayTitle: 'Today',
        todayDue: 'Due today',
        todayOverdue: 'Overdue',
        todayChanged: 'Changed today',
        nothing: 'Nothing',
        justNow: 'just now',
        minutesAgo: '{n} min ago',
        hoursAgo: '{n} h ago',
        untitled: 'Untitled',
        items: '{n} items',
        retry: 'Retry',
        weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
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

    function newId(prefix) {
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }

    function tiltOf(note) {
      const id = String(note?.id ?? '')
      let acc = 3
      for (let i = 0; i < id.length; i += 1) acc = (acc * 31 + id.charCodeAt(i)) % 9973
      return ((acc % 9) - 4) * 0.55
    }

    function colorOf(note) {
      if (Number.isInteger(note?.color) && note.color >= 0 && note.color < PAPERS.length) return note.color
      const id = String(note?.id ?? '')
      let acc = 7
      for (let i = 0; i < id.length; i += 1) acc = (acc * 31 + id.charCodeAt(i)) % 9973
      return acc % PAPERS.length
    }

    function normalizeKind(kind) {
      return kind === 'memory' || kind === 'task' || kind === 'link' ? kind : 'note'
    }

    function pad2(value) {
      return String(value).padStart(2, '0')
    }

    function dateInputValue(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return ''
      const d = new Date(ms)
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    }

    function fromDateInput(value) {
      if (typeof value !== 'string' || value === '') return 0
      const ms = Date.parse(`${value}T12:00:00`)
      return Number.isFinite(ms) ? ms : 0
    }

    function startOfDay(ms) {
      const d = new Date(ms)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }

    function shortDate(ms) {
      const d = new Date(ms)
      return `${d.getMonth() + 1}/${d.getDate()}`
    }

    function isLocalOrigin() {
      try {
        const host = window.location.hostname
        return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
      } catch {
        return true
      }
    }

    // ---------------------------------------------------------------- store

    function createStore() {
      let state = {
        mounted: false,
        tab: 'notes',
        view: 'wall',
        notes: [],
        peers: [],
        workspaces: [],
        activeId: null,
        title: '',
        body: '',
        color: 0,
        kind: 'note',
        aiMode: 'off',
        aiWorkspaceId: '',
        status: 'todo',
        priority: 'normal',
        dueAt: 0,
        estimateMin: 0,
        url: '',
        read: false,
        baseRev: 0,
        dirty: false,
        status2: 'idle',
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
          status: 'todo',
          priority: 'normal',
          dueAt: 0,
          estimateMin: 0,
          url: '',
          read: false,
          baseRev: 0,
          dirty: false,
          conflict: null,
          deletedNotice: false,
        }
      }

      function isBlankDraft() {
        return state.baseRev === 0
          && state.title.trim() === ''
          && state.body.trim() === ''
          && state.url.trim() === ''
      }

      function applyItemToDraft(item) {
        return {
          title: item.title,
          body: item.body,
          color: colorOf(item),
          kind: normalizeKind(item.kind),
          aiMode: item.aiMode ?? 'off',
          aiWorkspaceId: item.aiWorkspaceId ?? '',
          status: item.status ?? 'todo',
          priority: item.priority ?? 'normal',
          dueAt: Number(item.dueAt) || 0,
          estimateMin: Number(item.estimateMin) || 0,
          url: item.url ?? '',
          read: item.read === true,
          baseRev: item.rev,
        }
      }

      function accept(data) {
        const notes = Array.isArray(data.notes) ? data.notes : []
        const peers = Array.isArray(data.peers) ? data.peers : []
        const next = {
          notes,
          peers,
          workspaces: Array.isArray(data.workspaces) ? data.workspaces : state.workspaces,
          error: '',
          status2: state.status2 === 'offline' ? 'idle' : state.status2,
        }

        if (state.activeId !== null) {
          const active = notes.find((note) => note.id === state.activeId) ?? null
          if (active === null) {
            if (state.baseRev > 0) {
              if (state.dirty) next.deletedNotice = true
              else Object.assign(next, resetDraft())
            }
          } else if (state.deletedNotice) {
            next.deletedNotice = false
          } else if (state.dirty) {
            if (active.rev !== state.baseRev) next.conflict = { current: { ...active } }
          } else if (state.conflict === null) {
            Object.assign(next, applyItemToDraft(active))
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
          patch({ status2: 'offline', error: String(error?.message ?? error) })
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
          status: state.status,
          priority: state.priority,
          dueAt: state.dueAt,
          estimateMin: state.estimateMin,
          url: state.url,
          read: state.read,
          baseRev: state.baseRev,
        }
        patch({ status2: 'saving' })

        try {
          const response = await fetch(API_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              client: clientId,
              name: state.me,
              op: { type: 'save', note: { id: target, ...sent } },
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
            if (state.activeId === target) patch({ ...shared, status2: 'saved', deletedNotice: true, dirty: true })
            else patch(shared)
            return false
          }

          if (data.conflict === true && data.current !== undefined) {
            if (state.activeId === target) {
              patch({ ...shared, status2: 'unsaved', conflict: { current: { ...data.current } } })
            } else {
              patch(shared)
            }
            return false
          }

          if (state.activeId !== target) {
            patch({ ...shared, status2: 'saved' })
            return true
          }

          const keys = Object.keys(sent)
          const stillSame = keys.every((key) => state[key] === sent[key])
          patch({
            ...shared,
            status2: stillSame ? 'saved' : 'unsaved',
            dirty: !stillSame,
            baseRev: Number(data.note?.rev ?? state.baseRev),
            conflict: null,
          })
          if (!stillSame) scheduleSave()
          return true
        } catch (error) {
          patch({ status2: 'offline', error: String(error?.message ?? error) })
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

      function edit(patchValue) {
        patch({ ...patchValue, dirty: true, status2: 'unsaved' })
        scheduleSave()
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
        setMounted(mounted) {
          if (state.mounted === mounted) return
          patch({
            mounted,
            unread: mounted ? 0 : state.unread,
            seenAt: mounted ? latestUpdate(state.notes) : state.seenAt,
          })
          if (mounted) void refresh()
          schedulePoll()
        },
        setTab(tab) {
          if (state.tab === tab) return
          if (state.dirty) void saveNow()
          patch({ tab, view: 'wall', ...resetDraft() })
        },
        openNote(id) {
          const note = state.notes.find((item) => item.id === id)
          if (note === undefined) return
          patch({
            view: 'edit',
            activeId: id,
            dirty: false,
            conflict: null,
            deletedNotice: false,
            ...applyItemToDraft(note),
          })
        },
        create() {
          const kind = state.tab === 'tasks' ? 'task' : state.tab === 'links' ? 'link' : 'note'
          const id = newId(kind === 'task' ? 'task' : kind === 'link' ? 'link' : 'note')
          patch({
            view: 'edit',
            activeId: id,
            title: '',
            body: '',
            color: colorOf({ id }),
            kind,
            aiMode: kind === 'task' || kind === 'link' ? 'off' : 'all',
            aiWorkspaceId: '',
            status: 'todo',
            priority: 'normal',
            dueAt: 0,
            estimateMin: 0,
            url: '',
            read: false,
            baseRev: 0,
            dirty: false,
            conflict: null,
            deletedNotice: false,
          })
        },
        editTitle: (value) => edit({ title: value }),
        editBody: (value) => edit({ body: value }),
        editUrl: (value) => edit({ url: value }),
        setColor(color) {
          if (color === state.color) return
          edit({ color })
        },
        setAiMode(aiMode, aiWorkspaceId) {
          const nextMode = aiMode === 'all' || aiMode === 'workspace' ? aiMode : 'off'
          const nextWorkspace = nextMode === 'workspace' ? (aiWorkspaceId ?? state.aiWorkspaceId) : ''
          if (nextMode === state.aiMode && nextWorkspace === state.aiWorkspaceId) return
          edit({ aiMode: nextMode, aiWorkspaceId: nextWorkspace })
        },
        setKind(kind) {
          const nextKind = normalizeKind(kind)
          if (nextKind === state.kind) return
          edit({ kind: nextKind, aiMode: nextKind === 'memory' ? 'all' : state.aiMode })
        },
        setStatus(status) {
          if (status === state.status) return
          edit({ status })
        },
        setPriority(priority) {
          if (priority === state.priority) return
          edit({ priority })
        },
        setDueAt(value) {
          const dueAt = fromDateInput(value)
          if (dueAt === state.dueAt) return
          edit({ dueAt })
        },
        setEstimateMin(value) {
          const parsed = Number.parseInt(String(value), 10)
          const estimateMin = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
          if (estimateMin === state.estimateMin) return
          edit({ estimateMin })
        },
        setRead(read) {
          if (read === state.read) return
          edit({ read })
        },
        resolveConflict(choice) {
          const pending = state.conflict
          if (pending === null) return
          if (choice === 'theirs') {
            patch({ ...applyItemToDraft(pending.current), dirty: false, conflict: null, status2: 'saved' })
          } else {
            patch({ baseRev: pending.current.rev, conflict: null, status2: 'unsaved' })
            void saveNow()
          }
        },
        reviveDraft() {
          patch({ activeId: newId('note'), baseRev: 0, dirty: true, deletedNotice: false, status2: 'unsaved' })
          scheduleSave()
        },
        dropDraft() {
          patch({ ...resetDraft(), view: 'wall' })
        },
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
            patch({ status2: 'offline', error: String(error?.message ?? error) })
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
      if (state.status2 === 'offline') return 'offline'
      if (state.dirty) return 'unsaved'
      if (state.status2 === 'saving') return 'saving'
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
      return shortDate(ms)
    }

    function byKind(state, ...kinds) {
      return state.notes.filter((note) => kinds.includes(normalizeKind(note.kind)))
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

.dsn-ic-line{stroke-dasharray:100;stroke-dashoffset:0}
@keyframes dsn-draw{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
.dsn-btn:hover .dsn-ic-line{animation:dsn-draw .55s ease both}
.dsn-icon-wrap[data-active="true"] .dsn-ic-line{animation:dsn-draw .6s ease both}
.dsn-back{transition:transform .22s var(--dsn-bounce)}
.dsn-icon-btn:hover .dsn-back{transform:translateX(-2.5px)}
.dsn-icon-btn:active .dsn-back{transform:translateX(-4px) scale(.94)}
.dsn-plus{transition:transform .32s var(--dsn-bounce)}
.dsn-btn:hover .dsn-plus{transform:rotate(90deg)}
.dsn-btn:active .dsn-plus{transform:rotate(90deg) scale(.88)}
.dsn-star{transition:transform .3s var(--dsn-bounce)}
.dsn-kind[data-memory="true"] .dsn-star{animation:dsn-star-pop .5s var(--dsn-bounce) both}
.dsn-kind:not([data-memory="true"]):hover .dsn-star{animation:dsn-star-wiggle .6s ease}
@keyframes dsn-star-pop{0%{transform:scale(.5) rotate(-30deg)}60%{transform:scale(1.22) rotate(10deg)}100%{transform:scale(1) rotate(0)}}
@keyframes dsn-star-wiggle{0%,100%{transform:rotate(0)}28%{transform:rotate(-14deg)}58%{transform:rotate(11deg)}}

.dsn-page{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fff);color:var(--dsn-ink);font:inherit;font-size:13px;line-height:1.55}
.dsn-page-head{display:flex;align-items:center;gap:12px;padding:14px 22px 12px;border-bottom:1px solid var(--dsn-line);background:linear-gradient(180deg,rgba(255,214,102,.20),rgba(255,214,102,0));flex:none}
.dsn-badge{width:30px;height:30px;flex:none;border-radius:11px;display:flex;align-items:center;justify-content:center;background:linear-gradient(140deg,#FFD666,#FF9F68);color:#fff;box-shadow:0 4px 12px rgba(255,159,104,.42)}
.dsn-head-main{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.dsn-heading{margin:0;font-size:15.5px;font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.dsn-pill{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 10px;border-radius:999px;background:rgba(255,214,102,.24);font-size:11.5px;font-weight:600;color:var(--dsn-ink2);max-width:100%;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.dsn-pill-dot{width:6px;height:6px;border-radius:50%;background:var(--dsn-ink3);flex:none}
.dsn-pill[data-live="true"]{background:rgba(63,196,124,.18)}
.dsn-pill[data-live="true"] .dsn-pill-dot{background:#3FC47C;box-shadow:0 0 0 3px rgba(63,196,124,.22)}
.dsn-head-actions{display:flex;align-items:center;gap:8px;flex:none}

.dsn-tabs{display:flex;align-items:center;gap:4px;padding:8px 18px 0;flex:none;border-bottom:1px solid var(--dsn-line)}
.dsn-tab{height:32px;padding:0 14px;border:0;border-bottom:2.5px solid transparent;background:transparent;color:var(--dsn-ink2);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:color .15s ease,border-color .15s ease}
.dsn-tab:hover{color:var(--dsn-ink)}
.dsn-tab[data-active="true"]{color:var(--dsn-ink);border-bottom-color:#FFB13D}
.dsn-tab:focus-visible{outline:3px solid rgba(255,214,102,.9);outline-offset:-2px}

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
.dsn-toolbar{display:flex;align-items:center;gap:10px;padding:12px 22px 2px;flex:none}
.dsn-toolbar .dsn-count{margin-right:auto;font-size:11.5px;font-weight:600;color:var(--dsn-ink2)}
.dsn-scroll{flex:1;min-height:0;overflow-y:auto;padding:16px 22px 30px;scrollbar-width:thin}
.dsn-scroll::-webkit-scrollbar{width:8px}
.dsn-scroll::-webkit-scrollbar-thumb{background:rgba(0,0,0,.16);border-radius:99px}

.dsn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:24px 18px;align-content:start;background:radial-gradient(circle at 50% -16%,rgba(255,214,102,.17),rgba(255,214,102,0) 62%)}
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

.dsn-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}
.dsn-col{display:flex;flex-direction:column;gap:9px;min-width:0}
.dsn-col-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 4px 2px;font-size:11.5px;font-weight:700;color:var(--dsn-ink2);letter-spacing:.02em}
.dsn-col-count{font-variant-numeric:tabular-nums;opacity:.7}
.dsn-task{display:block;width:100%;text-align:left;padding:11px 13px;border:1.5px solid var(--dsn-line);border-left:4px solid var(--paper-edge,#FFD666);border-radius:14px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsn-ink);font:inherit;cursor:pointer;transition:transform .18s var(--dsn-bounce),box-shadow .18s ease,border-color .15s ease}
.dsn-task:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(0,0,0,.12)}
.dsn-task:focus-visible{outline:3px solid var(--paper-edge,#FFD666);outline-offset:2px}
.dsn-task[data-priority="high"]{border-left-color:#FF6B6B}
.dsn-task[data-done="true"]{opacity:.55}
.dsn-task[data-done="true"] .dsn-task-title{text-decoration:line-through}
.dsn-task-title{display:block;font-size:12.5px;font-weight:700;line-height:1.4;word-break:break-word}
.dsn-task-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;font-size:10.5px;font-weight:600;color:var(--dsn-ink2)}
.dsn-chip{padding:1px 7px;border-radius:999px;background:var(--dsn-surface-1)}
.dsn-chip[data-tone="overdue"]{background:rgba(255,107,107,.18);color:#C93A3A}
.dsn-chip[data-tone="today"]{background:rgba(255,177,61,.22);color:#9A5B00}

.dsn-links{display:flex;flex-direction:column;gap:10px}
.dsn-link{display:block;width:100%;text-align:left;padding:13px 15px;border:1.5px solid var(--dsn-line);border-radius:16px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsn-ink);font:inherit;cursor:pointer;transition:transform .18s var(--dsn-bounce),box-shadow .18s ease}
.dsn-link:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(0,0,0,.12)}
.dsn-link:focus-visible{outline:3px solid #FFD666;outline-offset:2px}
.dsn-link[data-read="true"]{opacity:.6}
.dsn-link-title{display:block;font-size:13px;font-weight:700;word-break:break-word}
.dsn-link-url{display:block;margin-top:4px;font-size:11px;color:var(--dsn-ink2);word-break:break-all;font-family:var(--dsw-font-markdown-code-font-family,ui-monospace,monospace)}
.dsn-link-foot{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:10.5px;font-weight:600;color:var(--dsn-ink3)}

.dsn-today{display:flex;flex-direction:column;gap:20px}
.dsn-clock{padding:22px;border-radius:20px;background:linear-gradient(135deg,rgba(255,210,77,.22),rgba(255,159,104,.18));border:1.5px solid rgba(255,177,61,.35)}
.dsn-clock-date{font-size:12.5px;font-weight:700;color:var(--dsn-ink2);letter-spacing:.02em}
.dsn-clock-time{font-size:34px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15;margin-top:2px}
.dsn-section{display:flex;flex-direction:column;gap:9px}
.dsn-section-head{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--dsn-ink2)}
.dsn-section-head::after{content:'';flex:1;height:1px;background:var(--dsn-line)}
.dsn-none{font-size:12px;color:var(--dsn-ink3);padding:2px 0}

.dsn-edit{flex:1;min-height:0;display:flex;flex-direction:column;padding:14px 26px 16px;gap:11px;background:linear-gradient(180deg,var(--paper-tint,rgba(255,214,102,.18)),rgba(0,0,0,0) 170px)}
.dsn-edit-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none;flex-wrap:wrap}
.dsn-edit-swatches{display:flex;align-items:center;gap:9px;flex:none}
.dsn-edit-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.dsn-swatch{width:24px;height:24px;padding:0;border:2.5px solid #fff;border-radius:50%;cursor:pointer;background:var(--paper-bg,#FFF3C4);box-shadow:0 3px 9px rgba(0,0,0,.18);transition:transform .2s var(--dsn-bounce),box-shadow .18s ease}
.dsn-swatch:hover{transform:scale(1.16)}
.dsn-swatch:focus-visible{outline:3px solid rgba(255,214,102,.95);outline-offset:2px}
.dsn-swatch[aria-pressed="true"]{transform:scale(1.2);box-shadow:0 0 0 3px var(--paper-edge,#FFD666),0 4px 10px rgba(0,0,0,.18)}

.dsn-kind{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 11px;border-radius:999px;border:1.5px solid var(--dsn-line);background:transparent;color:var(--dsn-ink2);font:inherit;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .15s ease,border-color .15s ease,color .15s ease}
.dsn-kind:hover{border-color:var(--dsn-ink3)}
.dsn-kind:focus-visible{outline:3px solid rgba(255,214,102,.9);outline-offset:2px}
.dsn-kind[data-memory="true"]{background:rgba(255,193,7,.2);border-color:rgba(255,193,7,.65);color:var(--dsn-ink)}
.dsn-select{height:26px;padding:0 8px;border-radius:8px;border:1.5px solid var(--dsn-line);background:var(--dsn-surface-1);color:var(--dsn-ink);font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;max-width:200px}
.dsn-select:focus{outline:none;border-color:#FFD666}

.dsn-fields{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;flex:none}
.dsn-field{display:flex;flex-direction:column;gap:3px;min-width:0}
.dsn-field-label{font-size:10.5px;font-weight:700;color:var(--dsn-ink3);letter-spacing:.02em}
.dsn-input{height:28px;padding:0 9px;border-radius:8px;border:1.5px solid var(--dsn-line);background:var(--dsn-surface-1);color:var(--dsn-ink);font:inherit;font-size:12px;font-weight:600}
.dsn-input:focus{outline:none;border-color:#FFD666}
.dsn-input-num{width:76px}

.dsn-edit-title,.dsn-edit-body{width:100%;box-sizing:border-box;border:2px solid transparent;border-radius:var(--dsn-r-sm);background:transparent;color:var(--dsn-ink);font:inherit;transition:background .16s ease,border-color .16s ease}
.dsn-edit-title{padding:8px 12px;font-size:24px;font-weight:800;letter-spacing:-.02em;flex:none}
.dsn-edit-body{flex:1;min-height:0;resize:none;padding:10px 12px;font-size:14px;line-height:1.8}
.dsn-edit-title::placeholder,.dsn-edit-body::placeholder{color:var(--dsn-ink3)}
.dsn-edit-title:hover,.dsn-edit-body:hover{background:var(--dsn-surface-1)}
.dsn-edit-title:focus,.dsn-edit-body:focus{outline:none;border-color:var(--paper-edge,#FFD666);background:var(--dsn-surface-1)}
.dsn-url-input{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:12px;border:1.5px solid var(--dsn-line);background:var(--dsn-surface-1);color:var(--dsn-ink);font:inherit;font-size:12.5px;font-family:var(--dsw-font-markdown-code-font-family,ui-monospace,monospace);flex:none}
.dsn-url-input:focus{outline:none;border-color:var(--paper-edge,#FFD666)}
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

.dsn-invite{margin:10px 22px 0;padding:13px 15px;border:1.5px solid var(--dsn-line);border-radius:var(--dsn-r-sm);background:var(--dsn-surface-1);flex:none}
.dsn-invite-title{font-weight:700;margin-bottom:4px;font-size:12.5px}
.dsn-invite-body{color:var(--dsn-ink2);margin-bottom:10px;font-size:12px;line-height:1.6}
.dsn-invite-warn{margin-bottom:10px;color:#D97706;font-size:11.5px;line-height:1.55;font-weight:600}
.dsn-invite-row{display:flex;align-items:center;gap:8px}
.dsn-invite-url{flex:1;min-width:0;padding:7px 12px;border:1.5px solid var(--dsn-line);border-radius:999px;background:var(--dsw-alias-bg-base,transparent);color:var(--dsn-ink2);font-family:var(--dsw-font-markdown-code-font-family,ui-monospace,monospace);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

@media (prefers-reduced-motion:reduce){.dsn-screen,.dsn-card,.dsn-ic-line,.dsn-star,.dsn-plus,.dsn-back{animation:none !important}.dsn-btn,.dsn-swatch,.dsn-card,.dsn-task,.dsn-link,.dsn-back,.dsn-plus,.dsn-star{transition:none}}
@media (max-width:760px){
.dsn-page-head{padding:12px 14px 11px;gap:8px}
.dsn-heading{font-size:14px}
.dsn-tabs{padding:6px 12px 0;overflow-x:auto}
.dsn-tab{padding:0 11px;font-size:12px}
.dsn-toolbar{padding:10px 14px 2px}
.dsn-scroll{padding:12px 14px 24px}
.dsn-grid{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:20px 12px}
.dsn-board{grid-template-columns:1fr}
.dsn-edit{padding:12px 14px 14px}
.dsn-edit-title{font-size:19px}
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
        h('path', { d: 'M4.2 3.6h11.6a1 1 0 0 1 1 1v7.4l-4.2 4.2H4.2a1 1 0 0 1-1-1V4.6a1 1 0 0 1 1-1Z', pathLength: 100, className: 'dsn-ic-line' }),
        h('path', { d: 'M16.8 12h-3.4a.8.8 0 0 0-.8.8v3.4', pathLength: 100, className: 'dsn-ic-line' }),
        h('path', { d: 'M6.4 7.4h7.2', pathLength: 100, className: 'dsn-ic-line' }),
        h('path', { d: 'M6.4 10.2h4.6', pathLength: 100, className: 'dsn-ic-line' }),
      )
    }

    /** Line art that draws itself when its button is hovered or its row is selected. */
    function PlusIcon({ size }) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          'aria-hidden': true,
          focusable: false,
          className: 'dsn-plus',
        },
        h('path', { d: 'M8 3.2v9.6' }),
        h('path', { d: 'M3.2 8h9.6' }),
      )
    }

    function CheckIcon({ size }) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M3.4 8.6l3.1 3.1 6.1-7.2', pathLength: 100, className: 'dsn-ic-line' }),
      )
    }

    function BackIcon({ size }) {
      return h(
        'svg',
        {
          viewBox: '0 0 20 20',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.9,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          className: 'dsn-back',
        },
        h('path', { d: 'M11.8 4.6 6.4 10l5.4 5.4' }),
        h('path', { d: 'M6.6 10h7.2', opacity: 0.55 }),
      )
    }

    function StarIcon({ filled, size }) {
      return h(
        'svg',
        {
          viewBox: '0 0 20 20',
          width: size,
          height: size,
          'aria-hidden': true,
          focusable: false,
          className: 'dsn-star',
        },
        h('path', {
          d: 'M10 2.6l2.35 4.76 5.25.77-3.8 3.7.9 5.23L10 14.55l-4.7 2.47.9-5.23-3.8-3.7 5.25-.77z',
          fill: filled ? 'currentColor' : 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinejoin: 'round',
        }),
      )
    }

    function EmptyArt() {
      return h(
        'svg',
        {
          viewBox: '0 0 120 120',
          width: 96,
          height: 96,
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

    function PanelIcon({ size, active }) {
      const state = useSnapshot()
      const status = effectiveStatus(state)
      const badge = state.unread > 0 || status === 'offline'
      return h(
        'span',
        { className: 'dsn-surface dsn-icon-wrap', 'data-active': active ? 'true' : 'false' },
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

    function Tabs({ state }) {
      const tabs = [
        { id: 'notes', label: t('tabNotes') },
        { id: 'tasks', label: t('tabTasks') },
        { id: 'links', label: t('tabLinks') },
        { id: 'today', label: t('tabToday') },
      ]
      return h(
        'nav',
        { className: 'dsn-tabs', role: 'tablist' },
        tabs.map((tab) => h('button', {
          key: tab.id,
          type: 'button',
          role: 'tab',
          className: 'dsn-tab',
          'data-active': state.tab === tab.id ? 'true' : 'false',
          'aria-selected': state.tab === tab.id ? 'true' : 'false',
          onClick: () => store.setTab(tab.id),
        }, tab.label)),
      )
    }

    function NotesWall({ state }) {
      const items = byKind(state, 'note', 'memory')
      if (items.length === 0) {
        return h(
          'div',
          { className: 'dsn-empty' },
          h(EmptyArt),
          h('div', { className: 'dsn-empty-title' }, t('emptyNotes')),
          h('div', { className: 'dsn-empty-hint' }, t('emptyNotesHint')),
        )
      }
      return h(
        'div',
        { className: 'dsn-scroll' },
        h(
          'div',
          { className: 'dsn-grid' },
          items.map((note, index) => {
            const preview = String(note.body ?? '').replace(/\s+/g, ' ').trim()
            return h(
              'button',
              {
                key: note.id,
                type: 'button',
                className: 'dsn-card',
                'data-color': colorOf(note),
                style: { '--tilt': `${tiltOf(note)}deg`, '--delay': `${Math.min(index, 12) * 46}ms` },
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

    function dueChip(item, now) {
      if (!item.dueAt) return null
      const today = startOfDay(now)
      const due = startOfDay(item.dueAt)
      if (item.status !== 'done' && due < today) return h('span', { className: 'dsn-chip', 'data-tone': 'overdue' }, `${t('overdue')} · ${shortDate(item.dueAt)}`)
      if (due === today) return h('span', { className: 'dsn-chip', 'data-tone': 'today' }, t('dueToday'))
      return h('span', { className: 'dsn-chip' }, shortDate(item.dueAt))
    }

    function TaskBoard({ state }) {
      const tasks = byKind(state, 'task')
      if (tasks.length === 0) {
        return h(
          'div',
          { className: 'dsn-empty' },
          h(EmptyArt),
          h('div', { className: 'dsn-empty-title' }, t('emptyTasks')),
          h('div', { className: 'dsn-empty-hint' }, t('emptyTasksHint')),
        )
      }
      const now = Date.now()
      const labels = { todo: t('statusTodo'), doing: t('statusDoing'), done: t('statusDone') }
      return h(
        'div',
        { className: 'dsn-scroll' },
        h(
          'div',
          { className: 'dsn-board' },
          STATUSES.map((status) => {
            const column = tasks.filter((task) => (task.status ?? 'todo') === status)
            return h(
              'section',
              { key: status, className: 'dsn-col' },
              h(
                'header',
                { className: 'dsn-col-head' },
                h('span', null, labels[status]),
                h('span', { className: 'dsn-col-count' }, String(column.length)),
              ),
              column.map((task) => h(
                'button',
                {
                  key: task.id,
                  type: 'button',
                  className: 'dsn-task',
                  'data-color': colorOf(task),
                  'data-priority': task.priority ?? 'normal',
                  'data-done': status === 'done' ? 'true' : 'false',
                  onClick: () => store.openNote(task.id),
                },
                h('span', { className: 'dsn-task-title' }, task.title === '' ? t('untitled') : task.title),
                h(
                  'span',
                  { className: 'dsn-task-meta' },
                  task.priority === 'high' ? h('span', { className: 'dsn-chip', 'data-tone': 'overdue' }, t('priorityHigh')) : null,
                  dueChip(task, now),
                  task.estimateMin > 0 ? h('span', { className: 'dsn-chip' }, t('minutes', { n: task.estimateMin })) : null,
                ),
              )),
            )
          }),
        ),
      )
    }

    function LinkList({ state }) {
      const links = byKind(state, 'link')
      if (links.length === 0) {
        return h(
          'div',
          { className: 'dsn-empty' },
          h(EmptyArt),
          h('div', { className: 'dsn-empty-title' }, t('emptyLinks')),
          h('div', { className: 'dsn-empty-hint' }, t('emptyLinksHint')),
        )
      }
      const sorted = [...links].sort((left, right) => Number(left.read === true) - Number(right.read === true) || right.updatedAt - left.updatedAt)
      return h(
        'div',
        { className: 'dsn-scroll' },
        h(
          'div',
          { className: 'dsn-links' },
          sorted.map((link) => h(
            'button',
            {
              key: link.id,
              type: 'button',
              className: 'dsn-link',
              'data-read': link.read === true ? 'true' : 'false',
              onClick: () => store.openNote(link.id),
            },
            h('span', { className: 'dsn-link-title' }, link.title === '' ? link.url || t('untitled') : link.title),
            link.url === '' ? null : h('span', { className: 'dsn-link-url' }, link.url),
            h(
              'span',
              { className: 'dsn-link-foot' },
              h('span', { className: 'dsn-chip' }, link.read === true ? t('read') : t('unread')),
              h('span', null, `${link.updatedBy || '—'} · ${timeLabel(link.updatedAt)}`),
            ),
          )),
        ),
      )
    }

    function TodayView({ state }) {
      const [now, setNow] = React.useState(() => Date.now())

      React.useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(id)
      }, [])

      const date = new Date(now)
      const weekdays = DICT[currentLang()]?.weekdays ?? DICT.en.weekdays
      const dateLine = `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} · ${weekdays[date.getDay()]}`
      const timeLine = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
      const today = startOfDay(now)

      const tasks = byKind(state, 'task')
      const dueToday = tasks.filter((task) => task.dueAt > 0 && startOfDay(task.dueAt) === today && task.status !== 'done')
      const overdue = tasks.filter((task) => task.dueAt > 0 && startOfDay(task.dueAt) < today && task.status !== 'done')
      const changed = state.notes.filter((item) => item.updatedAt >= today)

      function row(item, key) {
        return h(
          'button',
          {
            key,
            type: 'button',
            className: 'dsn-task',
            'data-color': colorOf(item),
            'data-priority': item.priority ?? 'normal',
            'data-done': item.status === 'done' ? 'true' : 'false',
            onClick: () => store.openNote(item.id),
          },
          h('span', { className: 'dsn-task-title' }, item.title === '' ? t('untitled') : item.title),
          h(
            'span',
            { className: 'dsn-task-meta' },
            item.kind === 'task' ? h('span', { className: 'dsn-chip' }, t(item.status === 'doing' ? 'statusDoing' : item.status === 'done' ? 'statusDone' : 'statusTodo')) : null,
            item.estimateMin > 0 ? h('span', { className: 'dsn-chip' }, t('minutes', { n: item.estimateMin })) : null,
            h('span', { className: 'dsn-chip' }, timeLabel(item.updatedAt)),
          ),
        )
      }

      return h(
        'div',
        { className: 'dsn-scroll' },
        h(
          'div',
          { className: 'dsn-today' },
          h(
            'div',
            { className: 'dsn-clock' },
            h('div', { className: 'dsn-clock-date' }, dateLine),
            h('div', { className: 'dsn-clock-time' }, timeLine),
          ),
          h(
            'section',
            { className: 'dsn-section' },
            h('div', { className: 'dsn-section-head' }, `${t('todayDue')} · ${dueToday.length}`),
            dueToday.length === 0
              ? h('div', { className: 'dsn-none' }, t('nothing'))
              : dueToday.map((item) => row(item, item.id)),
          ),
          h(
            'section',
            { className: 'dsn-section' },
            h('div', { className: 'dsn-section-head' }, `${t('todayOverdue')} · ${overdue.length}`),
            overdue.length === 0
              ? h('div', { className: 'dsn-none' }, t('nothing'))
              : overdue.map((item) => row(item, item.id)),
          ),
          h(
            'section',
            { className: 'dsn-section' },
            h('div', { className: 'dsn-section-head' }, `${t('todayChanged')} · ${changed.length}`),
            changed.length === 0
              ? h('div', { className: 'dsn-none' }, t('nothing'))
              : changed.slice(0, 12).map((item) => row(item, item.id)),
          ),
        ),
      )
    }

    function Editor({ state }) {
      const [confirming, setConfirming] = React.useState(false)
      const activeItem = state.notes.find((note) => note.id === state.activeId) ?? null
      const names = PAPERS.map((paper) => (currentLang() === 'zh' ? paper.zh : paper.en))
      const isTask = state.kind === 'task'
      const isLink = state.kind === 'link'

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
          isTask || isLink
            ? null
            : h(
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
                h(StarIcon, { filled: state.kind === 'memory', size: 13 }),
                t(state.kind === 'memory' ? 'kindMemory' : 'kindNote'),
              ),
              h(
                'select',
                {
                  className: 'dsn-select',
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
                    className: 'dsn-select',
                    value: state.aiWorkspaceId,
                    'aria-label': t('scopeWorkspace'),
                    onChange: (event) => store.setAiMode('workspace', event.target.value),
                  },
                  h('option', { value: '' }, t('scopePick')),
                  state.workspaces.map((workspace) => h('option', { key: workspace.id, value: workspace.id }, workspace.title)),
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
        isTask
          ? h(
            'div',
            { className: 'dsn-fields' },
            h(
              'label',
              { className: 'dsn-field' },
              h('span', { className: 'dsn-field-label' }, t('statusLabel')),
              h(
                'select',
                { className: 'dsn-input', value: state.status, onChange: (event) => store.setStatus(event.target.value) },
                STATUSES.map((value) => h('option', { key: value, value }, t(value === 'todo' ? 'statusTodo' : value === 'doing' ? 'statusDoing' : 'statusDone'))),
              ),
            ),
            h(
              'label',
              { className: 'dsn-field' },
              h('span', { className: 'dsn-field-label' }, t('priorityLabel')),
              h(
                'select',
                { className: 'dsn-input', value: state.priority, onChange: (event) => store.setPriority(event.target.value) },
                PRIORITIES.map((value) => h('option', { key: value, value }, t(value === 'low' ? 'priorityLow' : value === 'high' ? 'priorityHigh' : 'priorityNormal'))),
              ),
            ),
            h(
              'label',
              { className: 'dsn-field' },
              h('span', { className: 'dsn-field-label' }, t('dueLabel')),
              h('input', {
                className: 'dsn-input',
                type: 'date',
                value: dateInputValue(state.dueAt),
                onChange: (event) => store.setDueAt(event.target.value),
              }),
            ),
            h(
              'label',
              { className: 'dsn-field' },
              h('span', { className: 'dsn-field-label' }, t('estimateLabel')),
              h('input', {
                className: 'dsn-input dsn-input-num',
                type: 'number',
                min: '0',
                step: '5',
                value: state.estimateMin === 0 ? '' : String(state.estimateMin),
                onChange: (event) => store.setEstimateMin(event.target.value),
              }),
            ),
          )
          : null,
        isLink
          ? h('input', {
            className: 'dsn-url-input',
            type: 'url',
            value: state.url,
            placeholder: t('urlPlaceholder'),
            'aria-label': t('urlLabel'),
            onChange: (event) => store.editUrl(event.target.value),
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
          h('span', null, activeItem === null ? '' : `${activeItem.updatedBy || '—'} · ${timeLabel(activeItem.updatedAt)}`),
          h(
            'span',
            { style: { display: 'inline-flex', gap: '8px' } },
            isLink
              ? h('button', {
                type: 'button',
                className: state.read ? 'dsn-btn dsn-btn-primary' : 'dsn-btn',
                onClick: () => store.setRead(!state.read),
              }, state.read ? t('read') : t('unread'))
              : null,
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
        ),
      )
    }

    function BoardPage() {
      const state = useSnapshot()
      const [inviteOpen, setInviteOpen] = React.useState(false)

      React.useEffect(() => {
        store.setMounted(true)
        return () => store.setMounted(false)
      }, [])

      const status = effectiveStatus(state)
      const editing = state.view === 'edit'
      const addLabel = state.tab === 'tasks' ? t('addTask') : state.tab === 'links' ? t('addLink') : t('addNote')
      const editLabel = state.tab === 'tasks' ? t('editTask') : state.tab === 'links' ? t('editLink') : t('editNote')
      const tabCount = state.tab === 'tasks'
        ? byKind(state, 'task').length
        : state.tab === 'links'
          ? byKind(state, 'link').length
          : state.tab === 'today'
            ? state.notes.filter((item) => item.updatedAt >= startOfDay(Date.now())).length
            : byKind(state, 'note', 'memory').length

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
            }, h(BackIcon, { size: 18 }))
            : h('div', { className: 'dsn-badge' }, h(NoteIcon, { size: 17 })),
          h(
            'div',
            { className: 'dsn-head-main' },
            h('h2', { className: 'dsn-heading' }, editing ? editLabel : t('title')),
            editing ? null : h(Presence, { peers: state.peers }),
          ),
          h(
            'div',
            { className: 'dsn-head-actions' },
            editing
              ? h('button', { type: 'button', className: 'dsn-btn dsn-btn-primary', onClick: () => { void store.done() } }, h(CheckIcon, { size: 14 }), t('done'))
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
        editing ? null : h(Tabs, { state }),
        !editing && inviteOpen ? h(InviteBar) : null,
        editing
          ? h(Editor, { state })
          : h(
            'div',
            { className: 'dsn-screen' },
            h(
              'div',
              { className: 'dsn-toolbar' },
              h('span', { className: 'dsn-count' }, t('items', { n: tabCount })),
              state.tab === 'today'
                ? null
                : h('button', { type: 'button', className: 'dsn-btn dsn-btn-primary', onClick: () => store.create() }, h(PlusIcon, { size: 14 }), addLabel),
            ),
            state.tab === 'tasks'
              ? h(TaskBoard, { state })
              : state.tab === 'links'
                ? h(LinkList, { state })
                : state.tab === 'today'
                  ? h(TodayView, { state })
                  : h(NotesWall, { state }),
          ),
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

        ctx.effect(
          () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            label: () => t('button'),
          }, PanelIcon)),
          'nexera: sidebar row',
        )

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
