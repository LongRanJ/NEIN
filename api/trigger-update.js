// Vercel Serverless Function - 触发 GitHub Actions 新闻更新
// 环境变量：GITHUB_TOKEN（需要 repo 权限的 Personal Access Token）

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    return res.status(500).json({ error: '服务端未配置 GITHUB_TOKEN' })
  }

  try {
    // 触发 fetch-news workflow
    const resp = await fetch('https://api.github.com/repos/LongRanJ/NEIN/actions/workflows/fetch-news.yml/dispatches', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        ref: 'main'
      })
    })

    if (resp.status === 204) {
      return res.status(200).json({ success: true, message: '已触发新闻更新任务，预计 2-5 分钟完成' })
    }

    const errText = await resp.text().catch(() => '')
    console.error('GitHub API error:', resp.status, errText)
    return res.status(502).json({ error: `GitHub API 错误: ${resp.status}` })

  } catch (err) {
    console.error('Trigger error:', err.message)
    return res.status(500).json({ error: `触发失败: ${err.message}` })
  }
}
