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

# T5 标准模式 UI — 2026-11-19

- 方式：Edge headless CDP（精确 440×820，light/dark × zh-CN/en-US）+ Tauri dev / WebView2 CDP（真实 IPC、键盘、记忆、错误路径）。
- 环境：同上；Tauri 窗口逻辑尺寸 441×821（设备缩放 175%）。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | 440×820 下 `scrollWidth/clientWidth = 440`、`scrollHeight/clientHeight = 820`；24 个按键全部在视口内（keypad 296–796），无横向溢出 |
| 运算 | `2 + 3 × 4 =` → `14`；表达式行显示 `2 + 3 × 4 =` |
| 分组 | `1000 × 1000 =` → `1,000,000`；关闭分组后即时取消分隔 |
| 错误 | `1 ÷ 0` → 显示「不能除以零」，表达式行保留 `1 ÷ 0` |
| CE | `2 + 3 CE` → 值 `0`、表达式 `2 +`；继续 `4 =` → `6` |
| 记忆 | MS 后出现 `M` 指示；C 后按 MR 恢复 `500` |
| 键盘 | 数字、运算符、Enter、Esc、Backspace、% 与 F9/R/Q/@ 均映射到命令；覆盖层打开时不拦截 |
| IPC | 20 次 `calc_command` 均值 1.77 ms、p95 2.5 ms、最大 2.5 ms |
| 控制台 | 0 error |
| 测试 | 前端 55 项、Rust 92 项通过 |

## 截图

- `t5-light-zh-CN-basic.png`、`t5-light-en-US-basic.png`、`t5-dark-zh-CN-basic.png`、`t5-dark-en-US-basic.png`（440×820，1x）
- `t5-tauri-verified.png`（真实 Tauri WebView2，`2 + 3 × 4 =` 结果 14，逻辑 441×821 @175%）

# T6 历史记录 — 2026-11-19

- 方式：Tauri dev + WebView2 CDP（真实 IPC/存储/剪贴板）+ Edge headless（440×820 截图）。
- 环境：同上。

## 结果

| 项 | 结果 |
|---|---|
| 记录 | `2 + 3 =` 与 `10 × 2 =` 各生成一条；最新在前，按「今天/昨天」分组 |
| 恢复 | 点击 `2 + 3 =` 后抽屉关闭，显示区值为 `5`、表达式保留；继续 `× 2 =` 得 `10` 并新增条目 |
| 复制 | 写系统剪贴板为原始值 `10`（`Get-Clipboard` 校验），UI 提示「已复制」 |
| 删除 | 单条删除后抽屉与 `history.json` 同步 |
| 清空 | 二次确认（确认→取消→确认）；清空后展示空状态，文件 `entries` 为 `[]` |
| 持久化 | 重启应用后历史保留、计算会话归零 |
| 开关/上限 | 关闭历史后 `9 × 9 =` 不记录；105 条后上限改为 100，内存与文件均保留最新 100 条 |
| 布局 | 440×820 下 light/dark × zh-CN/en-US 抽屉无溢出，控制台 0 error |
| 测试 | 前端 67 项、Rust 103 项通过 |

## 截图

- `t6-light-zh-CN-history.png`、`t6-light-en-US-history.png`、`t6-dark-zh-CN-history.png`、`t6-dark-en-US-history.png`（440×820，1x）

# T7 剪贴板 + 右键菜单 — 2026-11-19

- 方式：Tauri dev + WebView2 CDP（真实 IPC 与系统剪贴板）；截图使用 CDP 设备模拟 440×820（1x）与真实 175% DPI 各一套。QA 前后已恢复系统剪贴板与持久化设置。

## 结果

| 项 | 结果 |
|---|---|
| 复制 | 显示区复制按钮 → 原始值 `1234567`；右键「复制显示值」→ `1,234,567`；均提示「已复制」 |
| 粘贴 | Ctrl+V `1,234` → `1234`；全角 `１２３＋４５` → `168`；表达式 `2×(3+4)` → `14`（表达式行保留 `2 × (3 + 4)`） |
| 进制前缀 | `0xFF` → `255`（基本模式转十进制，BigInt 不丢精度） |
| 校验 | 1,001 字符 → 「粘贴内容过长」；空剪贴板 → 「剪贴板为空」；`abc` → 「剪贴板内容无法粘贴」且显示值保持不变 |
| 右键菜单 | 4 项：复制原始值（Ctrl+C）/ 复制显示值 / 粘贴（Ctrl+V）/ 清除（Esc）；无值时复制项禁用；Esc 关闭菜单不清值 |
| 覆盖层 | 菜单打开时 Ctrl+H 先关闭菜单再打开历史；菜单不浮于抽屉之上 |
| 布局 | 440×820 下 light/dark × zh-CN/en-US 菜单完整可见，无溢出 |
| 控制台 | 0 error / 0 warning |
| 测试 | 前端 93 项、Rust 103 项通过 |

## 截图

- `t7-light-zh-CN-menu.png`、`t7-light-en-US-menu.png`、`t7-dark-zh-CN-menu.png`、`t7-dark-en-US-menu.png`（440×820，1x）
- `t7-tauri-verified.png`（真实 Tauri WebView2，`2 + 3 =` 与右键菜单，772×1437 @175%）

