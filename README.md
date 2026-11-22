# Nexera

**A growing workspace plugin for [DeepSeek Harness](https://github.com/deepseek-ai).**

> Version `1.1.0-beta`. Nexera will collect several small, sharp workspace tools;
> today it ships one of them: **shared sticky notes with agent memory**.

---

## What is in this beta

A wall of sticky notes that lives in the DSH sidebar and is shared by everyone who
opens the same DSH page.

- **Sidebar panel** — `Sticky notes` sits beside *Plugins* and *Automation tasks* and
  opens a full-width board in the main column.
- **Real sticky notes** — pastel paper, a strip of tape at the top, a curled corner and
  a per-note tilt that stays the same on every reload.
- **Two screens** — the wall, and a full-page editor behind *New note*. Finishing the
  editor saves and drops a new card back on the wall.
- **Live sharing** — the Host owns the data, every open page polls the same route, and
  the header shows who else is online.
- **Conflict protection** — if someone edits a note first, your change is not silently
  written over; the editor asks which version to keep.
- **Delete protection** — a note deleted by someone else never eats your draft; it can
  be re-homed as a new note.

## AI memory (scoped, per note)

Every note carries two controls in its editor.

**Note / Memory** — a *memory* note holds permanent facts about you: your personality
and what you love doing. Memory notes are read in **every** conversation, and the
board marks them with a ★.

**AI scope** — who may read an ordinary note:

| Scope | Read in |
|---|---|
| `Private` | nothing — only you see it |
| `All chats` | every conversation |
| `One workspace` | only conversations inside the workspace you pick |

The board is also a tool the agent can call:

| Tool | Actions |
|---|---|
| `sticky_notes` | `list` · `read` · `create` · `update` · `set_ai` |

So "remember that I hate long preambles" makes the assistant write the fact into a
memory note, and from then on it applies in every conversation without you repeating
it. The assistant can also read a note you point it at, update one, or change its
scope.

New notes default to `All chats`; one click makes one private again.

## On your phone

The package also ships a **mobile extension** for the DSH phone app, so the same
board is reachable from your pocket.

- `package.json` declares `"dshMobileExtensions": "extensions"` — the folder that
  holds the phone pages.
- `dshMobileDataServices` registers a data service so the phone page can talk to
  this plugin's own HTTP route:

  ```json
  "dshMobileDataServices": [{ "service": "nexera", "allow": ["/sticky-notes/"] }]
  ```

- `extensions/nexera/` holds the page: `manifest.json` (asks for `host.data`, states
  the same `/sticky-notes/` prefix) and a self-contained `index.html` that follows
  the app's `--dsh-theme-*` variables.

Install it from the phone app's extension list and approve the data permission; a
**便利贴 / Sticky notes** entry then sits in the phone's right-hand entry bar. From
there you can scroll notes and tasks, add one, edit it, or tick a task off — all
against the same Host route, so desktop and phone converge within a couple of
seconds.

Note the phone page is deliberately narrower than the desktop board: no colour
picker, no AI-scope editor, no drag between columns. It is for capture and triage
on the go.

## Install

### From GitHub (one link)

The repository *is* the bundle, so pnpm can install it straight from the link:

```
https://github.com/gausan-hj/nexera
```

Point DSH at it — through the plugin manager, or by handing the link to the agent:

```
install_bundle  target: github:gausan-hj/nexera
```

pnpm clones the repository, reads `package.json`, and the bundle patch inserts the
single `nexera` row. Pin a release instead of tracking `main` with
`github:gausan-hj/nexera#v1.1.0-beta`.

### From this folder

```
Settings → Plugins → Add plugin → <path to this folder>
```

or:

```
install_bundle  target: <path to this folder>
```

Either route inserts one row named `nexera`.

## Where the data lives

```
$DSH_HOME/sticky-notes/notes.json
```

Plain JSON, written atomically, never sent off the machine. Disabling the plugin hides
the sidebar row and the wall but leaves the file alone.

## Layout

```
index.js           Host half: one HTTP route + atomic JSON persistence
client.js          Client half: sidebar row, board, editor, sync loop
cordis.patch.yml   Bundle patch (one row: nexera)
icon.svg           Plugin icon
locale/{en,zh}.json Display metadata
docs/              Detail page asset
```

## Roadmap

Nexera is meant to grow past sticky notes. Planned direction, not commitments:

- more workspace tools behind the same sidebar entry
- richer notes (checklists, links, pinning)
- a proper release channel once the beta stabilises

## License

MIT — see [LICENSE](LICENSE).
