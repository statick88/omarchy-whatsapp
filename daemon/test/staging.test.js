import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import { discardStaged, stageOutgoing } from '../lib/staging.js'

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

test('a file can be given the name it should arrive with', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-stage-'))
  const source = join(dir, 'recording.m4a')
  writeFileSync(source, Buffer.from('una grabacion'))

  const staged = stageOutgoing(source, 'voice-note.opus')

  assert.equal(basename(staged), 'voice-note.opus')
  assert.equal(readFileSync(staged, 'utf8'), 'una grabacion')
})

test('a file that is not there is refused', () => {
  assert.throws(() => stageOutgoing('/definitely/not/here.png'), /ENOENT|no such file/i)
})

test('a staged file is removed once it has gone out', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-stage-'))
  const source = join(dir, 'photo.png')
  writeFileSync(source, Buffer.from('a photo'))

  const staged = stageOutgoing(source)
  assert.equal(existsSync(staged), true)

  // The copy was made for one message and nothing else needs it.
  assert.equal(discardStaged(staged), true)
  assert.equal(existsSync(staged), false)
})

test('a file that was never staged is never removed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-stage-'))
  const source = join(dir, 'photo.png')
  writeFileSync(source, Buffer.from('a photo'))

  // The user picked this file: it lives in their own directories and is
  // theirs to keep.
  assert.equal(discardStaged(source), false)
  assert.equal(existsSync(source), true)
})

test('removing a file that is already gone is not a failure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-stage-'))
  const source = join(dir, 'photo.png')
  writeFileSync(source, Buffer.from('a photo'))

  const staged = stageOutgoing(source)
  assert.equal(discardStaged(staged), true)
  assert.equal(discardStaged(staged), true)
})
