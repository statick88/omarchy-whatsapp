import { copyFileSync, mkdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { mediaDir } from './paths.js'

// The daemon runs with a private /tmp, so a file the user picked in a
// terminal, dropped on the panel or recorded there cannot be read by the
// process that has to send it. The file is copied into the daemon's own
// directory first, which both can see.
//
// The copy is what is sent, so the file the user picked is still the file
// that goes out, with its own name.

let staged = 0

export function stageOutgoing(source) {
  const name = basename(String(source || ''))
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
