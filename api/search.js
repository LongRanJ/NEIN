// Vercel Serverless Function - 调用 MIMO API 进行实时资讯搜索
// 环境变量：MIMO_API_KEY（在 Vercel 后台配置）

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query, sources, limit = 5 } = req.body

  if (!query || !query.trim()) {
    return res.status(400).json({ error: '请输入搜索关键词' })
  }

  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: '服务端未配置 MIMO API Key' })
  }

  // 构建搜索 prompt
  const sourceText = sources && sources.length > 0
    ? `优先从以下来源获取信息：${sources.join('、')}`
    : '不限定来源，综合搜索'

  const systemPrompt = `你是新能源行业资讯搜索助手。你的任务是根据用户提供的关键词，搜索最新的新能源行业相关资讯。

搜索范围：锂电池材料、固态电池、磷酸铁锂、三元锂、快充技术、新能源事故、储能、氢能等新能源领域。

${sourceText}

返回数量要求：${limit} 条

请严格以 JSON 数组格式返回结果，不要包含任何其他文字。每条结果包含以下字段：
- title: 资讯标题
- summary: 内容摘要（50-100字）
- source: 信息来源
- url: 原文链接（如果能获取到）
- date: 发布日期（YYYY-MM-DD 格式，如果能获取到）
- keywords: 相关关键词数组

示例格式：
[{"title":"标题","summary":"摘要","source":"来源","url":"链接","date":"2026-07-08","keywords":["关键词1","关键词2"]}]`

  try {
    const response = await fetch('https://token-plan-cn.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请搜索以下关键词相关的最新新能源行业资讯：${query}` }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('MIMO API error:', response.status, errText)
      return res.status(502).json({ error: `MIMO API 错误: ${response.status}` })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // 尝试解析 JSON 结果
    let results = []
    try {
      // 提取 JSON 部分（处理可能被 markdown 包裹的情况）
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0])
      }
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message, 'Content:', content)
      // 如果解析失败，返回原始文本作为单条结果
      results = [{
        title: `搜索结果：${query}`,
        summary: content.slice(0, 200),
        source: 'MIMO AI 搜索',
        url: '',
        date: new Date().toISOString().split('T')[0],
        keywords: query.split(/\s+/)
      }]
    }

    return res.status(200).json({
      success: true,
      query,
      count: results.length,
      results
    })

  } catch (err) {
    console.error('Search error:', err.message)
    return res.status(500).json({ error: `搜索失败: ${err.message}` })
  }
}
