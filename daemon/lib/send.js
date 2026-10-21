import { mediaMessageFor, prepareUpload } from './outgoing.js'

// One file, one WhatsApp message.
//
// The daemon owns the socket, the store and the fan-out to the panels; this
// module owns the decision of what a picked file becomes, so it can be tested
// without a WhatsApp connection: the caller hands over the socket and the
// store, and gets back the same answer the panel would show.
export async function handleSendMedia(payload, reply, deps) {
  const { sock, connection, store, deliver } = deps
  const { id, jid: rawJid } = payload || {}

  if (!rawJid) throw new Error('send-media: jid required')
  const path = String((payload && payload.path) || '')
  if (!path) throw new Error('send-media: file required')
  if (!sock || connection !== 'open') throw new Error('send-media: not connected to WhatsApp')

  // Refuses a file that is not there, and one WhatsApp would not take.
  const upload = prepareUpload(path)
  // A recording is played in place, the way a voice note is; a file the user
  // picked is a file.
  const message = mediaMessageFor(upload, payload.caption, { ptt: payload.ptt === true })

  const routingJid = store.routingJid(rawJid) || rawJid
  const sent = await sock.sendMessage(routingJid, message, {})

  // The panel learns about the message the same way it learns about any other:
  // through the shared fan-out, so every monitor shows it.
  if (sent) deliver(routingJid, rawJid, sent)

  reply({ t: 'ack', id, ok: true, jid: rawJid })
}
