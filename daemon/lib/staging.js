import { copyFileSync, mkdirSync, rmdirSync, unlinkSync } from 'node:fs'
import { basename, dirname, join, sep } from 'node:path'
import { mediaDir } from './paths.js'

// The daemon runs with a private /tmp, so a file the user picked in a
// terminal, dropped on the panel or recorded there cannot be read by the
// process that has to send it. The file is copied into the daemon's own
// directory first, which both can see.
//
// The copy is what is sent, so the file the user picked is still the file
// that goes out, with its own name.

let staged = 0

export function stageOutgoing(source, wanted) {
  // The name that travels is the one the file should arrive with. A recording
  // has no name of its own yet, so its caller says what it should be called.
  const name = wanted ? String(wanted) : basename(String(source || ''))
  if (!name) throw new Error('stage: no file given')

  // Each staged file gets its own directory, so the name that travels is the
  // name the user gave it and two files of the same name never land on each
  // other. The clock alone is not enough: two files staged in the same
  // millisecond would collide.
  staged += 1
  const target = join(mediaDir, 'outgoing', `${Date.now()}-${staged}`, name)
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
  copyFileSync(source, target)
  return target
}

// The copy has done its job once the message went out: WhatsApp has the file
// now, and a retry re-sends what the server already holds.
//
// Only a staged copy is removed. A file the user picked lives in their own
// directories and is theirs to keep, so it is never touched.
export function discardStaged(path) {
  const target = String(path || '')
  if (!target.startsWith(join(mediaDir, 'outgoing') + sep)) return false

  try {
    unlinkSync(target)
  } catch (err) {
    // Already gone is the outcome that was asked for, not a failure.
    if (err?.code !== 'ENOENT') return false
  }

  // The directory was made for that one file, so it can go with it.
  try {
    rmdirSync(dirname(target))
  } catch {
    // Not empty, or already gone: nothing left to clean up.
  }
  return true
}
