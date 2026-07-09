// Vercel Serverless Function - PPT 生成
// 基于 pptxgenjs，接收前端传来的结构化内容生成 .pptx 文件
// 环境变量：无（MIMO增强由前端调用 /api/chat 完成）

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { keyword, overview, slides } = req.body

  if (!keyword?.trim()) {
    return res.status(400).json({ error: '关键词不能为空' })
  }
  if (!slides || slides.length === 0) {
    return res.status(400).json({ error: '没有新闻数据，无法生成PPT' })
  }

  try {
    // 动态导入 pptxgenjs（兼容 CJS/ESM）
    let PptxGenJS
    try {
      PptxGenJS = (await import('pptxgenjs')).default
    } catch {
      PptxGenJS = require('pptxgenjs')
    }
    const pptx = new PptxGenJS()

    // 16:9 宽屏
    pptx.layout = 'LAYOUT_WIDE'

    const today = new Date().toISOString().split('T')[0]

    // NEIN 主题色
    const BG_DARK = '0F1729'
    const BG_GRADIENT_1 = '1A3A5C'
    const BG_GRADIENT_2 = '2D5F8A'
    const PRIMARY = '38BDF8'
    const ACCENT_GREEN = '22C55E'
    const TEXT_WHITE = 'FFFFFF'
    const TEXT_LIGHT = 'E2E8F0'
    const TEXT_MUTED = '94A3B8'
    const DIVIDER = '38BDF8'

    // ─── 封面页 ─────────────────────────────────────────

    const cover = pptx.addSlide()
    cover.background = { color: BG_DARK }

    // 渐变装饰矩形
    cover.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { type: 'solid', color: BG_GRADIENT_1 }
    })

    // 顶部装饰条
    cover.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.08,
      fill: { type: 'solid', color: PRIMARY }
    })

    cover.addText(`${keyword} - 新闻简报`, {
      x: 1, y: 1.8, w: 11, h: 1.5,
      fontSize: 40, fontFace: 'Microsoft YaHei',
      color: TEXT_WHITE, bold: true,
      align: 'left'
    })

    cover.addText(`生成日期：${today}`, {
      x: 1, y: 3.5, w: 11, h: 0.6,
      fontSize: 18, fontFace: 'Microsoft YaHei',
      color: TEXT_MUTED, align: 'left'
    })

    if (overview) {
      cover.addText(overview, {
        x: 1, y: 4.3, w: 11, h: 1.2,
        fontSize: 14, fontFace: 'Microsoft YaHei',
        color: TEXT_LIGHT, align: 'left',
        wrap: true
      })
    }

    cover.addText('NEIN 新能源行业资讯平台', {
      x: 1, y: 6.2, w: 11, h: 0.4,
      fontSize: 11, fontFace: 'Microsoft YaHei',
      color: TEXT_MUTED, align: 'left'
    })

    // ─── 概述页（如果有 overview） ─────────────────────

    if (overview) {
      const overviewSlide = pptx.addSlide()
      overviewSlide.background = { color: BG_DARK }

      overviewSlide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.06,
        fill: { type: 'solid', color: PRIMARY }
      })

      overviewSlide.addText('报告概述', {
        x: 0.8, y: 0.4, w: 11, h: 0.6,
        fontSize: 24, fontFace: 'Microsoft YaHei',
        color: TEXT_WHITE, bold: true
      })

      overviewSlide.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: 1.1, w: 2, h: 0.04,
        fill: { type: 'solid', color: PRIMARY }
      })

      overviewSlide.addText(overview, {
        x: 0.8, y: 1.4, w: 11.4, h: 5,
        fontSize: 16, fontFace: 'Microsoft YaHei',
        color: TEXT_LIGHT, align: 'left',
        wrap: true, valign: 'top'
      })
    }

    // ─── 内容页 ─────────────────────────────────────────

    slides.forEach((slide, i) => {
      const contentSlide = pptx.addSlide()
      contentSlide.background = { color: BG_DARK }

      // 顶部装饰条
      contentSlide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.06,
        fill: { type: 'solid', color: PRIMARY }
      })

      // 序号
      contentSlide.addText(`#${i + 1}`, {
        x: 0.5, y: 0.3, w: 1, h: 0.5,
        fontSize: 16, fontFace: 'Microsoft YaHei',
        color: PRIMARY, bold: true
      })

      // 标题
      contentSlide.addText(slide.title || '', {
        x: 0.5, y: 0.9, w: 12, h: 0.9,
        fontSize: 26, fontFace: 'Microsoft YaHei',
        color: TEXT_WHITE, bold: true,
        wrap: true
      })

      // 分割线
      contentSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: 1.9, w: 2, h: 0.04,
        fill: { type: 'solid', color: PRIMARY }
      })

      // 要点（bullet points）或摘要
      if (slide.bullets && slide.bullets.length > 0) {
        const bulletText = slide.bullets.map(b => `•  ${b}`).join('\n')
        contentSlide.addText(bulletText, {
          x: 0.5, y: 2.2, w: 12, h: 3.2,
          fontSize: 16, fontFace: 'Microsoft YaHei',
          color: TEXT_LIGHT, align: 'left',
          wrap: true, valign: 'top', lineSpacing: 28
        })
      } else if (slide.summary) {
        contentSlide.addText(slide.summary, {
          x: 0.5, y: 2.2, w: 12, h: 3.2,
          fontSize: 16, fontFace: 'Microsoft YaHei',
          color: TEXT_LIGHT, align: 'left',
          wrap: true, valign: 'top', lineSpacing: 26
        })
      }

      // 来源
      const sourceText = slide.source ? `来源：${slide.source}` : ''
      contentSlide.addText(sourceText, {
        x: 0.5, y: 5.6, w: 6, h: 0.35,
        fontSize: 11, fontFace: 'Microsoft YaHei',
        color: TEXT_MUTED
      })

      // 原文链接
      if (slide.url) {
        contentSlide.addText(`原文链接：${slide.url}`, {
          x: 0.5, y: 6.0, w: 12, h: 0.35,
          fontSize: 9, fontFace: 'Microsoft YaHei',
          color: PRIMARY
        })
      }

      // 页码
      contentSlide.addText(`${i + 1} / ${slides.length}`, {
        x: 11, y: 6.8, w: 2, h: 0.3,
        fontSize: 9, fontFace: 'Microsoft YaHei',
        color: TEXT_MUTED, align: 'right'
      })
    })

    // ─── 封底页 ─────────────────────────────────────────

    const back = pptx.addSlide()
    back.background = { color: BG_DARK }

    back.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { type: 'solid', color: BG_GRADIENT_1 }
    })

    back.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.08,
      fill: { type: 'solid', color: PRIMARY }
    })

    back.addText('感谢阅读', {
      x: 1, y: 2.2, w: 11, h: 1.5,
      fontSize: 44, fontFace: 'Microsoft YaHei',
      color: TEXT_WHITE, bold: true,
      align: 'center'
    })

    back.addText('由 NEIN 新能源行业资讯平台自动生成', {
      x: 1, y: 4, w: 11, h: 0.6,
      fontSize: 16, fontFace: 'Microsoft YaHei',
      color: TEXT_MUTED, align: 'center'
    })

    back.addText(today, {
      x: 1, y: 4.8, w: 11, h: 0.5,
      fontSize: 14, fontFace: 'Microsoft YaHei',
      color: TEXT_MUTED, align: 'center'
    })

    // ─── 生成文件 ───────────────────────────────────────

    const buffer = await pptx.write({ outputType: 'arraybuffer' })

    // 文件名安全处理
    const safeName = keyword.replace(/[\\/:*?"<>|]/g, '_')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}_新闻简报.pptx"`)
    res.status(200).send(Buffer.from(buffer))

  } catch (err) {
    console.error('PPT generation error:', err)
    res.status(500).json({ error: `PPT 生成失败: ${err.message}` })
  }
}
