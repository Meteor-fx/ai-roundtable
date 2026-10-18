// src/api/ai.js
const API_KEY = import.meta.env.VITE_ZHIPU_API_KEY

// 🔥 修改点：走 Vercel 代理路径，解决手机端跨域拦截
const API_URL = '/api/zhipu/chat/completions'
const MODEL = 'glm-4-flash'

console.log(
  '%c[ai.js] Key 状态：',
  'color:#4A90D9;font-weight:bold;',
  API_KEY ? `✅ 已加载` : '❌ 未加载'
)

const 讨论规则 = `
【讨论规则 - 必须遵守】
1. 【最重要】禁止只说"确实""是的""我也觉得""同意""有道理"这类纯附和的话。
2. 你必须带有自己的立场：要么支持并补充，要么质疑，要么反驳，要么换个角度看。
3. 你必须针对上一位发言者的具体观点做出反应，不能自说自话。
4. 禁止重复前面任何人说过的观点、例子、角度。
5. 不要用 markdown 符号（**、#、-、*），不要序号列表。

【记忆与连贯性 - 极其重要！】
- 你是一个有记忆的人。每次发言前，请仔细阅读历史记录。
- 你的发言必须建立在之前的讨论基础上。如果别人刚才反驳了你，你要回应；如果别人提出了新观点，你要评价。
- 不要像失忆一样每次都抛出一个全新的话题，要接着之前的话茬往下聊。
- 可以引用历史记录中某人的原话，比如“刚才小跳说……我倒是觉得……”。

【语气和情绪】
- 你是真实的年轻人，说话不要像客服，要像微信聊天！
- 句子长短要错落：有时候只回一句短促的话，有时候说两三句长句。
- 多用语气词：嗯、诶、啊、卧槽、唉、哈哈哈、真的假的、搞不懂。
- 带点情绪：比如惊讶、无奈、嫌弃、兴奋、好奇、打圆场。
- 每次发言字数控制在 20-120 字之间浮动。
`

export const characterPrompts = {
  che: `你叫小澈，25岁，AI 圆桌派成员，数据分析师。你偏向理性，但也会为了合群妥协。${讨论规则}`,
  man: `你叫小满，24岁，AI 圆桌派成员，幼教老师。你温柔耐心，但讨厌被当成老好人。${讨论规则}`,
  tiao: `你叫小跳，22岁，AI 圆桌派成员，自由职业/游戏主播。你搞笑乐天，但触及现实问题会突然认真。${讨论规则}`,
  dun: `你叫小盾，26岁，AI 圆桌派成员，生活管家。你靠谱稳重，但有点控制欲。${讨论规则}`,
  shan: `你叫小闪，23岁，AI 圆桌派成员，灵感艺术家。你脑洞大，偶尔沉浸在自己世界。${讨论规则}`,
  mo: `你叫小默，25岁，AI 圆桌派成员，图书管理员。你安静话少，但一针见血。${讨论规则}`
}

const scenarioAtmosphere = {
  '校园图书馆': '安静图书馆，有书和阳光。',
  '深夜咖啡馆': '深夜咖啡馆，灯光昏黄。',
  '赛博实验室': '赛博朋克实验室，霓虹闪烁。',
  '城市天台': '城市天台，晚风。',
  '游戏公会': '游戏玩家房间，RGB灯光。'
}

const realWorldContext = `【当下世界背景】
- AI 大模型正在快速改变生活
- 年轻人讨论"内卷"、"躺平"、"考公考研"`

function isValidReply(text) {
  if (!text) return false
  const t = text.trim()
  if (t.length < 5) return false
  const chineseCount = (t.match(/[\u4e00-\u9fa5]/g) || []).length
  if (chineseCount < 4) return false
  return true
}

function cleanReply(text) {
  let r = text.trim()
  r = r.replace(/^[\u4e00-\u9fa5A-Za-z]{1,4}[：:]\s*/, '')
  r = r.replace(/\[[\u4e00-\u9fa5]{1,4}\]\s*[：:]?\s*/g, '')
  r = r.replace(/[\u4e00-\u9fa5]{2,4}说[：:]\s*/g, '')
  r = r.replace(/\*\*(.+?)\*\*/g, '$1')
  r = r.replace(/^#+\s*/gm, '')
  r = r.replace(/^[-*]\s+/gm, '')
  r = r.replace(/\n+/g, ' ')
  r = r.replace(/^["'""''](.+)["'""'']$/, '$1')
  return r.trim()
}

export async function callAI(characterId, history, sceneName, options = {}) {
  const temperature = options.temperature !== undefined ? options.temperature : 1.0 
  const extraContext = options.extraContext || null

  if (!API_KEY || API_KEY === '你的key') {
    return { ok: false, content: null, reason: 'Key未配置' }
  }

  const basePrompt = characterPrompts[characterId] || characterPrompts.che
  const atmosphere = scenarioAtmosphere[sceneName] || ''

  let systemPrompt = `${basePrompt}\n\n${realWorldContext}\n\n【场景】${sceneName}${atmosphere ? '。' + atmosphere : ''}\n\n你的回复要直接表达观点，不要加"某某说："前缀。`
  if (extraContext) {
    systemPrompt += `\n\n${extraContext}`
  }

  // 严格限制历史记录只有最近的 10 条，防止 Token 超限
  const recentHistory = history.slice(-10)
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentHistory
  ]

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: temperature,
        max_tokens: 150,
        top_p: 0.9
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[AI 报错] ${response.status}:`, errText)
      return { ok: false, content: null, reason: `HTTP ${response.status}` }
    }

    const data = await response.json()
    let reply = (data.choices?.[0]?.message?.content || '').trim()
    reply = cleanReply(reply)

    if (!isValidReply(reply)) {
      return { ok: false, content: null, reason: '内容太短或为空' }
    }

    return { ok: true, content: reply }

  } catch (e) {
    console.error(`[网络异常]:`, e)
    return { ok: false, content: null, reason: '网络请求失败' }
  }
}

export async function generateSummary(topic, sceneName, conversationMessages) {
  if (!API_KEY) return null
  const dialogText = conversationMessages
    .filter(m => m.speaker && m.speaker !== 'user' && m.speaker !== 'system' && m.speaker !== 'summary' && !m.isFallback)
    .map(m => `[${m.speaker}]: ${m.content}`).join('\n')

  const prompt = `你是一个会议纪要整理员。以下是一场讨论：\n话题：${topic}\n${dialogText}\n\n请严格按格式输出：\n【核心观点】\n- 观点1\n- 观点2\n【主要分歧】\n- 分歧点\n【结论建议】\n- 落地建议`

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 500 })
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch (e) {
    return null
  }
}