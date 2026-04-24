# RoomSim

浏览器内的"装修前空间感知模拟器"。2D 俯视画户型、摆家具 → 一键切 3D 第一人称走一遍，判断实际入住是否舒适。技术设计详见 [RoomSim-TDD.md](./RoomSim-TDD.md)。

## 快速开始

```bash
pnpm install
pnpm dev          # http://localhost:5174/
pnpm test         # Vitest 全量单测（当前 124 tests）
pnpm typecheck    # vue-tsc
pnpm build        # 生产打包到 dist/
pnpm preview      # 预览 dist
```

> **Windows 环境提示**：如果看到 `Cannot find module @rollup/rollup-win32-x64-msvc` 或 `Application Control policy has blocked` 等错误，本项目已通过 `package.json` 的 `pnpm.overrides` 把 rollup 替换为 `@rollup/wasm-node`（纯 JS）绕开。重新 `pnpm install` 即可。
>
> 若 `vue-tsc` 报 `Search string not found: "/supportedTSExtensions = .*(?=;)/"`，说明 vue-tsc 版本与 TypeScript 不匹配，保持 `vue-tsc ^2.0.0` 与 `typescript ^5.3.0` 组合。

## 功能清单（P0）

**编辑器（2D 俯视）**
- 画墙、矩形一键房间、门/窗吸附到墙放置
- 家具库 30 种 + 拖拽放置 + 属性面板（尺寸/颜色/旋转/复制/删除）
- 房间自动识别（平面图面遍历算法）
- 端点 / 墙中点 / 墙垂足 / 网格 四级吸附
- 撤销/重做（50 步，连续拖动自动合并）
- 人体工学警告 8 条规则（过道/沙发/床周/厨房三角/门开启区域/墙高…）
- 自动保存 IndexedDB（5s debounce）+ JSON 导入导出

**3D 漫游**
- 第一人称 WASD + 鼠标（PointerLock），Shift 跑步
- 墙体带开洞（门/窗几何切段）+ 地板 + 家具 Box + 轮廓
- 圆-OBB 碰撞（防穿墙，sweep 细分避免隧穿）
- E 键交互：开关门 90° 动画、开关灯（PointLight intensity）
- 身高 140–200cm 实时调节
- 屏幕中心射线检测 + HUD 提示

**模板**：空白 / 主卧 18㎡ / 一室一厅 50㎡ / 两室一厅 70㎡ / 开放式厨房 12㎡

## 快捷键

编辑器：`V` 选择 · `W` 画墙 · `R` 矩形房间 · `D` 门 · `I` 窗 · `Esc` 取消 · `Ctrl+Z/Y` 撤销重做 · `Ctrl+D` 复制 · `Del` 删除 · `?` 快捷键帮助

漫游：`WASD` 移动 · `Shift` 跑步 · `E` 交互 · `Esc` 退出

## 架构

```
Vue 3.4 + TypeScript 5 + Vite 5
├── 2D 渲染：Konva.js 9（6 层 Stage/Layer 架构）
├── 3D 渲染：Three.js 0.160（原生 API，未经 TresJS）
├── 状态：Pinia 2 + shallowRef + 命令模式（20+ 命令，do/undo 完全可撤销）
├── 存储：Dexie 4（IndexedDB）+ Zod schema 校验
└── 样式：UnoCSS
```

**分层原则**：`geometry/` 全是纯函数（无 Vue / 无 Konva / 无 Three.js 依赖），100% 测试覆盖；`store` 持有状态，UI 只读+派发命令；`editor` 和 `walkthrough` 都订阅同一份 Plan。

**2D↔3D 坐标约定**（锁死在 [walkthrough/coord.ts](src/modules/walkthrough/coord.ts) 并有测试保护）：
```
editor (x, y)  ⇒  three (x, heightZ_cm, y) × 0.01   // cm → m
editor angle   ⇒  three.rotation.y = -angle
```

## 测试

```bash
pnpm test              # Vitest 单测（当前 124 pass）
pnpm test -- <pattern> # 筛选
pnpm test:watch        # 监视模式
pnpm e2e:install       # 首次跑 e2e 前下载 Chromium (~111MB)
pnpm e2e               # Playwright 冒烟 3 条核心路径
```

**单测覆盖**（`tests/unit/`）：
- `geometry/`：opening-cut / collision（slide）/ room-detect / snap / nearest-wall
- `commands/`：do ↔ undo 深度等价，连续 Move/Rotate 合并
- `store/history`：栈管理 + 合并 + 容量限制 + BatchCommand
- `walkthrough/`：coord 换算约束 + WallBuilder slab 数 + CollisionBuilder
- `ergonomics/`：8 条规则各自的正/反例 fixture
- `templates/`：模板都通过 PlanSchema
- `model/schema`：Zod 校验
- `storage/migrations`：版本迁移骨架

**E2E 覆盖**（`tests/e2e/smoke.spec.ts`）：
1. 模板 → 编辑器 → 返回列表 → 刷新后方案还在
2. 模板 → 进入漫游 → canvas 渲染 + 身高调节可见
3. 导入损坏 JSON → 错误提示 → 原方案不变

## 目录结构

```
src/
├── views/                  # 三个页面（Home / Editor / Walkthrough）
├── components/             # Toolbar / FurniturePanel / PropertyPanel / HelpOverlay
├── modules/
│   ├── model/              # types + Zod schema + defaults
│   ├── store/              # Pinia（plan / editor / history）
│   ├── commands/           # 14 个命令，按 wall/opening/furniture 分包
│   ├── geometry/           # 纯几何算法
│   ├── editor/             # Konva Canvas + 工具策略模式
│   ├── walkthrough/        # Three.js builders + FPS 控制器 + 碰撞
│   ├── ergonomics/         # 规则引擎 + 8 条规则
│   ├── storage/            # Dexie + 导入导出 + 迁移
│   └── templates/          # 家具 catalog + 户型模板
└── styles/
tests/unit/                 # 按模块镜像
```

## 部署

纯静态，任何支持托管的平台都行：

**Vercel**
```bash
pnpm build
# 把 dist/ 上传到 Vercel，或连接 git 自动部署
# 注意：routes 使用 createWebHashHistory，URL 里有 #，无需 SPA rewrite 配置
```

**GitHub Pages**
```bash
pnpm build
# push dist/ 到 gh-pages 分支
# 或用 actions/deploy-pages
```

**任意 OSS**：上传 `dist/`，配置 index.html 作为默认首页即可。

## 已知限制（P1+）

- **墙拆分**：内墙端点落在外墙中段时，`detectRooms` 识别不到子房间（两室一厅模板目前识别为 1 个大房间）。编辑器画墙时同样会遇到，未来需要 `splitWallsAtHangingNodes` 自动拆墙。
- **MobileFPS**：移动端摇杆/滑屏转视角还没做，移动端只能用编辑器。
- **电视**：VideoTexture 播放视频未实现，E 键占位。
- **选中墙/门窗**：PropertyPanel 目前只对家具生效。
- **InstancedMesh**：家具数超过 100 时可合批优化。

## License

个人装修工具项目。未声明 License。
