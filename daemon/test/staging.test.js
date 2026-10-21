import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import { stageOutgoing } from '../lib/staging.js'

// The daemon cannot read the user's /tmp, so a file that is going out is
// copied into the directory both of them can see.

test('a file is staged where the daemon can read it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-stage-'))
  const source = join(dir, 'voice.opus')
  writeFileSync(source, Buffer.from('a recording'))

  const staged = stageOutgoing(source)

  assert.notEqual(staged, source)
  assert.equal(readFileSync(staged, 'utf8'), 'a recording')
  assert.match(staged, /voice\.opus$/)
})

test('two files with the same name do not land on each other', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-stage-'))
  // Two different files that happen to share a name.
  const one = join(dir, 'a', 'photo.png')
  const two = join(dir, 'b', 'photo.png')
  mkdirSync(join(dir, 'a'), { recursive: true })
  mkdirSync(join(dir, 'b'), { recursive: true })
  writeFileSync(one, Buffer.from('one'))
  writeFileSync(two, Buffer.from('two'))

  const first = stageOutgoing(one)
  const second = stageOutgoing(two)

  assert.notEqual(first, second)
  assert.equal(readFileSync(first, 'utf8'), 'one')
  assert.equal(readFileSync(second, 'utf8'), 'two')
})

test('the file that goes out keeps the name the user gave it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-stage-'))
  const source = join(dir, 'informe.pdf')
  writeFileSync(source, Buffer.from('un informe'))

  const staged = stageOutgoing(source)

  // The name that travels is the name the user gave it, not one with a
  // timestamp glued to it.
  assert.equal(basename(staged), 'informe.pdf')
  assert.equal(readFileSync(staged, 'utf8'), 'un informe')
})

test('a file that is not there is refused', () => {
  assert.throws(() => stageOutgoing('/definitely/not/here.png'), /ENOENT|no such file/i)
})
