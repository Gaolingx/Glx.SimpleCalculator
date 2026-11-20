# T20 QA 记录 — 2026-11-20

发布后 UI 打磨（缩放滑杆、动效、布局统一、tooltip 修复）与多槽记忆面板的抽样验证。

## 被测对象

| 项 | 值 |
|---|---|
| 代码 | HEAD（T20，含 `memories[]` 契约与 M▾ 面板） |
| 前端 | Vitest 206 项 / 26 文件；JS 421.14 kB（gzip 130.42 kB）、CSS 61.53 kB（gzip 9.44 kB） |
| Rust | 250 项；`fmt` / `clippy -D warnings` / `test` 全部通过 |
| 安装包 | 未重建；`release/v0.1.0/` 仍对应 T19 构建 |

## 方法

- **浏览器预览**：`npm run dev -- --port 4180`，Edge 157 headless + CDP，视口 440×820；通过 `localStorage["glx.settings.preview"]` 写入主题/语言/`uiZoom` 后导航加载，读取 `data-theme`、`html lang`、根字号、`--ui-zoom`、`data-ui-scale`、`scrollWidth/clientWidth` 并截图。
- **记忆面板**：浏览器预览不执行 Rust 计算，无法产生记忆；改由 `src/features/basic/MemoryBar.test.tsx`（jsdom + RTL）覆盖打开面板、最新在前、按 id 恢复、清空全部、空列表禁用。
- **内核**：`cargo test --workspace` 覆盖多槽新建在前、按 id 命中旧槽、旧槽 M+、未知 id 拒绝、程序员字宽归一化。

## 缩放与主题抽样

| 场景 | 根字号 | `--ui-zoom` | 主题 / 语言 | 页面宽 | 结论 |
|---|---|---|---|---|---|
| 100% 浅色中文 | 16px | 1 | light / zh-CN | 440/440 | 无横向溢出，`main` 376 |
| 150% 浅色中文（设置弹层） | 24px | 1.5 | light / zh-CN | 440/440 | 滑杆显示 150%，弹层在视口内，`data-ui-scale=large` |
| 150% 深色英文 | 24px | 1.5 | dark / en-US | 440/440 | 无横向溢出，`main` 344 |
| 250% 浅色英文（上限） | 40px | 2.5 | light / en-US | 440/440 | 仅竖向滚动（`scrollHeight=1305`），无横向溢出 |

控制台：0 error / 0 exception。

## 截图

| 文件 | 说明 |
|---|---|
| `t20-light-zh-CN-basic-100.png` | 100% 基准 |
| `t20-light-zh-CN-settings-150.png` | 设置弹层，缩放滑杆 150% |
| `t20-dark-en-US-basic-150.png` | 深色 / English / 150% |
| `t20-light-en-US-basic-250.png` | 250% 上限，竖向滚动 |

## 限制

- 记忆面板的浏览器预览不可用（无 IPC / 不执行计算），其交互由组件测试覆盖，未在真实 WebView2 中点击验证。
- 250% 超出 Windows 文本大小 150% 产品约束，仅验证用户缩放的边界与无横向溢出。
- 安装包未重建；发布前需升版本并重新打包。
