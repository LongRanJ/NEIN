// Vercel Serverless Function - MIMO 直接搜索新闻
// 环境变量：MIMO_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { keyword, sources = [], timeRange = 'all' } = req.body

  if (!keyword?.trim()) return res.status(400).json({ error: '请输入搜索关键词' })
  if (keyword.length > 100) return res.status(400).json({ error: '关键词过长' })
  if (sources.length === 0) return res.status(400).json({ error: '请至少选择一个来源' })

  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey) return res.status(500).json({ error: '服务端未配置 MIMO_API_KEY' })

  // 时间范围描述
  const timeDesc = {
    day: '今天',
    week: '最近一周',
    month: '最近一个月',
    all: ''
  }[timeRange] || ''

  const timeHint = timeDesc ? `优先返回${timeDesc}发布的新闻。` : ''

  const prompt = `你是新能源行业资讯搜索助手。根据用户的关键词搜索新闻。

搜索关键词：${keyword}
限定来源：${sources.join('、')}
${timeHint}

要求：
1. 只返回来自上述来源网站的新闻
2. 每条新闻包含：title（标题）、summary（50-100字摘要）、source（来源名称）、url（原文链接）、date（发布日期YYYY-MM-DD）
3. 按相关性排序
4. 最多返回20条
5. 只返回JSON数组，格式：[{"title":"","summary":"","source":"","url":"","date":""}]
6. 如果找不到相关新闻，返回空数组 []`

  try {
    const resp = await fetch('https://token-plan-cn.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          { role: 'system', content: '你是新能源行业资讯搜索助手。只返回JSON数组，不要其他文字。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      console.error('MIMO API error:', resp.status, errText)
      return res.status(502).json({ error: `MIMO API 错误: ${resp.status}` })
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''

    // 解析JSON
    let results = []
    try {
      // 去除markdown代码块
      const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
      const jsonMatch = cleaned.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.error('JSON parse error:', e.message, 'Content:', content.slice(0, 300))
    }

    // 校验：只保留有title的结果，source必须在选定来源中
    const sourceSet = new Set(sources)
    results = results
      .filter(item => item.title && item.title.length >= 3)
      .map(item => ({
        title: item.title.trim(),
        summary: (item.summary || '').trim().slice(0, 200),
        source: item.source || '未知来源',
        url: item.url || '',
        date: item.date || ''
      }))

    // 生成概述
    let overview = ''
    if (results.length > 0) {
      try {
        const overviewResp = await fetch('https://token-plan-cn.xiaomimimo.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'mimo-v2.5',
            messages: [{
              role: 'user',
              content: `用50-100字概括以下新闻的核心要点：\n${results.map(r => `- ${r.title}`).join('\n')}`
            }],
            temperature: 0.3,
            max_tokens: 300
          })
        })
        if (overviewResp.ok) {
          const overviewData = await overviewResp.json()
          overview = overviewData.choices?.[0]?.message?.content || ''
        }
      } catch {}
    }

    return res.status(200).json({
      success: true,
      keyword,
      data: results,
      total: results.length,
      overview
    })

  } catch (err) {
    console.error('Search error:', err.message)
    return res.status(500).json({ error: `搜索失败: ${err.message}` })
  }
}
