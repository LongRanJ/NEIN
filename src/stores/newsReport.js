import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const TARGET_SOURCES = [
  '中国能源网', '北极星储能网', '电动汽车网', '盖世汽车网', '第一电动网',
  'OFWeek锂电网', '高工氢电网', '中国储能网', '索比储能网', '国际能源网',
  '北极星电池网', '新能源网', '电池网', '百度新闻', 'Bing新闻'
]

function fmtDate(d) {
  return d.toISOString().split('T')[0]
}

export const useNewsReportStore = defineStore('newsReport', () => {
  const keyword = ref('')
  const rawData = ref([])          // API 原始返回
  const selectedIds = ref(new Set())
  const isSearching = ref(false)
  const isGenerating = ref(false)
  const error = ref('')
  const hasSearched = ref(false)
  const overview = ref('')

  // 来源管理
  const targetSources = TARGET_SOURCES
  const otherSources = ref([])     // 搜索后动态更新
  const sourceCount = ref({})       // 每个来源的文章数
  const selectedSources = ref(new Set()) // 选中的来源（Set）
  const showSourceDropdown = ref(false)

  // 时间范围
  const startDate = ref('')
  const endDate = ref('')
  const activePreset = ref(null)

  const presets = [
    { label: '今天', days: 0 },
    { label: '近3天', days: 3 },
    { label: '近7天', days: 7 },
    { label: '近30天', days: 30 }
  ]

  // 所有可选来源（目标优先，其他按数量排序）
  const allSources = computed(() => {
    const target = targetSources.filter(s => sourceCount.value[s])
    const other = otherSources.value.filter(s => sourceCount.value[s])
    return [...target, ...other]
  })

  // 过滤后的结果
  const newsList = computed(() => {
    let list = rawData.value

    // 来源过滤：只显示选中的来源
    if (selectedSources.value.size > 0) {
      list = list.filter(item => selectedSources.value.has(item.source))
    }

    // 时间过滤
    if (startDate.value) {
      list = list.filter(item => item.date >= startDate.value)
    }
    if (endDate.value) {
      list = list.filter(item => item.date <= endDate.value)
    }

    return list
  })

  const selectedItems = computed(() =>
    newsList.value.filter((_, i) => selectedIds.value.has(i))
  )

  const allSelected = computed(() =>
    newsList.value.length > 0 && selectedIds.value.size === newsList.value.length
  )

  // 统计实际出现的来源
  const resultSources = computed(() => Object.keys(sourceCount.value))

  // ─── 时间预设 ─────────────────────────────────────────

  function setPreset(days) {
    activePreset.value = days
    const now = new Date()
    endDate.value = fmtDate(now)
    if (days === 0) {
      startDate.value = fmtDate(now)
    } else {
      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      startDate.value = fmtDate(start)
    }
  }

  function setDateRange(start, end) {
    startDate.value = start
    endDate.value = end
    activePreset.value = null
  }

  function clearDateRange() {
    startDate.value = ''
    endDate.value = ''
    activePreset.value = null
  }

  // ─── 来源操作 ─────────────────────────────────────────

  function toggleSource(src) {
    const s = new Set(selectedSources.value)
    s.has(src) ? s.delete(src) : s.add(src)
    selectedSources.value = s
  }

  function selectAllSources() {
    selectedSources.value = new Set(allSources.value)
  }

  function clearSources() {
    selectedSources.value = new Set()
  }

  function selectTargetOnly() {
    selectedSources.value = new Set(targetSources.filter(s => sourceCount.value[s]))
  }

  // ─── 搜索 ────────────────────────────────────────────

  async function search(kw) {
    const q = (kw || keyword.value).trim()
    if (!q) return

    keyword.value = q
    isSearching.value = true
    error.value = ''
    hasSearched.value = true
    rawData.value = []
    selectedIds.value = new Set()
    overview.value = ''

    try {
      const resp = await fetch('/api/news-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: q })
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `请求失败: ${resp.status}`)
      }

      const data = await resp.json()
      rawData.value = data.data || []
      overview.value = data.overview || ''

      // 更新来源信息
      if (data.sources) {
        sourceCount.value = data.sources.count || {}
        otherSources.value = data.sources.other || []
        // 默认选中目标来源
        selectedSources.value = new Set(data.sources.target || [])
      }
    } catch (err) {
      error.value = err.message
    } finally {
      isSearching.value = false
    }
  }

  // ─── PPT ──────────────────────────────────────────────

  async function enhanceContent() {
    if (selectedItems.value.length === 0) return null
    const items = selectedItems.value
    const prompt = `为以下新闻生成PPT要点。返回JSON：{"overview":"50字概述","enhanced":[{"index":0,"bullets":["要点1","要点2"]}]}
新闻：
${items.map((item, i) => `${i+1}. [${item.source}] ${item.title} - ${item.summary}`).join('\n')}`
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: '只返回JSON。' }, { role: 'user', content: prompt }],
          temperature: 0.3, max_tokens: 3000
        })
      })
      if (!resp.ok) return null
      const data = await resp.json()
      const m = (data.content || '').match(/\{[\s\S]*\}/)
      return m ? JSON.parse(m[0]) : null
    } catch { return null }
  }

  async function generatePpt() {
    if (selectedItems.value.length === 0) { error.value = '请先选择新闻'; return }
    isGenerating.value = true
    error.value = ''

    try {
      // MIMO 内容增强
      const enhanced = await enhanceContent()

      // 前端生成 PPT
      const PptxGenJS = (await import('pptxgenjs')).default
      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_WIDE'

      const today = new Date().toISOString().split('T')[0]
      const items = selectedItems.value

      // 主题色
      const BG = '0F1729'
      const PRIMARY = '38BDF8'
      const WHITE = 'FFFFFF'
      const LIGHT = 'E2E8F0'
      const MUTED = '94A3B8'
      const ACCENT = 'F59E0B'
      const DIVIDER_W = 1.5
      const MARGIN_L = 0.8

      // ─── 封面页 ─────────────────────────────

      const cover = pptx.addSlide()
      cover.background = { color: BG }
      // 渐变装饰条
      cover.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 1.2,
        fill: { type: 'solid', color: '1A3A5C' }
      })
      cover.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.08,
        fill: { type: 'solid', color: PRIMARY }
      })
      // 标题
      cover.addText(`${keyword.value} - 新闻简报`, {
        x: MARGIN_L, y: 1.8, w: 11, h: 1.2,
        fontSize: 38, color: WHITE, bold: true
      })
      // 日期
      cover.addText(today, {
        x: MARGIN_L, y: 3.2, w: 11, h: 0.5,
        fontSize: 16, color: MUTED
      })
      // 分割线
      cover.addShape(pptx.ShapeType.rect, {
        x: MARGIN_L, y: 3.9, w: DIVIDER_W, h: 0.04,
        fill: { type: 'solid', color: PRIMARY }
      })
      // 概述
      if (enhanced?.overview) {
        cover.addText(enhanced.overview, {
          x: MARGIN_L, y: 4.2, w: 11, h: 1.2,
          fontSize: 14, color: LIGHT, wrap: true, lineSpacing: 22
        })
      }
      // 统计
      const sourceNames = [...new Set(items.map(i => i.source))]
      const statsText = `共 ${items.length} 条资讯 | 来源：${sourceNames.slice(0, 3).join('、')}${sourceNames.length > 3 ? '等' : ''}`
      cover.addText(statsText, {
        x: MARGIN_L, y: 5.6, w: 11, h: 0.4,
        fontSize: 12, color: MUTED
      })
      // 平台名
      cover.addText('NEIN 新能源行业资讯平台', {
        x: MARGIN_L, y: 6.5, w: 11, h: 0.4,
        fontSize: 11, color: MUTED
      })

      // ─── 内容页 ─────────────────────────────

      let slideIndex = 0
      for (const item of items) {
        // 获取内容：bullets > summary > title拼接
        const bullets = enhanced?.enhanced?.find(e => e.index === slideIndex)?.bullets
        let content = ''
        if (bullets?.length) {
          content = bullets.map(b => `•  ${b}`).join('\n')
        } else if (item.summary && item.summary.length > 10) {
          content = item.summary
        } else {
          // 兜底：跳过无内容的条目
          slideIndex++
          continue
        }

        const s = pptx.addSlide()
        s.background = { color: BG }

        // 顶部装饰条
        s.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: '100%', h: 0.06,
          fill: { type: 'solid', color: PRIMARY }
        })

        // 序号（大字）
        s.addText(`#${slideIndex + 1}`, {
          x: MARGIN_L, y: 0.3, w: 1.2, h: 0.6,
          fontSize: 28, color: PRIMARY, bold: true
        })

        // 标题
        s.addText(item.title, {
          x: MARGIN_L, y: 1.0, w: 11.4, h: 0.9,
          fontSize: 24, color: WHITE, bold: true, wrap: true
        })

        // 分割线
        s.addShape(pptx.ShapeType.rect, {
          x: MARGIN_L, y: 2.0, w: DIVIDER_W, h: 0.04,
          fill: { type: 'solid', color: PRIMARY }
        })

        // 内容
        s.addText(content, {
          x: MARGIN_L, y: 2.3, w: 11.4, h: 3.2,
          fontSize: 15, color: LIGHT, wrap: true, valign: 'top', lineSpacing: 26
        })

        // 底部：来源 + 日期
        const metaParts = []
        if (item.source) metaParts.push(`来源：${item.source}`)
        if (item.date) metaParts.push(item.date)
        s.addText(metaParts.join('  ·  '), {
          x: MARGIN_L, y: 5.8, w: 8, h: 0.35,
          fontSize: 11, color: MUTED
        })

        // 原文链接
        if (item.url) {
          s.addText([
            { text: '原文链接：', options: { color: MUTED } },
            { text: item.url, options: { color: PRIMARY, hyperlink: { url: item.url } } }
          ], {
            x: MARGIN_L, y: 6.2, w: 11.4, h: 0.3,
            fontSize: 9
          })
        }

        // 页码
        s.addText(`${slideIndex + 1} / ${items.length}`, {
          x: 11, y: 6.8, w: 2, h: 0.3,
          fontSize: 9, color: MUTED, align: 'right'
        })

        slideIndex++
      }

      // ─── 封底页 ─────────────────────────────

      const back = pptx.addSlide()
      back.background = { color: BG }
      back.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 1.2,
        fill: { type: 'solid', color: '1A3A5C' }
      })
      back.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.08,
        fill: { type: 'solid', color: PRIMARY }
      })
      back.addText('感谢阅读', {
        x: 1, y: 2.5, w: 11, h: 1.2,
        fontSize: 44, color: WHITE, bold: true, align: 'center'
      })
      back.addText('由 NEIN 新能源行业资讯平台自动生成', {
        x: 1, y: 4.2, w: 11, h: 0.6,
        fontSize: 16, color: MUTED, align: 'center'
      })
      back.addText(today, {
        x: 1, y: 5.0, w: 11, h: 0.5,
        fontSize: 14, color: MUTED, align: 'center'
      })

      // ─── 下载 ───────────────────────────────

      const blob = await pptx.write({ outputType: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${keyword.value.replace(/[\\/:*?"<>|]/g, '_')}_新闻简报.pptx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      error.value = `PPT生成失败: ${err.message}`
    } finally {
      isGenerating.value = false
    }
  }

  // ─── 选择 ────────────────────────────────────────────

  function toggleSelect(i) {
    const s = new Set(selectedIds.value)
    s.has(i) ? s.delete(i) : s.add(i)
    selectedIds.value = s
  }
  function toggleSelectAll() {
    selectedIds.value = allSelected.value ? new Set() : new Set(newsList.value.map((_, i) => i))
  }
  function clearSelect() { selectedIds.value = new Set() }

  function reset() {
    keyword.value = ''; rawData.value = []; selectedIds.value = new Set()
    isSearching.value = false; isGenerating.value = false
    error.value = ''; hasSearched.value = false; overview.value = ''
  }

  return {
    keyword, rawData, newsList, selectedIds,
    isSearching, isGenerating, error, hasSearched, overview,
    targetSources, otherSources, sourceCount, selectedSources, showSourceDropdown, allSources,
    startDate, endDate, activePreset, presets,
    selectedItems, allSelected, resultSources,
    setPreset, setDateRange, clearDateRange,
    toggleSource, selectAllSources, clearSources, selectTargetOnly,
    search, generatePpt,
    toggleSelect, toggleSelectAll, clearSelect, reset
  }
})
