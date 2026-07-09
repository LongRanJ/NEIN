// Vercel Serverless Function - 触发 GitHub Actions 修正新闻源链接
// 环境变量：GITHUB_TOKEN, MIMO_API_KEY（均从 Vercel 环境读取）

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { failedSources, keyword } = req.body

  if (!failedSources || failedSources.length === 0) {
    return res.status(400).json({ error: '没有需要修正的源' })
  }

  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    return res.status(500).json({ error: '服务端未配置 GITHUB_TOKEN' })
  }

  const mimoKey = process.env.MIMO_API_KEY
  if (!mimoKey) {
    return res.status(500).json({ error: '服务端未配置 MIMO_API_KEY' })
  }

  try {
    const resp = await fetch('https://api.github.com/repos/LongRanJ/NEIN/actions/workflows/fix-news-sources.yml/dispatches', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          failed_sources: JSON.stringify({ failedSources, keyword: keyword || '' }),
          mimo_key: mimoKey
        }
      })
    })

    if (resp.status === 204) {
      return res.status(200).json({
        success: true,
        message: `已提交修正任务（${failedSources.length}个源），约3-5分钟后刷新重试`,
        sources: failedSources
      })
    }

    const errText = await resp.text().catch(() => '')
    console.error('GitHub API error:', resp.status, errText)
    return res.status(502).json({ error: `GitHub API 错误: ${resp.status}` })

  } catch (err) {
    console.error('Fix trigger error:', err.message)
    return res.status(500).json({ error: `触发失败: ${err.message}` })
  }
}
