# Feature: Play, record and drop media in the WhatsApp panel

## Objective

Let the panel do with media what a phone does: play the voice notes that
arrive, record a voice note and send it, and take a file that is dropped on the
panel as the thing to send.

## Branch

`feature/audio-and-drop` (on top of `feature/media-upload`, which is on top of
the upstream `main`)

## Delivery Strategy

`ask-on-risk`

## Test Runner

`node --test` (daemon unit and integration tests), `bash tests/test_lifecycle.sh`,
`qmllint` against the installed shell, and the live panel.

---

## Specs

### S1: Hearing a voice note

verifica que pueda escuchar audios, sino implementa esta funcionalidad

- A voice note that arrives is downloaded like a picture is, and it can be
  played from where it sits in the conversation.
- The note says how long it is, and the button turns into a stop while it plays.
- A file that cannot be played says so instead of doing nothing.

### S2: Recording a voice note

tambien la posibilidad de enviar audios grabados en ese momento

- The panel can record, and what it records is sent as a voice note, the way a
  phone sends one: played in place, with no download.
- The recording is attached like any other file, so it goes with the
  conversation it was recorded in and can be thrown away.
- The recording is opus, because that is what a voice note is.

### S3: Dropping a file on the panel

y ya que puedo tomar capturas de pantalla poder arrastrar y soltar en el plugin
para poder enviar

- A file dropped on the panel becomes the attachment, the same way a file
  picked from the dialog does.
- A screenshot is a file, so it takes the same road.

### S4: What must not break

- Pictures still download and show as they did.
- Text messages are untouched.
- The daemon keeps speaking the same newline-delimited JSON.

---

## Tasks

| ID | Specs | Route | Commit | Evidence |
|----|-------|-------|--------|----------|
| T1 | S1 | inline | pending | The daemon extracts and downloads a voice note; the panel plays it. |
| T2 | S2 | inline | pending | The panel records, converts to opus and attaches it. |
| T3 | S3 | inline | pending | A file dropped on the panel is attached. |
| T4 | S4 | inline | pending | The whole suite, qmllint and the live panel. |

---

## Log

### L1 (2026-10-20)

User requested: "antes de enviar verifica que pueda escuchar audios, sino
implementa esta funcionalidad antes de enviar el pr" and, after that: "tambien la
posibilidad de enviar audios grabados en ese momento" and "y ya que puedo tomar
capturas de pantalla poder arrastrar y soltar en el plugin par poder enviar".

### L2 (2026-10-20)

Read the code before touching it. The plugin could not hear a voice note:

- `message.js` only extracted `imageMessage` and `stickerMessage`, so an
  `audioMessage` was never media the daemon could fetch.
- `media.js` only knew how to download a picture or a sticker.
- `Panel.qml` had no player at all: a voice note was the label
  "Voice message" and nothing else.

Measured what the machine can do before choosing:

- Qt's own player reads an opus file and plays it to the end
  (`MediaPlayer` with `AudioOutput`, `hasAudio: true`, the position reaches the
  duration), so the panel can play a voice note without another process.
- `paplay` also plays opus, but `pw-play` cannot find a target node here.
- The recorder works (`MediaRecorder.record()` and `stop()` write a file), but
  the backend cannot encode opus: `mediaFormat.isSupported(Opus, Encode)` is
  false, and the file Qt writes is an MP4 whatever the extension says. A phone
  only plays an opus voice note, so the recording is converted with ffmpeg,
  which is on the machine and encodes opus.
- There are microphones: two `alsa_input` sources through PipeWire.

So: the panel plays with Qt, records with Qt, and ffmpeg turns the recording
into the opus a voice note is.
