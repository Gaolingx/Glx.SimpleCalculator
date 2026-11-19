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

# T8 科学型 — 2026-11-19

- 方式：Tauri dev + WebView2 CDP（真实 IPC/设置/历史）；截图使用 CDP 设备模拟 440×820（1x）与真实 175% DPI 各一套。QA 前后已恢复设置与系统剪贴板，并清空科学型历史。

## 结果

| 项 | 结果 |
|---|---|
| 三角函数 | DEG `sin(30)` → `0.5`；RAD `π ÷ 2 =` 后 `sin` → `1`；GRAD `sin(100)` → `1`，`settings.json` 的 `angleUnit` 同步为 `grad` |
| 大数 | `170!` → `7.25741561530799e+306`（f64，超出 Decimal 值域） |
| F-E | `1,234.5` → `1.2345e+3`，再次点击恢复 `1,234.5` |
| 随机 | 连续两次 `rand` 结果不同，均落在 `[0,1)` |
| 定义域 | `tan(90)`、`ln(0)` 显示「超出定义域」，表达式行保留原输入；输入 `5` 后正常恢复 |
| 历史 | `sin(30) =` 作为完整表达式记录；恢复后显示 `0.5`，角度制仍为 DEG，继续计算正确 |
| 剪贴板/菜单 | Ctrl+C 复制 `0.5`；右键菜单仍为 4 项，Esc 关闭且不清值 |
| 布局 | 441×821 客户端尺寸、`scrollWidth/Height` 与视口一致；6×8 键位全部在视口内 |
| 控制台 | 0 error（含错误路径与随机/历史操作） |
| 测试 | 前端 105 项、Rust 132 项通过 |

## 截图

- `t8-light-zh-CN-scientific.png`、`t8-light-en-US-scientific.png`、`t8-dark-zh-CN-scientific.png`、`t8-dark-en-US-scientific.png`（440×820，1x，`sin(30)=0.5`）
- `t8-tauri-verified.png`（真实 Tauri WebView2，`170!` 结果，772×1437 @175%）


# T11 统计型 — 2026-11-19

- 方式：Edge headless CDP（440×820，1x，light/dark × zh-CN/en-US），`Page.addScriptToEvaluateOnNewDocument` 注入 mock `__TAURI_INTERNALS__` 渲染真实前端；内核算法由 Rust 集成测试覆盖。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | `documentElement` 440/440、820/820；`main` 376/376；12 个函数键、10 行数据集全部在视口内，无横向/纵向溢出 |
| 样本 | 数据 `1..10`，点击 `x̄` → `5.5`，表达式 `mean(1, 2, 3, 4, 5, 6, 7, 8, 9, 10) =` |
| 添加 | 输入 `11` → 11 项，结果卡片清空 |
| 编辑 | 编辑第 1 项载入输入框；改为 `2` 后原位置更新 |
| 删除/排序 | 删除首项回到 10 项；排序 `录入 → 升序 → 降序`，降序显示下标 `9…0` |
| 清空/空集 | 二次确认后 0 项；点击 `Σx` 显示「请先添加至少一个数值。」 |
| 主题/语言 | 四组均正常，0 console error |
| 测试 | 前端 136 项、Rust 179 项通过 |

## 截图

- `t11-light-zh-CN-statistics.png`、`t11-light-en-US-statistics.png`、`t11-dark-zh-CN-statistics.png`、`t11-dark-en-US-statistics.png`（440×820，1x，均值结果）
- `t11-light-zh-CN-statistics-empty.png`（清空后的空状态与空集提示）

# T12 单位转换 — 2026-11-19

- 方式：Edge headless CDP（440×820，1x，light/dark × zh-CN/en-US），`Page.addScriptToEvaluateOnNewDocument` 注入 mock `__TAURI_INTERNALS__`（目录与换算结果）渲染真实前端；内核换算与目录由 Rust 集成测试覆盖。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | `documentElement` 440/440、820/820；`main` 376/376、776/776；全部按钮在视口内，无横向/纵向溢出 |
| 默认 | 长度 `1 km → m` = `1,000`，公式 `1 km = 1,000 m` |
| 单位切换 | 目标改英尺 → `3,280.83989501` |
| 换向 | `1 ft → km` = `0.0003048` |
| 类别切换 | 温度默认 `°C → °F`，`1 °C` = `33.8 °F` |
| 汇率 | 显示「汇率数据不可用」与「汇率数据将在联网后更新。」（T13 接入 ECB 数据） |
| 复制 | 复制规范值 `0.001`（长度默认对调为 m→km） |
| 下拉 | 类别列表 portal 渲染、选中项高亮、滚动正常 |
| 主题/语言 | 四组均正常，0 console error |
| 测试 | 前端 150 项、Rust 203 项通过 |

## 截图

- `t12-light-zh-CN-converter.png`、`t12-light-en-US-converter.png`、`t12-dark-zh-CN-converter.png`、`t12-dark-en-US-converter.png`（440×820，1x，`1 km = 1,000 m`）
- `t12-light-zh-CN-converter-options.png`（类别下拉）
- `t12-light-zh-CN-converter-currency.png`（汇率离线提示）

# T13 ECB 汇率 — 2026-11-19

- 方式：Edge headless CDP（440×820，1x，light/zh-CN 与 dark/en-US），`Page.addScriptToEvaluateOnNewDocument` 注入 mock `__TAURI_INTERNALS__`（目录、汇率状态、换算与刷新失败）渲染真实前端；ECB XML 解析、缓存与离线分支由 Rust fixture 集成测试覆盖，QA 不访问外网。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | `documentElement` 440/440、820/820；`main` 376/376、776/776；全部按钮在视口内 |
| 在线态 | 状态条显示「数据来源：ECB · 2026-11-18」与刷新按钮；`1 EUR = 1.1585 USD` |
| 刷新成功 | 刷新后保留来源/日期并重算当前货币结果 |
| 刷新失败 | 结果保留，显示「汇率更新失败，使用 2026-11-18 数据」 |
| 离线态 | dark/en-US 显示 `No exchange rates available`、`Exchange rate data is unavailable` 与重试提示 |
| 控制台 | 0 console error / 0 异常 |
| 测试 | 前端 153 项、Rust 218 项通过（Rust 含 ECB fixture 与离线分支 5 项集成测试） |

## 截图

- `t13-light-zh-CN-currency.png`（在线态与来源日期）
- `t13-light-zh-CN-currency-refresh-failed.png`（刷新失败保留缓存）
- `t13-dark-en-US-currency-offline.png`（离线无缓存）

# T14 日期计算 — 2026-11-19

- 方式：Edge headless CDP（440×820，1x，light/zh-CN 与 dark/en-US），`Page.addScriptToEvaluateOnNewDocument` 注入 mock `__TAURI_INTERNALS__`（设置、`date_diff`/`date_add` 的 JS 镜像）渲染真实前端；闰年、月末夹取与越界由 Rust 日期集成测试覆盖。
- 交互：点击结束日期触发器 → 下个月 → 15 日；切换「日期加减」→ 减 → 个月；dark 下打开起始日期并切换到 2024-02 / 2023-02。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | `documentElement` 440/440、820/820；`main` 376/376、776/776；按钮无越界（20 / 54 个） |
| 日期差 | `2026-11-19 → 2026-12-15` 显示 `0 年 0 个月 26 天`，总天数 26、总周数 3 周 5 天 |
| 日期加减 | 起始 `2026-11-19` − 1 个月 = `2026-10-19`，公式与 ISO 日期同步 |
| 日历弹层 | dark/en-US 312×359，位于视口内（左 104、上 271、右 416、下 630） |
| 闰年 | 2024-02 可选中 29 日；上一年的 2023-02 无 29 日 |
| 主题/语言 | light/zh-CN 与 dark/en-US 均无裸键、无截断、0 console error / 0 异常 |
| 测试 | 前端 180 项、Rust 227 项通过 |

## 截图

- `t14-light-zh-CN-datecalc.png`（日期差 26 天与总计）
- `t14-light-zh-CN-date-add.png`（减 1 个月）
- `t14-dark-en-US-datecalc.png`（同日起始态）
- `t14-dark-en-US-date-picker.png`（日历弹层，2024-02 含 29 日）

# T15 工作表 — 2026-11-19

- 方式：Edge headless CDP（440×820，1x，light/zh-CN 与 dark/en-US），`Page.addScriptToEvaluateOnNewDocument` 注入 mock `__TAURI_INTERNALS__`（设置、`worksheet_catalog`/`worksheet_compute` 的 JS 镜像）渲染真实前端；公式、边界与溢出由 Rust 工作表集成测试覆盖。
- 交互：切换「油耗」；dark/en-US 切换「Lease」；残值改为 `300000`（等于车价）触发跨字段校验。

## 结果

| 项 | 结果 |
|---|---|
| 布局 | `documentElement` 440/440、820/820；`main` 376/776；三张表按钮/输入均无越界，0 异常 |
| 抵押 | `1,000,000 / 4.2% / 30 年` → 月供 `4,890.17`、总额 `1,760,461.20`、利息 `760,461.20` |
| 油耗 | `500 km / 7.5 L/100km / 7.5` → `37.5 L`、`281.25`、`31.36 mpg(US)`、`37.66 mpg(UK)` |
| 租赁 | 默认 `300000 / 150000 / 36 / 5% / 0%` → `5,104.17`、`183,750.12`、`33,750.00` |
| 校验 | 残值 300000 时残值输入高亮并显示「Residual value must be below the vehicle price」，结果区提示「Fix the highlighted fields to recalculate」 |
| 主题/语言 | light/zh-CN 与 dark/en-US 均无裸键、无裁切、0 console error |
| 测试 | 前端 188 项、Rust 243 项通过 |

## 截图

- `t15-light-zh-CN-worksheet-mortgage.png`（抵押默认结果）
- `t15-light-zh-CN-worksheet-fuel.png`（油耗与 mpg 明细）
- `t15-dark-en-US-worksheet-lease.png`（租赁两列表单）
- `t15-dark-en-US-worksheet-lease-invalid.png`（残值跨字段校验）

# T16 DPI / 无障碍 / 性能 — 2026-11-19

- 方式：`cargo run` 启动 debug 应用，`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`，Node + CDP 直接驱动真实 WebView2（真实 IPC/设置/i18n）；视口 `Emulation.setDeviceMetricsOverride` 固定 440×820。
- 文本缩放：本机未设置 `HKCU\Software\Microsoft\Accessibility\TextScaleFactor`，`ui_scale_get` 返回 `{textScale: 1.0}`；125%/150% 通过写入同一 `--ui-scale` 与 `html[data-ui-scale]` 变量路径验证（未修改系统设置）。release 冷启动由 `target/release/glx-calculator.exe` 单独测量。

## 结果

| 项 | 结果 |
|---|---|
| 系统缩放 | 100/125/150/175/200%：`documentElement` 440/440、820/820，`main` 376/776，无横向溢出、无控件越界 |
| 文本 100% | 7 页 `page.scrollWidth = clientWidth`，无截断标签 |
| 文本 125% | 7 页无横向溢出；科学/程序员键盘 6→4 列、统计 4→3 列，页面按需竖向滚动 |
| 文本 150% | 7 页无横向溢出、无截断标签；科学 1450px、程序员 1280px、统计 906px、工作表 970px 内容高；日期弹层 416px、设置弹层 368px 均在 440 视口内 |
| en-US 150% | `Mortgage/Fuel/Lease`、`Difference/Add or subtract` 等长标签完整显示，7 页无溢出/截断 |
| 键盘 | Tab → 「跳到主要内容」→ Enter 聚焦 `main`；F1 打开快捷键说明、Esc 关闭；Ctrl+H 打开历史 |
| IPC | `calc_command` 30 次 mean 2.29ms、p95 3.0ms、max 3.5ms |
| 输入延迟 | 合成按键 → `calc-value` 变更后下一帧：8 次 16.0–17.5ms |
| 冷启动 | release：进程启动 → `main` 可交互 首次 1.45s、后续 0.74s / 0.70s；页面 DCL/load 123–153ms |
| 控制台 | 0 error |
| 测试 | 前端 196 项、Rust 246 项通过 |

## 说明

- 文本缩放有效上限 150%：440px 紧凑窗口在 200–225% 下无法保证 6 列键盘可读；该取舍已写入 HANDOFF §4.5/自审 #28。
- 双屏不同缩放拖动未实测（当前为单活动桌面）；DPI 矩阵通过 CDP 设备缩放模拟完成。

## 截图

- `t16-light-zh-CN-shortcuts.png`（F1 说明，100%）
- `t16-light-zh-CN-basic-100.png`（基准布局）
- `t16-light-zh-CN-scientific-150.png`（150% 四列重排、F-E 换行）
- `t16-light-zh-CN-programmer-150.png`（150% 字宽控件与位网格）
- `t16-dark-zh-CN-basic-150.png`（深色 150%）
- `t16-light-zh-CN-datepicker-150.png`（150% 日历弹层，416px）
- `t16-light-en-US-shortcuts-150.png`（英文 150% 说明）
- `t16-light-en-US-scientific-150.png`（英文 150% 科学型）
- `t16-dark-en-US-worksheets-150.png`（英文/深色 150% 工作表）

# T17 打包与安装冒烟 — 2026-11-19

- 方式：`npx tauri build`（release：`opt-level=s`、`lto=thin`、`codegen-units=1`、`strip=true`、`panic=abort`）；NSIS `/S` 安装 → 启动（WebView2 CDP 9223）→ `uninstall.exe /S` 卸载；MSI 以非管理员 `/qn` 尝试安装，再用 `/a` 管理安装解包并启动载荷。
- 环境：Windows Server 2022（10.0.20348）、WebView2 157.0.4341.60、当前会话非管理员。
- 构建工具：WiX 3.14.1 从 NuGet 官方镜像取得后置于 `%LOCALAPPDATA%\tauri\WixTools314`（本机直连 GitHub 发行资产长时间停滞）；NSIS 3.11 由 Tauri 自动下载。

## 产物

| 产物 | 大小 | SHA-256 |
|---|---|---|
| `target/release/glx-calculator.exe` | 6,814,720 B | `eb15cdffebc660d8354a542a26e2b87f677e190e9bed392d12ed4d073d3782fc` |
| `bundle/nsis/Glx Calculator_0.1.0_x64-setup.exe` | 2,399,069 B | `45bbb99316bd05144bf81d067ec087ad14c6aeecc38546dfea4a5a8a164d4219` |
| `bundle/msi/Glx Calculator_0.1.0_x64_en-US.msi` | 3,252,224 B | `1ca26ca65fb090f28514151f6465ff2ef7a81e6c4f1907b28f383fd6103b47ee` |
| `bundle/msi/Glx Calculator_0.1.0_x64_zh-CN.msi` | 3,248,128 B | `d096eee6c91a1affb234090525b246d5d210e69d6d1cdca95569f67aed88d2a0` |

前端产物：JS 415.79 kB（gzip 128.78 kB）、CSS 58.82 kB（gzip 9.03 kB）、字体 48.25 kB；JS 低于 250 kB gzip 预算。

## 结果

| 项 | 结果 |
|---|---|
| 图标 | `app-icon.svg` 生成 32/64/128/256/512px PNG、ICO、ICNS、Square/StoreLogo；`icon.ico` 用于窗口与安装包；移动端目录未保留 |
| NSIS 安装 | `setup.exe /S` 退出码 0；安装到 `%LOCALAPPDATA%\Glx Calculator`；HKCU 卸载项显示 `Glx Calculator 0.1.0` |
| 启动 | 安装版 `glx-calculator.exe` 窗口标题 `Glx Calculator`；CDP `main=true`、43 个按钮、根字号 16px，页面文案为 zh-CN |
| NSIS 卸载 | `uninstall.exe /S` 退出码 0；安装目录与 HKCU 卸载项均移除；无遗留 `glx-calculator` 进程 |
| MSI 常规安装 | 非管理员 `/qn` 返回 1625；日志显示系统策略禁用非管理员的 per-machine 安装，未写入 Program Files |
| MSI 管理安装 | `msiexec /a` 退出码 0；载荷 `glx-calculator.exe` 6,814,720 B，与 NSIS 安装一致；直接启动窗口/CDP 正常 |
| 冷启动 | release 3 次：1.53 s / 0.85 s / 0.93 s（首次含 50 ms CDP 轮询与握手；目标 <1.5 s，T16 同口径 1.45 s） |
| 控制台 | 安装版与 MSI 载荷均能加载 `main`，无启动失败 |
| 测试 | Rust 246 项、前端 196 项通过；fmt/clippy/typecheck/lint/check:i18n/build 全绿 |

## 说明

- 当前会话非管理员，MSI 的 `perMachine` 安装/卸载未在本机完成；已用管理安装验证包体完整性与载荷启动，需在管理员会话复验安装/卸载。
- NSIS 为 `currentUser`，无需提权即可安装/卸载；适合普通用户分发。MSI 适合管理员集中部署。
- 未配置代码签名证书，SmartScreen 可能提示；本迭代不启用自动更新。
- 版本号保持 `0.1.0`，产物归档与发布说明在 T19 处理。
