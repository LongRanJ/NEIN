// Vercel Serverless Function - 通用 AI 对话接口
// 环境变量：MIMO_API_KEY

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, model, temperature, max_tokens } = req.body

  if (!messages?.length) {
    return res.status(400).json({ error: '消息不能为空' })
  }

  const apiKey = process.env.MIMO_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: '服务端未配置 MIMO API Key' })
  }

  try {
    const resp = await fetch('https://token-plan-cn.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'mimo-v2.5-pro',
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? 2000,
        stream: false
      })
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      console.error('MIMO API error:', resp.status, errText)
      return res.status(502).json({ error: `MIMO API 错误: ${resp.status}` })
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''

    return res.status(200).json({ success: true, content })

  } catch (err) {
    console.error('Chat error:', err.message)
    return res.status(500).json({ error: `请求失败: ${err.message}` })
  }
}
