# X (Twitter) Reply Helper

A Chrome extension that drafts reply ideas for the tweet you are replying to,
using whichever LLM provider you point it at. Click into a reply box on x.com, a
panel appears with five replies in different styles, and clicking one drops it
into the composer.

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
| 智谱 GLM | `glm-4-flash` | [open.bigmodel.cn](https://open.bigmodel.cn/usercenter/apikeys) |

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
2. The panel opens and generates five replies, each in a different style
   (Concrete, Question, Counter, Personal, Playful).
3. Click a reply to insert it into the composer, then edit it as you like.
4. **Regenerate** gets a fresh set; **Esc** or clicking away closes the panel.

### Saying what you actually mean

Type your own angle into the box at the top of the panel and press **Enter**
(Shift+Enter for a newline). This switches to rewrite mode: instead of inventing
five takes of its own, the model returns four phrasings of *your* idea — Short,
Sentence, Playful and Echo — without adding opinions you did not ask for. You
can write the note in Chinese or English regardless of the reply language.

The reply language follows the tweet, so Chinese tweets get Chinese replies and
English tweets get English ones. Once you have picked about three replies, the
extension starts feeding your recent picks back into the prompt so later
suggestions drift toward how you actually write.

### A note on voice

The built-in prompts are tuned to the original author's voice, down to naming
her in the instructions. They produce casual, short, low-key replies. If you
want a different register, edit `SYSTEM_PROMPT_EN` and friends in
`background.js`.

## Notes on reasoning models

Reasoning models (DeepSeek, Qwen, GLM and friends) spend output tokens thinking
before they write, and how much varies a lot from one call to the next. If a
model burns its whole budget without answering, the extension automatically
retries with thinking switched off, then remembers that the model needs it and
takes the fast path from then on — typically around 3 seconds instead of 10.

If a model still fails to answer, switch to a non-reasoning one in the popup.

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

Originally made by [@kellyyuweipeng](https://x.com/kellyyuweipeng).
