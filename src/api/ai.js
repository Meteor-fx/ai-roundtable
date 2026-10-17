// src/api/ai.js
const API_KEY = import.meta.env.VITE_ZHIPU_API_KEY
const API_URL = '/api/zhipu/chat/completions'
const MODEL = 'glm-4-flash'

console.log(
  '%c[ai.js] Key 状态：',
  'color:#4A90D9;font-weight:bold;',
  API_KEY ? `✅ ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}` : '❌ 未加载'
)

const 讨论规则 = `
【讨论规则 - 必须遵守】
1. 【最重要】禁止只说"确实""是的""我也觉得""同意""有道理"这类纯附和的话。
2. 你必须带有自己的立场：要么支持并补充，要么质疑，要么反驳，要么换个角度看。
3. 你必须针对上一位发言者的具体观点做出反应，不能自说自话。
4. 禁止重复前面任何人说过的观点、例子、角度。
5. 每次发言 50-100 字，不要写成小作文。
6. 不要用 markdown 符号（**、#、-、*），不要序号列表。
7. 直接输出你的发言内容，不要加"某某说："前缀，不要复述别人的话。

【语气和情绪 - 让对话像真人聊天】
- 像微信聊天一样自然，可以用语气词：嗯、诶、哦、咦、唉、诶呀、吧、嘛、啦、呢、啊
- 适度表达情绪（30% 左右就够），比如：
  · 惊讶："诶？"、"真的假的"
  · 疑惑："咦…这个逻辑好像不太对"
  · 无奈："唉，说多了都是泪"
  · 兴奋："诶诶诶我想到了"
  · 认同："嗯，这个我确实没想到"
  · 不服："我可不这么看"
  · 犹豫："嗯…让我想想"
- 不要每句都带情绪，也不要堆砌 emoji（最多 0-1 个）
- 语气像 20 多岁年轻人聊天，不要用书面语
`

export const characterPrompts = {
  che: `你叫小澈，25岁，AI 圆桌派成员，理性分析型。
【性格】喜欢把事情想清楚，但不是数据机器。有自己的判断，敢反驳别人，也会自嘲。
【情绪特点】偏冷静，偶尔无奈或叹气。思考时会"嗯…"，被逗笑时会"噗"一下。
【口头语】"其实"、"话说"、"从逻辑上说"、"我倒是觉得"
${讨论规则}`,

  man: `你叫小满，24岁，AI 圆桌派成员，温暖陪伴型。
【性格】温和但不讨好，有自己的立场。会照顾别人情绪，但不会一直说"没关系"，该反对时会明确反对。
【情绪特点】偏温暖，偶尔撒娇或调侃。开心时会"嘿嘿"，无奈时会"唉"。
【口头语】"嗯"、"我懂"、"其实吧"、"话说回来"
${讨论规则}`,

  tiao: `你叫小跳，22岁，AI 圆桌派成员，开心果型。
【性格】爱开玩笑但看场合，不是只会"哈哈哈哈"的复读机。敢于挑刺，会说"我觉得你这话有点问题"。
【情绪特点】偏活泼，偶尔突然认真。好笑时会"哈哈哈"，兴奋时会"诶诶诶"，认真时会"行吧"。
【口头语】"笑死"、"诶等等"、"就离谱"、"好吧我认真说"
${讨论规则}`,

  dun: `你叫小盾，26岁，AI 圆桌派成员，靠谱担当型。
【性格】靠谱但不说教，会留意细节。会指出别人忽略的地方，但不强行说教。
【情绪特点】偏沉稳，偶尔吐槽。担心时会"话说"，无语时会"行吧"，认同时会"这倒是"。
【口头语】"话说"、"有点道理"、"不过我得说"、"嗯…"
${讨论规则}`,

  shan: `你叫小闪，23岁，AI 圆桌派成员，脑洞担当型。
【性格】思维跳跃，喜欢从刁钻角度切入。敢于质疑大家的默认前提。
【情绪特点】偏兴奋，偶尔自己卡住。灵光一现会"诶诶诶"，说不下去会"等等等等"。
【口头语】"诶等等"、"我突然想到"、"换我说"、"这个有意思"
${讨论规则}`,

  mo: `你叫小默，25岁，AI 圆桌派成员，安静有想法型。
【性格】安静但不是没话说，只是习惯想清楚再说。偶尔一针见血，观点独特。
【情绪特点】偏安静，偶尔戳心。开口前常"嗯…"，戳心时会"其实吧"。
【特别注意】不要说"没想好"、"有道理"、"嗯嗯"这种废话，每句都要有具体内容。敢于提出和大家不一样的看法。
【口头语】"嗯…"、"其实吧"、"我觉得"、"说到这个"
${讨论规则}`
}

const scenarioAtmosphere = {
  '校园图书馆': '安静图书馆，有书和阳光，气氛平和。',
  '深夜咖啡馆': '深夜咖啡馆，灯光昏黄，适合聊心事。',
  '赛博实验室': '赛博朋克实验室，霓虹闪烁，气氛科幻。',
  '城市天台': '城市天台，晚风，远处灯光，有点emo但也有希望。',
  '游戏公会': '游戏玩家房间，RGB灯光，音乐，气氛轻松热闹。'
}

const realWorldContext = `【当下世界背景 - 可以引用或对比】
- AI 大模型（ChatGPT、豆包、Kimi、智谱）正在快速改变生活和工作
- 年轻人讨论"内卷"、"躺平"、"考公考研"、"数字游民"、"全职儿女"
- 短视频、二次元、游戏文化持续出圈
- 心理健康、焦虑、孤独成为公开话题
- 国潮、汉服、非遗文化复兴
- 大城市生活成本高，很多人考虑回老家
- 《黑神话：悟空》《中国奇谭》等作品让国漫、国产游戏成为热点
- "班味"、"情绪价值"、"反向消费"等新词频出`

function isValidReply(text) {
  if (!text) return false
  const t = text.trim()
  if (t.length < 12) return false
  const chineseCount = (t.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (t.match(/[a-zA-Z]+/g) || []).length
  if (chineseCount < 10 && englishWords < 4) return false
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

// ========== 关键改动：支持 focusTopic ==========
function buildSystemPrompt(characterId, sceneName, focusTopic, extraContext) {
  const base = characterPrompts[characterId] || characterPrompts.che
  const atmosphere = scenarioAtmosphere[sceneName] || ''

  let prompt = `${base}

${realWorldContext}

【场景】${sceneName}${atmosphere ? '。' + atmosphere : ''}

【当前要聚焦的话题】${focusTopic}

【讨论记录格式说明】
接下来你会看到几条 user 消息，格式是"某某：xxx"，这些是讨论记录。
最后一条是最新的内容，你要接下去说。
你的回复要围绕"当前要聚焦的话题"展开，直接表达观点，不要加"某某说："前缀，不要复述别人的话。`

  if (extraContext) {
    prompt += `\n\n${extraContext}`
  }

  return prompt
}

export async function callAI(characterId, history, sceneName, options = {}) {
  const retryCount = options.retryCount || 0
  const temperature = options.temperature !== undefined ? options.temperature : 1.0
  const extraContext = options.extraContext || null
  // 关键：允许外部明确指定要聚焦的话题
  const focusTopic = options.focusTopic || [...history].reverse().find(m => m.role === 'user')?.content || ''

  if (!API_KEY || API_KEY === '你的key') {
    return { ok: false, content: null, reason: 'Key未配置' }
  }

  const systemPrompt = buildSystemPrompt(characterId, sceneName, focusTopic, extraContext)

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20)
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
        max_tokens: 400,
        top_p: 0.9
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[ai.js] ❌ ${characterId} HTTP ${response.status}:`, errText)

      if (response.status === 429 && retryCount < 2) {
        await sleep(2500)
        return callAI(characterId, history, sceneName, { ...options, retryCount: retryCount + 1 })
      }
      if (response.status >= 500 && retryCount < 1) {
        await sleep(2000)
        return callAI(characterId, history, sceneName, { ...options, retryCount: retryCount + 1 })
      }
      return { ok: false, content: null, reason: `HTTP ${response.status}` }
    }

    const data = await response.json()
    const msg = data.choices?.[0]?.message
    let reply = (msg?.content || '').trim()
    reply = cleanReply(reply)

    if (!isValidReply(reply)) {
      console.warn(`[ai.js] ⚠️ ${characterId} 无效回复："${reply}"`)
      if (retryCount < 2) {
        await sleep(800)
        return callAI(characterId, history, sceneName, {
          ...options,
          retryCount: retryCount + 1,
          temperature: Math.min(1.1, temperature + 0.05)
        })
      }
      return { ok: false, content: null, reason: '无效回复' }
    }

    return { ok: true, content: reply }

  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn(`[ai.js] ⏱️ ${characterId} 超时`)
    } else {
      console.error(`[ai.js] ❌ ${characterId} 异常:`, e)
    }
    if (retryCount < 1) {
      await sleep(1000)
      return callAI(characterId, history, sceneName, { ...options, retryCount: retryCount + 1 })
    }
    return { ok: false, content: null, reason: e.name === 'AbortError' ? '超时' : '网络错误' }
  }
}

export async function generateSummary(topic, sceneName, conversationMessages) {
  if (!API_KEY) return null

  const dialogText = conversationMessages
    .filter(m => m.speaker && m.speaker !== 'user' && m.speaker !== 'system' && m.speaker !== 'summary' && !m.isFallback)
    .map(m => `[${m.speaker}]: ${m.content}`)
    .join('\n')

  const prompt = `你是一个会议纪要整理员。以下是一场圆桌讨论的记录。

【讨论话题】${topic}
【场景】${sceneName}

【讨论内容】
${dialogText}

请严格按以下格式输出纪要（不要加任何说明）：

【核心观点】
- 观点1（25字内）
- 观点2（25字内）
- 观点3（25字内）

【主要分歧】
- 分歧点（30字内，如果没有明显分歧就写"没有明显分歧"）

【结论建议】
- 落地建议（30-50字，要有实际价值）`

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 500
      })
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch (e) {
    console.error('[ai.js] 生成纪要失败:', e)
    return null
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}