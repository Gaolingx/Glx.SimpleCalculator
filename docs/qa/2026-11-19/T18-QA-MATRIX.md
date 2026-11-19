# T18 QA 矩阵 — 2026-11-19

T18 的合并回归记录。逐任务证据仍保留在本文档所在的 [README.md](README.md)，本页只记录最终构建的跨模式矩阵、门禁结果与已知问题。

## 被测对象

| 项 | 值 |
|---|---|
| 代码版本 | `c910b06`（T17 HEAD，工作区无源码改动） |
| 可执行文件 | `target/release/glx-calculator.exe`，6,814,720 B |
| exe SHA-256 | `eb15cdffebc660d8354a542a26e2b87f677e190e9bed392d12ed4d073d3782fc` |
| 前端产物 | JS 415.79 kB（gzip 128.78 kB）、CSS 58.82 kB（gzip 9.03 kB）、Inter 48.25 kB |
| 安装包 | NSIS 2.40 MB / MSI 3.25 MB（T17 冒烟，见 README「T17」） |

## 环境

- Windows Server 2022（10.0.20348，x64）；当前会话非管理员。
- WebView2 Runtime 157.0.4341.60；系统缩放 175%（DPI 168）。
- Windows 文本大小未设置（`TextScaleFactor` 缺省，100%）。
- 输入法：`Get-WinUserLanguageList` 为空，本机未安装中文输入法。
- 构建链：Rust 1.98.1、Node 24.21.0、npm 11.19.0。

## 方法

- 启动 release exe，`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9225`，Node + CDP 直接驱动真实 WebView2；走真实 IPC、设置、历史与系统剪贴板。
- 视口固定 440×820（`Emulation.setDeviceMetricsOverride`）；DPI 档位用 `deviceScaleFactor` 1 / 1.25 / 1.5 / 1.75 / 2 模拟；文本缩放写入 `--ui-scale` 与 `html[data-ui-scale]`（与 T16 相同路径）。
- 一次脚本运行产出 20 条断言，全部 PASS；运行前后备份并恢复 `settings.json`、`history.json`、`currency-cache.json`、`.window-state.json` 与系统剪贴板。
- 记录结果：`docs/qa/2026-11-19/` 下的 T18 截图；本页表格中的“实测”即脚本读回的界面文本/尺寸。

## 全量门禁

| 门禁 | 结果 |
|---|---|
| `cargo fmt --all -- --check` | 通过 |
| `cargo clippy --workspace --all-targets -- -D warnings` | 通过，0 warning |
| `cargo test --workspace` | **246 passed**，0 failed |
| `npm run typecheck` | 通过 |
| `npm run lint`（oxlint） | 0 warning / 0 error（81 文件） |
| `npm run test`（Vitest） | **196 passed**（25 文件） |
| `npm run check:i18n` | 通过：13 文件 × 2 语言，单文件最多 132 键 |
| `npm run build` | 通过，产物见上表 |

## 功能矩阵

| 页面 | 操作 | 期望 | 实测 | 结果 |
|---|---|---|---|---|
| 基本 | 键盘 `2 + 3 × 4 Enter` | `14`，表达式 `2 + 3 × 4 =` | `14` / `2 + 3 × 4 =` | PASS |
| 科学型 | `30` → `sin`（DEG） | `0.5` | `0.5` | PASS |
| 程序员 | 输入 `255` | HEX `FF`、DEC `255`、OCT `377`、BIN `1111 1111` | 四进制一致 | PASS |
| 统计型 | 录入 `1..10` → `x̄` | `5.5`，10 行数据集 | `5.5` / 10 行 | PASS |
| 单位转换 | 默认 `1 km → m` | `1,000`，公式 `1 km = 1,000 m` | `1,000` / `1 km = 1,000 m` | PASS |
| 单位转换（汇率） | 类别切到「汇率」 | 显示 ECB 来源与日期 | 「数据来源：ECB · 2026-11-18」+ 刷新按钮 | PASS |
| 日期计算 | 默认同日差 | `0 年 0 个月 0 天`，总天数 0 | 一致 | PASS |
| 日期计算 | 切「日期加减」+1 天 | 明天的本地化长日期 | `2026年11月20日` | PASS |
| 工作表 | 抵押默认 `1,000,000 / 4.2% / 30 年` | 月供 `4,890.17` | `4,890.17` / 总额 `1,760,461.20` / 利息 `760,461.20` | PASS |
| 历史 | `Ctrl+H` | 抽屉包含刚完成的 `2 + 3 × 4 = 14` | 一致（按「今天」分组） | PASS |
| 剪贴板 | `Ctrl+C` | 系统剪贴板为原始值 `1234567` | `1234567` | PASS |
| 剪贴板 | 剪贴板置为 `1,234 + 56` → `Ctrl+V` → `Enter` | `1,290` | `1,290` | PASS |

## 主题 × 语言

| 组合 | `data-theme` | `html lang` | 检查 | 截图 |
|---|---|---|---|---|
| 浅色 / 简体中文 | `light` | `zh-CN` | 43 个按钮，无裸键 | `t18-light-zh-CN-basic.png` |
| 深色 / 简体中文 | `dark` | `zh-CN` | 即时切换，无裸键 | `t18-dark-zh-CN-basic.png` |
| 深色 / English | `dark` | `en-US` | 页面标题 `Basic`，按钮 aria 标签全英文，`untranslated=false` | `t18-dark-en-US-basic.png` |
| 浅色 / English | `light` | `en-US` | 即时切换，无裸键 | `t18-light-en-US-basic.png` |

## 键盘与可访问性

| 项 | 实测 |
|---|---|
| Tab 首焦点 | `A`「跳到主要内容」 |
| Enter | 焦点进入 `#main-content` |
| F1 | 打开「键盘快捷键」弹层；Esc 关闭 |
| 图标按钮 | 0 个缺少文本或 `aria-label`/`aria-labelledby` 的按钮 |
| 计算键盘 | 数字、运算符、Enter、Esc、Backspace、`%`、F9/R/Q/@ 与 Ctrl+C/V 均由 T5–T16 覆盖，本次抽样复验 Enter/Esc/Ctrl+C/V |
| 焦点陷阱 / forced-colors / reduced-motion | T16 已验；本次未回归 |

## DPI 与文本缩放

DPI（`deviceScaleFactor`，basic 页）：

| 缩放 | `main` 宽 | 页面 `scrollWidth/clientWidth` | 越界控件 |
|---|---|---|---|
| 100% | 376 | 440 / 440 | 0 |
| 125% | 376 | 440 / 440 | 0 |
| 150% | 376 | 440 / 440 | 0 |
| 175% | 376 | 440 / 440 | 0 |
| 200% | 376 | 440 / 440 | 0 |

文本大小 150%（`--ui-scale=1.5`，7 个页面逐页检查）：

| 页面 | `scrollWidth/clientWidth` | `main` 宽 | 越界控件 |
|---|---|---|---|
| 基本 / 科学型 / 程序员 / 统计型 / 日期计算 / 单位转换 / 工作表 | 440 / 440 | 344 | 0 |

150% 下科学/程序员键盘重排、页面竖向滚动、标题栏隐藏重复历史按钮与 dev 徽标均由 T16 验证；本次截图 `t18-light-zh-CN-worksheets-150.png` 复验工作表页。

## 输入法

未实测：测试机未安装中文输入法（`Get-WinUserLanguageList` 为空）。计算页使用全局 `keydown`，统计/日期/工作表/换算输入为受控 `input`；需在装有 Microsoft Pinyin 的机器复验「组合输入不触发计算、Enter 提交不误触 `=`」。

## 跨模式回归链路

启动 → 浅色/深色 → 7 个页面切换 → 各模式运算 → 历史抽屉 → Ctrl+C/Ctrl+V → 中英文切换 → DPI 1–2× → 文本 150%。全链路 0 console error、0 未捕获异常。

## QA 检查表

- [x] 7 个主页面可导航，各模式核心运算与上表一致
- [x] light/dark × zh-CN/en-US 四组合无裸键、无截断
- [x] DPI 100/125/150/175/200% 无横向溢出（T16 + T18）
- [x] Windows 文本大小 100/150% 无横向溢出，150% 截图归档
- [x] Tab 跳转链接、main 聚焦、F1 说明、图标按钮可访问名称
- [x] 历史记录写入、展示与模式隔离
- [x] 复制原始值 / 粘贴表达式清洗
- [x] ECB 汇率来源与日期展示（缓存态）
- [x] 安装/卸载/启动冒烟（T17；MSI per-machine 限制见下）
- [x] i18n 键集合与占位符一致（`check:i18n`）
- [x] fmt / clippy / test / typecheck / lint / build 全绿
- [x] 精选截图归档，文件名与任务/状态可追溯

## 已知问题与限制

| # | 问题 | 影响 | 缓解 / 后续 |
|---|---|---|---|
| 1 | MSI 为 `perMachine`，非管理员 `/qn` 被系统策略拒绝（1625） | 普通用户无法直接装 MSI | 普通用户用 NSIS（`currentUser`）；MSI 面向管理员集中部署；T17 已用 `/a` 验证载荷 |
| 2 | 未配置代码签名 | SmartScreen 可能提示 | 发布说明中注明；接入证书后重打包 |
| 3 | WebView2 使用 silent `downloadBootstrapper` | 离线机器/Server 2022 无 Runtime 时安装失败 | 预装 Evergreen Runtime，或联网安装 |
| 4 | Windows 文本大小上限 150% | 440px 紧凑窗口在 200–225% 下无法保证 6 列键盘可读 | 已在 `ui_scale_get` 钳制；HANDOFF §4.5 |
| 5 | 双屏不同缩放拖动未实测 | 混合 DPI 场景可能有边缘缩放差异 | 当前单活动桌面；后续在双屏环境复验 |
| 6 | 中文输入法未实测 | IME 组合输入行为未知 | 在装有 Pinyin 的环境补测 |
| 7 | ECB 汇率每日更新，29 币种、基准 EUR、无 RUB | 非实时，部分币种缺失 | 缓存 24h；离线回退旧数据并提示 |
| 8 | 无自动更新 | 新版本需手动下载 | 本迭代范围外；保留版本号与 changelog 规范 |
| 9 | 不构建 Android/iOS | 仅 Windows 桌面 | 图标目录未保留移动端资源 |
| 10 | 标题栏保留 `DEV` 徽标（100–115% 文本大小） | 发布版可能被误认为开发构建 | 设计稿元素，≥120% 自动隐藏；T19 决定是否移除 |

## 截图

| 文件 | 说明 |
|---|---|
| `t18-light-zh-CN-basic.png` | 浅色 / 中文，`2 + 3 = 5` |
| `t18-dark-zh-CN-basic.png` | 深色 / 中文 |
| `t18-dark-en-US-basic.png` | 深色 / English |
| `t18-light-en-US-basic.png` | 浅色 / English |
| `t18-light-zh-CN-worksheets-150.png` | 文本 150%，工作表竖向滚动 |

当前 `docs/qa/2026-11-19/` 累计 T3–T18 的逐任务证据约 3.1 MB，高于 §12.2 的单里程碑 2 MB 建议值；T18 新增约 0.21 MB。若发布时需压缩，可按 §12.3 只保留每个里程碑一套精选图。

## 结论

T18 合并回归 **20/20 PASS**，0 console error，无阻塞缺陷；T18 验收通过。T19 已完成：发布说明见 [docs/release/v0.1.0.md](../../release/v0.1.0.md)，产物归档于 `release/v0.1.0/`（不入库）。