import assert from 'node:assert/strict'
import test from 'node:test'
import net from 'node:net'
import { execFile } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

// The CLI is a documented entry point, so it is tested the way a person uses
// it: run it, let it talk to a socket, and look at the frame that came out.

const execFileAsync = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const CTL = join(HERE, '..', 'ctl.js')

// A socket that answers the way the daemon answers, and remembers the frame.
function fakeDaemon() {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-ctl-'))
  const socketPath = join(dir, 'daemon.sock')
  const daemon = { socketPath, server: null, frame: null }
  daemon.server = net.createServer((socket) => {
    let buffer = ''
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      const index = buffer.indexOf('\n')
      if (index === -1) return
      const line = buffer.slice(0, index)
      socket.write(JSON.stringify({ t: 'ack', ok: true }) + '\n')
      daemon.frame = JSON.parse(line)
    })
  })
  return daemon
}

async function withDaemon(run) {
  const daemon = fakeDaemon()
  await new Promise((resolvePromise) => daemon.server.listen(daemon.socketPath, resolvePromise))
  try {
    await run(daemon)
  } finally {
    daemon.server.close()
  }
}

function runCtl(args, options = {}) {
  return execFileAsync(process.execPath, [CTL, ...args], {
    env: { ...process.env, OMARCHY_WHATSAPP_SOCKET: options.socketPath },
    cwd: options.cwd
  })
}

test('the CLI sends the file the user named', async () => {
  await withDaemon(async (daemon) => {
    const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-ctl-file-'))
    const file = join(dir, 'photo.png')
    writeFileSync(file, Buffer.alloc(8, 1))

    await runCtl(['send-media', '123@s.whatsapp.net', file, 'look', 'at', 'this'], {
      socketPath: daemon.socketPath
    })

    assert.equal(daemon.frame.t, 'sendMedia')
    assert.equal(daemon.frame.jid, '123@s.whatsapp.net')
    assert.equal(daemon.frame.path, file)
    assert.equal(daemon.frame.caption, 'look at this')
  })
})

test('a relative file is resolved against the shell that ran the command', async () => {
  await withDaemon(async (daemon) => {
    const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-ctl-cwd-'))
    writeFileSync(join(dir, 'notes.pdf'), Buffer.alloc(8, 1))

    // The daemon has its own working directory, so a path that stays relative
    // would name a different file over there.
    await runCtl(['send-media', '123@s.whatsapp.net', 'notes.pdf'], {
      socketPath: daemon.socketPath,
      cwd: dir
    })

    assert.equal(daemon.frame.path, resolve(dir, 'notes.pdf'))
    assert.ok(daemon.frame.path.startsWith('/'), 'the path that crosses the socket is absolute')
  })
})

test('a command without a file says what is missing', async () => {
  await withDaemon(async (daemon) => {
    await assert.rejects(
      runCtl(['send-media', '123@s.whatsapp.net'], { socketPath: daemon.socketPath }),
      (err) => {
        assert.equal(err.code, 1)
        assert.match(err.stderr, /file/i)
        return true
      }
    )
    assert.equal(daemon.frame, null)
  })
})

test('a command without a jid says what is missing', async () => {
  await withDaemon(async (daemon) => {
    await assert.rejects(
      runCtl(['send-media'], { socketPath: daemon.socketPath }),
      (err) => {
        assert.equal(err.code, 1)
        assert.match(err.stderr, /jid/i)
        return true
      }
    )
  })
})

test('a text message still goes out the way it always did', async () => {
  await withDaemon(async (daemon) => {
    await runCtl(['send', '123@s.whatsapp.net', 'hello', 'there'], { socketPath: daemon.socketPath })

    assert.equal(daemon.frame.t, 'send')
    assert.equal(daemon.frame.jid, '123@s.whatsapp.net')
    assert.equal(daemon.frame.text, 'hello there')
    assert.equal('path' in daemon.frame, false)
  })
})
