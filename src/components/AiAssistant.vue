<template>
  <div>
    <!-- Floating button -->
    <button
      @click="aiStore.isOpen = !aiStore.isOpen"
      class="fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent-green text-white shadow-lg hover:shadow-primary/30 transition-all animate-pulse-glow flex items-center justify-center"
      :class="{ 'rotate-0': !aiStore.isOpen, 'rotate-90': aiStore.isOpen }"
    >
      <span v-if="aiStore.isOpen" v-html="icons.close"></span>
      <span v-else v-html="icons.ai"></span>
    </button>

    <!-- AI Panel - 右侧 1/3 -->
    <Transition name="panel">
      <div
        v-if="aiStore.isOpen"
        class="fixed top-14 right-0 bottom-0 z-[80] w-1/3 min-w-[320px] max-w-[480px] glass border-l border-border flex flex-col shadow-2xl"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div class="flex items-center gap-2">
            <span class="inline-flex text-primary" v-html="icons.ai"></span>
            <h3 class="text-sm font-semibold text-white">AI 资讯助手</h3>
          </div>
          <div class="flex items-center gap-1">
            <!-- 信息按钮 - 悬停浮窗 -->
            <div class="relative group">
              <button
                class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-white hover:bg-bg-card transition-all"
                v-html="icons.info"
              ></button>
              <!-- 浮窗 -->
              <div class="absolute right-0 top-full mt-1 w-56 p-3 rounded-lg bg-bg-deep border border-border shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <ul class="text-xs text-text-muted space-y-1.5">
                  <li>• AI 智能分析模式</li>
                  <li>• 数据范围：当前时间筛选区间 + 搜索结果</li>
                  <li>• 支持行业趋势分析、技术对比、事件总结</li>
                  <li>• 所有回答基于数据库中的真实新闻</li>
                </ul>
              </div>
            </div>
            <!-- 设置按钮 -->
            <button
              @click="showSettings = !showSettings"
              class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-white hover:bg-bg-card transition-all"
              v-html="icons.settings"
            ></button>
            <!-- 清空对话 -->
            <button
              @click="aiStore.clearHistory()"
              class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-white hover:bg-bg-card transition-all"
              v-html="icons.trash"
            ></button>
          </div>
        </div>

        <!-- Settings panel -->
        <div v-if="showSettings" class="px-4 py-3 border-b border-border bg-bg-deep/50 shrink-0 overflow-y-auto max-h-64">
          <h4 class="text-xs font-medium text-text-secondary mb-2">AI 模式</h4>
          <div class="space-y-2 mb-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="aiStore.mode" value="mimo" class="accent-primary" />
              <span class="text-xs text-text-primary">AI 智能分析（推荐）</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="aiStore.mode" value="external" class="accent-primary" />
              <span class="text-xs text-text-primary">外部模型（OpenAI/DeepSeek）</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="aiStore.mode" value="internal" class="accent-primary" />
              <span class="text-xs text-text-primary">内部模型（公司内网）</span>
            </label>
          </div>

          <!-- MIMO settings -->
          <div v-if="aiStore.mode === 'mimo'" class="space-y-2 mt-3 p-2 rounded bg-bg-deep/50">
            <p class="text-xs text-text-muted">自动使用后端配置的 MIMO API，无需手动设置</p>
          </div>

          <!-- External model settings -->
          <div v-if="aiStore.mode === 'external'" class="space-y-2 mt-3">
            <input v-model="aiStore.externalApiUrl" placeholder="API URL（如 https://api.deepseek.com）" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
            <input v-model="aiStore.externalApiKey" type="password" placeholder="API Key" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
            <input v-model="aiStore.externalModel" placeholder="模型名称（如 deepseek-chat）" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
          </div>

          <!-- Internal model settings -->
          <div v-if="aiStore.mode === 'internal'" class="space-y-2 mt-3">
            <input v-model="aiStore.internalApiUrl" placeholder="API URL（如 http://192.168.1.100:8080）" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
            <input v-model="aiStore.internalApiKey" type="password" placeholder="API Key（如需要）" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
            <input v-model="aiStore.internalModel" placeholder="模型名称" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
          </div>

          <button
            @click="showSettings = false"
            class="mt-3 w-full px-3 py-1.5 rounded-lg bg-primary/20 text-primary-light text-xs hover:bg-primary/30 transition-colors"
          >完成设置</button>
        </div>

        <!-- Messages -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <!-- Welcome -->
          <div v-if="aiStore.messages.length === 0" class="text-center py-8">
            <p class="text-sm text-text-secondary">你好！我是新能源资讯助手</p>
            <p class="text-xs text-text-muted mt-1">可以问我关于锂电池、固态电池、储能等问题</p>
            <div class="mt-4 space-y-2">
              <button
                v-for="q in quickQuestions"
                :key="q"
                @click="sendQuickQuestion(q)"
                class="block w-full text-left px-3 py-2 rounded-lg bg-bg-deep/50 border border-border/50 text-xs text-text-secondary hover:border-primary/30 hover:text-primary-light transition-all"
              >{{ q }}</button>
            </div>
          </div>

          <!-- Messages -->
          <div
            v-for="(msg, i) in aiStore.messages"
            :key="i"
            class="animate-fade-in"
            :class="msg.role === 'user' ? 'flex justify-end' : ''"
          >
            <div
              class="max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed"
              :class="msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'"
            >
              <div v-html="renderMarkdown(msg.content)" class="prose prose-invert prose-sm max-w-none"></div>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="aiStore.isLoading" class="flex items-center gap-2 text-text-muted text-sm">
            <span class="inline-flex animate-pulse" v-html="icons.ai"></span>
            <span>思考中...</span>
          </div>
        </div>

        <!-- Input -->
        <div class="px-4 py-3 border-t border-border shrink-0">
          <div class="flex gap-2">
            <input
              v-model="inputText"
              @keydown.enter="sendMessage"
              type="text"
              placeholder="输入你的问题..."
              class="flex-1 px-3 py-2 rounded-lg bg-bg-deep border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
              :disabled="aiStore.isLoading"
            />
            <button
              @click="sendMessage"
              :disabled="!inputText.trim() || aiStore.isLoading"
              class="px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              v-html="icons.send"
            ></button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { marked } from 'marked'
import { useAiStore } from '../stores/ai'
import { icons } from '../assets/icons'

const aiStore = useAiStore()
const inputText = ref('')
const showSettings = ref(false)
const messagesContainer = ref(null)

const quickQuestions = [
  '最近固态电池有什么进展？',
  '磷酸铁锂和三元锂哪个更有前景？',
  '储能行业最新安全事件有哪些？',
  '快充技术发展趋势如何？'
]

function renderMarkdown(text) {
  try {
    return marked(text, { breaks: true })
  } catch {
    return text
  }
}

async function sendMessage() {
  const msg = inputText.value.trim()
  if (!msg || aiStore.isLoading) return
  inputText.value = ''
  await aiStore.sendMessage(msg)
  await nextTick()
  scrollToBottom()
}

function sendQuickQuestion(q) {
  inputText.value = q
  sendMessage()
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

watch(() => aiStore.messages.length, () => nextTick(scrollToBottom))
</script>

<style scoped>
.panel-enter-active,
.panel-leave-active {
  transition: all 0.3s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

:deep(.prose) {
  --tw-prose-body: #E2E8F0;
  --tw-prose-headings: #E2E8F0;
  --tw-prose-links: #38BDF8;
  --tw-prose-bold: #E2E8F0;
  --tw-prose-code: #38BDF8;
  --tw-prose-bullets: #94A3B8;
}
:deep(.prose p) {
  margin: 0.4em 0;
}
:deep(.prose ul), :deep(.prose ol) {
  margin: 0.3em 0;
  padding-left: 1.2em;
}
:deep(.prose strong) {
  color: #F59E0B;
}
</style>
