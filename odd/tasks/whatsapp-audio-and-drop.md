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
| T1 | S1 | inline | 817e29b | The daemon extracts and downloads a voice note; the panel plays it. |
| T2 | S2 | inline | 817e29b | The panel records, converts to opus and attaches it. |
| T3 | S3 | inline | 817e29b | A file dropped on the panel is attached. |
| T4 | S4 | inline | 58e5511, 97663e5 | The whole suite, qmllint and the live panel. |

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

### L3 (2026-10-20)

The three features, built test first:

- The daemon now extracts an `audioMessage` the way it extracts a picture, and
  downloads it as the opus a voice note is. `daemon/test/media.test.js` pins it.
- The panel plays a voice note where it sits, with its length next to it, and
  the button becomes a stop while it plays.
- The panel records, converts what it recorded into opus and attaches it, and a
  recording is marked as a voice note so the phone plays it in place.
- A file dropped on the panel becomes the attachment, the same way one picked
  from the dialog does.

### L4 (2026-10-20)

Two things the machine told us that the code could not:

- The daemon runs with `PrivateTmp=yes`, so it never saw a file picked in a
  terminal, dropped on the panel, or recorded there: the send failed with "file
  not found" for a file that was plainly there. A file on its way out is now
  copied into the directory both of them can see, and that copy is what is
  sent. `daemon/lib/staging.js` and `daemon/test/staging.test.js` pin it.
- `MediaPlayer` has no `stopped` signal in QML. The invalid assignment did not
  only warn: it failed the whole panel, so the plugin stopped opening at all.
  The state is a property, and that is what the code reads now.

### L5 (2026-10-20)

Verified against the real account, not only against the tests:

- A voice note sent to the account's own chat arrived as an `audioMessage`
  with its length, and the daemon downloaded it as an opus file.
- The panel shows it as a play button and `0:03`, next to the paperclip, the
  microphone and the send button.
- The same player, with the same file the daemon downloaded, plays it to the
  end: `hasAudio: true`, the position reaches the duration.
- Recording writes a file, and the conversion turns it into a valid
  Ogg/Opus, which is what a voice note is.
- 65 daemon tests, the lifecycle test and qmllint are green.
