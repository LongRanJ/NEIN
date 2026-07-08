# NEIN - 新能源行业资讯平台

> New Energy Industry News - 聚合锂电池、固态电池、储能、氢能等领域最新动态

## ✨ 功能特性

- 📰 **行业资讯展示** - 8大关键词分类，10+主流媒体源
- 📊 **数据可视化** - 关键词分布、来源分析、时间趋势
- 🔍 **智能检索** - 模糊搜索 + 多维筛选
- 🤖 **AI 资讯助手** - 三种模式：纯前端/外部模型/内部模型

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 获取最新资讯（本地运行）
npm run fetch-news
```

## 🤖 AI 助手模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| 纯前端搜索 | 基于 Fuse.js 模糊匹配 | 无需 API，开箱即用 |
| 外部模型 | OpenAI / DeepSeek 等 | 有外部 API Key |
| 内部模型 | 公司内网大模型 | 企业内网环境 |

## 📡 数据源

- Google News RSS（关键词聚合）
- 36氪 / IT之家 / 虎嗅 RSS
- NewsAPI（可选）

## 🔧 GitHub Pages 部署

1. Fork 本项目
2. 在仓库 Settings → Pages 中启用 GitHub Actions
3. 推送代码即自动部署

资讯抓取通过 GitHub Actions 每天自动运行，无需手动操作。

## 📁 项目结构

```
NEIN/
├── .github/workflows/   # CI/CD 配置
├── scripts/             # 资讯抓取脚本
├── src/
│   ├── components/      # Vue 组件
│   ├── stores/          # Pinia 状态管理
│   ├── data/            # 静态资讯数据
│   └── assets/          # 样式资源
└── public/              # 静态资源
```

## 📄 License

MIT
