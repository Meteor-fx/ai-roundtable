<template>
  <div class="app" @mousemove="onMousemove" @click="onClick">
    <div class="scene-bg" :style="{ backgroundImage: `url(${currentScenario.bgImage})` }"></div>
    <div class="scene-veil" :class="ambienceMode"></div>

    <header class="topbar">
      <div class="top-left">
        <button class="menu-btn" @click.stop="menuOpen = !menuOpen">
          <span></span><span></span><span></span>
        </button>
        <div class="brand">
          <span>🎙️</span>
          <span class="brand-text">AI 圆桌派</span>
        </div>
        <div class="ambience-switch">
          <button :class="{ active: ambienceMode === 'quiet' }" @click.stop="ambienceMode = 'quiet'">🌙 静谧</button>
          <button :class="{ active: ambienceMode === 'lively' }" @click.stop="ambienceMode = 'lively'">🔥 热闹</button>
        </div>
      </div>
      <div class="top-right">
        <div class="info-pill" v-if="visitor"><span>🚪</span><span>{{ visitor }}</span></div>
        <div class="info-pill"><span class="dot" :class="apiStatus"></span><span>{{ apiStatusText }}</span></div>
        <div class="info-pill"><span>🕐</span><span>{{ currentTime }}</span></div>
      </div>
    </header>

    <div class="scenario-rail">
      <div v-for="(sc, key) in scenarios" :key="key"
           class="scenario-item"
           :class="{ active: currentScenarioKey === key }"
           :style="currentScenarioKey === key ? { borderColor: sc.accent, boxShadow: `0 0 20px ${sc.accent}55` } : {}"
           @click.stop="switchScenario(key)">
        <span class="sc-icon">{{ sc.icon }}</span>
        <span class="sc-name">{{ sc.name }}</span>
      </div>
    </div>

    <div class="stage">
      <div class="center-halo" :style="{ background: `radial-gradient(circle, ${currentScenario.accent}22, transparent 70%)` }"></div>

      <transition name="visitor-enter">
        <div 
          v-if="incomingVisitor" 
          class="incoming-visitor"
          :style="{ '--visitor-color': incomingVisitor.color }"
        >
          <div class="visitor-bubble" v-if="visitorBubble">{{ visitorBubble }}</div>
          <img :src="incomingVisitor.avatar" class="visitor-avatar" />
          <div class="visitor-name" :style="{ background: incomingVisitor.color }">
            {{ incomingVisitor.name }} · 来访
          </div>
        </div>
      </transition>

      <div v-for="char in characters" :key="char.id"
           class="paper-doll"
           :class="dollClass(char.id)"
           :style="dollStyle(char.id)"
           @click.stop="handleDollClick(char)">
        <div class="doll-shadow"></div>
        <img :src="char.avatar" :alt="char.name" class="doll-img" />
        <div class="doll-tag" :style="{ background: char.color }">{{ char.name }}</div>
        <transition name="emote">
          <div v-if="emoteBubbles[char.id]" class="emote-bubble">{{ emoteBubbles[char.id] }}</div>
        </transition>
        <transition name="pop">
          <div v-if="typingId === char.id" class="doll-bubble">
            <span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>
          </div>
        </transition>
        <transition name="pop">
          <div v-if="dollBubbles[char.id]" class="doll-bubble last">{{ dollBubbles[char.id] }}</div>
        </transition>
      </div>
    </div>

    <!-- 聊天抽屉：比全透明稍微暗一点，保证阅读体验的磨砂玻璃 -->
    <div class="chat-drawer" :style="{ height: chatHeight + 'vh' }">
      <div class="drawer-handle" @click.stop="drawerExpanded = !drawerExpanded">
        <div class="handle-bar"></div>
      </div>

      <div class="chat-head">
        <div class="chat-title">
          <span class="hash">#</span>
          <span>{{ currentScenario.name }}</span>
          <span v-if="topic" class="topic-label">· {{ topic }}</span>
        </div>
        <div class="chat-stats">
          <span class="stat" v-if="messages.length > 0">💬 {{ messages.length }}</span>
          <span class="stat" v-if="isDiscussing">第 {{ currentRound }}/{{ totalRounds }} 轮</span>
          <span class="mode-tag" :class="ambienceMode">{{ ambienceMode === 'quiet' ? '🌙' : '🔥' }}</span>
        </div>
      </div>

      <div class="discuss-bar" v-if="isDiscussing">
        <span class="discuss-status">
          <span class="pulse-dot" :class="{ paused: isPaused }"></span>
          {{ isPaused ? '已暂停' : discussPhase }}
        </span>
        <button class="bar-btn" @click.stop="togglePause">
          {{ isPaused ? '▶ 继续' : '⏸ 暂停' }}
        </button>
        <button class="bar-btn stop" @click.stop="stopDiscussion">⏹ 结束</button>
      </div>

      <div class="chat-scroll" ref="chatArea">
        <div v-if="messages.length === 0" class="empty">
          <div class="empty-emoji">💬</div>
          <div class="empty-title">开始一场对话吧</div>
          <div class="empty-tip">点击下方"发起"按钮，或直接打字</div>
        </div>

        <template v-for="(msg, index) in messages" :key="index">
          <div v-if="msg.speaker === 'system'" class="sys-row"><span>{{ msg.content }}</span></div>
          <div v-else-if="msg.speaker === 'summary'" class="summary-card">
            <div class="summary-head">📋 圆桌纪要</div>
            <pre class="summary-body">{{ msg.content }}</pre>
          </div>
          <!-- 访客名字和头像修复 -->
          <div v-else-if="msg.speaker !== 'user'" class="msg-row left">
            <div class="avatar-wrapper">
              <img :src="msg.isVisitor ? msg.speakerAvatar : getAvatar(msg.speaker)" class="avatar" @click.stop="mentionCharacter(getChar(msg.speaker))" />
              <div v-if="msg.isVisitor" class="visitor-badge">来访</div>
            </div>
            <div class="msg-main">
              <div class="nick" :style="{ color: msg.isVisitor ? msg.speakerColor : getColor(msg.speaker) }">
                {{ msg.isVisitor ? msg.speakerName : getName(msg.speaker) }}
                <span v-if="msg.isVisitor" class="visitor-tag">🚪 访客</span>
              </div>
              <div class="bubble ai" :class="{ 'bubble-muted': msg.isFallback, 'visitor-bubble-style': msg.isVisitor }">
                {{ msg.content }}
              </div>
            </div>
          </div>
          <div v-else class="msg-row right">
            <div class="msg-main">
              <div class="nick user">我</div>
              <div class="bubble user">{{ msg.content }}</div>
            </div>
            <div class="avatar user-avatar">😎</div>
          </div>
        </template>

        <!-- 访客打字状态 -->
        <div v-if="typingId" class="msg-row left">
          <div class="avatar-wrapper">
            <img :src="typingId === 'visitor' ? incomingVisitor?.avatar : getAvatar(typingId)" class="avatar" />
            <div v-if="isVisitorTyping" class="visitor-badge">来访</div>
          </div>
          <div class="msg-main">
            <div class="nick" :style="{ color: typingId === 'visitor' ? incomingVisitor?.color : getColor(typingId) }">
              {{ typingId === 'visitor' ? incomingVisitor?.name : getName(typingId) }}
              <span v-if="isVisitorTyping" class="visitor-tag">🚪 访客</span>
            </div>
            <div class="bubble ai typing" :class="{ 'visitor-bubble-style': isVisitorTyping }">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <div class="input-bar">
        <div class="mention-pill" v-if="userMention">
          @{{ userMention.name }}
          <span class="x" @click.stop="userMention = null; mentionedCharId = ''">×</span>
        </div>
        <div class="input-row">
          <!-- 输入法回车修复 -->
          <input v-model="userMessage" class="chat-input"
                 :placeholder="inputPlaceholder"
                 @keydown.enter="onEnter"
                 @focus="onInputFocus" />
          <button class="send-btn" @click.stop="userSpeak" :disabled="!userMessage.trim()">
            {{ isDiscussing ? '插话' : '发送' }}
          </button>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <button class="tool-btn" @click.stop="greetUser"><span class="ti">👋</span><span class="tl">打招呼</span></button>
      <button class="tool-btn" @click.stop="openPanel('setup')"><span class="ti">🎬</span><span class="tl">发起</span></button>
      <button class="tool-btn" @click.stop="visitNeighbor"><span class="ti">🚪</span><span class="tl">串门</span></button>
      <button class="tool-btn" @click.stop="openPanel('hotsearch')"><span class="ti">🔥</span><span class="tl">热搜</span></button>
      <button class="tool-btn" @click.stop="openPanel('profiles')"><span class="ti">👥</span><span class="tl">角色</span></button>
      <button class="tool-btn" @click.stop="openPanel('stats')"><span class="ti">📊</span><span class="tl">数据</span></button>
      <button class="tool-btn" @click.stop="openPanel('history')"><span class="ti">📜</span><span class="tl">历史</span></button>
      <button class="tool-btn" @click.stop="openPanel('about')"><span class="ti">ℹ️</span><span class="tl">关于</span></button>
    </div>

    <transition name="ach">
      <div class="ach-toast" v-if="recentAchievement">🏆 {{ recentAchievement }}</div>
    </transition>

    <div class="mask" :class="{ show: menuOpen || activeTab !== 'chat' }" @click="closeAllLayers"></div>

    <aside class="side-menu" :class="{ open: menuOpen }" @click.stop>
      <div class="menu-head">
        <div class="menu-title">🎙️ AI 圆桌派</div>
        <button class="close-btn" @click="menuOpen = false">×</button>
      </div>
      <nav class="menu-nav">
        <button v-for="item in navItems" :key="item.id"
                :class="{ active: activeTab === item.id }"
                @click="openPanel(item.id)">
          <span>{{ item.icon }}</span>{{ item.label }}
        </button>
      </nav>
      <div class="menu-foot">
        <div><span>AI 调用</span><b>{{ apiCallCount }}</b></div>
        <div><span>历史场次</span><b>{{ discussionHistory.length }}</b></div>
      </div>
    </aside>

    <aside class="panel-drawer" :class="{ open: activeTab !== 'chat' }" @click.stop>
      <div class="panel-head">
        <h2>{{ panelTitle }}</h2>
        <button class="back-btn" @click="activeTab = 'chat'"><span>←</span> 返回聊天</button>
      </div>
      <div class="panel-body">
        <div v-if="activeTab === 'setup'">
          <section>
            <h3>📍 场景</h3>
            <div class="scene-picker">
              <div v-for="(sc, key) in scenarios" :key="key"
                   class="scene-chip" :class="{ active: currentScenarioKey === key }"
                   :style="currentScenarioKey === key ? { borderColor: sc.accent, background: sc.accent + '22' } : {}"
                   @click="switchScenario(key)">
                <span>{{ sc.icon }}</span> {{ sc.name }}
              </div>
            </div>
          </section>
          <section>
            <h3>💬 话题</h3>
            <input v-model="topic" class="drawer-input" :placeholder="'试试：' + rotatingTopic" @keyup.enter="startDiscussion" />
            <div class="topic-chips">
              <button v-for="(t, i) in currentScenario.topics" :key="i" @click="topic = t">{{ t }}</button>
            </div>
          </section>
          <section>
            <h3>⏱️ 讨论轮数</h3>
            <div class="round-picker">
              <button v-for="n in [15, 30, 50, 80]" :key="n" :class="{ active: totalRounds === n }" @click="totalRounds = n">{{ n }} 轮</button>
            </div>
            <p class="hint">1 轮 = 3 人发言，30 轮大约 10-12 分钟</p>
          </section>
          <div class="actions">
            <button class="big-btn" :style="{ background: `linear-gradient(135deg, ${currentScenario.accent}, ${currentScenario.accent2})` }"
                    @click="startDiscussion" :disabled="isDiscussing">
              🚀 开始讨论
            </button>
          </div>
        </div>

        <!-- 热搜换一换 -->
        <div v-if="activeTab === 'hotsearch'">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 14px; color: #aaa;">实时热议</h3>
            <button class="mini" style="background: #4A90D9;" @click="refreshHotSearch">🔄 换一换</button>
          </div>
          <div class="hot-list">
            <div v-for="(item, index) in hotSearchList" :key="index" class="hot-item" @click="discussHotSearch(item)">
              <span class="rank" :class="{ top3: index < 3 }">{{ index + 1 }}</span>
              <span class="htitle">{{ item.title }}</span>
              <span class="tag" :style="{ background: item.tagColor + '33', color: item.tagColor }">{{ item.tag }}</span>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'profiles'">
          <div class="profile-grid">
            <div v-for="char in characters" :key="char.id" class="profile-card" :style="{ borderColor: char.color }">
              <img :src="char.avatar" />
              <div class="pname" :style="{ color: char.color }">{{ char.name }}</div>
              <div class="prole">{{ char.personality }}</div>
              <p>{{ char.description }}</p>
              <button class="mini" :style="{ background: char.color }" @click="startPrivateChat(char)">单独聊 →</button>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'stats'">
          <div class="stats-grid">
            <div class="stat-cell"><b>{{ messages.length }}</b><span>消息</span></div>
            <div class="stat-cell"><b>{{ apiCallCount }}</b><span>AI 调用</span></div>
            <div class="stat-cell"><b>{{ discussionHistory.length }}</b><span>历史场次</span></div>
            <div class="stat-cell"><b>{{ characters.filter(c => c.emotion > 50).length }}</b><span>高情绪角色</span></div>
          </div>
        </div>

        <div v-if="activeTab === 'history'">
          <div v-if="discussionHistory.length === 0" class="empty-tip">暂无记录</div>
          <div v-else class="history-list">
            <div v-for="(h, i) in discussionHistory" :key="i" class="history-card">
              <div class="hhead"><span>{{ h.sceneIcon }} {{ h.sceneName }}</span><span>{{ h.time }}</span></div>
              <h3>{{ h.topic }}</h3>
              <p>{{ h.preview }}</p>
              <div class="hactions">
                <button @click="loadHistory(h)">📂 载入</button>
                <button @click="deleteHistory(i)">🗑 删除</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'about'">
          <div class="about">
            <h3>🎙️ AI 圆桌派 · 邻里</h3>
            <p>基于真实大模型的多智能体聊天室。</p>
            <h4>✨ 亮点</h4>
            <ul>
              <li>真实 AI 调用（智谱 GLM-4-Flash）</li>
              <li>讨论链引擎：每轮 3 人交锋</li>
              <li>6 种立场强制分配，不会只附和</li>
              <li>12 种讨论角度轮换，拒绝炒冷饭</li>
              <li>20 条现实热点注入</li>
              <li>随时可以插话，AI 会立即回应你</li>
              <li>跨设备串门：有角色互访、欢迎、带回见闻</li>
              <li>自动生成圆桌纪要</li>
            </ul>
            <p class="esc-tip">💡 按 ESC 可关闭弹层</p>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { callAI, generateSummary } from '@/api/ai.js'

import cheImg from '@/assets/characters/che/main.png'
import manImg from '@/assets/characters/man/main.png'
import tiaoImg from '@/assets/characters/tiao/main.png'
import dunImg from '@/assets/characters/dun/main.png'
import shanImg from '@/assets/characters/shan/main.png'
import moImg from '@/assets/characters/mo/main.png'

import campusBg from '@/assets/scenes/campus.png'
import cafeBg from '@/assets/scenes/cafe.png'
import cyberBg from '@/assets/scenes/cyber.png'
import rooftopBg from '@/assets/scenes/rooftop.png'
import arcadeBg from '@/assets/scenes/arcade.png'

const navItems = [
  { id: 'setup', icon: '🎬', label: '发起讨论' },
  { id: 'hotsearch', icon: '🔥', label: '热搜榜' },
  { id: 'profiles', icon: '👥', label: '角色档案' },
  { id: 'stats', icon: '📊', label: '数据面板' },
  { id: 'history', icon: '📜', label: '历史记录' },
  { id: 'about', icon: 'ℹ️', label: '关于' }
]
const panelTitles = {
  setup: '🎬 发起讨论', hotsearch: '🔥 热搜榜', profiles: '👥 角色档案',
  stats: '📊 数据面板', history: '📜 历史记录', about: 'ℹ️ 关于'
}

const scenarios = {
  campus: {
    name: '校园图书馆', icon: '📚', bgImage: campusBg, accent: '#4A90D9', accent2: '#6BCB77',
    keywords: ['学习','考试','作业','大学','考研','专业','成绩','毕业','论文','熬夜','早八','室友'],
    topics: ['大学生该不该熬夜？','考研还是就业？','大学该不该谈恋爱？','室友关系怎么处理？','该不该转专业？','大学生该不该兼职？']
  },
  cafe: {
    name: '深夜咖啡馆', icon: '☕', bgImage: cafeBg, accent: '#FFB6C1', accent2: '#FFD93D',
    keywords: ['情感','感情','喜欢','恋爱','失恋','朋友','孤独','心事','关系','分手','告白','想念','暗恋','焦虑','难过','开心','累'],
    topics: ['暗恋该不该表白？','异地恋能坚持吗？','友情和爱情怎么选？','分手后还能做朋友吗？','如何走出失恋？','该不该为爱情改变自己？']
  },
  cyber: {
    name: '赛博实验室', icon: '🌃', bgImage: cyberBg, accent: '#9B59B6', accent2: '#00d4ff',
    keywords: ['AI','人工智能','科技','未来','机器人','元宇宙','数据','算法','赛博','数字','编程','互联网'],
    topics: ['AI 会取代人类吗？','元宇宙是泡沫吗？','该不该学编程？','ChatGPT 改变了什么？','自动驾驶安全吗？','数据隐私谁来保护？']
  },
  rooftop: {
    name: '城市天台', icon: '🏙️', bgImage: rooftopBg, accent: '#FFD93D', accent2: '#FF6B6B',
    keywords: ['生活','社会','工作','梦想','焦虑','内卷','压力','人生','现实','迷茫','躺平','内耗','意义'],
    topics: ['内卷时代该躺平吗？','工作的意义是什么？','如何面对焦虑？','大城市的孤独感','该不该回老家？','人生的意义是什么？']
  },
  arcade: {
    name: '游戏公会', icon: '🎮', bgImage: arcadeBg, accent: '#FF6B6B', accent2: '#9B59B6',
    keywords: ['游戏','动漫','二次元','追剧','娱乐','电竞','主播','番剧','音乐','电影','刷剧','短视频'],
    topics: ['游戏是电子海洛因吗？','二次元文化出圈了吗？','追星该不该理智？','短视频让人变傻了吗？','电竞算体育吗？','国漫崛起是真的吗？']
  }
}

const allHotSearchPool = [
  { title: 'AI 大模型突破新能力', tag: '科技', tagColor: '#9B59B6' },
  { title: '大学生熬夜猝死引关注', tag: '社会', tagColor: '#FF6B6B' },
  { title: '某明星官宣恋情', tag: '娱乐', tagColor: '#FFB6C1' },
  { title: '考研人数首次下降', tag: '教育', tagColor: '#4A90D9' },
  { title: '年轻人为何选择躺平', tag: '热议', tagColor: '#FFD93D' },
  { title: '国产游戏出海创纪录', tag: '游戏', tagColor: '#6BCB77' },
  { title: '短视频影响青少年专注力', tag: '社会', tagColor: '#FF6B6B' },
  { title: '某高校开设恋爱选修课', tag: '教育', tagColor: '#4A90D9' },
  { title: '苹果发布全新 Vision Pro', tag: '科技', tagColor: '#9B59B6' },
  { title: '多地气温创今年新低', tag: '生活', tagColor: '#00d4ff' },
  { title: '00后整顿职场引热议', tag: '职场', tagColor: '#FFD93D' },
  { title: '新能源车价格战再起', tag: '财经', tagColor: '#6BCB77' },
  { title: '巴黎奥运会倒计时', tag: '体育', tagColor: '#FF6B6B' },
  { title: '社保缴费基数上调', tag: '民生', tagColor: '#4A90D9' },
  { title: '数字游民成新趋势', tag: '社会', tagColor: '#FFB6C1' },
  { title: '大厂纷纷裁员潮', tag: '职场', tagColor: '#FFD93D' },
  { title: '预制菜进校园引争议', tag: '社会', tagColor: '#FF6B6B' },
  { title: '《黑神话：悟空》发售', tag: '游戏', tagColor: '#6BCB77' }
]
const hotSearchList = ref([])
const refreshHotSearch = () => {
  const shuffled = [...allHotSearchPool].sort(() => Math.random() - 0.5)
  hotSearchList.value = shuffled.slice(0, 8)
}
refreshHotSearch()

const characters = ref([
  { id: 'che', name: '小澈', personality: '理性分析', avatar: cheImg, color: '#4A90D9', emotion: 20,
    description: '数据分析师，逻辑控，但偶尔会因为争论不赢而嘴硬。' },
  { id: 'man', name: '小满', personality: '温暖陪伴', avatar: manImg, color: '#FFB6C1', emotion: 10,
    description: '幼教老师，温柔耐心，但非常讨厌被当成“老好人”。' },
  { id: 'tiao', name: '小跳', personality: '开心果', avatar: tiaoImg, color: '#FFD93D', emotion: 40,
    description: '游戏主播，搞笑乐天派，但提到现实问题会突然认真。' },
  { id: 'dun', name: '小盾', personality: '靠谱担当', avatar: dunImg, color: '#6BCB77', emotion: 15,
    description: '生活管家，稳重爱操心，有点控制欲。' },
  { id: 'shan', name: '小闪', personality: '脑洞担当', avatar: shanImg, color: '#9B59B6', emotion: 30,
    description: '灵感艺术家，脑洞大，偶尔会沉浸在自己的世界里。' },
  { id: 'mo', name: '小默', personality: '安静有想法', avatar: moImg, color: '#A8D8EA', emotion: 5,
    description: '图书管理员，话少，但是个微表情大师。' }
])

const DISCUSSION_ANGLES = [
  '【角度：亲身经历】从你自己或身边朋友的真实故事切入，讲一个具体场景，不要说大道理。',
  '【角度：新闻热点】引用一个最近看到的新闻、热搜或网络讨论，作为论据。',
  '【角度：生动比喻】用一个形象的比喻或类比来解释你的观点，让人一听就懂。',
  '【角度：反直觉】提出一个反直觉的角度，或质疑大家默认的前提。',
  '【角度：社会现象】结合当下社会现象（就业、房价、内卷、数字生活、代际差异）来分析。',
  '【角度：科技趋势】从科技发展或未来趋势的角度看这个问题。',
  '【角度：数据佐证】举一个具体的数据或统计（合理即可，不必精确到个位）。',
  '【角度：文化案例】引用一个历史案例、文学作品、电影或游戏里的例子。',
  '【角度：微观场景】从一个非常具体、微观的生活场景切入，而不是讲宏观道理。',
  '【角度：先扬后抑】先承认对方有道理，然后指出一个被忽略的关键细节。',
  '【角度：假设推演】用一个反问或假设场景来推进讨论："如果…会怎样？"',
  '【角度：换个视角】从另一个群体的视角看这个问题（比如父母、老人、外国人、小孩）。'
]

const STANCES = [
  { id: 'agree_add', desc: '【你的立场：赞同但补充】你基本认同上一位的观点，但必须补充一个全新的角度或细节，让讨论往前走一步。禁止只说"同意"、"确实"，要有实质内容。' },
  { id: 'partial_agree', desc: '【你的立场：部分赞同】你认同上一位观点的一部分，但有一部分你不认同。必须明确指出"哪一部分你不同意"，并给出理由。' },
  { id: 'challenge', desc: '【你的立场：质疑反驳】你不完全认同上一位的观点。必须直接指出一个具体的问题、漏洞或反例，可以说"我有点不同意"、"我不这么看"。' },
  { id: 'counter_example', desc: '【你的立场：提出反例】上一位说的道理可能成立，但你知道一个反例。必须讲出这个反例（可以是亲身经历、看到的新闻、历史案例）。' },
  { id: 'alternative', desc: '【你的立场：换个角度】你觉得大家都在某个框架里讨论。必须跳出来，提出一个完全不同的分析维度，比如"其实这个问题真正的关键是…"' },
  { id: 'synthesis', desc: '【你的立场：折中协调】你看到了前面双方的合理之处，但不认同任何一方的极端。必须指出"真正的答案在中间的某个点"，说明是什么点。' }
]

const HOT_TOPICS = [
  'ChatGPT、豆包、Kimi 这些 AI 工具最近更新特别快',
  '最近 AI 换脸诈骗频发，引发安全担忧',
  '今年考研报名人数下降，大家都在聊"学历贬值"',
  '一些城市开始试行育儿补贴、租房补贴',
  '年轻人开始"反向消费"，不再追求大牌',
  '《黑神话：悟空》出圈后，国产游戏成了热门话题',
  '最近某明星塌房事件又引发关于偶像文化的讨论',
  '国漫《中国奇谭》《时光代理人》在海外也很受欢迎',
  '"班味"这个词特别火，年轻人用它形容上班的状态',
  '"全职儿女"最近被反复提起',
  '"数字游民"和"远程办公"在大理、安吉兴起',
  '"情绪价值"被用在各种场合',
  '小红书"断亲"话题引发讨论',
  '很多人开始重视"睡眠健康"，智能手环销量大涨',
  '预制菜进校园引发争议',
  '年轻人流行"citywalk"和"早C晚A"',
  '一线城市房租最近出现下降趋势',
  '短视频影响青少年专注力的话题被反复讨论',
  '"抗糖""断食"这类健康话题很火',
  'AI 主播、AI 配音开始出现在短视频平台'
]

const usedAngles = new Set()
const usedHotTopics = new Set()
const usedStances = new Set()

function pickAngle() {
  const available = DISCUSSION_ANGLES.filter(a => !usedAngles.has(a))
  if (available.length === 0) {
    usedAngles.clear()
    return DISCUSSION_ANGLES[Math.floor(Math.random() * DISCUSSION_ANGLES.length)]
  }
  const pick = available[Math.floor(Math.random() * available.length)]
  usedAngles.add(pick)
  return pick
}

function pickHotTopic() {
  const available = HOT_TOPICS.filter(t => !usedHotTopics.has(t))
  if (available.length === 0) {
    usedHotTopics.clear()
    return HOT_TOPICS[Math.floor(Math.random() * HOT_TOPICS.length)]
  }
  const pick = available[Math.floor(Math.random() * available.length)]
  usedHotTopics.add(pick)
  return pick
}

function pickStance() {
  const available = STANCES.filter(s => !usedStances.has(s.id))
  if (available.length === 0) {
    usedStances.clear()
    return STANCES[Math.floor(Math.random() * STANCES.length)]
  }
  const pick = available[Math.floor(Math.random() * available.length)]
  usedStances.add(pick.id)
  return pick
}

const activeTab = ref('chat')
const menuOpen = ref(false)
const drawerExpanded = ref(false)
const ambienceMode = ref('lively')

const topic = ref('')
const messages = ref([])
const isDiscussing = ref(false)
const isPaused = ref(false)
const isSummarizing = ref(false) 
const currentSpeakerId = ref('')
const typingId = ref('')
const isVisitorTyping = ref(false) 
const userMessage = ref('')
const userMention = ref(null)
const mentionedCharId = ref('')
const chatArea = ref(null)
const apiCallCount = ref(0)
const apiStatus = ref('ok')
const discussionHistory = ref([])
const stopFlag = ref(false)
const currentRound = ref(0)
const totalRounds = ref(30) 
const recentAchievement = ref('')
const currentTime = ref('')
const lastUserActivity = ref(Date.now())
const idlePrompted = ref(false)
const emoteBubbles = ref({})
const dollBubbles = ref({})
const visitor = ref('')
const currentScenarioKey = ref('cafe')

const visitingCharId = ref(null)
const incomingVisitor = ref(null)
const visitorBubble = ref('')

const discussPhase = computed(() => {
  if (!isDiscussing.value) return ''
  if (currentRound.value <= 1) return '破冰阶段'
  if (currentRound.value >= totalRounds.value) return '收尾阶段'
  return `交锋中·第${currentRound.value}轮`
})

const screenW = ref(window.innerWidth)
const screenH = ref(window.innerHeight)
const stageH = computed(() => screenH.value * 0.58)
const STAGE_TOP = 70 

const homes = {
  che: { x: 0.15, y: 0.30 }, man: { x: 0.80, y: 0.25 }, tiao: { x: 0.85, y: 0.45 },
  dun: { x: 0.12, y: 0.45 }, shan: { x: 0.25, y: 0.38 }, mo: { x: 0.72, y: 0.38 }
}

function createDoll(id) {
  const h = homes[id]
  return {
    x: h.x, y: h.y, px: h.x * screenW.value, py: h.y * stageH.value,
    vx: 0, vy: 0, tx: h.x, ty: h.y,
    mood: 'idle', tilt: 0, squash: 1, pauseUntil: 0
  }
}

const dollStates = reactive({
  che: createDoll('che'), man: createDoll('man'), tiao: createDoll('tiao'),
  dun: createDoll('dun'), shan: createDoll('shan'), mo: createDoll('mo')
})

const dollClass = (id) => {
  const s = dollStates[id]
  return {
    speaking: currentSpeakerId.value === id,
    thinking: typingId.value === id,
    mentioned: mentionedCharId.value === id,
    approaching: s.mood === 'approach',
    reacting: s.mood === 'react',
    'visiting-out': visitingCharId.value === id
  }
}

const dollStyle = (id) => {
  const s = dollStates[id]
  const char = characters.value.find(c => c.id === id)
  if (visitingCharId.value === id) {
    return {
      '--color': char?.color,
      opacity: '0',
      pointerEvents: 'none',
      transform: `translate3d(${screenW.value + 200}px, ${s.py - 72}px, 0)`
    }
  }
  return {
    '--color': char?.color,
    transform: `translate3d(${s.px - 65}px, ${s.py - 72}px, 0) rotate(${s.tilt}deg) scale(${s.squash})`
  }
}

let rafId = null, lastTime = 0
const MIN_X = 0.08, MAX_X = 0.92, MIN_Y = 0.12, MAX_Y = 0.58

const physicsLoop = (timestamp) => {
  if (!lastTime) lastTime = timestamp
  const dt = Math.min((timestamp - lastTime) / 1000, 0.033)
  lastTime = timestamp
  const now = Date.now()

  Object.entries(dollStates).forEach(([id, s]) => {
    if (s.mood === 'speaking' || s.mood === 'approach') {
      const ease = Math.min(1, dt * 5)
      s.x += (s.tx - s.x) * ease
      s.y += (s.ty - s.y) * ease
      s.vx *= 0.85
      s.vy *= 0.85
    } else if (now < s.pauseUntil) {
      s.vx *= 0.9
      s.vy *= 0.9
      s.x += s.vx * dt
      s.y += s.vy * dt
    } else {
      const k = 30
      const damping = 1.6 * Math.sqrt(k)
      s.vx += ((s.tx - s.x) * k - s.vx * damping) * dt
      s.vy += ((s.ty - s.y) * k - s.vy * damping) * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
    }

    if (s.x < MIN_X) { s.x = MIN_X; s.vx = Math.abs(s.vx) * 0.3 }
    if (s.x > MAX_X) { s.x = MAX_X; s.vx = -Math.abs(s.vx) * 0.3 }
    if (s.y < MIN_Y) { s.y = MIN_Y; s.vy = Math.abs(s.vy) * 0.3 }
    if (s.y > MAX_Y) { s.y = MAX_Y; s.vy = -Math.abs(s.vy) * 0.3 }

    s.tx = Math.max(MIN_X, Math.min(MAX_X, s.tx))
    s.ty = Math.max(MIN_Y, Math.min(MAX_Y, s.ty))

    const dist = Math.hypot(s.tx - s.x, s.ty - s.y)
    if (dist < 0.02 && s.mood === 'idle') {
      const phase = now / 1000 + id.charCodeAt(0) * 0.7
      s.y += Math.sin(phase * 1.5) * 0.0006
    }

    const speedPx = Math.hypot(s.vx * screenW.value, s.vy * stageH.value)
    const targetTilt = Math.max(-12, Math.min(12, s.vx * screenW.value * 0.08))
    s.tilt += (targetTilt - s.tilt) * Math.min(1, dt * 12)

    const targetSquash = speedPx > 100 ? 1 + Math.min(0.08, speedPx * 0.0004) : 1
    s.squash += (targetSquash - s.squash) * Math.min(1, dt * 10)

    s.px = s.x * screenW.value
    s.py = s.y * stageH.value
  })

  rafId = requestAnimationFrame(physicsLoop)
}

const onMousemove = (e) => {
  lastUserActivity.value = Date.now()
  idlePrompted.value = false
  const mx = e.clientX, my = e.clientY - STAGE_TOP
  Object.values(dollStates).forEach(s => {
    if (s.mood === 'speaking' || s.mood === 'approach') return
    const dx = s.px - mx, dy = s.py - my
    const dist = Math.hypot(dx, dy)
    if (dist < 130 && dist > 1) {
      const force = (130 - dist) / 130 * 0.04
      s.vx += (dx / dist) * force
      s.vy += (dy / dist) * force
    }
  })
}

const onClick = (e) => {
  if (e.target.closest('.chat-drawer, .toolbar, .side-menu, .panel-drawer, .scenario-rail, .topbar, .mask')) return
  lastUserActivity.value = Date.now()
  idlePrompted.value = false
  const idleDolls = Object.entries(dollStates).filter(([_, s]) => s.mood === 'idle' || s.mood === 'wander')
  if (idleDolls.length === 0) return
  const [id, s] = idleDolls[Math.floor(Math.random() * idleDolls.length)]
  s.tx = e.clientX / screenW.value
  s.ty = (e.clientY - STAGE_TOP) / stageH.value
  s.mood = 'chase'
  setTimeout(() => {
    if (s.mood === 'chase') {
      s.mood = 'idle'
      s.tx = homes[id].x
      s.ty = homes[id].y
    }
  }, 2500)
}

const reactEmojis = ['😊', '😳', '😆', '🥺', '😮', '🤔', '😌', '😎']

const handleDollClick = (char) => {
  lastUserActivity.value = Date.now()
  idlePrompted.value = false
  const s = dollStates[char.id]
  s.mood = 'react'
  s.vx += (Math.random() - 0.5) * 0.4
  s.vy += (Math.random() - 0.5) * 0.4
  s.squash = 1.22
  const emoji = reactEmojis[Math.floor(Math.random() * reactEmojis.length)]
  emoteBubbles.value[char.id] = emoji
  setTimeout(() => { delete emoteBubbles.value[char.id] }, 1200)
  setTimeout(() => {
    if (s.mood === 'react') {
      s.mood = 'idle'
      s.tx = homes[char.id].x
      s.ty = homes[char.id].y
    }
  }, 500)
  mentionCharacter(char)
}

const moveToSpeak = (id) => {
  const s = dollStates[id]
  s.mood = 'speaking'
  const side = s.x < 0.5 ? 0.35 : 0.65
  s.tx = side
  s.ty = 0.22
}

const moveHome = (id) => {
  const s = dollStates[id]
  if (s.mood === 'speaking') {
    s.mood = 'idle'
    s.tx = homes[id].x
    s.ty = homes[id].y
  }
}

const approachUser = (id) => {
  const s = dollStates[id]
  if (!s) return
  s.mood = 'approach'
  s.tx = 0.5
  s.ty = 0.48
  setTimeout(() => {
    if (s.mood === 'approach') {
      s.mood = 'idle'
      s.tx = homes[id].x
      s.ty = homes[id].y
    }
  }, 6000)
}

const wander = (id) => {
  const s = dollStates[id]
  if (!s || ['speaking', 'approach', 'chase', 'react'].includes(s.mood)) return
  if (visitingCharId.value === id) return
  if (Date.now() < s.pauseUntil) return
  const h = homes[id]
  s.mood = 'wander'
  s.tx = Math.max(MIN_X + 0.03, Math.min(MAX_X - 0.03, h.x + (Math.random() - 0.5) * 0.25))
  s.ty = Math.max(MIN_Y + 0.03, Math.min(MAX_Y - 0.03, h.y + (Math.random() - 0.5) * 0.18))
  if (Math.random() < 0.3) s.pauseUntil = Date.now() + 1500 + Math.random() * 2000
  setTimeout(() => {
    if (s.mood === 'wander') {
      s.mood = 'idle'
      s.tx = h.x
      s.ty = h.y
    }
  }, 3000 + Math.random() * 2000)
}

const currentScenario = computed(() => scenarios[currentScenarioKey.value])
const panelTitle = computed(() => panelTitles[activeTab.value] || '')
const apiStatusText = computed(() => {
  if (apiStatus.value === 'ok') return '在线'
  if (apiStatus.value === 'calling') return `思考中...`
  return '异常'
})
const inputPlaceholder = computed(() => {
  if (userMention.value) return `对 ${userMention.value.name} 说什么？`
  if (isDiscussing.value) return '想插话？直接打字，会打断讨论…'
  return '说点什么…'
})
const chatHeight = computed(() => {
  if (drawerExpanded.value) return 76
  const hasLowerDoll = Object.values(dollStates).some(s =>
    (s.mood === 'approach' || s.mood === 'speaking') && s.y > 0.42
  )
  return hasLowerDoll ? 38 : 52
})

const getChar = (id) => characters.value.find(c => c.id === id)
const getAvatar = (id) => id === 'user' ? '' : (getChar(id)?.avatar || '')
const getName = (id) => id === 'user' ? '我' : (getChar(id)?.name || '')
const getColor = (id) => id === 'user' ? '#6BCB77' : (getChar(id)?.color || '#fff')
const nowTime = () => {
  const d = new Date()
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

const closeAllLayers = () => { menuOpen.value = false; activeTab.value = 'chat' }
const openPanel = (id) => { 
  lastUserActivity.value = Date.now();
  menuOpen.value = false; 
  nextTick(() => { activeTab.value = id }) 
}
const switchScenario = (key) => { currentScenarioKey.value = key }
const detectScenario = (text) => {
  for (const [key, config] of Object.entries(scenarios)) {
    if (config.keywords.some(k => text.includes(k))) return key
  }
  return 'cafe'
}
const unlockAchievement = (name) => {
  recentAchievement.value = name
  setTimeout(() => { recentAchievement.value = '' }, 3000)
}

const rotatingTopic = ref('最近总觉得好焦虑…')
const allTopics = [
  '最近总觉得好焦虑…', '室友半夜打游戏怎么办？', 'AI 会取代程序员吗？',
  '暗恋一个人该表白吗？', '内卷时代该躺平吗？', '大学该不该谈恋爱？',
  '游戏是电子海洛因吗？', '大城市的孤独感', '该不该回老家发展？', '每天都很累，怎么调整？'
]
let topicIdx = 0

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const waitWithControl = async (ms) => {
  const step = 100
  let elapsed = 0
  while (elapsed < ms) {
    if (stopFlag.value) throw new Error('stopped')
    if (!isPaused.value) elapsed += step
    await sleep(step)
  }
  if (stopFlag.value) throw new Error('stopped')
}

const getPrevAIMessage = () => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const m = messages.value[i]
    if (m.speaker !== 'user' && m.speaker !== 'system' && m.speaker !== 'summary' && !m.isFallback) {
      return m
    }
  }
  return null
}

const speakOnce = async (charId, history, sceneName, options = {}) => {
  if (stopFlag.value) return { ok: false, displayed: false }
  const char = getChar(charId)
  if (!char) return { ok: false, displayed: false }

  typingId.value = charId
  currentSpeakerId.value = charId
  isVisitorTyping.value = options.isVisitor || false
  moveToSpeak(charId)

  try {
    const result = await callAI(charId, history, sceneName, {
      extraContext: options.extraContext || null,
      focusTopic: options.focusTopic || null
    })

    if (!result.ok) {
      console.warn(`[${char.name}] 发言失败，原因: ${result.reason}`)
      return { ok: false, displayed: false }
    }

    apiCallCount.value++
    const reply = result.content

    messages.value.push({ 
      speaker: charId, 
      content: reply, 
      time: nowTime(),
      isVisitor: options.isVisitor || false 
    })
    history.push({ role: 'user', content: `${char.name}：${reply}` })
    
    if (history.length > 40) history.splice(0, history.length - 40)

    dollBubbles.value[charId] = reply.length > 24 ? reply.slice(0, 24) + '…' : reply
    setTimeout(() => {
      if (dollBubbles.value[charId]) delete dollBubbles.value[charId]
    }, 4000)

    char.emotion = Math.min(100, char.emotion + 8 + Math.random() * 12)

    // 强制自动追踪聊天底部
    nextTick(() => {
      if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight
    })

    return { ok: true, displayed: true }

  } catch (e) {
    console.error(`[speakOnce] ${charId} 异常:`, e)
    return { ok: false, displayed: false }
  } finally {
    typingId.value = ''
    currentSpeakerId.value = ''
    isVisitorTyping.value = false
    moveHome(charId)
  }
}

const finalizeSummary = async () => {
  if (isSummarizing.value) return
  const realMessages = messages.value.filter(m => !m.isFallback && m.speaker !== 'system' && m.speaker !== 'summary')
  if (realMessages.length < 4) {
    messages.value.push({ speaker: 'system', content: '📋 有效发言太少，跳过纪要生成', time: nowTime() })
    return
  }

  isSummarizing.value = true
  messages.value.push({ speaker: 'system', content: '📋 正在生成圆桌纪要…', time: nowTime() })
  nextTick(() => {
    if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight
  })

  try {
    const summary = await generateSummary(topic.value, currentScenario.value.name, messages.value)
    const idx = messages.value.findIndex(m => m.content && m.content.includes('正在生成圆桌纪要'))
    if (idx >= 0) messages.value.splice(idx, 1)

    if (summary) {
      messages.value.push({ speaker: 'summary', content: summary, time: nowTime() })
    } else {
      messages.value.push({ speaker: 'system', content: '📋 纪要生成失败', time: nowTime() })
    }
  } catch (e) {
    const idx = messages.value.findIndex(m => m.content && m.content.includes('正在生成圆桌纪要'))
    if (idx >= 0) messages.value.splice(idx, 1)
    messages.value.push({ speaker: 'system', content: '📋 纪要生成失败', time: nowTime() })
  } finally {
    isSummarizing.value = false
  }

  nextTick(() => {
    if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight
  })
}

const startDiscussion = async () => {
  if (!topic.value.trim()) return alert('请先输入话题！')
  if (isDiscussing.value) {
    stopFlag.value = true
    isPaused.value = false
    await sleep(500)
  }

  const detected = detectScenario(topic.value)
  currentScenarioKey.value = detected
  lastUserActivity.value = Date.now()
  idlePrompted.value = false

  isDiscussing.value = true
  isPaused.value = false
  stopFlag.value = false
  
  // 保留访客及串门记录
  const preservedMsgs = messages.value.filter(m => m.isVisitor || (m.speaker === 'system' && (m.content.includes('串门') || m.content.includes('来访'))))
  messages.value = preservedMsgs
  messages.value.push({ speaker: 'system', content: `--- 开启新话题：${topic.value} ---`, time: nowTime() })
  
  apiCallCount.value = 0
  currentRound.value = 0
  apiStatus.value = 'calling'
  characters.value.forEach(c => c.emotion = 10 + Math.random() * 20)

  usedAngles.clear()
  usedHotTopics.clear()
  usedStances.clear()

  messages.value.push({ speaker: 'user', content: topic.value, time: nowTime() })

  const history = [
    { role: 'user', content: `讨论话题：${topic.value}。请紧扣这个话题发言，50-100字，表达明确观点，不要只附和别人。` }
  ]

  const base = ['che', 'tiao', 'man', 'dun', 'shan', 'mo']
  const isLively = ambienceMode.value === 'lively'
  const focusTopicText = topic.value

  let consecutiveFails = 0

  try {
    for (let round = 0; round < totalRounds.value; round++) {
      if (stopFlag.value) break
      currentRound.value = round + 1

      const shuffled = [...base].sort(() => Math.random() - 0.5)
      const roundSpeakers = shuffled.slice(0, 3)

      for (let i = 0; i < roundSpeakers.length; i++) {
        if (stopFlag.value) break
        const charId = roundSpeakers[i]

        const angle = pickAngle()
        const stance = pickStance()
        const hotTopic = Math.random() < 0.6 ? pickHotTopic() : null

        let extraContext = ''

        if (i === 0) {
          extraContext += `【你的角色】你是本轮**第一个发言**的人，必须**直接针对讨论话题抛出你自己的观点**，观点要明确，不能含糊。\n`
        } else {
          const prev = getPrevAIMessage()
          if (prev) {
            const prevName = prev.isVisitor ? prev.speakerName : getName(prev.speaker)
            extraContext += `【你要回应的对象】上一位发言的是"${prevName}"，ta 说：\n"${prev.content}"\n`
            extraContext += `【你的任务】必须针对 ${prevName} 的这段话做出反应，**不能自说自话**。\n`
          }
        }

        extraContext += `${stance.desc}\n`
        extraContext += `${angle}\n`

        if (hotTopic) {
          extraContext += `【可参考的现实热点】${hotTopic}\n`
        }

        extraContext += `【硬性要求】
1. 禁止说"我同意""确实""我也觉得""对"这类纯附和的话。
2. 必须针对上一位的具体观点回应，可以赞同、可以质疑、可以反驳、可以换个角度。
3. 不要重复前面任何人说过的例子或观点。
4. 50-100字，像微信聊天一样自然，可以用语气词，适度表达情绪。
5. 直接说你的观点，不要加"某某说："前缀。`

        const preDelay = i === 0
          ? (isLively ? 600 : 1200)
          : (isLively ? 1500 + Math.random() * 1000 : 2200 + Math.random() * 1200)
        await waitWithControl(preDelay)

        const result = await speakOnce(charId, history, currentScenario.value.name, {
          extraContext,
          focusTopic: focusTopicText
        })

        if (result.ok) {
          consecutiveFails = 0
        } else {
          consecutiveFails++
          if (consecutiveFails >= 5) {
            messages.value.push({
              speaker: 'system',
              content: '⚠️ 连续多次 AI 调用失败，讨论暂停。请检查 API Key 或网络。',
              time: nowTime()
            })
            stopFlag.value = true
            break
          }
        }

        await waitWithControl(isLively ? 500 : 900)
      }

      if (stopFlag.value) break

      if (round < totalRounds.value - 1) {
        await waitWithControl(isLively ? 800 : 1500)
      }
    }

    if (!stopFlag.value && messages.value.length > 3) {
      await finalizeSummary()
    }

  } catch (e) {
    if (e.message !== 'stopped') console.error(e)
  } finally {
    isDiscussing.value = false
    isPaused.value = false
    currentSpeakerId.value = ''
    typingId.value = ''
    apiStatus.value = 'ok'
    saveHistory()
  }
}

const togglePause = () => { isPaused.value = !isPaused.value }

const stopDiscussion = async () => {
  stopFlag.value = true
  isDiscussing.value = false
  isPaused.value = false
  typingId.value = ''
  currentSpeakerId.value = ''

  if (messages.value.length > 3 && !messages.value.some(m => m.speaker === 'summary')) {
    await finalizeSummary()
  }

  apiStatus.value = 'ok'
  saveHistory()
}

const onEnter = (e) => {
  if (e.isComposing) return
  userSpeak()
}

const userSpeak = async () => {
  if (!userMessage.value.trim()) return

  const userText = userMessage.value
  messages.value.push({ speaker: 'user', content: userText, time: nowTime() })
  userMessage.value = ''
  lastUserActivity.value = Date.now()
  idlePrompted.value = false

  nextTick(() => {
    if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight
  })

  if (isDiscussing.value) {
    stopFlag.value = true
    isPaused.value = false
    let waited = 0
    while (isDiscussing.value && waited < 2500) {
      await sleep(100)
      waited += 100
    }
    isDiscussing.value = false
    typingId.value = ''
    currentSpeakerId.value = ''
    stopFlag.value = false
  }

  const responders = [...characters.value]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3 + Math.floor(Math.random() * 2))

  const history = []

  if (topic.value) {
    history.push({ role: 'user', content: `[背景] 我们正在讨论的话题是"${topic.value}"。` })
  }

  for (const m of messages.value.slice(0, -1)) {
    if (m.speaker === 'user') {
      history.push({ role: 'user', content: `用户：${m.content}` })
    } else if (m.speaker !== 'system' && m.speaker !== 'summary' && !m.isFallback) {
      history.push({ role: 'user', content: `${m.isVisitor ? m.speakerName : getName(m.speaker)}：${m.content}` })
    }
  }

  history.push({
    role: 'user',
    content: `[用户说] "${userText}"\n请回应用户这句话。`
  })

  isDiscussing.value = true
  stopFlag.value = false
  isPaused.value = false
  apiStatus.value = 'calling'

  try {
    for (let i = 0; i < responders.length; i++) {
      const responder = responders[i]

      const angle = pickAngle()
      const stance = pickStance()

      let extraContext = ''

      if (i === 0) {
        extraContext += `【当前情况】用户刚刚说了一句："${userText}"。
你是第一个回应的。必须【直接回应用户这句话】。不要提"上一位发言者"。\n`
      } else {
        const prev = getPrevAIMessage()
        if (prev && prev.speaker !== 'user') {
          const prevName = prev.isVisitor ? prev.speakerName : getName(prev.speaker)
          extraContext += `【上一位回应者】"${prevName}"刚刚说了：\n"${prev.content}"\n`
          extraContext += `【你的任务】在 ${prevName} 的基础上补充或反驳。必须围绕用户刚才说的话，不要跑题。\n`
        } else {
          extraContext += `【你的任务】用户刚刚说："${userText}"。请回应用户。\n`
        }
      }

      extraContext += `${stance.desc}\n`
      extraContext += `${angle}\n`
      extraContext += `【硬性要求】
1. 必须【针对用户刚才说的话】回应。
2. 禁止纯附和（不要只说"我同意"、"确实"）。
3. 可以赞同、可以质疑、可以补充、可以举例子。
4. 50-100字，像微信聊天一样自然。`

      const preDelay = i === 0 ? 800 : 1800 + Math.random() * 800
      await waitWithControl(preDelay)
      await speakOnce(responder.id, history, currentScenario.value.name, {
        extraContext,
        focusTopic: userText
      })
      await waitWithControl(600)
    }
  } catch (e) {
    if (e.message !== 'stopped') console.error(e)
  } finally {
    isDiscussing.value = false
    typingId.value = ''
    currentSpeakerId.value = ''
    apiStatus.value = 'ok'
  }
}

const mentionCharacter = (char) => {
  if (!char) return
  userMention.value = char
  mentionedCharId.value = char.id
  setTimeout(() => { mentionedCharId.value = '' }, 2000)
}

const startPrivateChat = (char) => {
  activeTab.value = 'chat'
  menuOpen.value = false
  userMention.value = char
  mentionedCharId.value = char.id
  approachUser(char.id)
  setTimeout(() => { mentionedCharId.value = '' }, 2000)
}

const onInputFocus = () => {
  const ids = ['man', 'tiao', 'che', 'dun', 'shan', 'mo']
  const id = ids[Math.floor(Math.random() * ids.length)]
  if (dollStates[id].mood !== 'approach') approachUser(id)
}

const greetUser = async () => {
  activeTab.value = 'chat'
  menuOpen.value = false
  messages.value = []
  topic.value = ''
  lastUserActivity.value = Date.now()

  const order = ['man', 'tiao', 'che', 'dun', 'shan', 'mo']
  const history = [
    { role: 'user', content: '用户刚进入聊天室，请用你的方式打个招呼，15-35字，像微信聊天，不要重复前面人说的。' }
  ]

  isDiscussing.value = true
  stopFlag.value = false
  apiStatus.value = 'calling'

  try {
    for (const charId of order) {
      await waitWithControl(1200)
      await speakOnce(charId, history, currentScenario.value.name)
      await waitWithControl(500)
    }
  } catch (e) {
    if (e.message !== 'stopped') console.error(e)
  } finally {
    isDiscussing.value = false
    apiStatus.value = 'ok'
  }
}

const channel = ref(null)

const runGuestConversation = async (data) => {
  try {
    isDiscussing.value = true
    isPaused.value = false
    stopFlag.value = false

    const localGreeters = [...characters.value]
      .filter(c => c.id !== 'mo')
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)

    const history = [
      { role: 'user', content: `另一个圆桌的"${data.visitorName}"来我们这里做客了。ta 那边正在聊「${data.currentTopic}」。ta 刚才在那边聊了：\n${data.recentHistory}` }
    ]

    for (let round = 0; round < 8; round++) {
      const localChar = localGreeters[round % localGreeters.length]
      typingId.value = localChar.id
      currentSpeakerId.value = localChar.id
      isVisitorTyping.value = false

      let promptLocal = ''
      if (round === 0) {
        promptLocal = `请热情欢迎访客"${data.visitorName}"，并好奇地问 ta 刚才在对面聊了什么。`
      } else if (round % 2 === 0) {
        promptLocal = `请针对访客刚才说的见闻，追问一句或者发表你的看法。`
      } else {
        promptLocal = `访客分享了对面的情况，请回应 ta 一句。`
      }

      const r1 = await callAI(localChar.id, history, currentScenario.value.name, { extraContext: promptLocal })
      if (r1.ok) {
        messages.value.push({ speaker: localChar.id, content: r1.content, time: nowTime() })
        history.push({ role: 'user', content: `${localChar.name}：${r1.content}` })
        apiCallCount.value++
        nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })
      }
      typingId.value = ''
      await sleep(1200)

      typingId.value = 'visitor' 
      currentSpeakerId.value = ''
      isVisitorTyping.value = true

      let promptVisitor = round === 0 
        ? `你是访客"${data.visitorName}"，请回应对方的欢迎，并简单介绍你们那边的话题。`
        : `你是访客"${data.visitorName}"，请针对对方刚才的话接茬，可以反驳、赞同或补充，20-60字。`

      const r2 = await callAI('che', history, currentScenario.value.name, { extraContext: promptVisitor })
      if (r2.ok) {
        messages.value.push({ 
          speaker: 'visitor', 
          speakerName: data.visitorName,
          speakerAvatar: data.visitorAvatar,
          speakerColor: data.visitorColor,
          content: r2.content, 
          time: nowTime(), 
          isVisitor: true 
        })
        history.push({ role: 'user', content: `${data.visitorName}：${r2.content}` })
        apiCallCount.value++
        nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })
      }
      typingId.value = ''
      isVisitorTyping.value = false
      await sleep(1200)
    }

    visitorBubble.value = '聊得太开心了，我先回去啦！'

    setTimeout(() => {
      if (!incomingVisitor.value) return
      if (channel.value) {
        const backMsgs = messages.value.slice(-10).map(m => `${m.isVisitor ? m.speakerName : getName(m.speaker)}: ${m.content}`).join('\n')
        channel.value.postMessage({
          type: 'visit-back',
          from: '另一个圆桌的朋友',
          currentTopic: topic.value || '日常闲聊',
          currentScene: currentScenario.value.name,
          chatHistory: backMsgs,
          time: Date.now()
        })
      }
      messages.value.push({
        speaker: 'system',
        content: `🚪 ${incomingVisitor.value.name} 回自己的圆桌了`,
        time: nowTime()
      })
      incomingVisitor.value = null
      visitorBubble.value = ''
      visitor.value = ''
      nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })
    }, 3000) 

  } catch (err) {
    console.error(err)
    incomingVisitor.value = null
    visitorBubble.value = ''
    visitor.value = ''
  } finally {
    isDiscussing.value = false
    typingId.value = ''
    currentSpeakerId.value = ''
    isVisitorTyping.value = false
  }
}

const runReturnConversation = async (data) => {
  if (!visitingCharId.value) return
  const envoy = getChar(visitingCharId.value)
  const s = dollStates[envoy.id]
  s.mood = 'idle'
  s.tx = homes[envoy.id].x
  s.ty = homes[envoy.id].y
  visitingCharId.value = null 

  messages.value.push({
    speaker: 'system',
    content: `🚪 ${envoy.name} 从对门回来了！对面正在聊「${data.currentTopic}」`,
    time: nowTime()
  })
  nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })

  setTimeout(async () => {
    try {
      isDiscussing.value = true
      isPaused.value = false
      stopFlag.value = false

      const history = [
        { role: 'user', content: `你刚去对门串门回来。对门正在聊「${data.currentTopic}」，他们的场景是「${data.currentScene}」。你在那边的聊天记录是：\n${data.chatHistory}\n请结合这些见闻，跟大家说说这次串门的感受。` }
      ]
      
      for (let round = 0; round < 6; round++) {
        if (round === 0) {
          typingId.value = envoy.id
          currentSpeakerId.value = envoy.id
          const r1 = await callAI(envoy.id, history, currentScenario.value.name, {
            extraContext: `【任务】你刚从对门回来，对面在聊「${data.currentTopic}」，跟大家说说见闻。`
          })
          if (r1.ok) {
            messages.value.push({ speaker: envoy.id, content: r1.content, time: nowTime() })
            history.push({ role: 'user', content: `${envoy.name}：${r1.content}` })
            apiCallCount.value++
            nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })
          }
          typingId.value = ''
        } else if (round % 2 !== 0) {
          const asker = characters.value.filter(c => c.id !== envoy.id).sort(() => Math.random() - 0.5)[0]
          typingId.value = asker.id
          currentSpeakerId.value = asker.id
          const rq = await callAI(asker.id, history, currentScenario.value.name, {
            extraContext: `【任务】${envoy.name}刚从对门回来，请针对 ta 说的见闻，追问一句。`
          })
          if (rq.ok) {
            messages.value.push({ speaker: asker.id, content: rq.content, time: nowTime() })
            history.push({ role: 'user', content: `${asker.name}：${rq.content}` })
            apiCallCount.value++
            nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })
          }
          typingId.value = ''
        } else {
          typingId.value = envoy.id
          currentSpeakerId.value = envoy.id
          const ra = await callAI(envoy.id, history, currentScenario.value.name, {
            extraContext: `【任务】请回答刚才对方的问题。`
          })
          if (ra.ok) {
            messages.value.push({ speaker: envoy.id, content: ra.content, time: nowTime() })
            history.push({ role: 'user', content: `${envoy.name}：${ra.content}` })
            apiCallCount.value++
            nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })
          }
          typingId.value = ''
        }
        await sleep(1200)
      }
    } catch(err) {
      console.error(err)
    } finally {
      isDiscussing.value = false
      typingId.value = ''
      currentSpeakerId.value = ''
    }
  }, 1000)
}

const visitNeighbor = () => {
  if (!channel.value) {
    messages.value.push({ speaker: 'system', content: '🚪 串门通道未开启（需多开浏览器标签页）', time: nowTime() })
    return
  }

  if (visitingCharId.value) {
    messages.value.push({ speaker: 'system', content: `🚪 ${getChar(visitingCharId.value).name} 已经去对门了`, time: nowTime() })
    return
  }

  const candidates = characters.value.filter(c => c.id !== 'mo')
  const envoy = candidates[Math.floor(Math.random() * candidates.length)]
  visitingCharId.value = envoy.id

  const s = dollStates[envoy.id]
  s.mood = 'speaking'
  s.tx = 0.98
  s.ty = 0.5

  messages.value.push({
    speaker: 'system',
    content: `🚪 ${envoy.name} 出发去对门串门了…`,
    time: nowTime()
  })
  nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })

  const recentMsgs = messages.value.slice(-5).map(m => `${m.isVisitor ? m.speakerName : getName(m.speaker)}: ${m.content}`).join('\n')

  channel.value.postMessage({
    type: 'visit',
    from: '另一个圆桌的朋友',
    visitorName: envoy.name,
    visitorColor: envoy.color,
    visitorAvatar: envoy.avatar,
    currentTopic: topic.value || '日常闲聊',
    currentScene: currentScenario.value.name,
    recentHistory: recentMsgs,
    time: Date.now()
  })
}

let lastSavedHash = '' 
const saveHistory = () => {
  const realMessages = messages.value.filter(m => m.speaker !== 'system' && !m.isFallback && m.speaker !== 'summary')
  if (realMessages.length < 3) return
  
  const hash = realMessages.map(m => m.speaker + m.content).join('|').slice(0, 200)
  if (hash === lastSavedHash) return
  lastSavedHash = hash

  discussionHistory.value.unshift({
    topic: topic.value || '(打招呼)',
    sceneName: currentScenario.value.name,
    sceneIcon: currentScenario.value.icon,
    count: realMessages.length,
    preview: realMessages
      .slice(0, 3)
      .map(m => `[${m.isVisitor ? m.speakerName : getName(m.speaker)}] ${m.content}`)
      .join(' / ')
      .slice(0, 130) + '…',
    time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    messages: JSON.parse(JSON.stringify(messages.value))
  })
  if (discussionHistory.value.length > 20) discussionHistory.value.pop()
}

const loadHistory = (h) => {
  stopFlag.value = true
  isDiscussing.value = false
  isPaused.value = false
  typingId.value = ''
  currentSpeakerId.value = ''

  activeTab.value = 'chat'
  menuOpen.value = false
  topic.value = h.topic
  messages.value = JSON.parse(JSON.stringify(h.messages))
  nextTick(() => {
    if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight
  })
}

const deleteHistory = (i) => discussionHistory.value.splice(i, 1)

const discussHotSearch = (item) => {
  activeTab.value = 'chat'
  menuOpen.value = false
  topic.value = item.title
  nextTick(() => startDiscussion())
}

const onKeydown = (e) => {
  if (e.key === 'Escape') {
    if (menuOpen.value) menuOpen.value = false
    else if (activeTab.value !== 'chat') activeTab.value = 'chat'
  }
}

let wanderTimer, careTimer, clockTimer, topicTimer, resizeHandler

onMounted(() => {
  rafId = requestAnimationFrame(physicsLoop)
  window.addEventListener('keydown', onKeydown)

  resizeHandler = () => {
    screenW.value = window.innerWidth
    screenH.value = window.innerHeight
  }
  window.addEventListener('resize', resizeHandler)

  wanderTimer = setInterval(() => {
    if (isDiscussing.value) return
    const ids = Object.keys(dollStates)
    wander(ids[Math.floor(Math.random() * ids.length)])
  }, 3000)

  careTimer = setInterval(async () => {
    if (isDiscussing.value || isPaused.value || isSummarizing.value) return 
    const idleTime = Date.now() - lastUserActivity.value
    if (idleTime > 45000 && !idlePrompted.value) {
      idlePrompted.value = true
      lastUserActivity.value = Date.now()
      const ids = ['man', 'mo', 'che', 'shan']
      const id = ids[Math.floor(Math.random() * ids.length)]
      approachUser(id)
      const history = [
        { role: 'user', content: '用户已经有一段时间没说话了，请主动关心一下，20-40字，自然一点，可以带点情绪。' }
      ]
      const result = await callAI(id, history, currentScenario.value.name)
      if (result.ok) {
        apiCallCount.value++
        messages.value.push({ speaker: id, content: result.content, time: nowTime() })
        dollBubbles.value[id] = result.content.length > 24 ? result.content.slice(0, 24) + '…' : result.content
        setTimeout(() => {
          if (dollBubbles.value[id]) delete dollBubbles.value[id]
        }, 4000)
        nextTick(() => {
          if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight
        })
      }
    }
  }, 10000)

  clockTimer = setInterval(() => {
    const d = new Date()
    currentTime.value = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }, 1000)

  topicTimer = setInterval(() => {
    topicIdx = (topicIdx + 1) % allTopics.length
    rotatingTopic.value = allTopics[topicIdx]
  }, 5000)

  try {
    channel.value = new BroadcastChannel('ai-roundtable')
    channel.value.onmessage = (event) => {
      const data = event.data
      if (data.type === 'visit') {
        if (incomingVisitor.value) {
          channel.value.postMessage({ type: 'visit-reject', reason: '本页已有访客' })
          return
        }
        incomingVisitor.value = {
          name: data.visitorName,
          color: data.visitorColor,
          avatar: data.visitorAvatar,
          topic: data.currentTopic,
          scene: data.currentScene,
          enterAt: Date.now()
        }
        visitor.value = `${data.visitorName} 来做客了`
        visitorBubble.value = '大家好！我来串门啦～'
        messages.value.push({
          speaker: 'system',
          content: `🚪 ${data.visitorName}（来自${data.currentScene}）来做客了！那边正在聊「${data.currentTopic}」`,
          time: nowTime()
        })
        runGuestConversation(data)
      }

      if (data.type === 'visit-back') {
        runReturnConversation(data)
      }

      if (data.type === 'visit-reject') {
        if (visitingCharId.value) {
          const envoy = getChar(visitingCharId.value)
          const s = dollStates[envoy.id]
          s.mood = 'idle'
          s.tx = homes[envoy.id].x
          s.ty = homes[envoy.id].y
          messages.value.push({
            speaker: 'system',
            content: `🚪 对门已经有客人了，${envoy.name} 白跑一趟…`,
            time: nowTime()
          })
          visitingCharId.value = null
        }
      }
    }
  } catch (e) {
    console.warn('BroadcastChannel 不可用')
  }
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  clearInterval(wanderTimer)
  clearInterval(careTimer)
  clearInterval(clockTimer)
  clearInterval(topicTimer)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', resizeHandler)
  channel.value?.close()
})
</script>

<style scoped>
* { box-sizing: border-box; margin: 0; padding: 0; }
.app { position: relative; width: 100%; height: 100vh; overflow: hidden; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #fff; }

.scene-bg { position: absolute; inset: 0; background-size: cover; background-position: center; z-index: 0; transition: background-image 1.5s ease; }
.scene-veil { position: absolute; inset: 0; z-index: 1; pointer-events: none; transition: background 1.2s; }
.scene-veil.quiet { background: radial-gradient(ellipse at center, rgba(5,5,20,0.35) 0%, rgba(5,5,20,0.65) 100%); }
.scene-veil.lively { background: radial-gradient(ellipse at center, rgba(5,5,20,0.15) 0%, rgba(5,5,20,0.4) 100%); }

.topbar { position: absolute; top: 0; left: 0; right: 0; padding: 14px 22px; display: flex; justify-content: space-between; align-items: center; z-index: 100; background: linear-gradient(180deg, rgba(0,0,0,0.35), transparent); pointer-events: none; }
.topbar > * { pointer-events: auto; }
.top-left, .top-right { display: flex; align-items: center; gap: 12px; }
.menu-btn { width: 40px; height: 40px; border-radius: 12px; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.12); cursor: pointer; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px; padding: 0 10px; }
.menu-btn:hover { background: rgba(0,0,0,0.6); }
.menu-btn span { display: block; width: 16px; height: 2px; background: #fff; border-radius: 1px; }
.brand { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-size: 14px; }
.brand-text { font-weight: bold; background: linear-gradient(90deg, #4A90D9, #9B59B6, #FFB6C1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.ambience-switch { display: flex; gap: 2px; padding: 4px; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; }
.ambience-switch button { padding: 5px 12px; border: none; background: transparent; color: #999; cursor: pointer; font-size: 12px; border-radius: 16px; font-family: inherit; transition: all 0.25s; }
.ambience-switch button.active { background: rgba(255,255,255,0.15); color: #fff; }
.info-pill { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 12px; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
.info-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: #6BCB77; box-shadow: 0 0 8px #6BCB77; }
.info-pill .dot.calling { background: #FFD93D; box-shadow: 0 0 8px #FFD93D; }

.scenario-rail { position: absolute; left: 18px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 50; }
.scenario-item { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(0,0,0,0.45); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; cursor: pointer; font-size: 12px; color: #ccc; white-space: nowrap; overflow: hidden; max-width: 44px; transition: all 0.25s; }
.scenario-item:hover { max-width: 200px; background: rgba(0,0,0,0.65); }
.scenario-item.active { background: rgba(0,0,0,0.65); color: #fff; font-weight: bold; max-width: 200px; }
.sc-icon { font-size: 16px; flex-shrink: 0; }
.sc-name { opacity: 0; transition: opacity 0.3s; }
.scenario-item:hover .sc-name, .scenario-item.active .sc-name { opacity: 1; }

.stage { position: absolute; top: 70px; left: 0; right: 0; height: 58vh; z-index: 30; pointer-events: none; }
.center-halo { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 500px; height: 500px; border-radius: 50%; pointer-events: none; filter: blur(50px); opacity: 0.4; transition: background 1.5s; }

.paper-doll { position: absolute; top: 0; left: 0; width: 130px; height: 145px; pointer-events: auto; cursor: pointer; will-change: transform; transition: filter 0.3s; filter: drop-shadow(0 12px 24px rgba(0,0,0,0.55)); }
.paper-doll.speaking { filter: drop-shadow(0 0 30px var(--color)) drop-shadow(0 0 60px var(--color)) drop-shadow(0 12px 24px rgba(0,0,0,0.55)); z-index: 20; }
.paper-doll.thinking { filter: drop-shadow(0 0 20px var(--color)); }
.paper-doll.mentioned { filter: drop-shadow(0 0 25px #FFD93D) drop-shadow(0 12px 24px rgba(0,0,0,0.55)); }
.paper-doll.approaching { filter: drop-shadow(0 0 25px var(--color)); z-index: 15; }
.paper-doll.reacting img { animation: reactShake 0.5s ease-out; }
.paper-doll.visiting-out { transition: transform 0.8s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.5s; }
@keyframes reactShake { 0%, 100% { transform: translateX(0) rotate(0); } 20% { transform: translateX(-8px) rotate(-5deg); } 60% { transform: translateX(6px) rotate(4deg); } }

.doll-img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.doll-shadow { position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 60%; height: 10px; background: radial-gradient(ellipse, rgba(0,0,0,0.4), transparent 70%); border-radius: 50%; z-index: -1; }
.doll-tag { position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; color: #fff; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }

.emote-bubble { position: absolute; top: -30px; left: 50%; transform: translateX(-50%); font-size: 28px; pointer-events: none; }
.emote-enter-active { animation: emotePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes emotePop { from { transform: translateX(-50%) scale(0.3); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }

.doll-bubble { position: absolute; top: -22px; left: 50%; transform: translateX(-50%); background: #fff; color: #1a1a2e; padding: 7px 13px; border-radius: 14px; font-size: 12px; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 6px 20px rgba(0,0,0,0.35); font-weight: 500; }
.doll-bubble::after { content: ''; position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #fff; }
.doll-bubble .tdot { display: inline-block; width: 5px; height: 5px; margin: 0 1px; border-radius: 50%; background: #4A90D9; animation: tdBounce 1.2s infinite; }
.doll-bubble .tdot:nth-child(2) { animation-delay: 0.2s; }
.doll-bubble .tdot:nth-child(3) { animation-delay: 0.4s; }
@keyframes tdBounce { 0%,60%,100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
.pop-enter-active { animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes pop { from { transform: translateX(-50%) scale(0.5); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }

.incoming-visitor {
  position: absolute;
  right: 6%;
  top: 30%;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  z-index: 35; 
  filter: drop-shadow(0 0 30px var(--visitor-color)) drop-shadow(0 8px 20px rgba(0,0,0,0.5));
  animation: visitorFloat 3s ease-in-out infinite;
}

@keyframes visitorFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.visitor-avatar {
  width: 110px;
  height: 120px;
  object-fit: contain;
}

.visitor-name {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  margin-top: -4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}

.visitor-bubble {
  position: absolute;
  top: -36px;
  background: #fff;
  color: #1a1a2e;
  padding: 8px 14px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  animation: bubbleBounce 2s ease-in-out infinite;
}

.visitor-bubble::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #fff;
}

@keyframes bubbleBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.visitor-enter-enter-active {
  animation: visitorSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.visitor-enter-leave-active {
  animation: visitorSlideIn 0.4s reverse;
}

@keyframes visitorSlideIn {
  from {
    opacity: 0;
    transform: translateX(200px) scale(0.7);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

/* 聊天抽屉：适度透明，磨砂玻璃 (0.55) */
.chat-drawer { 
  position: absolute; 
  left: 50%; 
  bottom: 78px; 
  transform: translateX(-50%); 
  width: calc(100% - 44px); 
  max-width: 820px; 
  background: rgba(15, 15, 25, 0.55); /* 调整为 0.55，比原来 0.6 稍微透明一点 */
  backdrop-filter: blur(20px) saturate(160%); 
  -webkit-backdrop-filter: blur(20px) saturate(160%); 
  border: 1px solid rgba(255,255,255,0.15); 
  border-radius: 24px; 
  z-index: 20; 
  box-shadow: 0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1); 
  display: flex; 
  flex-direction: column; 
  transition: height 0.5s cubic-bezier(0.34, 1.2, 0.64, 1); 
  overflow: hidden; 
}
.drawer-handle { padding: 8px 0 4px; cursor: pointer; display: flex; justify-content: center; }
.drawer-handle:hover .handle-bar { background: rgba(255,255,255,0.5); width: 60px; }
.handle-bar { width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.25); transition: all 0.3s; }

.chat-head { padding: 8px 24px 10px; display: flex; justify-content: space-between; align-items: center; }
.chat-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: bold; }
.hash { color: #4A90D9; font-size: 18px; }
.topic-label { color: #999; font-weight: normal; font-size: 12px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-stats { display: flex; gap: 8px; align-items: center; }
.stat { font-size: 12px; color: #FF6B6B; padding: 3px 10px; background: rgba(255,107,107,0.12); border-radius: 10px; font-weight: bold; }
.mode-tag { font-size: 11px; padding: 3px 8px; border-radius: 10px; font-weight: bold; }
.mode-tag.quiet { background: rgba(155,89,182,0.2); }
.mode-tag.lively { background: rgba(255,107,107,0.2); }

.discuss-bar { display: flex; align-items: center; gap: 10px; padding: 8px 24px; background: rgba(74,144,217,0.1); border-top: 1px solid rgba(74,144,217,0.2); border-bottom: 1px solid rgba(74,144,217,0.2); }
.discuss-status { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #7fb2e5; font-weight: bold; flex: 1; }
.pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: #4A90D9; animation: pulse 1.2s infinite; }
.pulse-dot.paused { background: #FFD93D; animation: none; }
@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
.bar-btn { padding: 5px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: #fff; cursor: pointer; font-size: 12px; font-family: inherit; transition: all 0.2s; }
.bar-btn:hover { background: rgba(255,255,255,0.15); }
.bar-btn.stop { background: rgba(255,107,107,0.2); border-color: rgba(255,107,107,0.4); color: #FF6B6B; }
.bar-btn.stop:hover { background: rgba(255,107,107,0.3); }

.chat-scroll { flex: 1; overflow-y: auto; padding: 12px 24px; display: flex; flex-direction: column; gap: 14px; }
.chat-scroll::-webkit-scrollbar { width: 5px; }
.chat-scroll::-webkit-scrollbar-thumb { background: rgba(74,144,217,0.4); border-radius: 3px; }

.empty { text-align: center; padding: 40px 20px; color: #999; }
.empty-emoji { font-size: 48px; margin-bottom: 12px; }
.empty-title { font-size: 16px; color: #fff; font-weight: bold; margin-bottom: 6px; }
.empty-tip { font-size: 13px; }

.msg-row { display: flex; gap: 10px; align-items: flex-start; animation: msgIn 0.3s; }
.msg-row.left { justify-content: flex-start; }
.msg-row.right { justify-content: flex-end; }
@keyframes msgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}
.visitor-badge {
  position: absolute;
  bottom: -4px;
  right: -6px;
  background: #FFD93D;
  color: #000;
  font-size: 9px;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 6px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  border: 1px solid #1a1a2e;
}

.avatar { width: 42px; height: 42px; border-radius: 10px; object-fit: cover; background: rgba(255,255,255,0.1); flex-shrink: 0; cursor: pointer; transition: transform 0.2s; }
.avatar:hover { transform: scale(1.1); }
.user-avatar { display: flex; align-items: center; justify-content: center; font-size: 22px; background: linear-gradient(135deg, #6BCB77, #4A90D9); }

.msg-main { max-width: 68%; display: flex; flex-direction: column; gap: 4px; }
.nick { font-size: 11px; color: #999; padding: 0 6px; font-weight: bold; display: flex; align-items: center; gap: 4px; }
.nick.user { text-align: right; color: #6BCB77; }
.visitor-tag { font-size: 10px; color: #FFD93D; background: rgba(255,217,61,0.15); padding: 1px 6px; border-radius: 4px; }

.bubble { padding: 10px 15px; font-size: 14px; line-height: 1.55; word-break: break-word; border-radius: 4px 14px 14px 14px; }
.bubble.ai { background: rgba(255,255,255,0.94); color: #1a1a2e; box-shadow: 0 3px 12px rgba(0,0,0,0.2); }
.bubble.bubble-muted { opacity: 0.5; font-style: italic; }
.bubble.visitor-bubble-style {
  background: rgba(255, 217, 61, 0.08);
  border: 1px dashed #FFD93D;
  color: #FFD93D;
  box-shadow: 0 3px 12px rgba(255,217,61,0.15);
}
.bubble.user { background: linear-gradient(135deg, #4A90D9, #9B59B6); color: #fff; border-radius: 14px 4px 14px 14px; box-shadow: 0 3px 12px rgba(74,144,217,0.3); }
.bubble.typing { display: flex; gap: 4px; padding: 14px 16px; }
.bubble.typing span { width: 6px; height: 6px; border-radius: 50%; background: #4A90D9; animation: tdBounce 1.2s infinite; }
.bubble.typing span:nth-child(2) { animation-delay: 0.2s; }
.bubble.typing span:nth-child(3) { animation-delay: 0.4s; }
.bubble.visitor-bubble-style.typing span { background: #FFD93D; }

.sys-row { display: flex; justify-content: center; }
.sys-row span { font-size: 12px; color: #999; background: rgba(0,0,0,0.4); padding: 5px 14px; border-radius: 12px; }

.summary-card { background: linear-gradient(135deg, rgba(74,144,217,0.15), rgba(155,89,182,0.15)); border: 1px solid rgba(74,144,217,0.4); border-radius: 16px; padding: 18px 22px; margin: 8px 0; animation: msgIn 0.5s; }
.summary-head { font-size: 15px; font-weight: bold; color: #4A90D9; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.summary-body { font-family: inherit; font-size: 13px; line-height: 1.85; color: #e0e0e0; white-space: pre-wrap; word-break: break-word; }

.input-bar { padding: 12px 20px 14px; display: flex; flex-direction: column; gap: 8px; }
.mention-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,217,61,0.2); color: #FFD93D; padding: 4px 12px; border-radius: 12px; font-size: 12px; align-self: flex-start; font-weight: bold; }
.mention-pill .x { cursor: pointer; font-size: 14px; opacity: 0.7; }
.input-row { display: flex; gap: 10px; }
.chat-input { flex: 1; padding: 12px 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.3); color: #fff; font-size: 14px; outline: none; font-family: inherit; }
.chat-input:focus { border-color: #4A90D9; box-shadow: 0 0 0 3px rgba(74,144,217,0.15); }
.send-btn { padding: 12px 26px; border-radius: 12px; border: none; background: linear-gradient(135deg, #4A90D9, #9B59B6); color: #fff; font-weight: bold; cursor: pointer; font-size: 14px; font-family: inherit; min-width: 80px; transition: all 0.2s; }
.send-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
.send-btn:disabled { background: #444; cursor: not-allowed; }

.toolbar { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; padding: 8px 12px; background: rgba(10,10,22,0.7); backdrop-filter: blur(24px); border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); z-index: 60; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
.tool-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 12px; border-radius: 12px; border: none; background: transparent; color: #ccc; cursor: pointer; font-family: inherit; min-width: 52px; transition: all 0.2s; }
.tool-btn:hover { background: rgba(255,255,255,0.1); color: #fff; transform: translateY(-2px); }
.tool-btn .ti { font-size: 18px; }
.tool-btn .tl { font-size: 10px; opacity: 0.8; }

.ach-toast { position: fixed; top: 70px; left: 50%; transform: translateX(-50%); z-index: 300; background: linear-gradient(135deg, #FFD93D, #FF6B6B); color: #000; padding: 10px 24px; border-radius: 30px; font-weight: bold; font-size: 14px; box-shadow: 0 8px 30px rgba(255,217,61,0.5); }
.ach-enter-active, .ach-leave-active { transition: all 0.4s; }
.ach-enter-from, .ach-leave-to { opacity: 0; transform: translateX(-50%) translateY(-20px); }

.mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; opacity: 0; pointer-events: none; transition: opacity 0.25s; }
.mask.show { opacity: 1; pointer-events: auto; }

.side-menu { position: fixed; top: 0; right: 0; width: 300px; height: 100vh; background: rgba(15,15,28,0.98); backdrop-filter: blur(24px); border-left: 1px solid rgba(255,255,255,0.1); z-index: 210; display: flex; flex-direction: column; padding: 22px; transform: translateX(100%); transition: transform 0.3s ease; box-shadow: -10px 0 40px rgba(0,0,0,0.5); }
.side-menu.open { transform: translateX(0); }
.menu-head { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 16px; }
.menu-title { font-size: 16px; font-weight: bold; background: linear-gradient(90deg, #4A90D9, #9B59B6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.close-btn { width: 32px; height: 32px; border-radius: 50%; border: none; background: rgba(255,255,255,0.1); color: #fff; cursor: pointer; font-size: 18px; line-height: 1; }
.close-btn:hover { background: rgba(255,255,255,0.2); }
.menu-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.menu-nav button { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: none; background: transparent; color: #bbb; border-radius: 10px; cursor: pointer; font-size: 14px; font-family: inherit; text-align: left; transition: all 0.2s; }
.menu-nav button:hover { background: rgba(255,255,255,0.06); color: #fff; }
.menu-nav button.active { background: rgba(74,144,217,0.2); color: #fff; }
.menu-nav button span { font-size: 18px; width: 22px; }
.menu-foot { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px; display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: #999; }
.menu-foot > div { display: flex; justify-content: space-between; }
.menu-foot b { color: #fff; }

.panel-drawer { position: fixed; top: 0; left: 0; width: 100%; max-width: 560px; height: 100vh; background: rgba(15,15,28,0.98); backdrop-filter: blur(24px); border-right: 1px solid rgba(255,255,255,0.1); z-index: 210; display: flex; flex-direction: column; transform: translateX(-100%); transition: transform 0.3s ease; box-shadow: 10px 0 40px rgba(0,0,0,0.5); }
.panel-drawer.open { transform: translateX(0); }
.panel-head { display: flex; justify-content: space-between; align-items: center; padding: 24px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.panel-head h2 { font-size: 18px; }
.back-btn { padding: 10px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color: #fff; cursor: pointer; font-size: 13px; font-family: inherit; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
.back-btn:hover { background: rgba(255,255,255,0.15); transform: translateX(-2px); }
.back-btn span { font-size: 16px; }
.panel-body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 22px; }
.panel-body section { display: flex; flex-direction: column; gap: 10px; }
.panel-body h3 { font-size: 13px; color: #aaa; }
.hint { font-size: 11px; color: #666; margin-top: 4px; }
.scene-picker { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.scene-chip { padding: 12px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #ccc; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s; }
.scene-chip.active { color: #fff; font-weight: bold; }
.drawer-input { padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.4); color: #fff; font-size: 14px; outline: none; font-family: inherit; }
.drawer-input:focus { border-color: #4A90D9; }
.topic-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.topic-chips button { padding: 6px 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3); color: #ccc; font-size: 12px; cursor: pointer; font-family: inherit; }
.topic-chips button:hover { background: rgba(255,255,255,0.1); color: #fff; }
.round-picker { display: flex; gap: 8px; }
.round-picker button { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3); color: #ccc; cursor: pointer; font-family: inherit; transition: all 0.2s; }
.round-picker button.active { background: #4A90D9; color: #fff; border-color: #4A90D9; font-weight: bold; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.big-btn { flex: 1; padding: 14px; border-radius: 10px; border: none; color: #fff; font-weight: bold; cursor: pointer; font-size: 14px; font-family: inherit; min-width: 160px; }
.big-btn:disabled { background: #444 !important; cursor: not-allowed; }
.hot-list { display: flex; flex-direction: column; gap: 6px; }
.hot-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.03); cursor: pointer; transition: background 0.2s; }
.hot-item:hover { background: rgba(255,255,255,0.08); }
.rank { width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
.rank.top3 { background: linear-gradient(135deg, #FFD93D, #FF6B6B); color: #000; }
.htitle { flex: 1; font-size: 14px; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; }
.profile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.profile-card { padding: 16px; border-radius: 12px; border: 2px solid; background: rgba(255,255,255,0.03); }
.profile-card img { width: 60px; height: 60px; border-radius: 50%; background: rgba(255,255,255,0.05); margin-bottom: 8px; }
.pname { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
.prole { font-size: 12px; color: #999; margin-bottom: 8px; }
.profile-card p { font-size: 13px; color: #ccc; line-height: 1.5; margin-bottom: 8px; }
.mini { padding: 6px 12px; border-radius: 8px; border: none; color: #fff; font-size: 12px; cursor: pointer; font-family: inherit; }
.stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.stat-cell { padding: 14px; border-radius: 10px; background: rgba(255,255,255,0.04); text-align: center; }
.stat-cell b { display: block; font-size: 22px; color: #4A90D9; margin-bottom: 4px; }
.stat-cell span { font-size: 11px; color: #999; }
.empty-tip { text-align: center; padding: 40px 20px; color: #666; }
.history-list { display: flex; flex-direction: column; gap: 12px; }
.history-card { padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.04); }
.hhead { display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-bottom: 6px; }
.history-card h3 { font-size: 14px; color: #fff; margin-bottom: 6px; }
.history-card p { font-size: 12px; color: #aaa; line-height: 1.5; margin-bottom: 10px; }
.hactions { display: flex; gap: 8px; }
.hactions button { padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); color: #ccc; font-size: 12px; cursor: pointer; font-family: inherit; }
.about h3 { font-size: 18px; color: #4A90D9; margin-bottom: 10px; }
.about h4 { font-size: 14px; color: #9B59B6; margin: 16px 0 8px; }
.about p { font-size: 13px; color: #bbb; line-height: 1.7; }
.about ul { padding-left: 20px; }
.about li { font-size: 13px; color: #ccc; line-height: 1.8; }
.esc-tip { margin-top: 20px; padding: 10px 14px; background: rgba(74,144,217,0.1); border-radius: 8px; color: #7fb2e5 !important; font-size: 12px !important; }

@media (max-width: 768px) {
  .topbar { padding: 8px 12px; }
  .top-left, .top-right { gap: 8px; }
  .menu-btn { width: 32px; height: 32px; padding: 0 8px; }
  .brand { padding: 4px 10px; font-size: 12px; }
  .ambience-switch { padding: 2px; }
  .ambience-switch button { padding: 4px 8px; font-size: 10px; }
  .info-pill { display: none; }
  .scenario-rail { display: none; }
  .stage { top: 50px; }
  .paper-doll { width: 80px; height: 90px; }
  .doll-tag { padding: 2px 8px; font-size: 10px; bottom: -4px; }
  .doll-bubble { top: -18px; padding: 4px 8px; font-size: 11px; }
  .incoming-visitor { right: 2%; top: 20%; transform: scale(0.8); }
  .chat-drawer { bottom: 65px; height: 45vh !important; }
  .chat-head { padding: 8px 16px; }
  .chat-title { font-size: 13px; }
  .topic-label { max-width: 120px; }
  .discuss-bar { padding: 6px 16px; }
  .chat-scroll { padding: 10px 16px; gap: 10px; }
  .bubble { font-size: 13px; padding: 8px 12px; }
  .input-bar { padding: 10px 16px; }
  .chat-input { padding: 10px 14px; font-size: 13px; }
  .send-btn { padding: 10px 18px; min-width: 60px; font-size: 13px; }
  .toolbar { width: 95%; overflow-x: auto; justify-content: flex-start; padding: 6px 8px; bottom: 10px; }
  .toolbar::-webkit-scrollbar { display: none; }
  .tool-btn { min-width: 40px; padding: 4px 6px; }
  .tool-btn .ti { font-size: 16px; }
  .tool-btn .tl { display: none; }
  .side-menu, .panel-drawer { width: 100%; max-width: 100%; }
}
</style>