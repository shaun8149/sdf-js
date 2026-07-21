# Sprint 33 — a16z 20 篇对抗验证报告 (2026-07-10)

20 篇 a16z 文章摘录 (英文, 风格从数据密集报告到概念宣言) 打穿 news-to-deck 全链。
三路独立对抗检查: eval scorer / **number precision** (幻觉数字) / 全 subject 渲染冒烟。

**Summary**: 20 decks, 20/20 in [10,20] band, mean score 94.9, facts 99.5%, entities 92.5%, precision 88%, render failures 0

| deck | pages | band | score | facts% | ents% | prec% | halluc / renderFail |
|---|---|---|---|---|---|---|---|
| raise-15b | 11 | ✓ | 94.6 | 100 | 100 | 43 | halluc: $9.75B 38 70 130 110 95 75 165 90 200 195 180 |
| consumer-gold-rush | 12 | ✓ | 96.4 | 100 | 100 | 67 | halluc: 1B |
| enterprise-adoption | 10 | ✓ | 92.9 | 100 | 100 | 73 | halluc: 145 95 100 |
| cio-survey-2025 | 12 | ✓ | 96.4 | 90 | 100 | 77 | halluc: 25 18 7.7 |
| stablecoins | 10 | ✓ | 92.9 | 100 | 50 | 80 | halluc: $0.01 |
| ai-compute-cost | 12 | ✓ | 96.4 | 100 | 100 | 82 | halluc: 1.2 2025 |
| its-time-to-build | 13 | ✓ | 98.2 | 100 | 100 | 83 | halluc: 100 |
| enterprise-arms-race | 12 | ✓ | 96.4 | 100 | 100 | 84 | halluc: 19 0.46 0% 100% |
| app-spending | 10 | ✓ | 92.9 | 100 | 0 | 90 | halluc: 17 |
| gen-media-2026 | 13 | ✓ | 98.2 | 100 | 100 | 90 | halluc: 0.5 |
| genai-platform-value | 13 | ✓ | 98.2 | 100 | 100 | 92 | halluc: 85 |
| state-of-ai | 10 | ✓ | 92.9 | 100 | 100 | 100 |  |
| bio-x-ai | 11 | ✓ | 94.6 | 100 | 100 | 100 |  |
| robotics-defense | 10 | ✓ | 92.9 | 100 | 100 | 100 |  |
| techno-optimist | 11 | ✓ | 94.6 | 100 | 100 | 100 |  |
| read-25-books | 10 | ✓ | 92.9 | 100 | 100 | 100 |  |
| frontier-physical | 10 | ✓ | 92.9 | 100 | 100 | 100 |  |
| defend-nation | 11 | ✓ | 94.6 | 100 | 100 | 100 |  |
| big-ideas-infra | 10 | ✓ | 92.9 | 100 | 100 | 100 |  |
| notes-ai-apps | 12 | ✓ | 96.4 | 100 | 100 | 100 |  |
