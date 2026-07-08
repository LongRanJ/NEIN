<template>
  <div>
    <!-- Floating button -->
    <button
      @click="aiStore.isOpen = !aiStore.isOpen"
      class="fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent-green text-white shadow-lg hover:shadow-primary/30 transition-all animate-pulse-glow flex items-center justify-center text-2xl"
      :class="{ 'rotate-0': !aiStore.isOpen, 'rotate-90': aiStore.isOpen }"
    >
      {{ aiStore.isOpen ? '✕' : '💬' }}
    </button>

    <!-- Chat panel -->
    <Transition name="panel">
      <div
        v-if="aiStore.isOpen"
        class="fixed bottom-24 right-6 z-[90] w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-8rem)] glass rounded-2xl flex flex-col overflow-hidden shadow-2xl"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-border">
          <div class="flex items-center gap-2">
            <span class="text-lg">🤖</span>
            <div>
              <h3 class="text-sm font-semibold text-white">AI 资讯助手</h3>
              <p class="text-xs text-text-muted">{{ modeLabel }}</p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="showSettings = !showSettings"
              class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-white hover:bg-bg-card transition-all text-sm"
              title="设置"
            >⚙️</button>
            <button
              @click="aiStore.clearHistory()"
              class="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-white hover:bg-bg-card transition-all text-sm"
              title="清空对话"
            >🗑️</button>
          </div>
        </div>

        <!-- Settings panel -->
        <div v-if="showSettings" class="px-4 py-3 border-b border-border bg-bg-deep/50 overflow-y-auto max-h-64">
          <h4 class="text-xs font-medium text-text-secondary mb-2">AI 模式</h4>
          <div class="space-y-2 mb-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="aiStore.mode" value="frontend" class="accent-primary" />
              <span class="text-xs text-text-primary">🔍 纯前端搜索（无需API）</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="aiStore.mode" value="external" class="accent-primary" />
              <span class="text-xs text-text-primary">🌐 外部模型（OpenAI/DeepSeek）</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="aiStore.mode" value="internal" class="accent-primary" />
              <span class="text-xs text-text-primary">🏢 内部模型（公司内网）</span>
            </label>
          </div>

          <!-- External model settings -->
          <div v-if="aiStore.mode === 'external'" class="space-y-2 mt-3">
            <input v-model="aiStore.externalApiUrl" placeholder="API URL" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
            <input v-model="aiStore.externalApiKey" type="password" placeholder="API Key" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
            <input v-model="aiStore.externalModel" placeholder="模型名称" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
          </div>

          <!-- Internal model settings -->
          <div v-if="aiStore.mode === 'internal'" class="space-y-2 mt-3">
            <input v-model="aiStore.internalApiUrl" placeholder="内部模型 API URL" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
            <input v-model="aiStore.internalModel" placeholder="模型名称" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
            <input v-model="aiStore.internalApiKey" type="password" placeholder="API Key（如需要）" class="w-full px-2 py-1.5 rounded bg-bg-deep border border-border text-xs text-text-primary focus:outline-none focus:border-primary" />
          </div>

          <button
            @click="showSettings = false"
            class="mt-3 w-full px-3 py-1.5 rounded-lg bg-primary/20 text-primary-light text-xs hover:bg-primary/30 transition-colors"
          >完成设置</button>
        </div>

        <!-- Messages -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <!-- Welcome message -->
          <div v-if="aiStore.messages.length === 0" class="text-center py-8">
            <div class="text-4xl mb-3">🔋</div>
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

          <!-- Message bubbles -->
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
            <span class="animate-pulse">🤖</span>
            <span>思考中...</span>
          </div>
        </div>

        <!-- Input -->
        <div class="px-4 py-3 border-t border-border">
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
              class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >发送</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, computed } from 'vue'
import { marked } from 'marked'
import { useAiStore } from '../stores/ai'

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

const modeLabel = computed(() => ({
  frontend: '纯前端搜索模式',
  external: '外部模型模式',
  internal: '内部模型模式'
})[aiStore.mode])

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
  transform: translateY(20px) scale(0.95);
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
