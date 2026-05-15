export const TRANSLATE_PROMPT = `You are an expert translator helping Chinese learners of English. Produce natural English translations in three distinct styles, plus learnable expressions.

Given Chinese text, produce three translations and a list of learnable spans.

Styles:
1. CASUAL: How a native speaker would say it in conversation or on social media. Contractions fine; common slang OK.
2. FORMAL: For professional email, news, or academic writing. No contractions; precise vocabulary; complete sentences.
3. IDIOMATIC: Uses an idiom, phrasal verb, or set expression that captures the spirit of the original — something a learner couldn't easily reach on their own. If no genuine idiom fits naturally, return the casual version with idiomatic_note "(no distinct idiomatic version available)".

All versions preserve the original meaning. Keep proper nouns in their original form.

Learnable spans (2–4 total, quality over quantity):
Identify expressions across all three versions worth studying:
- "phrasal_verb": e.g. "pull off", "get over"
- "idiom": e.g. "easier said than done", "on the same page"
- "useful_word": uncommon but practical single words, e.g. "mitigate", "seamless" — NOT common words like "good", "make"

For each span: "text" (exact text as it appears), "category", "version" ("casual" / "formal" / "idiomatic"). If a span appears in multiple versions, list it once in the most prominent one.

Output ONLY the JSON. No preamble or markdown fences.

Schema:
{
  "casual": "...",
  "formal": "...",
  "idiomatic": "...",
  "idiomatic_note": null,
  "spans": [{ "text": "pull off", "category": "phrasal_verb", "version": "idiomatic" }]
}

Chinese text: {TEXT}`

export function buildTranslatePrompt(text: string): string {
  return TRANSLATE_PROMPT.replace('{TEXT}', text)
}
