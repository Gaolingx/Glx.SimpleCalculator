# M0 QA — 2026-11-19

- 环境：Windows Server 2022（10.0.20348）、WebView2 157.0.4341.60、系统缩放 175%（DPI 168）。
- 版本：T3 收尾（无边框外壳、导航、7 页占位、设置持久化）。
- 方式：Win32 窗口样式检查 + 输入注入（拖拽/Snap/缩放/按钮），WebView2 CDP（DOM、控制台、设置、DPI 设备模拟）。

## 结果

| 项 | 结果 |
|---|---|
| 窗口外壳 | `decorations:false`、`shadow:true`；`WS_THICKFRAME/MINBOX/MAXBOX` 就绪 |
| 交互 | 双击最大化/还原、拖拽移动、顶部 Snap、边缘缩放、自绘最小化/最大化/还原/关闭均通过 |
| 权限 | `core:default` 不含窗口写操作；已补 `start-dragging/minimize/toggle-maximize/close` |
| 设置 | 主题/语言/分组/历史开关/上限/角度制/字宽/进制可读写；重启保留；恢复默认成功 |
| 导航 | 7 个主页面 hash 路由，历史抽屉与设置弹层可开合，`Ctrl+H` 打开历史 |
| 主题/语言 | light/dark × zh-CN/en-US 即时切换，无未翻译裸键 |
| DPI | 100%/125%/150%/175%/200% 下布局无溢出；175% 实机清晰 |
| 控制台 | 0 error / 0 warning（favicon 404 已修复） |
| 测试 | 前端 31 项、Rust 10 项通过 |

## 截图

均为 440×820、设备缩放 1x，用于两主题 × 两语言回归。

- `m0-light-zh-basic.png`
- `m0-light-en-basic.png`
- `m0-dark-zh-basic.png`
- `m0-dark-en-basic.png`
- `m0-dark-en-settings.png`
