import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Model.js is a QML library, so node cannot import it as a module. Its
// functions are plain JavaScript, though: the pragma line is what a QML
// library needs and a JavaScript parser does not, so it goes and the rest is
// evaluated as it would be in the shell.
const HERE = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(HERE, '../../Model.js'), 'utf8').replace(/^\.pragma library\s*$/m, '')
const model = new Function(`${source}\nreturn { formatDuration }`)()

test('a voice note is written the way a phone writes it', () => {
  assert.equal(model.formatDuration(0), '0:00')
  assert.equal(model.formatDuration(7), '0:07')
  assert.equal(model.formatDuration(12), '0:12')
  assert.equal(model.formatDuration(65), '1:05')
  assert.equal(model.formatDuration(3600), '60:00')
})

test('a length that is not a number is not a length', () => {
  assert.equal(model.formatDuration(undefined), '0:00')
  assert.equal(model.formatDuration(null), '0:00')
  assert.equal(model.formatDuration('abc'), '0:00')
  assert.equal(model.formatDuration(-5), '0:00')
})
