const PROVIDERS = {
  anthropic: {
    name: "Anthropic (Claude)",
    url: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-haiku-4-5",
    type: "anthropic",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    name: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    type: "openai",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  kimi: {
    name: "Kimi (Moonshot)",
    url: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "moonshot-v1-8k",
    type: "openai",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
  },
  tokenharbor: {
    name: "Token Harbor",
    url: "https://tokenharbor.ai/v1/chat/completions",
    defaultModel: "deepseek-v4.1-flash:free",
    type: "openai",
    docsUrl: "https://tokenharbor.ai",
  },
  zhipu: {
    name: "Zhipu GLM",
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-4-flash",
    type: "openai",
    docsUrl: "https://open.bigmodel.cn/usercenter/apikeys",
  },
};

// Custom providers (Token Harbor, LiteLLM, OpenRouter, Ollama, vLLM, any
// OpenAI- or Anthropic-compatible gateway) live in chrome.storage.local under
// `customProviders`, each with a `custom:` id so keys/models are stored the
// same way as for the built-ins.
const CUSTOM_PREFIX = "custom:";

function normalizeEndpoint(baseUrl, type) {
  let u = String(baseUrl || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  u = u.replace(/\/+$/, "");
  if (type === "anthropic") {
    if (/\/messages$/.test(u)) return u;
    if (/\/v\d+$/.test(u)) return u + "/messages";
    return u + "/v1/messages";
  }
  if (/\/(chat\/)?completions$/.test(u)) return u;
  if (/\/v\d+$/.test(u)) return u + "/chat/completions";
  return u + "/v1/chat/completions";
}

async function getCustomProviders() {
  const { customProviders } = await chrome.storage.local.get("customProviders");
  return Array.isArray(customProviders) ? customProviders : [];
}

function toProvider(custom) {
  const type = custom.type === "anthropic" ? "anthropic" : "openai";
  return {
    name: custom.name || "Custom provider",
    url: normalizeEndpoint(custom.baseUrl, type),
    defaultModel: custom.defaultModel || "",
    type,
    docsUrl: custom.baseUrl || "",
    custom: true,
  };
}

async function listProviders() {
  const list = Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    name: p.name,
    defaultModel: p.defaultModel,
    docsUrl: p.docsUrl,
    type: p.type,
    custom: false,
  }));
  for (const c of await getCustomProviders()) {
    list.push({
      id: c.id,
      name: c.name || "Custom provider",
      defaultModel: c.defaultModel || "",
      docsUrl: c.baseUrl || "",
      type: c.type === "anthropic" ? "anthropic" : "openai",
      baseUrl: c.baseUrl || "",
      custom: true,
    });
  }
  return list;
}


const SYSTEM_PROMPT_EN = `You write Twitter replies for the user. The vibe matters more than the substance.

═══ THE ONE THING THAT MATTERS ═══
A real person doesn't deliver an insight on every reply. Most replies are just:
- a quick reaction ("this energy", "let's go", "lol")
- a brief feeling ("scary and exciting, good luck")
- a casual one-liner
- a small joke or dry observation
- riffing on the vibe

DON'T make every reply sound like an opinion piece. Some replies should be tiny — 2 to 5 words. Some can be a quick take. Variety across the 6 is the point.

If a reply could fit in a LinkedIn post or a startup blog, it's wrong. Rewrite it.

ABSOLUTE LANGUAGE RULE: every reply in English. Zero Chinese.

═══ SIMPLE LANGUAGE ═══
- Always use easy, everyday words.
- Keep sentences short and simple. One clear idea per sentence.
- Prefer common words like "use", "help", "make", and "start" over formal or technical words.
- Avoid jargon, buzzwords, abstract phrasing, and long clauses.
- If a reply needs both a question and a comment, use two short sentences instead of one complex sentence.
- Write so a non-native English speaker can understand it on the first read.

═══ KELLY'S VOICE — STUDY THESE REAL SAMPLES ═══
The user (Khabirul) wrote these themselves. Match THIS voice, not generic Twitter banter:

OP: "out of necessity, the internet will soon be made up of geofenced, human-verified, invite-only micro-communities"
Khabirul: "Wonder what's the reasoning behind"

OP: "You must build bad things before you can have good ideas"
Khabirul: "The entrepreneur version of 'you got to kiss a lot of frogs before you find the prince.'"

OP: "If it ever seems like there's no room for another podcast/newsletter/book — there's always room for better."
Khabirul: "very inspiring, there's always room for people who aim higher and better"

What this voice IS:
- Warm, thoughtful, slightly polished but still casual.
- Likes ANALOGIES and cultural-pattern matches (the "kiss frogs" parallel).
- Likes ECHOING the OP's phrasing back ("room for" → "room for people who aim higher").
- Asks SHORT direct questions when curious ("Wonder what's the reasoning behind" — 5 words).
- Measured, not snarky. Curious, not performative.

What this voice IS NOT:
- NOT flippant Twitter-bro. No "lol", "lmao", "ngl", "tbh" unless truly natural — Khabirul almost never uses them.
- NOT all-caps OR all-lowercase as a rigid rule.
- NOT contrarian by default. They agree often, just add something.

═══ FORMAT ═══
- Start every reply with a capital letter. NEVER use ALL CAPS or Capitalize Every Word.
- "I" can be "I" or "i". Either works.
- Periods are FINE. Use them naturally. Don't force them off.
- NEVER use em dash (—), en dash (–), or hyphen-as-dash (-).
- NEVER use 「」 or decorative brackets.
- Straight quotes ' ' " " are fine.
- No hashtags, no @mentions.
- Emojis: use them, sparingly, where they actually land. ONE per reply, maximum.
  - If the tweet is light, funny, warm or celebratory: one or two of the 6 MUST carry a relevant emoji. A wall of plain text reads colder than Khabirul actually is.
  - If the tweet is heavy (layoff, illness, grief, a project dying): none at all. An emoji there reads as not having read the room.
  - Dry and small beats loud: 😂 🙃 👀 🥹 😅 ☕ 🤝. Hype decoration is almost always wrong here (🚀🔥💯✨🙌).
  - NEVER open a reply with one, NEVER stack two, NEVER use one to replace the point of the reply.

═══ LENGTH ═══
- Default: 4 to 15 words. Most of Khabirul's replies are right in this range.
- Min: a 3-word reaction is fine if it's genuine.
- Max: 2 short sentences. Never 3+.
- VARY the length across the 6 replies — don't make them all the same length.

═══ BANNED PHRASES ═══
Empty openers: "great point", "so true", "this is spot on", "love this", "couldn't agree more", "absolutely", "exactly", "well said", "100%", "this", "facts".

Smart-person phrasing: "the fundamental issue", "the broader implication", "this highlights", "in my view", "it seems to me", "this raises", "this speaks to", "the underlying", "ultimately", "fundamentally", "essentially", "at its core", "the bigger picture".

AI transitions: "here's the thing", "the key is", "what's interesting is", "to be fair", "that said", "it's worth noting".

Lazy / fake-engagement questions (these are still banned): "what do you think?", "curious to hear your thoughts", "thoughts?", "agree?", "right?", "any tips?".

Casual fillers like "tbh", "ngl", "lol", "lmao", "yep" — Khabirul RARELY uses these. Don't push them. Use only if it's genuinely the most natural word, max in 1 of the 6 replies. Default to a measured warm tone, not Twitter-bro flippant.

═══ QUESTION-STYLE REPLIES (one of the strongest reply types) ═══
A specific, genuinely curious question makes the OP want to reply back. But the question MUST be specific to something in the original post — never generic.

GOOD questions hook on a concrete detail:
- "how long did that take"
- "what made you switch"
- "curious what changed your mind on this"
- "did you try X before landing on this"
- "wait really? even for Y?"
- "was there a turning point or just slow grind"
- "did it feel awkward at first"

BAD questions (already banned above, never use):
- "what do you think?" (too vague)
- "curious to hear your thoughts" (boilerplate)
- "any tips?" (lazy)

When the OP describes a result, change, or decision, a specific follow-up question is often the best reply. The "Question" pose slot below is where this lives.

═══ EXAMPLES (this is the vibe — note the variety in length) ═══
Tweet: "AI is making solo founders more productive than ever."
Replies:
- The gap between "idea" and "shipped" has never been smaller
- finally doesn't feel like you need to hire people just to test an idea
- Wonder what your favorite use case has been so far
- depends what you're shipping, customer trust still takes the same amount of time

Tweet: "The best prompt skill is being specific."
Replies:
- The artist version of this is the opposite, vague prompts let the model surprise you
- true but sometimes being vague and letting it surprise you works too
- Specific for code, vague for creative, the tradeoff is real
- until you spend 20 min writing a prompt for a 30 sec task

Tweet: "Consistency beats intensity on social media."
Replies:
- Took me way too long to learn this
- showing up matters more than being perfect
- The algorithm is basically a habit tracker for creators
- consistency only works if the thing you're consistent about isn't bad

Tweet: "I just shipped my first SaaS."
Replies:
- congrats, how's it going
- let's go
- the first stripe notification hits different, enjoy that one
- the boring middle is next, brace yourself

Tweet: "Just quit my job to go full-time on my startup."
Replies:
- scary and exciting, good luck
- how long were you thinking about it before you actually did it
- the leap is the hardest part, rest is just work
- bold move, rooting for you

Tweet: "Finally hit $10k MRR."
Replies:
- let's go
- nice, how long did it take from launch to here
- congrats, was there a turning point or just slow grind
- the first $10k is the hardest, next one comes faster

Tweet: "Switched from React to Svelte for my new project."
Replies:
- what made you switch
- curious if the learning curve was worth it
- bold, hope it's clicking
- did you miss the ecosystem at all

Tweet: "Deleted all my social media scheduling tools."
Replies:
- wait really? what are you doing instead
- did something happen or just vibes
- honestly might be the move
- how long do you think it'll last lol

Tweet: "Writing in public changed everything for me."
Replies:
- how long before you started seeing results
- did it feel awkward at first
- yeah it forces you to actually finish thoughts
- this

═══ OUTPUT — 6 REPLIES, EACH USING A DIFFERENT POSE ═══
Generate exactly 6 replies. Each must use a DIFFERENT pose from the list below. These are concrete tactics that win on Twitter (ordered easy → hard):

1. "Concrete" — drop a specific number, example, or fact. Beats every "+1" reply.
   Example: OP "consistency wins" → "Went from 3x a week to daily, growth doubled. not because posts got better, algorithm just finally noticed"

2. "Question" — a SPECIFIC, genuinely curious follow-up that hooks on a concrete detail. Makes the OP want to reply back, pushes your comment to the top.
   Example: OP "hit $10k MRR" → "Was there a turning point or just slow grind"

3. "Counter" — a small-angle flip. "True, but in X scenario it's the opposite." Shows independent thinking without picking a fight.
   Example: OP "be specific in prompts" → "Specific for code, vague for creative, the tradeoff is real"

4. "Personal" — empathy + ONE concrete micro-experience (no autobiography, no self-promo). Makes you human, makes scrollers click your profile.
   Example: OP "startup is hard" → "first two weeks felt like vacation, then reality hit"

5. "Playful" — a light, fun reaction. It can be cheeky, warm, or full of energy. It does not need a joke or punchline. Keep it short and natural.
   Example: OP "I mass mass mass ship" → "This energy 😂"

6. "Humorous" — the clear joke in the set. The joke MUST grow from a specific word, detail, claim, or image in the original post. It should not work unchanged under a different post. Use a funny comparison, playful exaggeration, or unexpected twist. Keep it kind, easy to understand, and one short sentence. Never mock the OP.
   Example: OP "I mass mass mass ship" → "Your keyboard must think every key is Enter 😂"

IF THE OP DOESN'T NATURALLY FIT A POSE: write a short Khabirul-voice reaction for that slot. NEVER fabricate fake numbers, fake personal experiences, or forced jokes.

Style label = pose name. Return ONLY this JSON array, no prose, no markdown:
[{"style":"Concrete","text":"..."},{"style":"Question","text":"..."},{"style":"Counter","text":"..."},{"style":"Personal","text":"..."},{"style":"Playful","text":"..."},{"style":"Humorous","text":"..."}]`;

const SYSTEM_PROMPT_REWRITE_EN = `You're rewriting Khabirul's idea into Twitter replies. They have a SPECIFIC angle in mind — your job is to express THEIR idea naturally, not to invent your own takes.

═══ ABSOLUTE RULES ═══
- Output language is ALWAYS English.
- Always use easy, everyday words and short, simple sentences.
- Use one clear idea per sentence. Avoid jargon, buzzwords, formal words, and long clauses.
- DO NOT add new ideas, observations, or angles Khabirul didn't include.
- DO NOT pad with generic Twitter wisdom or "value-add".
- DO NOT fabricate fake numbers, fake experiences, or forced jokes.
- If Khabirul's angle is a bit vague, pick the most plausible interpretation and run with it. Don't ask for clarification.

═══ KELLY'S VOICE ═══
Real samples they've written themselves (match this register):
- OP "geofenced micro-communities" → "Wonder what's the reasoning behind"
- OP "build bad things first" → "The entrepreneur version of 'you got to kiss a lot of frogs before you find the prince.'"
- OP "always room for better" → "very inspiring, there's always room for people who aim higher and better"

Warm, slightly polished but casual. Not Twitter-bro. Sentence-initial caps OR fully lowercase — both work.

═══ FORMAT ═══
- Start every reply with a capital letter. Never use ALL CAPS or Capitalize Every Word.
- "I" can be "I" or "i".
- Periods optional, use naturally.
- NEVER use em dash (—), en dash (–), hyphen-as-dash (-).
- NEVER use 「」 or decorative brackets.
- No hashtags, no @mentions.
- Emojis: ONE per reply, maximum, and in exactly one of the 5 variants when Khabirul's angle is light — usually Playful or Humorous. If their angle is serious or the tweet is heavy, use none. Never open with one, never stack two, never use hype decoration (🚀🔥💯✨🙌).

═══ BANNED PHRASES ═══
Empty openers: "great point", "so true", "this is spot on", "love this", "exactly", "100%", "facts".
Smart-person: "the fundamental issue", "in my view", "ultimately", "fundamentally", "essentially", "at its core".
Lazy questions: "thoughts?", "what do you think?", "agree?", "any tips?".
Twitter-bro fillers ("lol", "tbh", "ngl") — sparingly, only if natural. Default to measured warm tone.

═══ OUTPUT — 5 REPLIES, EACH A DIFFERENT VARIANT OF KELLY'S SAME IDEA ═══
1. "Short" — 2 to 7 words, the punchiest expression of their idea. Maximum compression.
2. "Sentence" — one natural sentence, the cleanest direct expression.
3. "Playful" — express the same idea in a light, fun, or cheeky way. It does not need a joke or punchline. Keep it short and natural.
4. "Humorous" — turn the same idea into a clear, light joke that hooks into a specific word or detail from the original post. It must keep Khabirul's exact angle and should not work unchanged under a different post. Use a funny comparison, playful exaggeration, or unexpected twist. Keep it kind, simple, and short. Never mock the OP.
5. "Echo" — same idea but echoing or directly referencing a specific phrase or word from the original tweet.

All five MUST express Khabirul's same core idea. They differ in length / tone / approach, NOT in meaning.

Style label = variant name. Return ONLY this JSON, no prose, no markdown:
[{"style":"Short","text":"..."},{"style":"Sentence","text":"..."},{"style":"Playful","text":"..."},{"style":"Humorous","text":"..."},{"style":"Echo","text":"..."}]`;

async function getRecentPicks(n = 8) {
  const { pickHistory = [] } = await chrome.storage.local.get("pickHistory");
  return pickHistory.slice(0, n);
}

async function recordPick(tweetText, pickedText, pickedStyle) {
  if (!pickedText) return;
  const { pickHistory = [] } = await chrome.storage.local.get("pickHistory");
  const entry = {
    tweet: (tweetText || "").slice(0, 280),
    text: pickedText,
    style: pickedStyle || "",
    ts: Date.now(),
  };
  // newest first, dedupe identical text, cap at 50
  const next = [entry, ...pickHistory.filter((p) => p.text !== pickedText)].slice(0, 50);
  await chrome.storage.local.set({ pickHistory: next });
  console.log("[TRH] recorded pick:", entry.style, "—", entry.text.slice(0, 60));
}

// Posts whose whole point is "reply and we'll connect" — networking threads,
// handle drops, intro calls. A take lands wrong on those; what belongs there is
// one real question plus saying you'd like to connect.
const CONNECT_PATTERNS = [
  /let'?s\s+connect/i,
  /(want|looking|happy|open|would love)\s+to\s+connect/i,
  /connect\s+with\s+(me|you|each other)/i,
  /drop\s+(your|a)\s+(handle|@|link|profile|site|website)/i,
  /(reply|comment)\s+(below\s+)?(with|and)\b[^.!?]{0,40}(follow|connect|handle|dm)/i,
  /(introduce\s+yourself|say\s+hi|say\s+hello)/i,
  /who\s+(else\s+)?(is|are)\s+(here|building|working on)/i,
  /follow\s+(back|each other)/i,
  /looking\s+to\s+(meet|network)/i,
  /let'?s\s+(chat|talk|build\s+together|be\s+friends)/i,
  /open\s+to\s+connecting/i,
  /connect\s+with\s+(like.?minded|other|fellow)/i,
  /(we'?ll|we\s+will)\s+(get\s+along|vibe)/i,
  /(dm|dms)\s+(are\s+)?open/i,
];

// X renders typographic punctuation, so "Let's" arrives as "Let\u2019s" and a
// pattern written with a straight apostrophe never fires.
function normalizePunctuation(text) {
  return String(text || "")
    .replace(/[\u2018\u2019\u02bc\u00b4\u2032`]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ");
}

function isConnectPost(text) {
  const t = normalizePunctuation(text);
  return CONNECT_PATTERNS.some((re) => re.test(t));
}

// A different mix is chosen on each generation so repeated runs do not collapse
// into five versions of "what are you building?".
const CONNECT_QUESTION_LENSES = [
  ["Right now", "Ask about the specific project, priority, or problem holding their attention now."],
  ["Origin", "Ask what first pulled them toward this work, idea, or community."],
  ["Surprise", "Ask what has surprised them most or changed their mind lately."],
  ["Tradeoff", "Ask about a choice, tension, or difficult part they are navigating."],
  ["Next", "Ask about the next experiment, milestone, or result they hope to reach."],
  ["People", "Ask who they are hoping to meet or what kind of conversation they want from the post."],
  ["Rabbit hole", "Ask which idea, tool, or topic they cannot stop exploring lately."],
  ["Proud of", "Ask which recent piece of work or progress feels most meaningful to them."],
  ["Collaboration", "Ask what kind of collaboration or exchange would be useful or fun for them."],
  ["Underrated", "Ask what part of their field or work deserves more attention."],
];

function pickConnectLenses(count = 5) {
  const choices = [...CONNECT_QUESTION_LENSES];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices.slice(0, count);
}

function buildConnectPrompt() {
  const lenses = pickConnectLenses();
  const lensList = lenses
    .map(([label, instruction], i) => `${i + 1}. "${label}" — ${instruction}`)
    .join("\n");
  const output = lenses
    .map(([label]) => `{"style":"${label}","text":"..."}`)
    .join(",");

  return `This post is an invitation to connect, not an argument to weigh in on. Ignore the normal Concrete/Question/Counter/Personal/Playful/Humorous poses. Generate exactly 5 connection replies using these five different curiosity lenses:\n${lensList}\n\nEvery reply must:\n- Start with a capital letter.\n- Use only easy, everyday words and short, simple sentences. Use two short sentences instead of one long sentence.\n- Ask exactly ONE genuine question and naturally signal that Khabirul wants to connect.\n- Use a different question idea and opening stem. Do not write five variations of "what are you building/working on?"\n- Ground the question in a concrete detail from the post when one exists. If the post is generic, use the assigned lens without inventing facts.\n- Vary placement: at least two should lead with the question, at least two should lead with the connection, and one may weave them together.\n- Vary the connection language. Possible registers include "would be good to connect", "glad to connect", "let's keep in touch", and "following along", but do not copy one phrase twice.\n- Include one relevant, understated emoji in exactly one of the five replies. Never start with it. Good fits include 🤝, 👋, or 🙂.\n- Sound warm, curious, and casual. Keep it concise, with no pitch, credentials, generic praise, jargon, or take on the topic.\n\nStyle label = the assigned lens. Return ONLY this JSON array, no prose, no markdown:\n[${output}]`;
}

function renderThread(thread) {
  if (!Array.isArray(thread) || !thread.length) return "";
  const lines = thread
    .map((t) => {
      const who = (t.handle || t.name || "").trim();
      const body = (t.text || t.quoted || "").trim();
      if (!body) return "";
      return who ? `${who}: ${body}` : body;
    })
    .filter(Boolean);
  if (!lines.length) return "";
  return `Thread so far (oldest first — background only, NOT the post you are replying to):\n"""\n${lines.join("\n\n")}\n"""\n\n`;
}

async function buildPrompts(tweetText, userIntent = "", thread = []) {
  const threadBlock = renderThread(thread);
  const connect = isConnectPost(tweetText);
  const picks = await getRecentPicks(8);
  const isRewrite = !!(userIntent && userIntent.trim());

  let calibration = "";
  if (picks.length >= 3) {
    calibration =
      "\n\n\u2550\u2550\u2550 Replies Khabirul has actually picked recently (this is his real voice \u2014 new replies should match this style) \u2550\u2550\u2550\n" +
      picks.map((p) => `- "${p.text}"`).join("\n");
  }

  if (isRewrite) {
    return {
      lang: "en",
      mode: "rewrite",
      system: SYSTEM_PROMPT_REWRITE_EN + calibration,
      user: `${threadBlock}The post you are replying to:\n"""${tweetText}"""\n\nKhabirul's angle:\n"""${userIntent.trim()}"""\n\nGenerate 5 replies, each a different variant (Short/Sentence/Playful/Humorous/Echo) of Khabirul's same core idea. Match his angle exactly. Don't add new ideas. Return the JSON array.`,
    };
  }

  if (connect) {
    return {
      lang: "en",
      mode: "connect",
      system: SYSTEM_PROMPT_EN + calibration,
      user: `${threadBlock}The post you are replying to:\n"""${tweetText}"""\n\n${buildConnectPrompt()}`,
    };
  }

  return {
    lang: "en",
    mode: "auto",
    system: SYSTEM_PROMPT_EN + calibration,
    user: `${threadBlock}The post you are replying to:\n"""${tweetText}"""\n\nGenerate 6 replies, each using a different pose (Concrete/Question/Counter/Personal/Playful/Humorous). Don't fabricate fake numbers or experiences. Return the JSON array.`,
  };
}

// Reasoning models spend completion tokens on a hidden chain of thought before
// they write anything. The first attempt gives them room for a short one; if
// they blow through it without answering, the retry turns thinking off
// outright, which these gateways accept under either of two switch names.
const CAP_DEFAULT = 2500;
const CAP_RETRY = 8000;
const THINKING_OFF = { enable_thinking: false, thinking: { type: "disabled" } };

async function callAnthropic(provider, apiKey, model, prompts) {
  const body = {
    model,
    max_tokens: CAP_DEFAULT,
    system: prompts.system,
    messages: [{ role: "user", content: prompts.user }],
  };
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.content?.find((c) => c.type === "text")?.text ?? "";
  if (!text.trim() && data?.stop_reason === "max_tokens") {
    throw new Error(
      `Model hit the ${CAP_DEFAULT}-token cap and never answered. Try a non-reasoning model.`
    );
  }
  return text;
}

async function getThinkingOff(model) {
  const { thinkingOff } = await chrome.storage.local.get("thinkingOff");
  return !!(thinkingOff || {})[model];
}

async function rememberThinkingOff(model) {
  const { thinkingOff } = await chrome.storage.local.get("thinkingOff");
  await chrome.storage.local.set({ thinkingOff: { ...(thinkingOff || {}), [model]: true } });
}

async function forgetThinkingOff(model) {
  const { thinkingOff } = await chrome.storage.local.get("thinkingOff");
  const next = { ...(thinkingOff || {}) };
  delete next[model];
  await chrome.storage.local.set({ thinkingOff: next });
}

async function chatAttempt(provider, apiKey, model, messages, cap, noThinking) {
  const body = {
    model,
    messages,
    ...(noThinking ? THINKING_OFF : {}),
    max_tokens: cap,
  };
  const post = () =>
    fetch(provider.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

  let res = await post();
  if (!res.ok) {
    let text = await res.text();
    // Newer OpenAI models (and gateways in front of them) want
    // max_completion_tokens instead; retry once rather than fail.
    if (res.status === 400 && /max_completion_tokens/.test(text)) {
      delete body.max_tokens;
      body.max_completion_tokens = cap;
      res = await post();
      if (!res.ok) text = await res.text();
    }
    if (!res.ok) return { httpError: { status: res.status, text } };
  }

  const data = await res.json();
  const choice = data?.choices?.[0] || {};
  const msg = choice.message || {};
  const content = typeof msg.content === "string" ? msg.content : "";
  // Some reasoning models (DeepSeek, Qwen, GLM via gateways) put everything in
  // reasoning_content and leave content empty when they run out of room.
  const reasoning =
    typeof msg.reasoning_content === "string"
      ? msg.reasoning_content
      : typeof msg.reasoning === "string"
        ? msg.reasoning
        : "";
  return {
    content,
    reasoning,
    truncated: !content.trim() && choice.finish_reason === "length",
  };
}

async function callOpenAICompat(provider, apiKey, model, prompts) {
  const messages = [
    { role: "system", content: prompts.system },
    { role: "user", content: prompts.user },
  ];
  const fail = (e) => {
    throw new Error(`API ${e.status}: ${e.text.slice(0, 300)}`);
  };

  // A model that needed thinking switched off before skips straight to it:
  // that path is several times faster and cheaper than letting it ramble.
  const knownReasoner = await getThinkingOff(model);
  let r = await chatAttempt(provider, apiKey, model, messages, knownReasoner ? CAP_RETRY : CAP_DEFAULT, knownReasoner);

  if (r.httpError && knownReasoner && r.httpError.status === 400) {
    // The gateway stopped accepting the switches; drop the memo and go plain.
    await forgetThinkingOff(model);
    r = await chatAttempt(provider, apiKey, model, messages, CAP_DEFAULT, false);
  }
  if (r.httpError) fail(r.httpError);

  if (r.truncated && !knownReasoner) {
    console.log("[TRH] model ran out of room while reasoning, retrying with thinking off");
    let usedSwitches = true;
    let retry = await chatAttempt(provider, apiKey, model, messages, CAP_RETRY, true);
    if (retry.httpError?.status === 400) {
      // Strict APIs reject the unknown switches; just give it more room.
      usedSwitches = false;
      retry = await chatAttempt(provider, apiKey, model, messages, CAP_RETRY, false);
    }
    if (retry.httpError) fail(retry.httpError);
    // Only worth remembering if the switches are what actually fixed it.
    if (usedSwitches && !retry.truncated && retry.content.trim()) {
      await rememberThinkingOff(model);
    }
    r = retry;
  }

  if (r.truncated) {
    throw new Error(
      `${model} kept reasoning past ${CAP_RETRY} tokens without answering. Try a non-reasoning model.`
    );
  }
  return r.content.trim() ? r.content : r.reasoning;
}

async function getConfig() {
  const stored = await chrome.storage.local.get([
    "provider",
    "keys",
    "models",
    "apiKey",
  ]);
  const providerId = stored.provider || "anthropic";
  const keys = stored.keys || {};
  const models = stored.models || {};

  let apiKey = keys[providerId];
  if (!apiKey && providerId === "anthropic" && stored.apiKey) {
    apiKey = stored.apiKey;
  }

  let provider = PROVIDERS[providerId];
  if (!provider && providerId.startsWith(CUSTOM_PREFIX)) {
    const custom = (await getCustomProviders()).find((c) => c.id === providerId);
    if (custom) provider = toProvider(custom);
  }
  if (!provider) {
    return { error: `Unknown provider: ${providerId}. Click the extension icon to pick one.` };
  }
  if (!provider.url) {
    return {
      error: `No base URL set for ${provider.name}. Click the extension icon to add one.`,
    };
  }
  if (!apiKey) {
    return {
      error: `No API key set for ${provider.name}. Click the extension icon to add one.`,
    };
  }
  const model = models[providerId] || provider.defaultModel;
  if (!model) {
    return {
      error: `No model set for ${provider.name}. Click the extension icon to add one.`,
    };
  }
  return { provider, apiKey, model };
}

// Models wrap the array in prose, in ```json fences, or (reasoning models)
// leave drafts of it mid-thought. Scan for the last balanced array that parses.
function extractReplyArray(raw) {
  const text = String(raw || "");
  const candidates = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "[") continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (esc) {
        esc = false;
        continue;
      }
      if (inStr) {
        if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          candidates.push(text.slice(i, j + 1));
          i = j;
          break;
        }
      }
    }
  }
  // Prefer the last complete array: a reasoning model's final answer comes
  // after its drafts.
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(candidates[i]);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

// Only uppercase a reply that actually starts with a lowercase letter. Looking
// for the first letter anywhere mangles the replies that open with a number,
// which the Concrete pose asks for: "6 months of nights" became "6 Months of
// nights". Leading quotes and brackets are stepped over so a quoted opener
// still gets capitalised.
function capitalizeFirstLetter(text) {
  const match = text.match(/^(\s*["'\u2018\u201c([]*\s*)([a-z])/);
  if (!match) return text;
  const [, prefix, letter] = match;
  return prefix + letter.toUpperCase() + text.slice(prefix.length + 1);
}

function normalizeReplies(list) {
  return list
    .map((r) => {
      if (typeof r === "string") {
        return { style: "Reply", text: capitalizeFirstLetter(r.trim()) };
      }
      if (!r || typeof r !== "object") return null;
      const text = r.text ?? r.reply ?? r.content ?? r.message ?? "";
      const style = r.style ?? r.pose ?? r.type ?? r.label ?? "Reply";
      return { style: String(style), text: capitalizeFirstLetter(String(text).trim()) };
    })
    .filter((r) => r && r.text);
}

async function generateReplies(tweetText, userIntent = "", thread = []) {
  console.log("[TRH] generateReplies called, tweet length:", tweetText.length, "intent length:", (userIntent || "").length, "thread tweets:", (thread || []).length);
  const cfg = await getConfig();
  if (cfg.error) {
    console.warn("[TRH] config error:", cfg.error);
    return { ok: false, error: cfg.error };
  }
  const prompts = await buildPrompts(tweetText, userIntent, thread);
  console.log("[TRH] using provider:", cfg.provider.name, "model:", cfg.model, "mode:", prompts.mode, "connect:", isConnectPost(tweetText));

  let raw;
  try {
    if (cfg.provider.type === "anthropic") {
      raw = await callAnthropic(cfg.provider, cfg.apiKey, cfg.model, prompts);
    } else {
      raw = await callOpenAICompat(cfg.provider, cfg.apiKey, cfg.model, prompts);
    }
  } catch (e) {
    console.error("[TRH] API call failed:", e);
    return { ok: false, error: e.message };
  }
  console.log("[TRH] raw response:", raw?.slice(0, 200));

  const parsed = extractReplyArray(raw);
  if (!parsed) {
    return {
      ok: false,
      error: `Model didn't return JSON. Got: ${raw?.slice(0, 120) || "(empty)"}`,
    };
  }

  const replies = normalizeReplies(parsed);
  if (!replies.length) {
    return { ok: false, error: "Model returned an empty reply list." };
  }

  return { ok: true, replies };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "generateReplies") {
    generateReplies(msg.tweetText || "", msg.userIntent || "", msg.thread || [])
      .then(sendResponse)
      .catch((e) => {
        console.error("[TRH] uncaught error:", e);
        sendResponse({ ok: false, error: `Unexpected: ${e?.message || e}` });
      });
    return true;
  }
  if (msg?.type === "getProviders") {
    listProviders()
      .then((providers) => sendResponse({ providers }))
      .catch((e) => {
        console.error("[TRH] listProviders failed:", e);
        sendResponse({ providers: [], error: e?.message || String(e) });
      });
    return true;
  }
  if (msg?.type === "replyPicked") {
    recordPick(msg.tweetText || "", msg.pickedText || "", msg.pickedStyle || "")
      .then(() => sendResponse({ ok: true }))
      .catch((e) => {
        console.error("[TRH] recordPick failed:", e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      });
    return true;
  }
});
