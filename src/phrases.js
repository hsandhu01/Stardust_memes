// How long each phrase in a sequence stays formed before morphing to the next.
export const HOLD_MS = 3200

// Split the input into a sequence of phrases. People can separate phrases with
// "·", "|", "/", or a newline. A single comma-free word stays one phrase, so
// "hello, world" still reads as one phrase (commas are common in real text).
export function parsePhrases(text) {
  const raw = (text ?? '').split(/[·|/\n]+/)
  const out = raw
    .map((s) => s.trim().slice(0, 24))
    .filter((s) => s.length > 0)
  return out.length ? out.slice(0, 6) : [' ']
}
