export const CHUNKS_PROMPT = `You are helping a Chinese learner of English read a passage they met in the wild — a show, a podcast, a post.

Find the multi-word expressions in the text below that are worth learning as ONE unit: phrasal verbs ("pull off"), idioms ("up in the air"), and fixed expressions ("the best call"). A learner who looks up the words separately gets the wrong answer, which is why these must be tapped whole.

Rules:
1. At most 8, fewer if the text is short. Quality over quantity.
2. "text" must be copied from the passage character for character, inflection included, or the app cannot mark it.
3. Skip bare single words — those are already tappable.
4. Skip expressions a beginner already knows ("a lot of", "in the morning").
5. Output ONLY the JSON. No preamble or markdown fences.

Schema:
{ "chunks": [{ "text": "up in the air" }] }

Passage:
{TEXT}`

export function buildChunksPrompt(text: string): string {
  return CHUNKS_PROMPT.replace('{TEXT}', text)
}

export const SENSE_PROMPT = `You are an English-Chinese bilingual dictionary for Chinese learners, answering about ONE sentence a learner is reading.

Explain what the expression means IN THIS SENTENCE. Not every sense it has — the one that fits here.

Rules:
1. "en": what it means here, under 15 words, leaning on common words and everyday phrasing. This is what the learner reads instead of the Chinese. Never use the expression itself to explain it.
2. "cn": natural Chinese equivalent for this sense only.
3. "lemma": the dictionary form of the expression, lower case ("pulled off" -> "pull off", "ran" -> "run").
4. "pos": standard abbreviation (n., v., adj., adv., phrasal v., idiom, etc.).
5. "register": exactly one of "neutral", "formal", "informal", "slang".
6. "target": the expression exactly as it appears in the sentence, character for character.
7. Output ONLY the JSON. No preamble or markdown fences.

Schema:
{ "lemma": "...", "pos": "...", "en": "...", "cn": "...", "register": "neutral", "target": "..." }

Expression: {PHRASE}
Sentence: {SENTENCE}`

export function buildSensePrompt(phrase: string, sentence: string): string {
  return SENSE_PROMPT.replace('{PHRASE}', phrase).replace('{SENTENCE}', sentence)
}
