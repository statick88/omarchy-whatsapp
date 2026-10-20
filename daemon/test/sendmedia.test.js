import assert from 'node:assert/strict'
import test from 'node:test'
import net from 'node:net'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Bus } from '../lib/server.js'
import { handleSendMedia } from '../lib/send.js'

// The daemon is one process and the panel is another, and the only thing
// between them is a newline-delimited JSON frame on a unix socket. So the
// honest test of "the panel can send a file" is a frame in one end and a
// WhatsApp call out of the other.

function tempFile(name, bytes = 32) {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-sendmedia-'))
  const path = join(dir, name)
  writeFileSync(path, Buffer.alloc(bytes, 1))
  return path
}

function connect(socketPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = net.connect(socketPath)
    socket.once('connect', () => resolvePromise(socket))
    socket.once('error', rejectPromise)
  })
}

function readFrame(socket) {
  return new Promise((resolvePromise) => {
    let buffer = ''
    const onData = (chunk) => {
      buffer += chunk.toString('utf8')
      const index = buffer.indexOf('\n')
      if (index === -1) return
      socket.off('data', onData)
      resolvePromise(JSON.parse(buffer.slice(0, index)))
    }
    socket.on('data', onData)
  })
}

async function withBus(onCommand, run) {
  const dir = mkdtempSync(join(tmpdir(), 'omarchy-whatsapp-bus-'))
  const socketPath = join(dir, 'bus.sock')
  const bus = new Bus(socketPath)
  bus.onCommand = onCommand
  await bus.listen()
  try {
    await run(socketPath)
  } finally {
    bus.close()
  }
}

test('a sendMedia frame reaches WhatsApp as an image', async () => {
  const path = tempFile('photo.png')
  const sent = []
  const sock = {
    async sendMessage(jid, content, options) {
      sent.push({ jid, content, options })
      return { key: { id: 'MSG1' }, message: { imageMessage: {} }, status: 1 }
    }
  }

  await withBus(
    (payload, reply) => handleSendMedia(payload, reply, {
      sock,
      connection: 'open',
      store: { canonicalJid: (jid) => jid, routingJid: (jid) => jid },
      deliver: () => {}
    }),
    async (socketPath) => {
      const socket = await connect(socketPath)
      const answer = readFrame(socket)
      socket.write(JSON.stringify({ t: 'sendMedia', jid: '123@s.whatsapp.net', path, caption: 'look' }) + '\n')
      const frame = await answer
      socket.destroy()

      assert.equal(frame.t, 'ack')
      assert.equal(frame.ok, true)
      assert.equal(frame.jid, '123@s.whatsapp.net')
      assert.equal(sent.length, 1)
      assert.equal(sent[0].jid, '123@s.whatsapp.net')
      assert.deepEqual(sent[0].content, { image: { url: path }, mimetype: 'image/png', caption: 'look' })
    }
  )
})

test('a file that is not an image goes out as a document with its name', async () => {
  const path = tempFile('notes.pdf')
  const sent = []
  const sock = {
    async sendMessage(jid, content) {
      sent.push(content)
      return { key: { id: 'MSG2' }, message: { documentMessage: {} }, status: 1 }
    }
  }

  await withBus(
    (payload, reply) => handleSendMedia(payload, reply, {
      sock,
      connection: 'open',
      store: { canonicalJid: (jid) => jid, routingJid: (jid) => jid },
      deliver: () => {}
    }),
    async (socketPath) => {
      const socket = await connect(socketPath)
      const answer = readFrame(socket)
      socket.write(JSON.stringify({ t: 'sendMedia', jid: '123@s.whatsapp.net', path }) + '\n')
      await answer
      socket.destroy()

      assert.deepEqual(sent[0], {
        document: { url: path },
        fileName: 'notes.pdf',
        mimetype: 'application/pdf'
      })
    }
  )
})

test('the sent message is handed on so the panel can show it', async () => {
  const path = tempFile('photo.png')
  const delivered = []
  const sock = {
    async sendMessage() {
      return { key: { id: 'MSG3' }, message: { imageMessage: {} }, status: 1 }
    }
  }

  await withBus(
    (payload, reply) => handleSendMedia(payload, reply, {
      sock,
      connection: 'open',
      store: { canonicalJid: (jid) => jid, routingJid: (jid) => jid },
      deliver: (jid, rawJid, sent) => delivered.push({ jid, rawJid, sent })
    }),
    async (socketPath) => {
      const socket = await connect(socketPath)
      const answer = readFrame(socket)
      socket.write(JSON.stringify({ t: 'sendMedia', jid: '123@s.whatsapp.net', path }) + '\n')
      await answer
      socket.destroy()

      assert.equal(delivered.length, 1)
      assert.equal(delivered[0].jid, '123@s.whatsapp.net')
      assert.equal(delivered[0].sent.key.id, 'MSG3')
    }
  )
})

test('a request without a file is refused and says why', async () => {
  await withBus(
    (payload, reply) => handleSendMedia(payload, reply, {
      sock: { async sendMessage() { throw new Error('should not send') } },
      connection: 'open',
      store: { canonicalJid: (jid) => jid, routingJid: (jid) => jid },
      deliver: () => {}
    }),
    async (socketPath) => {
      const socket = await connect(socketPath)
      const answer = readFrame(socket)
      socket.write(JSON.stringify({ t: 'sendMedia', jid: '123@s.whatsapp.net' }) + '\n')
      const frame = await answer
      socket.destroy()

      assert.equal(frame.t, 'error')
      assert.match(frame.message, /file/i)
    }
  )
})

test('a file that is not there is refused with the reason', async () => {
  await withBus(
    (payload, reply) => handleSendMedia(payload, reply, {
      sock: { async sendMessage() { throw new Error('should not send') } },
      connection: 'open',
      store: { canonicalJid: (jid) => jid, routingJid: (jid) => jid },
      deliver: () => {}
    }),
    async (socketPath) => {
      const socket = await connect(socketPath)
      const answer = readFrame(socket)
      socket.write(JSON.stringify({ t: 'sendMedia', jid: '123@s.whatsapp.net', path: '/definitely/not/here.png' }) + '\n')
      const frame = await answer
      socket.destroy()

      assert.equal(frame.t, 'error')
      assert.match(frame.message, /not found/i)
    }
  )
})

test('nothing is sent while WhatsApp is not connected', async () => {
  const path = tempFile('photo.png')
  let sends = 0

  await withBus(
    (payload, reply) => handleSendMedia(payload, reply, {
      sock: { async sendMessage() { sends += 1 } },
      connection: 'connecting',
      store: { canonicalJid: (jid) => jid, routingJid: (jid) => jid },
      deliver: () => {}
    }),
    async (socketPath) => {
      const socket = await connect(socketPath)
      const answer = readFrame(socket)
      socket.write(JSON.stringify({ t: 'sendMedia', jid: '123@s.whatsapp.net', path }) + '\n')
      const frame = await answer
      socket.destroy()

      assert.equal(frame.t, 'error')
      assert.match(frame.message, /not connected/i)
      assert.equal(sends, 0)
    }
  )
})
