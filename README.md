# X (Twitter) Reply Helper

A Chrome extension that drafts reply ideas for the tweet you are replying to,
using whichever LLM provider you point it at. Click into a reply box on x.com, a
panel appears with six replies in different styles, and clicking one drops it
into the composer.
Replies use easy, everyday words and short, simple sentences.

Works with Anthropic, OpenAI, and any OpenAI-compatible gateway (Token Harbor,
OpenRouter, LiteLLM, Ollama, vLLM, and so on). Your API key is stored locally in
the browser and is sent only to the provider you choose.

## Install

The extension is not on the Chrome Web Store, so load it unpacked:

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Pin the extension if you want quick access to its settings.

## Set up a provider

Click the extension icon, pick a provider, paste your API key, and hit **Save**.
Leave **Model** blank to use the default.

| Provider | Default model | Where to get a key |
| --- | --- | --- |
| Anthropic (Claude) | `claude-haiku-4-5` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| OpenAI | `gpt-4o-mini` | [platform.openai.com](https://platform.openai.com/api-keys) |
| Kimi (Moonshot) | `moonshot-v1-8k` | [platform.moonshot.cn](https://platform.moonshot.cn/console/api-keys) |
| Token Harbor | `deepseek-v4.1-flash:free` | [tokenharbor.ai](https://tokenharbor.ai) |
| Zhipu GLM | `glm-4-flash` | [open.bigmodel.cn](https://open.bigmodel.cn/usercenter/apikeys) |

Each provider keeps its own key and model, so you can switch between them freely.

### Custom endpoints

For anything not in the list, choose **+ Add custom provider…** and fill in:

- **Name** — optional label; defaults to the hostname.
- **Base URL** — `https://your-gateway.example/v1`, or the full endpoint URL.
  Local servers such as `http://localhost:11434/v1` work too.
- **API format** — OpenAI-compatible (`/chat/completions`) or
  Anthropic-compatible (`/messages`).
- **API Key** and **Model** — both required for custom providers.

The base URL is normalised for you, so a bare host, a `/v1` base, or a complete
endpoint all resolve correctly. On save, Chrome asks for permission to reach
that host; if you decline, generation will fail until you allow it under
`chrome://extensions` → **Details** → **Site access**.

## Usage

1. Click **Reply** on any tweet.
2. The panel opens and shows which post it is answering — `Replying to @handle`
   plus the first lines of that post, so a wrong target is obvious before you
   use anything it suggests. It follows whichever X theme you are in: light,
   dim or lights-out.
3. It generates six replies, each in a different style (Concrete, Question,
   Counter, Personal, Playful, Humorous). Playful stays light and fun. Humorous
   gives you a clear joke based on a specific detail in the post.
4. Click a reply to insert it into the composer, then edit it as you like.
5. **Regenerate** gets a fresh set; **Esc** or clicking away closes the panel.

### Threads

Replies are written against the conversation, not just the one post. The panel
reads the tweets above the one you are answering — up to four of them, oldest
dropped first if they run long — and passes them as background. The header shows
`+2 earlier in thread` when it is using them.

This matters most for short replies that mean nothing alone. Answering "honestly
same, took us three tries" on its own produces generic lines about third
attempts; with the thread above it, the replies know the argument is about a
billing rewrite.

The post being answered is found by document order within the reply dialog,
not by which text happens to sit nearest on screen. That is what keeps it from
picking up a quoted post, a tweet from the timeline behind the modal, or the
post above an image-only one.

### Posts asking you to connect

When a post is an invitation rather than an argument — "let's connect", "drop
what you're building", "comment and I'll follow back" — the replies change
shape. Three are plain, short ways of saying you'd like to connect, each worded
differently, and two pair one short question with the connect line. No take on
the topic, no pitch.

The wording is dealt out from a pool in `background.js` rather than left to the
model, which otherwise opened every set with "Would love to connect". One reply
also addresses the poster by first name when their display name yields a usable
one, and at least one picks up something specific from the post — a group they
listed, a word they used — so the set does not read like a template.

Heavy posts (grief, illness, a layoff, a company closing) drop the joke slots
entirely: those replies come back labelled **Warm** instead of Playful or
Humorous, so the label always matches what was actually written.

### Saying what you actually mean

Type your own angle into the box at the top of the panel and press **Enter**
(Shift+Enter for a newline). This switches to rewrite mode: instead of inventing
six takes of its own, the model returns five phrasings of *your* idea — Short,
Sentence, Playful, Humorous and Echo — without adding opinions you did not ask
for.

Replies are always in English, whatever language the post is in. Once you have
picked about three replies, the extension starts feeding your recent picks back
into the prompt so later suggestions drift toward how you actually write.

### Emojis

Replies can carry an emoji, but the prompts keep it on a short leash: at most
one per reply, typically on the playful line, and only when the tweet is light,
funny or worth celebrating. On heavy tweets — layoffs, illness, a company
closing — the model is told to use none at all. Hype decoration
(🚀🔥💯✨🙌) is banned outright; the ones that
get through are small and dry (😂 😅 🥹 👀).

In practice that works out to about one emoji across the suggestions for a
light tweet, and zero for a serious one.

### Keyboard

| Key | Does |
| --- | --- |
| `1`–`6` | Insert that reply (only while the composer is empty, so typing a digit still types a digit) |
| `Enter` | Rewrite in your own words, from the intent box |
| `⌘`/`Ctrl` + `Enter` | Regenerate |
| `Esc` | Close the panel |

Each card also has a copy button, for when you want the text somewhere else.

### A note on voice

The prompts are written around Khabirul as the person replying, and they
produce casual, short, low-key replies. The sample replies used as voice anchors
in `SYSTEM_PROMPT_EN` are still the original author's, so swap them for your own
if you want a closer match — or just use the extension for a while and let the
pick history calibrate it. For a different register altogether, edit
`SYSTEM_PROMPT_EN` and friends in `background.js`.

## Notes on reasoning models

Reasoning models (DeepSeek, Qwen, GLM and friends) spend output tokens thinking
before they write, and how much varies a lot from one call to the next. If a
model burns its whole budget without answering, the extension automatically
retries with thinking switched off, then remembers that the model needs it and
takes the fast path from then on — typically around 3 seconds instead of 10.

If a model still fails to answer, switch to a non-reasoning one in the popup.

## Known limits

Image- and video-only posts have no text to read. The panel says so and names
the poster rather than quietly answering the post above it; type your own angle
in the box and press Enter to get replies anyway.

## Troubleshooting

Logs are written to the service worker console, not the page console: open
`chrome://extensions` and click **service worker** under this extension.
Everything it logs is prefixed `[TRH]`, including the provider and model it
resolved and the start of the raw model response.

After reloading the extension, refresh any open x.com tabs — the content script
stays attached to the old version until the page reloads.

## Files

| File | What it does |
| --- | --- |
| `manifest.json` | Extension manifest (MV3), permissions |
| `background.js` | Service worker: prompts, provider calls, response parsing |
| `content.js` | Panel UI on x.com and composer insertion |
| `content.css` | Panel styles |
| `popup.html` / `popup.js` | Settings: provider, key, model, custom endpoints |

## Privacy

API keys live in `chrome.storage.local` on your machine. The tweet text and your
optional intent note are sent to the provider you configure, and nowhere else.
There is no analytics or telemetry of any kind.

## Credits

Maintained by [@kbtonmoy](https://x.com/kbtonmoy).

Originally made by [@kellyyuweipeng](https://x.com/kellyyuweipeng) as
X (Twitter) Reply Helper v0.4.0; this fork reworked provider support, reply
targeting, thread context and the panel UI.
