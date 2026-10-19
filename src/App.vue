<template>
  <div 
    class="app" 
    @mousemove="onMousemove" 
    @mouseup="onDragEnd" 
    @mouseleave="onDragEnd" 
    @dblclick="onDoubleClick"
    @click="onClick"
  >
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
      <div 
        v-for="(sc, key) in scenarios" 
        :key="key"
        class="scenario-item"
        :class="{ active: currentScenarioKey === key }"
        :style="currentScenarioKey === key ? { borderColor: sc.accent, boxShadow: `0 0 20px ${sc.accent}55` } : {}"
        @click.stop="switchScenario(key)"
      >
        <span class="sc-icon">{{ sc.icon }}</span>
        <span class="sc-name">{{ sc.name }}</span>
      </div>
    </div>

    <div class="stage">
      <div class="center-halo" :style="{ background: `radial-gradient(circle, ${currentScenario.accent}22, transparent 70%)` }"></div>

      <div v-for="item in droppedItems" :key="item.id" class="dropped-item" :style="{ left: item.x + 'px', top: item.y + 'px', fontSize: '40px' }">
        {{ item.emoji }}
      </div>

      <transition name="visitor-enter">
        <div v-if="incomingVisitor" class="incoming-visitor" :style="{ '--visitor-color': incomingVisitor.color }">
          <div class="visitor-bubble" v-if="visitorBubble">{{ visitorBubble }}</div>
          <img :src="incomingVisitor.avatar" class="visitor-avatar" draggable="false" />
          <div class="visitor-name" :style="{ background: incomingVisitor.color }">{{ incomingVisitor.name }} · 来访</div>
        </div>
      </transition>

      <div 
        v-for="char in characters" 
        :key="char.id"
        class="paper-doll"
        :class="dollClass(char.id)"
        :style="dollStyle(char.id)"
        @mousedown.stop.prevent="onDragStart($event, char.id)"
        @click.stop="handleDollClick(char)"
      >
        <div class="doll-shadow"></div>
        <img :src="char.avatar" :alt="char.name" class="doll-img" draggable="false" />
        
        <div v-if="currentModeKey === 'mystery'" class="mystery-aura"></div>

        <div class="doll-tag" :style="{ background: char.color }">
          {{ char.name }}
          <span v-if="currentModeKey === 'mystery' && char.scriptRole" class="script-role-badge">{{ char.scriptRole }}</span>
          <span v-else-if="char.affection > 0" class="affection-badge">❤️{{ char.affection }}</span>
        </div>
        
        <transition name="emote">
          <div v-if="emoteBubbles[char.id]" class="emote-bubble" :style="{ filter: `drop-shadow(0 0 12px ${char.effectColor})` }">
            {{ emoteBubbles[char.id] }}
          </div>
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

    <div class="chat-drawer" :style="{ height: chatHeight + 'vh' }">
      <div class="drawer-handle" @click.stop="drawerExpanded = !drawerExpanded">
        <div class="handle-bar"></div>
      </div>

      <div class="chat-head">
        <div class="chat-title">
          <span class="hash">#</span>
          <span>{{ currentScenario.name }}</span>
          <span v-if="currentModeKey !== 'normal'" class="mode-label" :style="{ background: currentMode.color }">{{ currentMode.name }}</span>
        </div>
        <div class="chat-stats">
          <span class="stat" v-if="isDiscussing">第 {{ currentRound }}/{{ totalRounds }} 轮</span>
          <span class="mode-tag" :class="ambienceMode">{{ ambienceMode === 'quiet' ? '🌙' : '🔥' }}</span>
        </div>
      </div>

      <div class="discuss-bar" v-if="isDiscussing">
        <span class="discuss-status">
          <span class="pulse-dot" :class="{ paused: isPaused }"></span>
          {{ isPaused ? '已暂停' : discussPhase }}
        </span>
        <button class="bar-btn" @click.stop="togglePause">{{ isPaused ? '▶ 继续' : '⏸ 暂停' }}</button>
        <button class="bar-btn stop" @click.stop="stopDiscussion">⏹ 结束</button>
      </div>

      <div class="chat-scroll" ref="chatArea">
        <div v-if="messages.length === 0" class="empty">
          <div class="empty-emoji">💬</div>
          <div class="empty-title">开始一场对话吧</div>
          <div class="empty-tip">双击空白处或点击下方🍰可以投喂零食哦~</div>
        </div>

        <template v-for="(msg, index) in messages" :key="index">
          <div v-if="msg.speaker === 'system'" class="sys-row">
            <span v-html="msg.content"></span>
          </div>
          
          <div v-else-if="msg.speaker === 'summary'" class="summary-card">
            <div class="summary-head">📋 圆桌纪要</div>
            <pre class="summary-body">{{ msg.content }}</pre>
          </div>
          
          <div v-else-if="msg.speaker !== 'user'" class="msg-row left">
            <div class="avatar-wrapper">
              <img :src="getAvatar(msg.speaker)" class="avatar" @click.stop="mentionCharacter(getChar(msg.speaker))" />
            </div>
            <div class="msg-main">
              <div class="nick" :style="{ color: getColor(msg.speaker) }">
                {{ getName(msg.speaker) }}
                <span v-if="currentModeKey === 'mystery' && getChar(msg.speaker)?.scriptRole" class="script-tag">🎭 {{ getChar(msg.speaker)?.scriptRole }}</span>
                <span v-else class="affection-tag">❤️ {{ getChar(msg.speaker)?.affection || 0 }}</span>
              </div>
              <div class="bubble ai" :class="{ 'bubble-muted': msg.isFallback }">
                {{ msg.content }}
              </div>
            </div>
          </div>
          
          <div v-else class="msg-row right">
            <div class="msg-main">
              <div class="nick user">我 <span v-if="currentModeKey === 'mystery' && myScriptRole" class="script-tag">🎭 {{ myScriptRole.name }}</span></div>
              <div class="bubble user">{{ msg.content }}</div>
            </div>
            <div class="avatar user-avatar">😎</div>
          </div>
        </template>

        <div v-if="typingId" class="msg-row left">
          <div class="avatar-wrapper">
            <img :src="getAvatar(typingId)" class="avatar" />
          </div>
          <div class="msg-main">
            <div class="nick" :style="{ color: getColor(typingId) }">{{ getName(typingId) }}</div>
            <div class="bubble ai typing"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>

      <div class="input-bar">
        <div class="mention-pill" v-if="userMention">
          @{{ userMention.name }}
          <span class="x" @click.stop="userMention = null; mentionedCharId = ''">×</span>
        </div>
        <div class="input-row">
          <textarea 
            v-model="userMessage" 
            class="chat-input textarea-input" 
            rows="1" 
            :placeholder="inputPlaceholder" 
            @keydown.enter="onEnter" 
            @focus="onInputFocus"
            resize="none"
          ></textarea>
          <button class="send-btn" @click.stop="userSpeak" :disabled="!userMessage.trim()">
            {{ isDiscussing ? '插话' : '发送' }}
          </button>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <button class="tool-btn" @click.stop="greetUser"><span class="ti">👋</span><span class="tl">打招呼</span></button>
      <button class="tool-btn" @click.stop="openPanel('setup')"><span class="ti">🎬</span><span class="tl">发起</span></button>
      <button class="tool-btn" @click.stop="triggerFeed"><span class="ti">🍰</span><span class="tl">投喂</span></button>
      <button class="tool-btn" @click.stop="visitNeighbor"><span class="ti">🚪</span><span class="tl">串门</span></button>
      <button v-if="currentModeKey === 'mystery'" class="tool-btn highlight" @click.stop="showScriptBook = true"><span class="ti">📖</span><span class="tl">查看剧本</span></button>
      <button class="tool-btn" @click.stop="openPanel('hotsearch')"><span class="ti">🔥</span><span class="tl">热搜</span></button>
      <button class="tool-btn" @click.stop="openPanel('profiles')"><span class="ti">👥</span><span class="tl">角色</span></button>
      <button class="tool-btn" @click.stop="openPanel('history')"><span class="ti">📜</span><span class="tl">历史</span></button>
    </div>

    <transition name="ach"><div class="ach-toast" v-if="recentAchievement">🏆 {{ recentAchievement }}</div></transition>
    <div class="mask" :class="{ show: menuOpen || activeTab !== 'chat' }" @click="closeAllLayers"></div>

    <aside class="side-menu" :class="{ open: menuOpen }" @click.stop>
      <div class="menu-head"><div class="menu-title">🎙️ AI 圆桌派</div><button class="close-btn" @click="menuOpen = false">×</button></div>
      <nav class="menu-nav">
        <button v-for="item in navItems" :key="item.id" :class="{ active: activeTab === item.id }" @click="openPanel(item.id)">
          <span>{{ item.icon }}</span>{{ item.label }}
        </button>
      </nav>
      <div class="menu-foot"><div><span>AI 调用</span><b>{{ apiCallCount }}</b></div><div><span>历史场次</span><b>{{ discussionHistory.length }}</b></div></div>
    </aside>

    <aside class="panel-drawer" :class="{ open: activeTab !== 'chat' }" @click.stop>
      <div class="panel-head"><h2>{{ panelTitle }}</h2><button class="back-btn" @click="activeTab = 'chat'"><span>←</span> 返回聊天</button></div>
      <div class="panel-body">
        <div v-if="activeTab === 'setup'">
          <section>
            <h3>🎮 玩法模式</h3>
            <div class="mode-picker">
              <div v-for="(m, key) in modes" :key="key" class="mode-chip" :class="{ active: currentModeKey === key }" :style="currentModeKey === key ? { borderColor: m.color, background: m.color + '22' } : {}" @click="currentModeKey = key; if(key==='mystery') openMysteryModal()">
                <span>{{ m.icon }}</span> {{ m.name }}
                <span class="mode-desc">{{ m.desc }}</span>
              </div>
            </div>
          </section>
          <section>
            <h3>📍 场景背景</h3>
            <div class="scene-picker">
              <div v-for="(sc, key) in scenarios" :key="key" class="scene-chip" :class="{ active: currentScenarioKey === key }" :style="currentScenarioKey === key ? { borderColor: sc.accent, background: sc.accent + '22' } : {}" @click="switchScenario(key)">
                <span>{{ sc.icon }}</span> {{ sc.name }}
              </div>
            </div>
          </section>
          <section>
            <h3>💬 话题</h3>
            <input v-model="topic" class="drawer-input" :placeholder="'试试：' + rotatingTopic" @keyup.enter="startDiscussion" />
            <div class="topic-chips"><button v-for="(t, i) in currentScenario.topics" :key="i" @click="topic = t">{{ t }}</button></div>
          </section>
          <section>
            <h3>⏱️ 讨论轮数</h3>
            <div class="round-picker"><button v-for="n in [15, 30, 50, 80]" :key="n" :class="{ active: totalRounds === n }" @click="totalRounds = n">{{ n }} 轮</button></div>
          </section>
          <div class="actions">
            <button class="big-btn" :style="{ background: `linear-gradient(135deg, ${currentScenario.accent}, ${currentScenario.accent2})` }" @click="startDiscussion" :disabled="isDiscussing">🚀 开始讨论</button>
          </div>
        </div>
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
              <div class="prole">好感度: ❤️ {{ char.affection || 0 }}</div>
              <div class="prole">{{ char.personality }}</div>
              <p>{{ char.description }}</p>
              <button class="mini" :style="{ background: char.color }" @click="startPrivateChat(char)">单独聊 →</button>
            </div>
          </div>
        </div>
        <div v-if="activeTab === 'history'">
          <div v-if="discussionHistory.length === 0" class="empty-tip">暂无记录</div>
          <div v-else class="history-list">
            <div v-for="(h, i) in discussionHistory" :key="i" class="history-card">
              <div class="hhead"><span>{{ h.sceneIcon }} {{ h.sceneName }}</span><span>{{ h.time }}</span></div>
              <h3>{{ h.topic }}</h3>
              <p>{{ h.preview }}</p>
              <div class="hactions"><button @click="loadHistory(h)">📂 载入</button><button @click="deleteHistory(i)">🗑 删除</button></div>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <div class="script-modal-mask" v-if="showScriptModal" @click.self="showScriptModal = false">
      <div class="script-modal">
        <h2>🕵️ 选择剧本杀</h2>
        <div class="script-list">
          <div v-for="(script, idx) in availableScripts" :key="idx" class="script-item" :class="{ active: selectedScriptIdx === idx }" @click="selectedScriptIdx = idx">
            <h3>{{ script.title }}</h3>
            <p>{{ script.desc }}</p>
          </div>
        </div>
        <div class="player-count">
          <span>选择人数 (含你):</span>
          <button v-for="n in [3, 4, 5, 6]" :key="n" :class="{ active: playerCount === n }" @click="playerCount = n">{{ n }}人</button>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="showScriptModal = false">取消</button>
          <button class="confirm-btn" @click="confirmScript">确认发车</button>
        </div>
      </div>
    </div>

    <div class="script-book-mask" v-if="showScriptBook && myScriptRole" @click.self="showScriptBook = false">
      <div class="script-book">
        <div class="book-header">
          <span class="book-title">{{ currentScriptTitle }}</span>
          <button class="close-btn" @click="showScriptBook = false">×</button>
        </div>
        <div class="book-content">
          <div class="role-info">
            <h3>你的角色：<span class="role-name">{{ myScriptRole.name }}</span></h3>
            <p class="role-quote">"{{ myScriptRole.quote }}"</p>
            <div class="role-bg"><strong>背景故事：</strong>{{ myScriptRole.background }}</div>
            <div class="role-task"><strong>任务目标：</strong>{{ myScriptRole.task }}</div>
          </div>
          
          <div class="acts-container">
            <div v-for="(act, idx) in myScriptRole.acts" :key="idx" class="act-card" :class="{ locked: !act.unlocked }">
              <div class="act-title">第 {{ idx + 1 }} 幕：{{ act.title }}</div>
              <div class="act-body" v-if="act.unlocked">{{ act.content }}</div>
              <div class="act-body locked-text" v-else>🔒 剧情尚未解锁，随着讨论的深入将自动开启...</div>
            </div>
          </div>
        </div>
        <div class="book-footer"><span>* 剧情会根据圆桌进度自动解锁</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { callAI, generateSummary } from '@/api/ai.js'
import { scriptDataTemplates } from '@/data/scripts.js'

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
  { id: 'history', icon: '📜', label: '历史记录' }
]
const panelTitles = {
  setup: '🎬 发起讨论', hotsearch: '🔥 热搜榜', profiles: '👥 角色档案', history: '📜 历史记录'
}

const scenarios = {
  cafe: {
    name: '深夜咖啡馆', icon: '☕', bgImage: cafeBg, accent: '#FFB6C1', accent2: '#FFD93D',
    keywords: ['情感','感情','喜欢','恋爱','失恋','朋友','孤独','心事','关系','分手','告白','想念','暗恋','焦虑','难过','开心','累'],
    topics: ['暗恋该不该表白？','异地恋能坚持吗？','友情和爱情怎么选？','分手后还能做朋友吗？','如何走出失恋？']
  },
  campus: {
    name: '校园图书馆', icon: '📚', bgImage: campusBg, accent: '#4A90D9', accent2: '#6BCB77',
    keywords: ['学习','考试','作业','大学','考研','专业','成绩','毕业','论文','熬夜','早八','室友'],
    topics: ['大学生该不该熬夜？','考研还是就业？','大学该不该谈恋爱？','室友关系怎么处理？','该不该转专业？']
  },
  cyber: {
    name: '赛博实验室', icon: '🌃', bgImage: cyberBg, accent: '#9B59B6', accent2: '#00d4ff',
    keywords: ['AI','人工智能','科技','未来','机器人','元宇宙','数据','算法','赛博','数字','编程','互联网'],
    topics: ['AI 会取代人类吗？','元宇宙是泡沫吗？','该不该学编程？','ChatGPT 改变了什么？']
  },
  rooftop: {
    name: '城市天台', icon: '🏙️', bgImage: rooftopBg, accent: '#FFD93D', accent2: '#FF6B6B',
    keywords: ['生活','社会','工作','梦想','焦虑','内卷','压力','人生','现实','迷茫','躺平','内耗','意义'],
    topics: ['内卷时代该躺平吗？','工作的意义是什么？','如何面对焦虑？','大城市的孤独感']
  },
  arcade: {
    name: '游戏公会', icon: '🎮', bgImage: arcadeBg, accent: '#FF6B6B', accent2: '#9B59B6',
    keywords: ['游戏','动漫','二次元','追剧','娱乐','电竞','主播','番剧','音乐','电影','刷剧','短视频'],
    topics: ['游戏是电子海洛因吗？','二次元文化出圈了吗？','追星该不该理智？','短视频让人变傻了吗？']
  }
}

const modes = {
  normal: { name: '常规辩论', icon: '⚔️', color: '#FF6B6B', desc: '激烈交锋，各抒己见' },
  psychology: { 
    name: '心理树洞', icon: '🌌', color: '#4A90D9', desc: '全员温柔安抚，禁止反驳', 
    prompt: '【心理疏导模式】你是一个极度温柔、充满共情能力的倾听者。绝不能说教，绝不反驳，绝不提供冰冷的建议。你只能使用理解、接纳、拥抱的语气。引导用户释放情绪，给他安全感。' 
  },
  mystery: { 
    name: '迷雾剧场', icon: '🕵️', color: '#9B59B6', desc: '沉浸式剧本杀',
    prompt: '【剧本杀模式】你正在参与一场剧本杀游戏。请严格遵守系统发给你的剧本设定！你是角色，不要跳戏。隐藏你的秘密，试探别人。' 
  },
  story: { 
    name: '故事接龙', icon: '🤪', color: '#6BCB77', desc: '一人一句，离谱脑洞', 
    prompt: '【故事接龙模式】大家在一起编故事。你必须顺着上一个人说的话继续往下编。必须脑洞大开，越离谱越好，绝对不要讲大道理或总结，只讲故事剧情。' 
  }
}

const availableScripts = [
  { title: '血色婚礼', desc: '一场豪华婚礼上，新郎突然中毒身亡，所有人都有嫌疑。' },
  { title: '赛博精神病', desc: '在2077年的夜之城，一个顶尖黑客死于自己的公寓，死因不明。' },
  { title: '午夜列车', desc: '一列开往北方的特快列车上，发生了一起密室杀人案。' }
]

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
  hotSearchList.value = [...allHotSearchPool].sort(() => Math.random() - 0.5).slice(0, 8)
}
refreshHotSearch()

const characters = ref([
  { id: 'che', name: '小澈', personality: '理性分析', avatar: cheImg, color: '#4A90D9', effectColor: '#00d4ff', emotion: 20, affection: 0, description: '数据分析师，逻辑控。', scriptRole: null, scriptSecret: '' },
  { id: 'man', name: '小满', personality: '温暖陪伴', avatar: manImg, color: '#FFB6C1', effectColor: '#FF69B4', emotion: 10, affection: 0, description: '幼教老师，温柔耐心。', scriptRole: null, scriptSecret: '' },
  { id: 'tiao', name: '小跳', personality: '开心果', avatar: tiaoImg, color: '#FFD93D', effectColor: '#FFD700', emotion: 40, affection: 0, description: '游戏主播，搞笑乐天派。', scriptRole: null, scriptSecret: '' },
  { id: 'dun', name: '小盾', personality: '靠谱担当', avatar: dunImg, color: '#6BCB77', effectColor: '#32CD32', emotion: 15, affection: 0, description: '生活管家，稳重爱操心。', scriptRole: null, scriptSecret: '' },
  { id: 'shan', name: '小闪', personality: '脑洞担当', avatar: shanImg, color: '#9B59B6', effectColor: '#DA70D6', emotion: 30, affection: 0, description: '灵感艺术家，脑洞大。', scriptRole: null, scriptSecret: '' },
  { id: 'mo', name: '小默', personality: '安静有想法', avatar: moImg, color: '#A8D8EA', effectColor: '#87CEEB', emotion: 5, affection: 0, description: '图书管理员，话少但一针见血。', scriptRole: null, scriptSecret: '' }
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

const usedAngles = new Set()
const usedStances = new Set()

function pickAngle() {
  const available = DISCUSSION_ANGLES.filter(a => !usedAngles.has(a))
  if (available.length === 0) { usedAngles.clear(); return DISCUSSION_ANGLES[Math.floor(Math.random() * DISCUSSION_ANGLES.length)] }
  const pick = available[Math.floor(Math.random() * available.length)]
  usedAngles.add(pick)
  return pick
}

function pickStance() {
  const available = STANCES.filter(s => !usedStances.has(s.id))
  if (available.length === 0) { usedStances.clear(); return STANCES[Math.floor(Math.random() * STANCES.length)] }
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
const currentSpeakerId = ref('')
const typingId = ref('')
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
const currentModeKey = ref('normal') 

const showScriptModal = ref(false)
const selectedScriptIdx = ref(0)
const playerCount = ref(3)
const showScriptBook = ref(false)
const currentScriptTitle = ref('')
const myScriptRole = ref(null)

const visitingCharId = ref(null)
const incomingVisitor = ref(null)
const visitorBubble = ref('')

const dragState = reactive({ id: null, lastX: 0, lastY: 0, vx: 0, vy: 0 })
const droppedItems = ref([])
const foodEmojis = ['☕', '🍰', '🍎', '🎮', '📚', '🥤', '🍔', '🍩']
let itemIdCounter = 0

const discussPhase = computed(() => {
  if (!isDiscussing.value) return ''
  if (currentRound.value <= 1) return '破冰阶段'
  if (currentRound.value >= totalRounds.value) return '收尾阶段'
  return `交锋中·第${currentRound.value}轮`
})

const screenW = ref(window.innerWidth)
const screenH = ref(window.innerHeight)
const stageH = computed(() => screenH.value * 0.58)

const getHomes = () => {
  if (currentModeKey.value === 'psychology') {
    return {
      che: { x: 0.05, y: 0.92 }, man: { x: 0.20, y: 0.98 }, tiao: { x: 0.35, y: 0.95 }, 
      dun: { x: 0.65, y: 0.95 }, shan: { x: 0.80, y: 0.98 }, mo: { x: 0.95, y: 0.92 } 
    }
  }
  return {
    che: { x: 0.15, y: 0.30 }, man: { x: 0.80, y: 0.25 }, tiao: { x: 0.85, y: 0.45 },
    dun: { x: 0.12, y: 0.45 }, shan: { x: 0.25, y: 0.38 }, mo: { x: 0.72, y: 0.38 }
  }
}

function createDoll(id) {
  const h = getHomes()[id]
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

watch(currentModeKey, () => {
  const homes = getHomes()
  Object.keys(dollStates).forEach(id => {
    const s = dollStates[id]
    s.tx = homes[id].x
    s.ty = homes[id].y
  })
})

const dollClass = (id) => {
  const s = dollStates[id]
  return {
    speaking: currentSpeakerId.value === id,
    thinking: typingId.value === id,
    mentioned: mentionedCharId.value === id,
    approaching: s.mood === 'approach',
    reacting: s.mood === 'react',
    walking: s.mood === 'wander' || s.mood === 'chase',
    dragging: s.mood === 'drag',
    listening: typingId.value && typingId.value !== id && s.mood === 'idle',
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
const MIN_X = -0.1, MAX_X = 1.1, MIN_Y = -0.2, MAX_Y = 1.1

const physicsLoop = (timestamp) => {
  if (!lastTime) lastTime = timestamp
  const dt = Math.min((timestamp - lastTime) / 1000, 0.033)
  lastTime = timestamp
  const now = Date.now()

  Object.entries(dollStates).forEach(([id, s]) => {
    if (s.mood === 'drag') {
      s.vx = 0
      s.vy = 0
      return 
    }

    if (s.mood === 'speaking' || s.mood === 'approach') {
      const ease = Math.min(1, dt * 5)
      s.x += (s.tx - s.x) * ease
      s.y += (s.ty - s.y) * ease
      s.vx *= 0.85
      s.vy *= 0.85
    } else if (now < s.pauseUntil) {
      s.vx *= 0.95
      s.vy *= 0.95
      s.x += s.vx * dt
      s.y += s.vy * dt
    } else {
      const k = 8 
      const damping = 1.2
      s.vx += ((s.tx - s.x) * k - s.vx * damping) * dt
      s.vy += ((s.ty - s.y) * k - s.vy * damping) * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
    }

    if (s.x < MIN_X) { s.x = MIN_X; s.vx = Math.abs(s.vx) * 0.8 }
    if (s.x > MAX_X) { s.x = MAX_X; s.vx = -Math.abs(s.vx) * 0.8 }
    if (s.y < MIN_Y) { s.y = MIN_Y; s.vy = Math.abs(s.vy) * 0.8 }
    if (s.y > MAX_Y) { s.y = MAX_Y; s.vy = -Math.abs(s.vy) * 0.8 }

    s.tx = Math.max(MIN_X, Math.min(MAX_X, s.tx))
    s.ty = Math.max(MIN_Y, Math.min(MAX_Y, s.ty))

    const dist = Math.hypot(s.tx - s.x, s.ty - s.y)
    if (dist < 0.02 && s.mood === 'idle') {
      const phase = now / 1000 + id.charCodeAt(0) * 0.7
      s.y += Math.sin(phase * 1.5) * 0.0006
    }

    const speedPx = Math.hypot(s.vx * screenW.value, s.vy * stageH.value)
    const targetTilt = Math.max(-15, Math.min(15, s.vx * screenW.value * 0.1))
    s.tilt += (targetTilt - s.tilt) * Math.min(1, dt * 12)

    const targetSquash = speedPx > 150 ? 1 + Math.min(0.1, speedPx * 0.0005) : 1
    s.squash += (targetSquash - s.squash) * Math.min(1, dt * 10)

    s.px = s.x * screenW.value
    s.py = s.y * stageH.value
  })

  checkFoodCollision()
  rafId = requestAnimationFrame(physicsLoop)
}

const onDragStart = (e, id) => {
  e.preventDefault() 
  dragState.id = id
  dragState.lastX = e.clientX
  dragState.lastY = e.clientY
  dragState.vx = 0
  dragState.vy = 0
  dollStates[id].mood = 'drag'
}

const onDragMove = (e) => {
  if (!dragState.id) return
  const s = dollStates[dragState.id]
  
  const dx = e.clientX - dragState.lastX
  const dy = e.clientY - dragState.lastY
  
  s.x += dx / screenW.value
  s.y += dy / stageH.value
  s.x = Math.max(MIN_X, Math.min(MAX_X, s.x))
  s.y = Math.max(MIN_Y, Math.min(MAX_Y, s.y))

  s.px = s.x * screenW.value
  s.py = s.y * stageH.value

  dragState.vx = Math.max(-30, Math.min(30, dx * 2.0))
  dragState.vy = Math.max(-30, Math.min(30, dy * 2.0))
  
  dragState.lastX = e.clientX
  dragState.lastY = e.clientY
}

const onDragEnd = () => {
  if (!dragState.id) return
  const s = dollStates[dragState.id]
  s.mood = 'idle'
  
  s.vx = dragState.vx
  s.vy = dragState.vy
  
  s.tx = s.x
  s.ty = s.y
  s.pauseUntil = Date.now() + 2000

  dragState.id = null
}

const onDoubleClick = (e) => {
  if (e.target.closest('.chat-drawer, .toolbar, .paper-doll, .side-menu, .script-modal-mask, .script-book-mask')) return
  spawnFood(e.clientX, e.clientY)
}

const triggerFeed = () => {
  spawnFood(window.innerWidth / 2 + (Math.random() - 0.5) * 200, window.innerHeight * 0.4)
}

const spawnFood = (x, y) => {
  const newItem = {
    id: ++itemIdCounter,
    emoji: foodEmojis[Math.floor(Math.random() * foodEmojis.length)],
    x: x,
    y: -50,
    targetY: y
  }
  droppedItems.value.push(newItem)
  
  setTimeout(() => {
    const target = droppedItems.value.find(i => i.id === newItem.id)
    if (target) target.y = target.targetY
  }, 50)

  setTimeout(() => {
    droppedItems.value = droppedItems.value.filter(i => i.id !== newItem.id)
  }, 8000)
}

const checkFoodCollision = () => {
  if (droppedItems.value.length === 0) return
  Object.entries(dollStates).forEach(([id, s]) => {
    if (s.mood === 'drag' || s.mood === 'speaking') return
    droppedItems.value.forEach((item, index) => {
      if (item.y < 0) return 
      
      const dist = Math.hypot((s.x * screenW.value) - item.x, (s.y * stageH.value) - item.y)
      
      if (dist < 90) {
        droppedItems.value.splice(index, 1)
        const char = getChar(id)
        char.affection = (char.affection || 0) + 5
        
        const thanks = ['好吃！谢谢～', '哇，你怎么知道我喜欢这个！', '嘿嘿，收到投喂啦！', '心情变好了！']
        dollBubbles.value[id] = thanks[Math.floor(Math.random() * thanks.length)]
        setTimeout(() => { if (dollBubbles.value[id]) delete dollBubbles.value[id] }, 3000)
        
        const effects = ['❤️', '✨', '🎉', '💖']
        emoteBubbles.value[id] = effects[Math.floor(Math.random() * effects.length)]
        setTimeout(() => { delete emoteBubbles.value[id] }, 1500)
      }
    })
  })
}

const onMousemove = (e) => {
  if (dragState.id) {
    onDragMove(e)
    return
  }

  lastUserActivity.value = Date.now()
  idlePrompted.value = false
  
  const mx = e.clientX, my = e.clientY
  Object.values(dollStates).forEach(s => {
    if (s.mood === 'speaking' || s.mood === 'approach') return
    const dx = s.px - mx, dy = s.py - my
    const dist = Math.hypot(dx, dy)
    
    if (dist < 120 && dist > 1) {
      const force = (120 - dist) / 120 * 0.015 
      s.vx += (dx / dist) * force
      s.vy += (dy / dist) * force
    }
  })
}

const onClick = (e) => {
  if (e.target.closest('.chat-drawer, .toolbar, .side-menu, .panel-drawer, .scenario-rail, .topbar, .mask, .script-modal-mask, .script-book-mask')) return
  lastUserActivity.value = Date.now()
  idlePrompted.value = false
  
  const idleDolls = Object.entries(dollStates).filter(([_, s]) => s.mood === 'idle' || s.mood === 'wander')
  if (idleDolls.length === 0) return
  const [id, s] = idleDolls[Math.floor(Math.random() * idleDolls.length)]
  s.tx = e.clientX / screenW.value
  s.ty = e.clientY / stageH.value
  s.mood = 'chase'
  
  setTimeout(() => {
    if (s.mood === 'chase') {
      s.mood = 'idle'
      const h = getHomes()[id]
      s.tx = h.x
      s.ty = h.y
    }
  }, 2500)
}

const handleDollClick = (char) => {
  lastUserActivity.value = Date.now()
  idlePrompted.value = false
  const s = dollStates[char.id]
  if (s.mood === 'drag') return
  
  s.mood = 'react'
  s.vx += (Math.random() - 0.5) * 0.4
  s.vy += (Math.random() - 0.5) * 0.4
  s.squash = 1.22
  
  char.affection = (char.affection || 0) + 1
  emoteBubbles.value[char.id] = '💖'
  
  setTimeout(() => { delete emoteBubbles.value[char.id] }, 1200)
  setTimeout(() => {
    if (s.mood === 'react') {
      s.mood = 'idle'
      const h = getHomes()[char.id]
      s.tx = h.x
      s.ty = h.y
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
    const h = getHomes()[id]
    s.tx = h.x
    s.ty = h.y
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
      const h = getHomes()[id]
      s.tx = h.x
      s.ty = h.y
    }
  }, 6000)
}

const wander = (id) => {
  const s = dollStates[id]
  if (!s || ['speaking', 'approach', 'chase', 'react', 'drag'].includes(s.mood)) return
  if (visitingCharId.value === id) return
  if (Date.now() < s.pauseUntil) return
  const h = getHomes()[id]
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
const currentMode = computed(() => modes[currentModeKey.value]) 
const panelTitle = computed(() => panelTitles[activeTab.value] || '')
const apiStatusText = computed(() => {
  if (apiStatus.value === 'ok') return '在线'
  if (apiStatus.value === 'calling') return `思考(${apiCallCount.value})`
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
const openPanel = (id) => { lastUserActivity.value = Date.now(); menuOpen.value = false; nextTick(() => { activeTab.value = id }) }
const switchScenario = (key) => { currentScenarioKey.value = key }
const detectScenario = (text) => {
  for (const [key, config] of Object.entries(scenarios)) {
    if (config.keywords.some(k => text.includes(k))) return key
  }
  return currentScenarioKey.value
}

const rotatingTopic = ref('最近总觉得好焦虑…')
const allTopics = ['最近总觉得好焦虑…', '室友半夜打游戏怎么办？', 'AI 会取代程序员吗？', '每天都很累，怎么调整？']
let topicIdx = 0

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const waitWithControl = async (ms) => {
  let elapsed = 0
  while (elapsed < ms) {
    if (stopFlag.value) throw new Error('stopped')
    if (!isPaused.value) elapsed += 100
    await sleep(100)
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

const pushDMMessage = (content) => {
  messages.value.push({ speaker: 'system', content: `【系统DM旁白】🎙️ ${content}`, time: nowTime() })
  nextTick(() => {
    if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight
  })
}

const speakOnce = async (charId, history, sceneName, options = {}) => {
  if (stopFlag.value) return { ok: false }
  const char = getChar(charId)
  if (!char) return { ok: false }

  typingId.value = charId
  currentSpeakerId.value = charId
  moveToSpeak(charId)

  try {
    const result = await callAI(charId, history, sceneName, {
      extraContext: options.extraContext || null,
      focusTopic: options.focusTopic || null
    })

    if (!result.ok) return { ok: false }

    apiCallCount.value++
    const reply = result.content

    messages.value.push({ speaker: charId, content: reply, time: nowTime() })
    history.push({ role: 'user', content: `${char.name}：${reply}` })

    dollBubbles.value[charId] = reply.length > 24 ? reply.slice(0, 24) + '…' : reply
    setTimeout(() => { if (dollBubbles.value[charId]) delete dollBubbles.value[charId] }, 4000)

    char.emotion = Math.min(100, char.emotion + 8 + Math.random() * 12)

    nextTick(() => {
      if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight
    })

    return { ok: true }
  } catch (e) {
    return { ok: false }
  } finally {
    typingId.value = ''
    currentSpeakerId.value = ''
    moveHome(charId)
  }
}

const finalizeSummary = async () => {
  const realMessages = messages.value.filter(m => !m.isFallback && m.speaker !== 'system' && m.speaker !== 'summary')
  if (realMessages.length < 4) {
    messages.value.push({ speaker: 'system', content: '📋 有效发言太少，跳过纪要生成', time: nowTime() })
    return
  }

  messages.value.push({ speaker: 'system', content: '📋 正在生成圆桌纪要…', time: nowTime() })
  nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })

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
  }

  nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })
}

const openMysteryModal = () => {
  if (currentModeKey.value === 'mystery') {
    showScriptModal.value = true
  }
}

const confirmScript = () => {
  showScriptModal.value = false
  const script = availableScripts[selectedScriptIdx.value]
  currentScriptTitle.value = script.title
  
  const roles = scriptDataTemplates[script.title]
  const shuffledRoles = [...roles].sort(() => Math.random() - 0.5)
  
  myScriptRole.value = shuffledRoles[0]
  
  characters.value.forEach(c => {
    c.scriptRole = null
    c.scriptSecret = ''
  })
  
  const shuffledAI = [...characters.value].sort(() => Math.random() - 0.5).slice(0, playerCount.value - 1)
  shuffledAI.forEach((char, idx) => {
    const role = shuffledRoles[idx + 1]
    char.scriptRole = role.name
    char.scriptSecret = `你的任务是：${role.task}`
  })
  
  topic.value = `剧本杀：${script.title}`
  startDiscussion()
}

const startDiscussion = async () => {
  if (currentModeKey.value === 'mystery' && !myScriptRole.value) {
    openMysteryModal()
    return
  }

  if (!topic.value.trim() && currentModeKey.value !== 'mystery') return alert('请先输入话题！')
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
  
  const preservedMsgs = messages.value.filter(m => m.isVisitor || (m.speaker === 'system' && (m.content.includes('串门') || m.content.includes('来访'))))
  messages.value = preservedMsgs
  
  // 剧本杀大段旁白开场
  if (currentModeKey.value === 'mystery') {
    pushDMMessage(`欢迎来到《${currentScriptTitle.value}》。各位请仔细阅读右下角【查看剧本】中的人物背景与第一幕详情。`)
    pushDMMessage(`游戏即将开始，请各位根据线索发言。务必记住你的秘密任务，找出隐藏在你们中间的凶手。`)
  } else {
    messages.value.push({ speaker: 'system', content: `--- 开启新话题：${topic.value} ---`, time: nowTime() })
  }

  apiCallCount.value = 0
  currentRound.value = 0
  apiStatus.value = 'calling'
  characters.value.forEach(c => c.emotion = 10 + Math.random() * 20)

  usedAngles.clear()
  usedStances.clear()

  messages.value.push({ speaker: 'user', content: currentModeKey.value === 'mystery' ? '游戏开始！' : topic.value, time: nowTime() })

  let initPrompt = `讨论话题：${topic.value}。请紧扣这个话题发言，50-100字。`
  if (currentMode.value.prompt) {
    initPrompt = `${currentMode.value.prompt}\n话题：${topic.value}。请限制在50-100字。`
  }

  const history = [{ role: 'user', content: initPrompt }]

  let base = ['che', 'tiao', 'man', 'dun', 'shan', 'mo']
  if (currentModeKey.value === 'mystery') {
    base = characters.value.filter(c => c.scriptRole).map(c => c.id)
  }

  const focusTopicText = topic.value
  let consecutiveFails = 0

  try {
    for (let round = 0; round < totalRounds.value; round++) {
      if (stopFlag.value) break
      currentRound.value = round + 1
      
      // 在特定轮数解锁第二幕
      if (currentModeKey.value === 'mystery' && round === 3) {
        if (myScriptRole.value && myScriptRole.value.acts[1]) myScriptRole.value.acts[1].unlocked = true
        pushDMMessage(`【DM旁白】时间到！警方已经介入调查，并且找到了新的决定性线索。第二幕剧情已在【查看剧本】中解锁，请大家结合新线索继续讨论，凶手要小心了！`)
      }

      const shuffled = [...base].sort(() => Math.random() - 0.5)
      
      // 剧本杀模式，每轮只让一个人说话，放慢节奏
      const roundSpeakers = currentModeKey.value === 'mystery' ? shuffled.slice(0, 1) : shuffled.slice(0, Math.min(3, base.length))

      for (let i = 0; i < roundSpeakers.length; i++) {
        if (stopFlag.value) break
        const charId = roundSpeakers[i]
        const char = getChar(charId)
        let extraContext = currentMode.value.prompt ? `${currentMode.value.prompt}\n` : ''

        if (currentModeKey.value === 'mystery') {
          extraContext += `【你的绝密档案】你的角色是【${char.scriptRole}】。${char.scriptSecret}\n`
          extraContext += `【任务】隐藏你的秘密，配合 DM 推进游戏，可以适度怀疑别人。`
        }

        if (i === 0) {
          extraContext += `【你的角色】你是本轮**第一个发言**的人，必须直接抛出观点。\n`
        } else {
          const prev = getPrevAIMessage()
          if (prev) {
            extraContext += `【你要回应的对象】上一位发言的是"${getName(prev.speaker)}"，ta 说：\n"${prev.content}"\n`
            extraContext += `【你的任务】必须针对 ta 的这段话做出反应。\n`
          }
        }

        if (currentModeKey.value === 'normal') {
          extraContext += `${pickStance().desc}\n${pickAngle()}\n`
        }

        // 拉长等待时间
        await waitWithControl(currentModeKey.value === 'mystery' ? 3000 : (i === 0 ? 200 : 600 + Math.random() * 400))
        
        const result = await speakOnce(charId, history, currentScenario.value.name, {
          extraContext, focusTopic: focusTopicText
        })

        if (result.ok) {
          consecutiveFails = 0
        } else {
          consecutiveFails++
          if (consecutiveFails >= 5) {
            messages.value.push({ speaker: 'system', content: '⚠️ 连续多次 AI 调用失败，讨论暂停。', time: nowTime() })
            stopFlag.value = true
            break
          }
        }

        if (currentModeKey.value === 'mystery' && round > 0 && Math.random() < 0.15) {
          pushDMMessage('时间到，请大家注意言辞，不要暴露太多自己的底牌。')
        }

        await waitWithControl(300)
      }

      if (stopFlag.value) break
      
      // 剧本杀每轮结束等待更久
      if (round < totalRounds.value - 1) {
        await waitWithControl(currentModeKey.value === 'mystery' ? 4000 : 800)
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
  if (e.isComposing || e.shiftKey) return // Shift+Enter 换行，不发送
  userSpeak()
}

const userSpeak = async () => {
  if (!userMessage.value.trim()) return

  const userText = userMessage.value
  messages.value.push({ speaker: 'user', content: userText, time: nowTime() })
  userMessage.value = ''
  lastUserActivity.value = Date.now()
  idlePrompted.value = false

  if (isDiscussing.value) {
    stopFlag.value = true
    isPaused.value = false
    let waited = 0
    while (isDiscussing.value && waited < 2500) { await sleep(100); waited += 100 }
    isDiscussing.value = false
    typingId.value = ''
    currentSpeakerId.value = ''
    stopFlag.value = false
    saveHistory()
  }

  const responders = [...characters.value].sort(() => Math.random() - 0.5).slice(0, 3)
  const history = []

  if (topic.value) history.push({ role: 'user', content: `[背景] 我们正在讨论的话题是"${topic.value}"。` })

  for (const m of messages.value.slice(0, -1)) {
    if (m.speaker === 'user') {
      history.push({ role: 'user', content: `用户：${m.content}` })
    } else if (m.speaker !== 'system' && m.speaker !== 'summary' && !m.isFallback) {
      history.push({ role: 'user', content: `${getName(m.speaker)}：${m.content}` })
    }
  }

  history.push({ role: 'user', content: `[用户说] "${userText}"\n请回应用户这句话。` })

  isDiscussing.value = true
  stopFlag.value = false
  isPaused.value = false
  apiStatus.value = 'calling'

  try {
    for (let i = 0; i < responders.length; i++) {
      const responder = responders[i]
      let extraContext = currentMode.value.prompt ? `${currentMode.value.prompt}\n` : ''

      if (i === 0) {
        extraContext += `【当前情况】用户刚刚说了一句："${userText}"。你是第一个回应的。必须【直接回应用户这句话】。\n`
      } else {
        const prev = getPrevAIMessage()
        if (prev && prev.speaker !== 'user') {
          extraContext += `【上一位回应者】"${getName(prev.speaker)}"刚刚说了：\n"${prev.content}"\n`
          extraContext += `【你的任务】在 ta 的基础上补充或反驳。\n`
        } else {
          extraContext += `【你的任务】用户刚刚说："${userText}"。请回应用户。\n`
        }
      }

      if (currentModeKey.value === 'normal') {
        extraContext += `${pickStance().desc}\n${pickAngle()}\n`
      }

      const preDelay = i === 0 ? 200 : 600
      await waitWithControl(preDelay)
      await speakOnce(responder.id, history, currentScenario.value.name, { extraContext, focusTopic: userText })
      await waitWithControl(300)
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
  const history = [{ role: 'user', content: '用户刚进入聊天室，请用你的方式打个招呼，15-35字。' }]

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

    const localGreeters = [...characters.value].filter(c => c.id !== 'mo' && c.id !== data.visitorId).sort(() => Math.random() - 0.5).slice(0, 3)
    const history = [{ role: 'user', content: `另一个圆桌的"${data.visitorName}"来我们这里做客了。ta 那边正在聊「${data.currentTopic}」。ta 刚才在那边聊了：\n${data.recentHistory}` }]

    for (let round = 0; round < 8; round++) {
      const localChar = localGreeters[round % localGreeters.length]
      typingId.value = localChar.id
      currentSpeakerId.value = localChar.id

      let promptLocal = round === 0 ? `请热情欢迎访客"${data.visitorName}"。` : `请针对访客刚才说的见闻，追问一句。`
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
      
      let promptVisitor = round === 0 ? `你是访客"${data.visitorName}"，请回应对方的欢迎。` : `你是访客"${data.visitorName}"，请针对对方刚才的话接茬。`
      const r2 = await callAI(data.visitorId || 'che', history, currentScenario.value.name, { extraContext: promptVisitor })
      if (r2.ok) {
        messages.value.push({ 
          speaker: 'visitor', 
          speakerName: data.visitorName,
          speakerColor: data.visitorColor,
          speakerAvatar: data.visitorAvatar,
          content: r2.content, 
          time: nowTime(), 
          isVisitor: true 
        })
        history.push({ role: 'user', content: `${data.visitorName}：${r2.content}` })
        apiCallCount.value++
        nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })
      }
      typingId.value = ''
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
      messages.value.push({ speaker: 'system', content: `🚪 ${incomingVisitor.value.name} 回自己的圆桌了`, time: nowTime() })
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
  }
}

const runReturnConversation = async (data) => {
  if (!visitingCharId.value) return
  const envoy = getChar(visitingCharId.value)
  const s = dollStates[envoy.id]
  s.mood = 'idle'
  const h = getHomes()[envoy.id]
  s.tx = h.x
  s.ty = h.y
  visitingCharId.value = null

  messages.value.push({ speaker: 'system', content: `🚪 ${envoy.name} 从对门回来了！对面正在聊「${data.currentTopic}」`, time: nowTime() })
  nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })

  setTimeout(async () => {
    try {
      isDiscussing.value = true
      isPaused.value = false
      stopFlag.value = false
      const history = [{ role: 'user', content: `你刚去对门串门回来。你在那边的聊天记录是：\n${data.chatHistory}\n请结合这些见闻，跟大家说说这次串门的感受。` }]
      
      for (let round = 0; round < 6; round++) {
        if (round === 0) {
          typingId.value = envoy.id
          currentSpeakerId.value = envoy.id
          const r1 = await callAI(envoy.id, history, currentScenario.value.name, { extraContext: `【任务】你刚从对门回来，跟大家说说见闻。` })
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
          const rq = await callAI(asker.id, history, currentScenario.value.name, { extraContext: `【任务】${envoy.name}刚从对门回来，请追问一句。` })
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
          const ra = await callAI(envoy.id, history, currentScenario.value.name, { extraContext: `【任务】请回答刚才对方的问题。` })
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
    } catch(err) { console.error(err) } finally {
      isDiscussing.value = false
      typingId.value = ''
      currentSpeakerId.value = ''
    }
  }, 1000)
}

const visitNeighbor = () => {
  if (!channel.value) {
    messages.value.push({ speaker: 'system', content: '🚪 串门通道未开启', time: nowTime() })
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

  messages.value.push({ speaker: 'system', content: `🚪 ${envoy.name} 出发去对门串门了…`, time: nowTime() })
  const recentMsgs = messages.value.slice(-5).map(m => `${getName(m.speaker)}: ${m.content}`).join('\n')

  channel.value.postMessage({
    type: 'visit',
    from: '另一个圆桌的朋友',
    visitorId: envoy.id,
    visitorName: envoy.name,
    visitorColor: envoy.color,
    visitorAvatar: envoy.avatar,
    currentTopic: topic.value || '日常闲聊',
    currentScene: currentScenario.value.name,
    recentHistory: recentMsgs,
    time: Date.now()
  })
}

const saveHistory = () => {
  const realMessages = messages.value.filter(m => m.speaker !== 'system' && !m.isFallback)
  if (realMessages.length < 3) return
  discussionHistory.value.unshift({
    topic: topic.value || '(打招呼)',
    sceneName: currentScenario.value.name,
    sceneIcon: currentScenario.value.icon,
    count: realMessages.length,
    preview: realMessages.slice(0, 3).map(m => `[${getName(m.speaker)}] ${m.content}`).join(' / ').slice(0, 130) + '…',
    time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    messages: JSON.parse(JSON.stringify(messages.value))
  })
  if (discussionHistory.value.length > 20) discussionHistory.value.pop()
}

const loadHistory = (h) => {
  activeTab.value = 'chat'
  menuOpen.value = false
  topic.value = h.topic
  messages.value = JSON.parse(JSON.stringify(h.messages))
  nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })
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
    else if (showScriptModal.value) showScriptModal.value = false
    else if (showScriptBook.value) showScriptBook.value = false
  }
}

let wanderTimer, careTimer, clockTimer, topicTimer, resizeHandler

onMounted(() => {
  rafId = requestAnimationFrame(physicsLoop)
  window.addEventListener('keydown', onKeydown)

  resizeHandler = () => { screenW.value = window.innerWidth; screenH.value = window.innerHeight }
  window.addEventListener('resize', resizeHandler)

  wanderTimer = setInterval(() => {
    if (isDiscussing.value) return
    const ids = Object.keys(dollStates)
    wander(ids[Math.floor(Math.random() * ids.length)])
  }, 3000)

  careTimer = setInterval(async () => {
    const idleTime = Date.now() - lastUserActivity.value
    if (idleTime > 60000 && !idlePrompted.value && !isDiscussing.value) {
      idlePrompted.value = true
      const ids = ['man', 'mo', 'che', 'shan']
      const id = ids[Math.floor(Math.random() * ids.length)]
      approachUser(id)
      const history = [{ role: 'user', content: '用户已经有一段时间没说话了，请主动关心一下，20-40字。' }]
      const result = await callAI(id, history, currentScenario.value.name)
      if (result.ok) {
        apiCallCount.value++
        messages.value.push({ speaker: id, content: result.content, time: nowTime() })
        dollBubbles.value[id] = result.content.length > 24 ? result.content.slice(0, 24) + '…' : result.content
        setTimeout(() => { if (dollBubbles.value[id]) delete dollBubbles.value[id] }, 4000)
        nextTick(() => { if (chatArea.value) chatArea.value.scrollTop = chatArea.value.scrollHeight })
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
          name: data.visitorName, color: data.visitorColor, avatar: data.visitorAvatar,
          topic: data.currentTopic, scene: data.currentScene, enterAt: Date.now()
        }
        visitor.value = `${data.visitorName} 来做客了`
        visitorBubble.value = '大家好！我来串门啦～'
        messages.value.push({ speaker: 'system', content: `🚪 ${data.visitorName}（来自${data.currentScene}）来做客了！那边正在聊「${data.currentTopic}」`, time: nowTime() })
        runGuestConversation(data)
      }

      if (data.type === 'visit-back') runReturnConversation(data)

      if (data.type === 'visit-reject') {
        if (visitingCharId.value) {
          const envoy = getChar(visitingCharId.value)
          const s = dollStates[envoy.id]
          s.mood = 'idle'
          const h = getHomes()[envoy.id]
          s.tx = h.x; s.ty = h.y
          messages.value.push({ speaker: 'system', content: `🚪 对门已经有客人了，${envoy.name} 白跑一趟…`, time: nowTime() })
          visitingCharId.value = null
        }
      }
    }
  } catch (e) { console.warn('BroadcastChannel 不可用') }
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  clearInterval(wanderTimer); clearInterval(careTimer); clearInterval(clockTimer); clearInterval(topicTimer)
  window.removeEventListener('keydown', onKeydown); window.removeEventListener('resize', resizeHandler)
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
.stage { position: absolute; top: 0; left: 0; right: 0; height: 100vh; z-index: 30; pointer-events: none; }
.center-halo { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 500px; height: 500px; border-radius: 50%; pointer-events: none; filter: blur(50px); opacity: 0.4; transition: background 1.5s; }
.paper-doll { position: absolute; top: 0; left: 0; width: 130px; height: 145px; pointer-events: auto; cursor: grab; will-change: transform; transition: filter 0.3s; filter: drop-shadow(0 12px 24px rgba(0,0,0,0.55)); user-select: none; }
.paper-doll:active { cursor: grabbing; }
.paper-doll.dragging { filter: drop-shadow(0 25px 35px rgba(0,0,0,0.8)) drop-shadow(0 0 20px #FFD93D); z-index: 999; transform: scale(1.1); }
.paper-doll.speaking { filter: drop-shadow(0 0 30px var(--color)) drop-shadow(0 0 60px var(--color)) drop-shadow(0 12px 24px rgba(0,0,0,0.55)); z-index: 20; }
.paper-doll.thinking { filter: drop-shadow(0 0 20px var(--color)); }
.paper-doll.mentioned { filter: drop-shadow(0 0 25px #FFD93D) drop-shadow(0 12px 24px rgba(0,0,0,0.55)); }
.paper-doll.approaching { filter: drop-shadow(0 0 25px var(--color)); z-index: 15; }
.paper-doll.reacting img { animation: reactShake 0.5s ease-out; }
.paper-doll.visiting-out { transition: transform 0.8s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.5s; }
.mystery-aura { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 140%; height: 140%; border-radius: 50%; background: radial-gradient(circle, rgba(155,89,182,0.4) 0%, transparent 60%); pointer-events: none; z-index: -1; animation: auraPulse 2s infinite alternate; }
@keyframes auraPulse { from { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; } to { transform: translate(-50%, -50%) scale(1.1); opacity: 0.2; } }
@keyframes reactShake { 0%, 100% { transform: translateX(0) rotate(0); } 20% { transform: translateX(-8px) rotate(-5deg); } 60% { transform: translateX(6px) rotate(4deg); } }
@keyframes breathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.97) translateY(3px); } }
@keyframes walkWobble { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
.doll-img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; animation: breathe 3s ease-in-out infinite; -webkit-user-drag: none; }
.paper-doll.walking .doll-img { animation: walkWobble 0.4s ease-in-out infinite; }
.paper-doll.listening .doll-img { transform: scaleX(0.95) rotate(3deg); transition: transform 0.3s; animation-play-state: paused; }
.doll-shadow { position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 60%; height: 10px; background: radial-gradient(ellipse, rgba(0,0,0,0.4), transparent 70%); border-radius: 50%; z-index: -1; }
.doll-tag { position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; color: #fff; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 4px; }
.affection-badge { font-size: 10px; background: #FF6B6B; padding: 1px 4px; border-radius: 8px; color: #fff; }
.script-role-badge { font-size: 10px; background: #9B59B6; padding: 1px 6px; border-radius: 8px; color: #fff; }
.dropped-item { position: absolute; pointer-events: none; z-index: 40; transition: top 2s cubic-bezier(0.25, 0.46, 0.45, 0.94); animation: bounceItem 0.5s infinite alternate; }
@keyframes bounceItem { from { transform: scale(1) translateY(0); } to { transform: scale(1.1) translateY(-5px); } }
.emote-bubble { position: absolute; top: -30px; left: 50%; transform: translateX(-50%); font-size: 32px; pointer-events: none; transition: all 0.3s; }
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
.incoming-visitor { position: absolute; right: 6%; top: 30%; display: flex; flex-direction: column; align-items: center; pointer-events: auto; z-index: 35; filter: drop-shadow(0 0 30px var(--visitor-color)) drop-shadow(0 8px 20px rgba(0,0,0,0.5)); animation: visitorFloat 3s ease-in-out infinite; }
@keyframes visitorFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
.visitor-avatar { width: 110px; height: 120px; object-fit: contain; }
.visitor-name { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; color: #fff; margin-top: -4px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
.visitor-bubble { position: absolute; top: -36px; background: #fff; color: #1a1a2e; padding: 8px 14px; border-radius: 14px; font-size: 13px; font-weight: 500; white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 6px 20px rgba(0,0,0,0.3); animation: bubbleBounce 2s ease-in-out infinite; }
.visitor-bubble::after { content: ''; position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #fff; }
@keyframes bubbleBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.visitor-enter-enter-active { animation: visitorSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
.visitor-enter-leave-active { animation: visitorSlideIn 0.4s reverse; }
@keyframes visitorSlideIn { from { opacity: 0; transform: translateX(200px) scale(0.7); } to { opacity: 1; transform: translateX(0) scale(1); } }
.chat-drawer { position: absolute; left: 50%; bottom: 78px; transform: translateX(-50%); width: calc(100% - 44px); max-width: 820px; background: rgba(15,15,25,0.55); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%); border: 1px solid rgba(255,255,255,0.15); border-radius: 24px; z-index: 20; box-shadow: 0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1); display: flex; flex-direction: column; transition: height 0.5s cubic-bezier(0.34, 1.2, 0.64, 1); overflow: hidden; }
.drawer-handle { padding: 8px 0 4px; cursor: pointer; display: flex; justify-content: center; }
.drawer-handle:hover .handle-bar { background: rgba(255,255,255,0.5); width: 60px; }
.handle-bar { width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.25); transition: all 0.3s; }
.chat-head { padding: 8px 24px 10px; display: flex; justify-content: space-between; align-items: center; }
.chat-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: bold; }
.hash { color: #4A90D9; font-size: 18px; }
.topic-label { color: #999; font-weight: normal; font-size: 12px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mode-label { font-size: 11px; padding: 2px 8px; border-radius: 6px; color: #fff; margin-left: 6px; font-weight: normal; }
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
.avatar-wrapper { position: relative; flex-shrink: 0; }
.visitor-badge { position: absolute; bottom: -4px; right: -6px; background: #FFD93D; color: #000; font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 6px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1px solid #1a1a2e; }
.avatar { width: 42px; height: 42px; border-radius: 10px; object-fit: cover; background: rgba(255,255,255,0.1); flex-shrink: 0; cursor: pointer; transition: transform 0.2s; }
.avatar:hover { transform: scale(1.1); }
.user-avatar { display: flex; align-items: center; justify-content: center; font-size: 22px; background: linear-gradient(135deg, #6BCB77, #4A90D9); }
.msg-main { max-width: 68%; display: flex; flex-direction: column; gap: 4px; }
.nick { font-size: 11px; color: #999; padding: 0 6px; font-weight: bold; display: flex; align-items: center; gap: 4px; }
.nick.user { text-align: right; color: #6BCB77; }
.visitor-tag { font-size: 10px; color: #FFD93D; background: rgba(255,217,61,0.15); padding: 1px 6px; border-radius: 4px; }
.affection-tag { font-size: 10px; color: #FF6B6B; background: rgba(255,107,107,0.15); padding: 1px 6px; border-radius: 4px; margin-left: 4px; }
.script-tag { font-size: 10px; color: #9B59B6; background: rgba(155,89,182,0.2); padding: 1px 6px; border-radius: 4px; margin-left: 4px; }
.bubble { padding: 10px 15px; font-size: 14px; line-height: 1.55; word-break: break-word; border-radius: 4px 14px 14px 14px; }
.bubble.ai { background: rgba(255,255,255,0.94); color: #1a1a2e; box-shadow: 0 3px 12px rgba(0,0,0,0.2); }
.bubble.bubble-muted { opacity: 0.5; font-style: italic; }
.bubble.visitor-bubble-style { background: rgba(255,217,61,0.08); border: 1px dashed #FFD93D; color: #FFD93D; box-shadow: 0 3px 12px rgba(255,217,61,0.15); }
.bubble.user { background: linear-gradient(135deg, #4A90D9, #9B59B6); color: #fff; border-radius: 14px 4px 14px 14px; box-shadow: 0 3px 12px rgba(74,144,217,0.3); }
.bubble.typing { display: flex; gap: 4px; padding: 14px 16px; }
.bubble.typing span { width: 6px; height: 6px; border-radius: 50%; background: #4A90D9; animation: tdBounce 1.2s infinite; }
.bubble.typing span:nth-child(2) { animation-delay: 0.2s; }
.bubble.typing span:nth-child(3) { animation-delay: 0.4s; }
.bubble.visitor-bubble-style.typing span { background: #FFD93D; }
.sys-row { display: flex; justify-content: center; margin: 10px 0; }
.sys-row span { font-size: 12px; color: #FFB6C1; background: rgba(255,182,193,0.15); padding: 8px 16px; border-radius: 12px; line-height: 1.5; text-align: center; border: 1px solid rgba(255,182,193,0.3); }
.summary-card { background: linear-gradient(135deg, rgba(74,144,217,0.15), rgba(155,89,182,0.15)); border: 1px solid rgba(74,144,217,0.4); border-radius: 16px; padding: 18px 22px; margin: 8px 0; animation: msgIn 0.5s; }
.summary-head { font-size: 15px; font-weight: bold; color: #4A90D9; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.summary-body { font-family: inherit; font-size: 13px; line-height: 1.85; color: #e0e0e0; white-space: pre-wrap; word-break: break-word; }
.input-bar { padding: 12px 20px 14px; display: flex; flex-direction: column; gap: 8px; }
.mention-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,217,61,0.2); color: #FFD93D; padding: 4px 12px; border-radius: 12px; font-size: 12px; align-self: flex-start; font-weight: bold; }
.mention-pill .x { cursor: pointer; font-size: 14px; opacity: 0.7; }
.input-row { display: flex; gap: 10px; align-items: flex-end; }
.chat-input { flex: 1; padding: 12px 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.3); color: #fff; font-size: 14px; outline: none; font-family: inherit; resize: none; min-height: 44px; max-height: 120px; line-height: 1.5; }
.textarea-input { scrollbar-width: none; }
.textarea-input::-webkit-scrollbar { display: none; }
.chat-input:focus { border-color: #4A90D9; box-shadow: 0 0 0 3px rgba(74,144,217,0.15); }
.send-btn { padding: 0 26px; height: 44px; border-radius: 12px; border: none; background: linear-gradient(135deg, #4A90D9, #9B59B6); color: #fff; font-weight: bold; cursor: pointer; font-size: 14px; font-family: inherit; min-width: 80px; transition: all 0.2s; }
.send-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
.send-btn:disabled { background: #444; cursor: not-allowed; }
.toolbar { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; padding: 8px 12px; background: rgba(10,10,22,0.7); backdrop-filter: blur(24px); border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); z-index: 60; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
.tool-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 12px; border-radius: 12px; border: none; background: transparent; color: #ccc; cursor: pointer; font-family: inherit; min-width: 52px; transition: all 0.2s; }
.tool-btn:hover { background: rgba(255,255,255,0.1); color: #fff; transform: translateY(-2px); }
.tool-btn.highlight { background: rgba(155,89,182,0.2); color: #fff; border: 1px solid rgba(155,89,182,0.4); animation: glowBtn 2s infinite alternate; }
@keyframes glowBtn { from { box-shadow: 0 0 5px rgba(155,89,182,0.2); } to { box-shadow: 0 0 15px rgba(155,89,182,0.8); } }
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
.mode-picker { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.mode-chip { padding: 12px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #ccc; cursor: pointer; font-size: 13px; transition: all 0.2s; display: flex; flex-direction: column; gap: 4px; }
.mode-chip.active { color: #fff; font-weight: bold; }
.mode-desc { font-size: 10px; opacity: 0.7; }
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
.empty-tip { text-align: center; padding: 40px 20px; color: #666; }
.history-list { display: flex; flex-direction: column; gap: 12px; }
.history-card { padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.04); }
.hhead { display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-bottom: 6px; }
.history-card h3 { font-size: 14px; color: #fff; margin-bottom: 6px; }
.history-card p { font-size: 12px; color: #aaa; line-height: 1.5; margin-bottom: 10px; }
.hactions { display: flex; gap: 8px; }
.hactions button { padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); color: #ccc; font-size: 12px; cursor: pointer; font-family: inherit; }
.script-modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); z-index: 500; display: flex; align-items: center; justify-content: center; }
.script-modal { background: rgba(20,20,35,0.95); border: 1px solid rgba(155,89,182,0.5); border-radius: 20px; width: 90%; max-width: 500px; padding: 24px; box-shadow: 0 20px 60px rgba(155,89,182,0.3); }
.script-modal h2 { font-size: 20px; color: #9B59B6; margin-bottom: 16px; text-align: center; }
.script-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; max-height: 40vh; overflow-y: auto; }
.script-item { background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s; }
.script-item.active { border-color: #9B59B6; background: rgba(155,89,182,0.2); }
.script-item h3 { font-size: 16px; color: #fff; margin-bottom: 4px; }
.script-item p { font-size: 12px; color: #aaa; line-height: 1.4; }
.player-count { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; font-size: 14px; }
.player-count button { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: #ccc; cursor: pointer; }
.player-count button.active { background: #9B59B6; color: #fff; border-color: #9B59B6; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
.cancel-btn { padding: 10px 20px; border-radius: 8px; border: none; background: rgba(255,255,255,0.1); color: #ccc; cursor: pointer; }
.confirm-btn { padding: 10px 24px; border-radius: 8px; border: none; background: linear-gradient(135deg, #9B59B6, #FF6B6B); color: #fff; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(155,89,182,0.4); }
.script-book-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); z-index: 600; display: flex; align-items: center; justify-content: center; padding: 20px; }
.script-book { background: #2a2a3e; border: 2px solid #9B59B6; border-radius: 16px; width: 100%; max-width: 600px; height: 80vh; display: flex; flex-direction: column; box-shadow: 0 0 50px rgba(155,89,182,0.4); overflow: hidden; position: relative; }
.book-header { padding: 16px 20px; border-bottom: 1px dashed rgba(155,89,182,0.4); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); }
.book-title { font-size: 20px; font-weight: bold; color: #9B59B6; letter-spacing: 2px; text-shadow: 0 0 10px rgba(155,89,182,0.5); }
.book-header .close-btn { background: none; border: none; color: #ccc; font-size: 24px; cursor: pointer; }
.book-content { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
.book-content::-webkit-scrollbar { width: 4px; }
.book-content::-webkit-scrollbar-thumb { background: #9B59B6; border-radius: 2px; }
.role-info { background: rgba(155,89,182,0.1); border-left: 4px solid #9B59B6; padding: 16px; border-radius: 0 12px 12px 0; }
.role-info h3 { margin-bottom: 8px; font-size: 16px; }
.role-name { color: #FFD93D; }
.role-quote { font-style: italic; color: #aaa; margin-bottom: 12px; font-size: 14px; }
.role-bg { background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; font-size: 13px; color: #e0e0e0; line-height: 1.6; margin-bottom: 12px; }
.role-task { background: rgba(255,107,107,0.1); padding: 10px; border-radius: 8px; font-size: 13px; color: #FFB6C1; line-height: 1.5; }
.acts-container { display: flex; flex-direction: column; gap: 16px; }
.act-card { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; }
.act-card.locked { opacity: 0.6; filter: grayscale(1); }
.act-title { font-weight: bold; color: #9B59B6; margin-bottom: 8px; font-size: 15px; }
.act-body { font-size: 14px; color: #ddd; line-height: 1.6; }
.locked-text { color: #666; font-style: italic; text-align: center; padding: 10px; }
.book-footer { padding: 12px; text-align: center; font-size: 12px; color: #888; border-top: 1px dashed rgba(155,89,182,0.4); background: rgba(0,0,0,0.2); }
</style>