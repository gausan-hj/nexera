# Nexera

**A growing workspace plugin for [DeepSeek Harness](https://github.com/deepseek-ai).**

> Version `1.0.0-beta` — the first public slice. Nexera will collect several small,
> sharp workspace tools; today it ships one of them: **shared sticky notes**.

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

## Install

Nexera is a DSH bundle. Point the plugin manager at this directory:

```
Settings → Plugins → Add plugin → <path to this folder>
```

or, from an agent session with the `plugin_manager` tool:

```
install_bundle  target: <path to this folder>
```

The bundle patch inserts one row named `nexera`.

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
