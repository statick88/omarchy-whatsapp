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
const model = new Function(`${source}\nreturn { formatDuration, filePathFromUrl }`)()

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

test('a file url is the path of the file', () => {
  assert.equal(model.filePathFromUrl('file:///home/user/photo.png'), '/home/user/photo.png')
  assert.equal(model.filePathFromUrl('file:///home/user/my%20photo.png'), '/home/user/my photo.png')
})

test('a name with a stray percent sign is still a name', () => {
  // decodeURIComponent throws on a broken escape sequence, and a file called
  // "100%.png" is a real file, not a broken one.
  assert.equal(model.filePathFromUrl('file:///home/user/100%.png'), '/home/user/100%.png')
  assert.equal(model.filePathFromUrl('file:///home/user/100%2.png'), '/home/user/100%2.png')
})

test('a url that is not a file is not a path', () => {
  assert.equal(model.filePathFromUrl(''), '')
  assert.equal(model.filePathFromUrl('https://example.com/photo.png'), '')
  assert.equal(model.filePathFromUrl(undefined), '')
})
