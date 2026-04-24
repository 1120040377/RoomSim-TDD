# RoomSim — 装修布局 2D 编辑 + 3D 漫游应用
## 技术设计文档 v1.0

> 目标：个人装修决策工具。2D 俯视编辑户型/家具 → 一键进入第一人称 3D 漫游，实地感受装修效果。浏览器直接运行，PC 和移动端双端可用。

---

## 目录

- [第 0 部分 决策摘要](#第-0-部分-决策摘要)
- [第 1 部分 产品需求（PRD）](#第-1-部分-产品需求prd)
- [第 2 部分 技术选型](#第-2-部分-技术选型)
- [第 3 部分 整体架构](#第-3-部分-整体架构)
- [第 4 部分 数据模型](#第-4-部分-数据模型)
- [第 5 部分 模块详细设计](#第-5-部分-模块详细设计)
- [第 6 部分 关键算法](#第-6-部分-关键算法)
- [第 7 部分 关键代码示例](#第-7-部分-关键代码示例)
- [第 8 部分 分期任务清单](#第-8-部分-分期任务清单)
- [第 9 部分 测试与质量](#第-9-部分-测试与质量)
- [第 10 部分 风险与规避](#第-10-部分-风险与规避)
- [附录 A 净空与人体工学规则表](#附录-a-净空与人体工学规则表)
- [附录 B 家具库定义](#附录-b-家具库定义)
- [附录 C IndexedDB Schema](#附录-c-indexeddb-schema)

---

## 第 0 部分 决策摘要

给赶时间的人：

| 维度 | 决策 | 理由 |
|---|---|---|
| 前端框架 | Vue 3.4 + TypeScript 5 + Vite 5 | 团队技术栈一致 |
| 2D 编辑器 | **Konva.js 9**（Canvas 2D）| 成熟 2D 编辑能力，层管理、拾取、移动端手势齐全 |
| 3D 漫游 | **Three.js + TresJS** | Vue 生态下最平滑的 Three.js 集成 |
| 状态 | Pinia 2 + 命令模式 | 支持完整 undo/redo |
| 存储 | Dexie 4（IndexedDB） + JSON 导入导出 | 纯前端，后期可加后端同步 |
| 移动端输入 | nipplejs（虚拟摇杆）+ 原生 touch | 体积小，成熟 |
| 样式 | UnoCSS | 按需、快 |
| 部署 | 静态托管（Vercel / GitHub Pages / OSS） | 零后端 |

核心架构一句话：**单一数据源（Plan 对象）被 2D 编辑器和 3D 场景同时订阅，两者各自渲染。**

P0 范围（全部实现）：自定义户型画墙、门窗真实开洞、家具交互（开门/开灯/电视）、尺寸标注与人体工学警告、户型模板库、第一人称漫游、JSON 导入导出、自动本地存档。

P0 工作量评估：**单人 60–80 工时**（8–10 工作日全职，或 3–4 周业余时间）。

---

## 第 1 部分 产品需求（PRD）

### 1.1 产品定位

**一句话定义**：浏览器内运行的"装修前空间感知模拟器"。用户在 2D 俯视图画出户型、摆家具，切到 3D 第一人称模式走一遍，判断实际入住后是否舒适。

**不是什么**：
- 不是专业 CAD（不需要图纸导出精度）
- 不是渲染软件（不追求照片级真实）
- 不是效果图工具（不卖"好看"，卖"空间感判断"）

**是什么**：
- 决策辅助工具（买这张床会不会卡过道？沙发离电视够不够远？）
- 低门槛（5 分钟画完一个一居室）
- 体感真实（比例、视角、净空警告要准）

### 1.2 目标用户

- **主用户**：准备装修或搬家的个人用户，技术素养中等。
- **次用户**：朋友间分享方案讨论。
- **非目标**：设计师、ToB 客户。

### 1.3 核心用户故事

| ID | 故事 | 优先级 |
|---|---|---|
| US-01 | 作为用户，我要画出我家的户型轮廓，以获得一个可操作的平面图 | P0 |
| US-02 | 作为用户，我要在墙上放门和窗，3D 里能真正看穿/走过 | P0 |
| US-03 | 作为用户，我要从家具库拖家具进来，调整位置和朝向 | P0 |
| US-04 | 作为用户，我要看到家具间距和过道宽度的警告，避免摆完发现挤 | P0 |
| US-05 | 作为用户，我要设置虚拟人物身高，按比例看视野 | P0 |
| US-06 | 作为用户，我要用 WASD 或手机摇杆在房间里走动 | P0 |
| US-07 | 作为用户，我要能打开门、开关灯、开电视，感受互动后的空间 | P0 |
| US-08 | 作为用户，我要用常见户型模板快速起步，不用从空白画起 | P0 |
| US-09 | 作为用户，我要在关闭浏览器后再打开还能看到我的方案 | P0 |
| US-10 | 作为用户，我要把方案导出成文件发给朋友，朋友能导入打开 | P0 |
| US-11 | 作为用户，我要撤销我的误操作 | P0 |
| US-12 | 作为用户，我要在手机上也能用，不必非得打开电脑 | P0 |

### 1.4 P0 功能清单（详细）

#### 1.4.1 编辑器模块

**画布与视图**
- 无限画布，支持平移（拖拽/双指）、缩放（滚轮/捏合）
- 网格背景：5cm/20cm/100cm 三档，随缩放自适应
- 当前缩放显示在 HUD，鼠标坐标显示实际 cm

**户型工具**
- 画墙工具：点击起点→移动→点击终点，连续画墙（按 ESC 结束）
- 墙体自动吸附到现有墙体端点、网格、正交方向（5° 容差）
- 墙体属性：厚度（默认 12cm，可调 6–30cm）、高度（默认 280cm，可调 220–400cm）
- 矩形房间工具：拖拽对角生成四面墙
- 墙体选择后可拖动端点调整、可删除

**门窗工具**
- 门：默认宽 90cm、高 210cm，放置时自动吸附最近墙体，沿墙滑动调整位置
- 开门方向：4 种（左开内/左开外/右开内/右开外）
- 窗：默认宽 120cm、高 140cm、窗台高 90cm，无方向，只调尺寸和位置
- 门窗占据墙段必须完全落在单面墙上，跨墙角禁止

**家具工具**
- 家具面板（左侧抽屉）：分类（卧室/客厅/餐厨/卫浴/办公/收纳），每类 4–8 件
- 拖拽从面板到画布放置
- 放置后可拖动、旋转（R 键 / 旋转手柄 / 90° 快捷键）、复制（Ctrl+D）、删除（Del）
- 家具属性面板：名称、尺寸（W/D/H）、颜色、是否贴墙
- 家具库详见附录 B

**标注与警告**
- 选中墙体/家具显示尺寸
- 测量工具：两点间距离
- 实时人体工学检查（默认开启，可关闭）：
  - 过道净宽 < 60cm ⚠️
  - 床侧通道 < 40cm ⚠️
  - 沙发-茶几间距 < 30cm ⚠️（太近）或 > 60cm ⚠️（太远）
  - 沙发-电视距离不在 2–3 倍屏幕对角线范围 ⚠️
  - 门开启扇扫过区域有家具 ❌
  - 开放式厨房工作三角形（灶-槽-冰箱）任一边 <120cm 或 >270cm ⚠️
  - 完整规则见附录 A
- 警告以红黄图标叠加显示，鼠标悬停显示文字说明

**历史操作**
- Undo/Redo：Ctrl+Z / Ctrl+Shift+Z，按钮在顶栏
- 历史栈长度 50

**模板库**
- 内置模板：一室一厅（50㎡）、两室一厅（70㎡）、三室两厅（95㎡）、主卧（18㎡）、客厅（25㎡）、开放厨房（12㎡）
- 新建时可选模板或空白

**存档**
- 自动保存到 IndexedDB，每 5 秒 debounce 触发
- 方案列表页可查看所有方案、删除、重命名
- 导出为 `.roomsim.json` 文件
- 导入 `.roomsim.json` 文件，schema 版本不兼容给出提示

#### 1.4.2 漫游模块

**进入与视角**
- 编辑器顶栏"进入漫游"按钮
- 虚拟人物身高设置：140–200cm，默认 170cm（相机高度 = 身高 × 0.94）
- 初始位置：户型内最大空房间的中心
- 退出回到编辑器保持编辑位置

**移动控制**
- 桌面：WASD / 方向键 移动，Shift 跑步，鼠标左键锁定后移动视角
- 移动端：左下虚拟摇杆（nipplejs）移动，右半屏滑动转视角，底部按钮"互动"
- 移动速度：步行 1.4m/s，跑步 3m/s
- 碰撞：角色半径 20cm 圆，贴地滑动（不上下楼梯）

**交互**
- 凝视物体（射线检测 1.5m 范围），在瞄准点显示交互提示
- 门：E 键/互动按钮开关，门板 90° 旋转动画
- 柜门：同门逻辑，旋转 60°
- 墙面开关：E 切换关联灯光 intensity
- 电视：E 切换播放/暂停预设视频
- 窗帘、抽屉等作为 P2 预留接口

**视觉**
- 环境光 + 一盏平行光（日光）
- 房间内灯光：吊灯/台灯 PointLight，受开关控制
- 材质简化：墙面纯色、地面木纹贴图、天花板白色
- 家具：带基础漫反射材质的盒子 + 轮廓（可辨识即可）
- 阴影：禁用或使用 PCFSoftShadowMap（性能开关）

### 1.5 P1+ 功能（不在本次实施范围）

- 多楼层
- 家具贴图/替换 glTF 模型
- 昼夜切换、色温调节
- 分享链接（Plan 压缩到 URL）
- 小地图（漫游时右上角）
- 材质库（地板、墙漆、瓷砖）
- 导出俯视 PNG / 3D 渲染图
- 云端同步（需要后端）
- 多人协作

### 1.6 非功能需求

| 维度 | 指标 |
|---|---|
| 启动时间 | 首屏 < 3s（4G 网络）、可交互 < 5s |
| 编辑器帧率 | 含 100 个家具时 ≥ 50 fps（桌面），≥ 30 fps（中端手机）|
| 3D 漫游帧率 | ≥ 30 fps（中端手机），≥ 60 fps（桌面）|
| 方案数据大小 | 单方案 JSON ≤ 200 KB，gzip 后 ≤ 50 KB |
| 浏览器兼容 | Chrome/Edge 最近 2 个大版本、Safari 16+、iOS Safari 16+、Android Chrome 最近 2 版 |
| 离线能力 | P0 不要求 PWA，但代码结构不阻碍后续加 Service Worker |
| 数据安全 | 仅本地存储，用户主动导出才离开设备 |

---

## 第 2 部分 技术选型

### 2.1 选型对照

#### 2D 编辑器渲染

| 方案 | 优 | 劣 | 结论 |
|---|---|---|---|
| SVG + Vue 响应式 | 开发快、事件原生 | 200+ 元素开始掉帧、移动端手势需自己实现 | 否 |
| Canvas 2D 原生 | 性能好、可控 | 拾取/层级/事件全要自己写 | 否 |
| **Konva.js** | **封装好的 2D 编辑框架、层/事件/拖拽/触屏齐全、Vue 集成包成熟** | **学习成本中等** | **✅ 选用** |
| Three.js 正交相机做 2D | 和 3D 统一 | 2D 编辑 UX 反而复杂，文字/标注要额外封装 | 否 |
| Fabric.js | 和 Konva 类似 | 更偏图像编辑，房型/路径类弱于 Konva | 否 |
| PixiJS | 性能最高 | 重在游戏/动画，编辑器用过剩 | 否 |

#### 3D 渲染

| 方案 | 结论 |
|---|---|
| **Three.js + TresJS** | ✅ 选用。TresJS 把场景、相机、灯、网格用 Vue 组件声明式写，和项目风格一致 |
| Babylon.js | 自带 FPS/碰撞/GUI 但体积大，Vue 生态弱 |
| 原生 Three.js | 可行，但在 Vue 项目里反复 useEffect 式生命周期麻烦 |
| react-three-fiber | 需要引入 React 运行时，不合适 |

#### 状态管理

| 方案 | 结论 |
|---|---|
| **Pinia + 命令模式**| ✅ 选用。Plan 数据放 Pinia，所有修改必须通过 Command 对象，天然支持 undo/redo |
| 直接 reactive 改 | 否。无法实现 undo |
| Zustand/Redux | 非 Vue 生态，不选 |

#### 存储

| 方案 | 结论 |
|---|---|
| localStorage | 否。单 key 容量约 5MB，复杂方案可能超 |
| **IndexedDB via Dexie** | ✅ 选用。Dexie 封装了 Promise API，支持 schema 迁移 |
| OPFS (Origin Private File System) | 新，兼容性略差，P1 可考虑 |

### 2.2 完整依赖清单

```jsonc
// package.json
{
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.0",
    "@vueuse/core": "^10.7.0",
    "vue-router": "^4.2.0",

    // 2D
    "konva": "^9.3.0",
    "vue-konva": "^3.0.0",

    // 3D
    "three": "^0.160.0",
    "@tresjs/core": "^3.7.0",
    "@tresjs/cientos": "^3.8.0",    // 辅助组件：OrbitControls / PointerLockControls 等

    // 存储
    "dexie": "^4.0.0",

    // 工具
    "nipplejs": "^0.10.1",           // 虚拟摇杆
    "lodash-es": "^4.17.21",
    "nanoid": "^5.0.0",              // ID 生成
    "zod": "^3.22.0"                 // 运行时数据校验（导入方案用）
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "unocss": "^0.58.0",
    "vitest": "^1.1.0",
    "@vue/test-utils": "^2.4.0",
    "playwright": "^1.40.0",
    "@types/three": "^0.160.0",
    "@types/lodash-es": "^4.17.0"
  }
}
```

### 2.3 工程结构

```
roomsim/
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/
│   ├── views/
│   │   ├── HomeView.vue         # 方案列表
│   │   ├── EditorView.vue       # 2D 编辑器
│   │   └── WalkthroughView.vue  # 3D 漫游
│   ├── modules/
│   │   ├── model/               # 数据模型 + 类型
│   │   │   ├── types.ts
│   │   │   ├── schema.ts        # Zod schema
│   │   │   └── defaults.ts
│   │   ├── store/               # Pinia stores
│   │   │   ├── plan.ts
│   │   │   ├── editor.ts        # 编辑器 UI 状态
│   │   │   ├── history.ts       # undo/redo
│   │   │   └── app.ts           # 全局设置
│   │   ├── commands/            # 命令模式
│   │   │   ├── base.ts
│   │   │   ├── wall/
│   │   │   ├── opening/
│   │   │   └── furniture/
│   │   ├── geometry/            # 纯计算，无 UI
│   │   │   ├── vec2.ts
│   │   │   ├── wall.ts
│   │   │   ├── room-detect.ts
│   │   │   ├── opening-cut.ts
│   │   │   └── collision.ts
│   │   ├── editor/              # 2D 编辑器（Konva）
│   │   │   ├── Canvas.vue
│   │   │   ├── layers/
│   │   │   ├── tools/           # 工具策略模式
│   │   │   │   ├── base.ts
│   │   │   │   ├── select.ts
│   │   │   │   ├── wall.ts
│   │   │   │   ├── opening.ts
│   │   │   │   ├── furniture.ts
│   │   │   │   └── measure.ts
│   │   │   └── snap/
│   │   ├── walkthrough/         # 3D 漫游（TresJS）
│   │   │   ├── Scene.vue
│   │   │   ├── builders/        # Plan -> 3D 对象
│   │   │   │   ├── wall-builder.ts
│   │   │   │   ├── floor-builder.ts
│   │   │   │   └── furniture-builder.ts
│   │   │   ├── controls/
│   │   │   │   ├── DesktopFPS.ts
│   │   │   │   └── MobileFPS.ts
│   │   │   ├── interaction/
│   │   │   └── lighting/
│   │   ├── ergonomics/          # 人体工学规则引擎
│   │   │   ├── rules/
│   │   │   └── engine.ts
│   │   ├── storage/             # IndexedDB + 导入导出
│   │   │   ├── db.ts
│   │   │   ├── plan-repo.ts
│   │   │   └── io.ts
│   │   └── templates/           # 户型模板
│   │       └── built-in.ts
│   ├── components/              # 通用 UI
│   └── assets/
├── public/
│   └── textures/                # 地板/墙面贴图
├── tests/
│   ├── unit/
│   └── e2e/
└── docs/
```

---

## 第 3 部分 整体架构

### 3.1 分层架构图

```
┌──────────────────────────────────────────────────────────────┐
│                         视图层（Vue Views）                   │
│  HomeView          EditorView          WalkthroughView       │
└────────┬─────────────────┬─────────────────────┬─────────────┘
         │                 │                     │
         ▼                 ▼                     ▼
┌──────────────────────────────────────────────────────────────┐
│                       UI 模块层（modules/）                   │
│   editor/              walkthrough/         ergonomics/       │
│  (Konva stage)       (TresJS scene)        (rules engine)     │
└────────┬─────────────────┬─────────────────────┬─────────────┘
         │                 │                     │
         └───────┬─────────┴────────┬────────────┘
                 ▼                  ▼
┌──────────────────────────────────────────────────────────────┐
│                    领域层（纯计算 + 状态）                     │
│   store/ (Pinia)      commands/         geometry/             │
│   ─ plan              ─ do/undo         ─ room-detect         │
│   ─ editor            ─ 20+ 命令         ─ opening-cut         │
│   ─ history           ─ 可序列化         ─ collision          │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                      持久化层（storage/）                      │
│   Dexie (IndexedDB)     ←→      JSON Import/Export           │
└──────────────────────────────────────────────────────────────┘
```

**分层原则**：

1. **geometry 层纯函数**，不依赖 Vue、不依赖 Konva、不依赖 Three.js。可独立跑 vitest。
2. **store 层持有所有状态**，UI 层只读 + 派发命令。
3. **editor 和 walkthrough 互不依赖**，都读 plan store。
4. **commands 是唯一修改 plan 的入口**，保证 undo/redo 完整。

### 3.2 核心数据流

```
用户操作（拖家具）
    │
    ▼
Editor Tool (furniture.ts)
    │ 构造命令
    ▼
new MoveFurnitureCommand({id, from, to})
    │
    ▼
historyStore.execute(command)
    ├─→ command.do() → 修改 planStore
    ├─→ push to undoStack
    └─→ clear redoStack
    │
    ▼
planStore.plan 变更（Pinia 响应式）
    │
    ├──→ Editor Canvas 重绘 (Konva)
    ├──→ Ergonomics Engine 重新计算警告
    └──→ Walkthrough Scene 增量更新（如果正在漫游）
    │
    ▼
debounced (5s) 保存到 IndexedDB
```

### 3.3 模式模块运行时

**编辑模式**：Konva Stage 挂载，Three.js 不加载。

**漫游模式**：Three.js 挂载（懒加载 chunk），Konva 销毁。

切换通过路由守卫处理，大块代码按路由分包，避免首屏加载 Three.js。

```ts
// router/index.ts 片段
{
  path: '/walkthrough/:planId',
  component: () => import('@/views/WalkthroughView.vue'),  // 懒加载
}
```

### 3.4 关键时序

#### 进入漫游流程

```
User                EditorView           WalkthroughView        WallBuilder
 │ 点击"进入漫游"       │                      │                      │
 ├────────────────────▶│                      │                      │
 │                     │ router.push          │                      │
 │                     ├─────────────────────▶│                      │
 │                     │                      │ onMounted            │
 │                     │                      ├──────────────────────│
 │                     │                      │ 从 planStore 读 Plan  │
 │                     │                      ├─────────────────────▶│
 │                     │                      │                      │ 计算墙段+开洞
 │                     │                      │                      │ 生成 Mesh[]
 │                     │                      │◀─────────────────────┤
 │                     │                      │ 挂载 TresScene        │
 │                     │                      │ 启动 FPS 控制器        │
 │◀────────────────────────────────────────────┤ 渲染第一帧           │
```

---

## 第 4 部分 数据模型

### 4.1 核心类型定义（TypeScript）

```ts
// src/modules/model/types.ts

/** 全局单位统一为 cm */
export type Cm = number;

export interface Vec2 {
  x: Cm;
  y: Cm;
}

export type WallId = string;
export type OpeningId = string;
export type FurnitureId = string;
export type RoomId = string;
export type PlanId = string;

/** ------------------------------- Wall ------------------------------- */

export interface Wall {
  id: WallId;
  /** 起点端点 id（指向 WallNode）*/
  startNodeId: string;
  /** 终点端点 id */
  endNodeId: string;
  thickness: Cm;   // 墙厚
  height: Cm;      // 墙高
}

/** 墙体端点。墙是线段，端点可以被多面墙共享，形成图结构。*/
export interface WallNode {
  id: string;
  position: Vec2;
}

/** ----------------------------- Opening ------------------------------ */

export type OpeningKind = 'door' | 'window';

export interface OpeningBase {
  id: OpeningId;
  kind: OpeningKind;
  /** 附着的墙体 id */
  wallId: WallId;
  /** 沿墙方向从起点的距离（中心点位置）*/
  offset: Cm;
  /** 开洞宽度 */
  width: Cm;
  /** 开洞高度 */
  height: Cm;
  /** 窗台高度（门为 0）*/
  sillHeight: Cm;
}

export interface Door extends OpeningBase {
  kind: 'door';
  /** 铰链在墙段哪一侧：start 代表靠近 wall.startNode */
  hinge: 'start' | 'end';
  /** 向哪一侧开：inside/outside 相对于墙的法向 */
  swing: 'inside' | 'outside';
  /** 初始状态开合角度（0 = 关，1 = 全开）*/
  state?: number;
}

export interface Window extends OpeningBase {
  kind: 'window';
}

export type Opening = Door | Window;

/** ---------------------------- Furniture ----------------------------- */

export type FurnitureType =
  | 'bed-single' | 'bed-double' | 'bed-kingsize'
  | 'sofa-2' | 'sofa-3' | 'sofa-l' | 'armchair'
  | 'coffee-table' | 'side-table' | 'tv-cabinet' | 'tv'
  | 'dining-table-4' | 'dining-table-6' | 'dining-chair'
  | 'wardrobe-2' | 'wardrobe-3' | 'bookshelf'
  | 'desk' | 'office-chair'
  | 'fridge' | 'stove' | 'sink' | 'kitchen-counter'
  | 'toilet' | 'basin' | 'shower' | 'bathtub'
  | 'lamp-ceiling' | 'lamp-floor' | 'lamp-wall' | 'switch';

export interface Furniture {
  id: FurnitureId;
  type: FurnitureType;
  position: Vec2;       // 中心点
  rotation: number;     // 弧度，绕 Z 轴（俯视的 up）
  size: {
    width: Cm;          // X 方向（朝向右）
    depth: Cm;          // Y 方向（朝向下/前）
    height: Cm;         // Z 方向（向上）
  };
  color?: string;       // 覆盖默认色
  /** 运行时状态。如门开合、灯开关、电视开关。仅漫游时使用，但存在数据里方便恢复 */
  runtimeState?: Record<string, number | boolean>;
  /** 是否贴墙放置（用于吸附和冲突检测）*/
  wallAligned?: boolean;
}

/** ------------------------------- Room ------------------------------- */

export interface Room {
  id: RoomId;
  name: string;        // "主卧" "客厅" ...
  /** 自动识别的闭合多边形的顶点（基于 WallNode 位置）*/
  polygon: Vec2[];
  /** 构成该房间的墙 id 顺序 */
  wallIds: WallId[];
  /** 面积（㎡），由 polygon 计算 */
  area: number;
}

/** ------------------------------- Plan ------------------------------- */

export interface Plan {
  id: PlanId;
  name: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;

  meta: {
    unit: 'cm';
    gridSize: Cm;          // 默认 20
    defaultWallHeight: Cm; // 默认 280
    defaultWallThickness: Cm; // 默认 12
  };

  /** 图结构：节点 + 边（墙）*/
  nodes: Record<string, WallNode>;
  walls: Record<WallId, Wall>;
  openings: Record<OpeningId, Opening>;
  furniture: Record<FurnitureId, Furniture>;

  /** 派生数据：rooms 从 walls 自动识别。保存是为了缓存 + 用户自定义命名。*/
  rooms: Record<RoomId, Room>;

  /** 漫游参数 */
  walkthrough: {
    personHeight: Cm;     // 默认 170
    startPosition?: Vec2; // 用户可指定，默认自动选最大房间中心
    startYaw?: number;    // 弧度
  };
}
```

**关键设计点**：

1. **墙用图结构（节点 + 边）而非多边形**：支持任意户型（L 型、凹凸型、连通多房间共享墙）。
2. **开洞 offset 沿墙方向存储**：墙改长度时不会导致开洞位置错乱（但需要边界 clamp）。
3. **家具 position 是中心点**：旋转时不用改 position，旋转矩阵围绕自身。
4. **rooms 是派生数据**：增删墙后调用 `detectRooms()` 重算，但名字用户可覆盖（通过 id 映射持久化）。
5. **runtimeState 放在数据里**：漫游时改完切回编辑器再切回来状态保留；也方便 P2 存"夜景模式 + 所有灯开"这样的场景。

### 4.2 Zod Schema（导入方案校验）

```ts
// src/modules/model/schema.ts
import { z } from 'zod';

export const Vec2Schema = z.object({
  x: z.number(),
  y: z.number(),
});

export const WallSchema = z.object({
  id: z.string(),
  startNodeId: z.string(),
  endNodeId: z.string(),
  thickness: z.number().min(3).max(50),
  height: z.number().min(100).max(500),
});

// ... 其他类型类似

export const PlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  schemaVersion: z.literal(1),
  meta: z.object({ /* ... */ }),
  nodes: z.record(z.string(), WallNodeSchema),
  walls: z.record(z.string(), WallSchema),
  openings: z.record(z.string(), OpeningSchema),
  furniture: z.record(z.string(), FurnitureSchema),
  rooms: z.record(z.string(), RoomSchema),
  walkthrough: z.object({ /* ... */ }),
});

export type Plan = z.infer<typeof PlanSchema>;
```

### 4.3 存储模型

详见[附录 C](#附录-c-indexeddb-schema)。

### 4.4 数据迁移策略

未来 schema 升级时：

```ts
// src/modules/storage/migrations.ts
const migrations: Record<number, (p: any) => any> = {
  // from v1 to v2
  2: (plan) => {
    // 举例：v2 增加 floors
    return { ...plan, floors: [{ id: 'f1', name: '1F', walls: plan.walls, ... }] };
  },
};

export function migrate(plan: any): Plan {
  let cur = plan;
  while (cur.schemaVersion < CURRENT_VERSION) {
    cur = migrations[cur.schemaVersion + 1](cur);
    cur.schemaVersion += 1;
  }
  return PlanSchema.parse(cur);
}
```

---

## 第 5 部分 模块详细设计

### 5.1 Store 模块

#### 5.1.1 planStore

```ts
// src/modules/store/plan.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Plan, WallId, FurnitureId, /* ... */ } from '@/modules/model/types';

export const usePlanStore = defineStore('plan', () => {
  const plan = ref<Plan | null>(null);

  // getters
  const walls = computed(() => Object.values(plan.value?.walls ?? {}));
  const furniture = computed(() => Object.values(plan.value?.furniture ?? {}));
  const openings = computed(() => Object.values(plan.value?.openings ?? {}));

  function loadPlan(p: Plan) {
    plan.value = p;
  }

  /**
   * 注意：这里的 mutate 方法不应该被 UI 直接调用。
   * UI 要改 plan 必须派发命令，命令里调用这些 mutation。
   * 命名前缀 _ 表示"内部使用，由 command 调用"。
   */
  function _addWall(wall: Wall) { /* ... */ }
  function _removeWall(id: WallId) { /* ... */ }
  function _updateWall(id: WallId, patch: Partial<Wall>) { /* ... */ }
  // ... 其他 CRUD

  return { plan, walls, furniture, openings, loadPlan,
    _addWall, _removeWall, _updateWall, /* ... */ };
});
```

#### 5.1.2 editorStore（UI 状态）

```ts
// src/modules/store/editor.ts
export const useEditorStore = defineStore('editor', () => {
  const activeTool = ref<ToolName>('select');
  const selection = ref<SelectionTarget[]>([]);
  const viewport = ref({ scale: 1, offset: { x: 0, y: 0 } });
  const snapEnabled = ref(true);
  const showErgonomics = ref(true);
  const showDimensions = ref(true);

  function setTool(t: ToolName) { activeTool.value = t; }
  function select(target: SelectionTarget, append = false) { /* ... */ }
  function clearSelection() { selection.value = []; }
  // ...
});
```

#### 5.1.3 historyStore

```ts
// src/modules/store/history.ts
import type { Command } from '@/modules/commands/base';

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<Command[]>([]);
  const redoStack = ref<Command[]>([]);
  const maxSize = 50;

  function execute(cmd: Command) {
    cmd.do();
    undoStack.value.push(cmd);
    if (undoStack.value.length > maxSize) undoStack.value.shift();
    redoStack.value = [];
  }

  function undo() {
    const cmd = undoStack.value.pop();
    if (!cmd) return;
    cmd.undo();
    redoStack.value.push(cmd);
  }

  function redo() {
    const cmd = redoStack.value.pop();
    if (!cmd) return;
    cmd.do();
    undoStack.value.push(cmd);
  }

  return { undoStack, redoStack, execute, undo, redo,
    canUndo: computed(() => undoStack.value.length > 0),
    canRedo: computed(() => redoStack.value.length > 0) };
});
```

### 5.2 命令模式

#### 5.2.1 Command 基类

```ts
// src/modules/commands/base.ts
export interface Command {
  readonly name: string;
  do(): void;
  undo(): void;
  /** 可选的合并逻辑：连续拖动合并为一个命令 */
  mergeWith?(next: Command): Command | null;
}
```

#### 5.2.2 示例：移动家具命令

```ts
// src/modules/commands/furniture/move.ts
export class MoveFurnitureCommand implements Command {
  readonly name = 'MoveFurniture';

  constructor(
    private id: FurnitureId,
    private from: Vec2,
    private to: Vec2,
  ) {}

  do() {
    usePlanStore()._updateFurniture(this.id, { position: this.to });
  }

  undo() {
    usePlanStore()._updateFurniture(this.id, { position: this.from });
  }

  mergeWith(next: Command): Command | null {
    if (next instanceof MoveFurnitureCommand && next.id === this.id) {
      // 拖动过程中的多次 move 合并为一个
      return new MoveFurnitureCommand(this.id, this.from, next.to);
    }
    return null;
  }
}
```

#### 5.2.3 P0 命令清单

| 命令 | 说明 |
|---|---|
| AddWallCommand | 添加一条墙（可能新建 nodes）|
| RemoveWallCommand | 删除墙（连带悬挂 node 清理）|
| MoveWallNodeCommand | 拖动墙端点 |
| UpdateWallCommand | 改厚度/高度 |
| AddOpeningCommand | 添加门/窗 |
| RemoveOpeningCommand | 删除门/窗 |
| MoveOpeningCommand | 沿墙滑动 |
| UpdateOpeningCommand | 改尺寸/开门方向 |
| AddFurnitureCommand | 添加家具 |
| RemoveFurnitureCommand | 删除家具 |
| MoveFurnitureCommand | 拖动 |
| RotateFurnitureCommand | 旋转 |
| UpdateFurnitureCommand | 改颜色/尺寸 |
| DuplicateFurnitureCommand | 复制 |
| RenameRoomCommand | 重命名房间 |
| BatchCommand | 组合命令（用于"载入模板"整体可撤销）|

BatchCommand 实现：

```ts
export class BatchCommand implements Command {
  constructor(readonly name: string, private cmds: Command[]) {}
  do()   { this.cmds.forEach(c => c.do()); }
  undo() { [...this.cmds].reverse().forEach(c => c.undo()); }
}
```

### 5.3 Editor 模块

#### 5.3.1 Canvas 层级

Konva 的 Stage 下分多个 Layer，按 z 顺序从下到上：

```
Stage
├── Layer: background  (网格、画布背景)
├── Layer: rooms       (房间填充色块 + 房间名标签)
├── Layer: walls       (墙体矩形)
├── Layer: openings    (门、窗)
├── Layer: furniture   (家具顶视图)
├── Layer: dimensions  (尺寸标注)
├── Layer: warnings    (人体工学警告图标)
└── Layer: overlay     (选择框、当前工具预览、吸附辅助线)
```

每个 layer 自己订阅对应的 store 数据，独立渲染，避免全局 redraw。

#### 5.3.2 工具（策略模式）

```ts
// src/modules/editor/tools/base.ts
export interface Tool {
  name: ToolName;
  cursor: string;
  onPointerDown?(e: PointerEvent, ctx: ToolContext): void;
  onPointerMove?(e: PointerEvent, ctx: ToolContext): void;
  onPointerUp?(e: PointerEvent, ctx: ToolContext): void;
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): void;
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;
  /** 当前工具的预览图形（如画墙时的虚线）*/
  renderPreview?(layer: Konva.Layer, ctx: ToolContext): void;
}

export interface ToolContext {
  stage: Konva.Stage;
  worldPoint: Vec2;            // 鼠标在世界坐标的位置（cm）
  snap: SnapResult | null;     // 当前吸附结果
  modifiers: {
    shift: boolean; ctrl: boolean; alt: boolean;
  };
}
```

`EditorView.vue` 根据 `editorStore.activeTool` 查表找到对应 Tool 实例，把事件转发过去。

#### 5.3.3 WallTool 实现

```ts
// src/modules/editor/tools/wall.ts
export class WallTool implements Tool {
  name = 'wall' as const;
  cursor = 'crosshair';

  private startPoint: Vec2 | null = null;

  onPointerDown(e, ctx) {
    const p = ctx.snap?.point ?? ctx.worldPoint;
    if (!this.startPoint) {
      this.startPoint = p;
    } else {
      // 第二次点击：生成墙
      const cmd = buildAddWallCommand(this.startPoint, p);
      useHistoryStore().execute(cmd);
      // 连续画：下一段起点 = 当前终点
      this.startPoint = p;
    }
  }

  onPointerMove(e, ctx) {
    // 触发预览重绘
  }

  onKeyDown(e) {
    if (e.key === 'Escape') this.startPoint = null;
  }

  renderPreview(layer, ctx) {
    if (!this.startPoint) return;
    // 画一条虚线从 startPoint 到 ctx.worldPoint
  }
}
```

#### 5.3.4 吸附系统（Snap）

输入：当前鼠标世界坐标 + 辅助对象列表（现有节点、墙、网格）。
输出：SnapResult `{point, type, sourceId?}`，或 null。

优先级：`endpoint > wall midpoint > wall line > grid`。半径 8px 对应的世界距离。

详细算法见第 6 部分。

### 5.4 Walkthrough 模块

#### 5.4.1 场景组合

```vue
<!-- src/views/WalkthroughView.vue 简化 -->
<TresCanvas window-size>
  <TresPerspectiveCamera :position="cameraPosition" :fov="70" />

  <!-- 灯光 -->
  <TresAmbientLight :intensity="0.5" />
  <TresDirectionalLight :position="[300, 500, 300]" :intensity="1" cast-shadow />

  <!-- 环境 -->
  <Floor :plan="plan" />
  <Walls :plan="plan" />
  <Openings :plan="plan" />
  <FurnitureSet :plan="plan" />
  <RoomLights :plan="plan" />

  <!-- 控制器 -->
  <FPSController :position="cameraPosition" @update="onCameraUpdate" />

  <!-- 交互检测 -->
  <InteractionRaycaster />
</TresCanvas>

<!-- UI Overlay -->
<CrosshairHUD />
<MobileJoystick v-if="isMobile" />
<InteractButton v-if="isMobile" />
```

#### 5.4.2 Walls 组件（核心）

墙体 3D 化的核心问题是：**如何在墙上正确开门窗？**

思路：把"一面带若干开洞的墙"切成**多个矩形 slab**。每条墙沿长度方向扫描开洞，产生 slab 列表：

```
墙 (长 400cm, 高 280cm):
├── 门 (offset=100, width=90, height=210)
├── 窗 (offset=280, width=80, height=120, sill=90)

切段结果（每个 slab 是一个立方体）：
┌──────────────────────────────────────────────────┐
│                    过梁（门上方）                   │  slab B
│            ┌────┐         ┌──────┐               │
│            │    │         │窗上方 │  slab E        │
│  slab A    │门洞 │   C     │──────│     G         │
│  (墙段1)    │    │ 墙段2   │窗    │               │
│            │    │         │      │  slab F       │
│            │    │         │──────│               │
│            │    │         │窗台下方│  slab D       │
└────────────┴────┴─────────┴──────┴───────────────┘
     ↑            ↑              ↑
   offset=0    offset=55      offset=240
              (门左边缘)      (窗左边缘)
```

算法：
1. 把所有开洞按 offset 排序
2. 依次产生水平段：墙段（无开洞区域）、开洞上方过梁、开洞下方墙体（仅窗）
3. 每个 slab 用 `BoxGeometry(width, height, thickness)` 实例化
4. 位置 = 墙起点 + 沿墙方向偏移 + 厚度方向偏移

完整代码见第 7 部分。

#### 5.4.3 FPS 控制器（桌面）

```ts
// src/modules/walkthrough/controls/DesktopFPS.ts
export class DesktopFPS {
  private yaw = 0;
  private pitch = 0;
  private velocity = new THREE.Vector3();
  private keys = new Set<string>();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private collider: Collider,    // 碰撞检测器
    private domElement: HTMLElement,
  ) {
    this.attachEvents();
  }

  attachEvents() {
    this.domElement.addEventListener('click', () => this.domElement.requestPointerLock());
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', e => this.keys.add(e.code));
    document.addEventListener('keyup', e => this.keys.delete(e.code));
  }

  onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.domElement) return;
    this.yaw -= e.movementX * 0.002;
    this.pitch -= e.movementY * 0.002;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    this.updateCameraRotation();
  };

  update(dt: number) {
    const speed = this.keys.has('ShiftLeft') ? 3.0 : 1.4;  // m/s
    const dir = new THREE.Vector3();
    if (this.keys.has('KeyW')) dir.z -= 1;
    if (this.keys.has('KeyS')) dir.z += 1;
    if (this.keys.has('KeyA')) dir.x -= 1;
    if (this.keys.has('KeyD')) dir.x += 1;
    dir.normalize();

    // 把输入方向按相机 yaw 旋转到世界坐标
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), this.yaw,
    );
    dir.applyQuaternion(yawQuat);

    const desired = dir.multiplyScalar(speed * dt);
    const next = this.collider.slide(this.camera.position, desired);
    this.camera.position.copy(next);
  }

  private updateCameraRotation() {
    const q = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(q);
  }
}
```

#### 5.4.4 碰撞系统

P0 不用 ammo/cannon.js，手写 2D 碰撞即可：

- 角色抽象为半径 `r = 20cm` 的圆
- 所有墙体（开洞后）、所有家具作为 AABB 集合
- 每帧：先按期望位移 `desired` 推进一次；对每个 AABB 做"圆-矩形"相交检测，若相交则沿相交法线推开

算法见第 6 部分。

#### 5.4.5 Mobile 控制器

```ts
// 左下摇杆：nipplejs
import nipplejs from 'nipplejs';

const joy = nipplejs.create({
  zone: document.getElementById('joystick-zone')!,
  mode: 'static',
  position: { left: '80px', bottom: '80px' },
  color: 'white',
  size: 120,
});

joy.on('move', (_e, data) => {
  this.moveX = Math.cos(data.angle.radian) * data.force;
  this.moveZ = -Math.sin(data.angle.radian) * data.force;
});
joy.on('end', () => { this.moveX = 0; this.moveZ = 0; });

// 右半屏 touch 转视角
const rightHalf = document.getElementById('look-zone')!;
let lastTouch: Touch | null = null;
rightHalf.addEventListener('touchstart', e => { lastTouch = e.touches[0]; });
rightHalf.addEventListener('touchmove', e => {
  const t = e.touches[0];
  if (lastTouch) {
    this.yaw -= (t.clientX - lastTouch.clientX) * 0.005;
    this.pitch -= (t.clientY - lastTouch.clientY) * 0.005;
  }
  lastTouch = t;
});
```

### 5.5 Ergonomics 模块

规则引擎设计：

```ts
// src/modules/ergonomics/engine.ts
export interface Warning {
  id: string;
  severity: 'warn' | 'error';
  position: Vec2;
  message: string;
  relatedIds: string[];
}

export interface Rule {
  id: string;
  /** 输入是 plan，输出是警告列表 */
  check(plan: Plan): Warning[];
}

export class ErgonomicsEngine {
  private rules: Rule[] = [];

  register(r: Rule) { this.rules.push(r); }

  run(plan: Plan): Warning[] {
    return this.rules.flatMap(r => r.check(plan));
  }
}
```

规则示例（完整列表见附录 A）：

```ts
// rules/walking-path.ts
export const WalkingPathRule: Rule = {
  id: 'walking-path-width',
  check(plan) {
    const warnings: Warning[] = [];
    // 对每对临近家具计算最短通行距离
    const furnitures = Object.values(plan.furniture);
    for (let i = 0; i < furnitures.length; i++) {
      for (let j = i + 1; j < furnitures.length; j++) {
        const d = furnitureAABBDistance(furnitures[i], furnitures[j]);
        if (d > 0 && d < 60) {
          warnings.push({
            id: `walk-${furnitures[i].id}-${furnitures[j].id}`,
            severity: 'warn',
            position: midPoint(furnitures[i].position, furnitures[j].position),
            message: `过道宽度仅 ${d.toFixed(0)}cm，建议 ≥ 60cm`,
            relatedIds: [furnitures[i].id, furnitures[j].id],
          });
        }
      }
    }
    return warnings;
  },
};
```

引擎运行时机：planStore 变更后，通过 `watch(plan, debounce(run, 200))` 触发，结果写入 `warningsStore`，warnings layer 订阅渲染。

### 5.6 Storage 模块

```ts
// src/modules/storage/db.ts
import Dexie from 'dexie';

class RoomSimDB extends Dexie {
  plans!: Dexie.Table<PlanRecord, string>;

  constructor() {
    super('RoomSim');
    this.version(1).stores({
      plans: 'id, name, updatedAt',   // id 主键，name/updatedAt 索引
    });
  }
}

export const db = new RoomSimDB();

interface PlanRecord {
  id: string;
  name: string;
  updatedAt: number;
  data: Plan;           // 完整 Plan 对象
  thumbnail?: string;   // 可选缩略图 base64
}
```

Plan Repo 封装：

```ts
// src/modules/storage/plan-repo.ts
export const planRepo = {
  async list(): Promise<PlanRecord[]> {
    return db.plans.orderBy('updatedAt').reverse().toArray();
  },
  async get(id: string): Promise<Plan | null> {
    const r = await db.plans.get(id);
    return r ? migrate(r.data) : null;
  },
  async save(plan: Plan): Promise<void> {
    await db.plans.put({
      id: plan.id,
      name: plan.name,
      updatedAt: Date.now(),
      data: plan,
    });
  },
  async remove(id: string): Promise<void> {
    await db.plans.delete(id);
  },
};

// 自动保存
export function setupAutoSave() {
  const planStore = usePlanStore();
  watch(
    () => planStore.plan,
    debounce(async (p) => {
      if (p) await planRepo.save(p);
    }, 5000),
    { deep: true },
  );
}
```

导入导出：

```ts
// src/modules/storage/io.ts
export function exportPlan(plan: Plan): void {
  const blob = new Blob([JSON.stringify(plan, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.name}.roomsim.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importPlan(file: File): Promise<Plan> {
  const text = await file.text();
  const raw = JSON.parse(text);
  const migrated = migrate(raw);
  // 生成新 id，避免和现有 id 冲突
  migrated.id = nanoid();
  migrated.createdAt = Date.now();
  migrated.updatedAt = Date.now();
  return migrated;
}
```

---

## 第 6 部分 关键算法

### 6.1 墙体开洞切段

输入：`Wall`，其上的 `Opening[]`（按 offset 排序）。
输出：`Slab[]`，每个 slab 描述一个需要渲染的矩形墙块。

```ts
interface Slab {
  /** 沿墙方向起点 */
  startOffset: Cm;
  /** 沿墙方向长度 */
  length: Cm;
  /** 从地面起的高度 */
  bottomZ: Cm;
  /** 块体本身的高度 */
  height: Cm;
}

function splitWallIntoSlabs(wall: Wall, openings: Opening[], wallHeight: Cm): Slab[] {
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  const slabs: Slab[] = [];
  let cursor = 0;

  for (const op of sorted) {
    const leftEdge = op.offset - op.width / 2;
    const rightEdge = op.offset + op.width / 2;

    // 1. 光板墙段（从 cursor 到开洞左缘）
    if (leftEdge > cursor) {
      slabs.push({
        startOffset: cursor, length: leftEdge - cursor,
        bottomZ: 0, height: wallHeight,
      });
    }

    // 2. 开洞上方过梁
    const topOfOpening = op.sillHeight + op.height;
    if (topOfOpening < wallHeight) {
      slabs.push({
        startOffset: leftEdge, length: op.width,
        bottomZ: topOfOpening, height: wallHeight - topOfOpening,
      });
    }

    // 3. 开洞下方（仅窗有）
    if (op.sillHeight > 0) {
      slabs.push({
        startOffset: leftEdge, length: op.width,
        bottomZ: 0, height: op.sillHeight,
      });
    }

    cursor = rightEdge;
  }

  // 4. 剩余光板墙段
  const wallLength = computeWallLength(wall);
  if (cursor < wallLength) {
    slabs.push({
      startOffset: cursor, length: wallLength - cursor,
      bottomZ: 0, height: wallHeight,
    });
  }

  return slabs;
}
```

### 6.2 房间识别（面检测）

墙段构成无向图，需要从中提取**最小闭合面**作为房间。经典算法：**平面图面遍历**（Face Traversal）。

简化版实现（适用于绝大多数户型）：

```ts
/**
 * 输入：nodes + walls 构成的无向图
 * 输出：所有最小面多边形（不包括外部无限大面）
 *
 * 步骤：
 * 1. 构建邻接表：node -> 相邻 node 列表（附带边 id）
 * 2. 对每个节点按角度排序相邻节点（顺时针/逆时针）
 * 3. 对每条有向边 (u->v)，下一步走：在 v 的邻居里找 u 的"下一个逆时针邻居"
 * 4. 沿着下一步一路走回 u，得到一个面
 * 5. 去掉面积最大的面（那是外部无限大面）
 * 6. 多个连通分量各自处理
 */
function detectRooms(nodes: WallNode[], walls: Wall[]): Polygon[] {
  const adj = buildAdjacency(nodes, walls);        // Map<nodeId, {to, wallId, angle}[]>
  sortAdjacencyByAngle(adj);

  const visited = new Set<string>();               // "u->v" 有向边
  const faces: Polygon[] = [];

  for (const wall of walls) {
    for (const [u, v] of [[wall.startNodeId, wall.endNodeId],
                          [wall.endNodeId, wall.startNodeId]]) {
      const key = `${u}->${v}`;
      if (visited.has(key)) continue;

      const face = traceFace(u, v, adj, visited);
      if (face.length >= 3) faces.push(face);
    }
  }

  // 去掉最大面（外部面）
  faces.sort((a, b) => polygonArea(b) - polygonArea(a));
  return faces.slice(1);
}

function traceFace(start: string, next: string,
                   adj: AdjMap, visited: Set<string>): Polygon {
  const polygon: Polygon = [];
  let u = start, v = next;

  while (!visited.has(`${u}->${v}`)) {
    visited.add(`${u}->${v}`);
    polygon.push(nodePosition(u));

    // 找 v 的邻居中，u 的"下一个逆时针"
    const neighbors = adj.get(v)!;
    const idx = neighbors.findIndex(n => n.to === u);
    const nextIdx = (idx + 1) % neighbors.length;
    const nextNode = neighbors[nextIdx].to;

    u = v;
    v = nextNode;

    if (polygon.length > 1000) break;  // 防死循环
  }

  return polygon;
}
```

性能：O(E × avg_degree)，100 条墙级别的户型瞬间完成。

### 6.3 吸附算法

```ts
interface SnapResult {
  point: Vec2;
  type: 'endpoint' | 'midpoint' | 'wall' | 'grid' | 'ortho';
  sourceId?: string;
}

function findSnap(worldPoint: Vec2, plan: Plan,
                  viewScale: number): SnapResult | null {
  const radius = 8 / viewScale;  // 像素半径 / 缩放 = 世界半径

  // 优先级 1: 端点
  for (const node of Object.values(plan.nodes)) {
    if (distance(worldPoint, node.position) < radius) {
      return { point: node.position, type: 'endpoint', sourceId: node.id };
    }
  }

  // 优先级 2: 墙中点
  for (const wall of Object.values(plan.walls)) {
    const mid = midpointOfWall(wall, plan);
    if (distance(worldPoint, mid) < radius) {
      return { point: mid, type: 'midpoint', sourceId: wall.id };
    }
  }

  // 优先级 3: 墙上垂足
  for (const wall of Object.values(plan.walls)) {
    const foot = projectOnSegment(worldPoint, wall, plan);
    if (foot && distance(worldPoint, foot) < radius) {
      return { point: foot, type: 'wall', sourceId: wall.id };
    }
  }

  // 优先级 4: 网格
  const gridSize = plan.meta.gridSize;
  const snapped = {
    x: Math.round(worldPoint.x / gridSize) * gridSize,
    y: Math.round(worldPoint.y / gridSize) * gridSize,
  };
  if (distance(worldPoint, snapped) < radius) {
    return { point: snapped, type: 'grid' };
  }

  return null;
}
```

正交约束（画墙时按 Shift）：把起点到鼠标的向量强制到最近的 45°/90° 角方向。

### 6.4 碰撞：圆-矩形推开

```ts
/**
 * 给定当前位置 P、期望位移 delta、障碍物 AABB 列表
 * 返回实际推进后的位置（滑墙）
 */
function slide(P: Vec2, delta: Vec2, radius: Cm,
               obstacles: OrientedBox[]): Vec2 {
  let pos = { x: P.x + delta.x, y: P.y + delta.y };

  // 迭代多次，每次处理一个碰撞，最多 4 次（对应 4 面墙同时挤）
  for (let iter = 0; iter < 4; iter++) {
    let pushed = false;
    for (const box of obstacles) {
      const res = circleVsOrientedBox(pos, radius, box);
      if (res.overlap > 0) {
        pos = { x: pos.x + res.normal.x * res.overlap,
                y: pos.y + res.normal.y * res.overlap };
        pushed = true;
      }
    }
    if (!pushed) break;
  }

  return pos;
}

function circleVsOrientedBox(center: Vec2, radius: Cm,
                              box: OrientedBox): {normal: Vec2, overlap: Cm} {
  // 把圆心变换到盒子局部坐标系
  const local = rotate(subtract(center, box.center), -box.rotation);
  // 最近点（在盒子内部取自身，在外部取到边界）
  const closest = {
    x: Math.max(-box.halfW, Math.min(box.halfW, local.x)),
    y: Math.max(-box.halfD, Math.min(box.halfD, local.y)),
  };
  const diff = subtract(local, closest);
  const dist = Math.hypot(diff.x, diff.y);
  if (dist >= radius) return { normal: {x:0,y:0}, overlap: 0 };

  const overlap = radius - dist;
  const localNormal = dist > 0
    ? { x: diff.x / dist, y: diff.y / dist }
    : { x: 1, y: 0 };  // 圆心正好在盒子中心，任选一个
  const worldNormal = rotate(localNormal, box.rotation);
  return { normal: worldNormal, overlap };
}
```

OrientedBox 数据由家具的 `position + rotation + size.width/depth` 构成。墙体开洞后按 slab 生成 AABB。

性能优化（家具超过 50 件时）：空间网格分桶（20cm × 20cm），角色只查自身格子 + 周围 8 格。P0 不做，预留接口。

### 6.5 射线交互检测（漫游）

```ts
const raycaster = new THREE.Raycaster();
const origin = new THREE.Vector3(0, 0, 0);   // 相机位置
const direction = new THREE.Vector3(0, 0, -1); // 相机朝向

function getInteractable(camera: THREE.Camera,
                          interactables: THREE.Object3D[]): Interactable | null {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);  // 屏幕中心
  const hits = raycaster.intersectObjects(interactables, true);
  if (hits.length === 0 || hits[0].distance > 1.5) return null;
  return hits[0].object.userData.interactable as Interactable;
}
```

`userData.interactable` 在构建家具时挂上，包含 `type`（door/light/tv）、`targetId`、`action()` 回调。

---

## 第 7 部分 关键代码示例

### 7.1 WallBuilder 完整实现

```ts
// src/modules/walkthrough/builders/wall-builder.ts
import * as THREE from 'three';
import type { Plan, Wall, Opening } from '@/modules/model/types';
import { splitWallIntoSlabs } from '@/modules/geometry/opening-cut';

const CM_TO_M = 0.01;

export function buildWalls(plan: Plan): THREE.Group {
  const group = new THREE.Group();
  group.name = 'walls';

  for (const wall of Object.values(plan.walls)) {
    const openings = Object.values(plan.openings)
      .filter(o => o.wallId === wall.id);
    const wallMesh = buildSingleWall(wall, openings, plan);
    group.add(wallMesh);
  }

  return group;
}

function buildSingleWall(wall: Wall, openings: Opening[], plan: Plan): THREE.Group {
  const g = new THREE.Group();
  g.userData.wallId = wall.id;

  const startNode = plan.nodes[wall.startNodeId];
  const endNode = plan.nodes[wall.endNodeId];
  const dx = endNode.position.x - startNode.position.x;
  const dy = endNode.position.y - startNode.position.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  const slabs = splitWallIntoSlabs(wall, openings, wall.height);

  const material = new THREE.MeshStandardMaterial({ color: 0xf5f0e8 });

  for (const slab of slabs) {
    const geom = new THREE.BoxGeometry(
      slab.length * CM_TO_M,
      slab.height * CM_TO_M,
      wall.thickness * CM_TO_M,
    );
    const mesh = new THREE.Mesh(geom, material);

    // 放置到墙上：沿墙方向 startOffset + length/2 位置
    const alongWall = slab.startOffset + slab.length / 2;
    const localX = alongWall;
    mesh.position.set(
      (startNode.position.x + Math.cos(angle) * alongWall) * CM_TO_M,
      (slab.bottomZ + slab.height / 2) * CM_TO_M,
      (startNode.position.y + Math.sin(angle) * alongWall) * CM_TO_M,
    );
    mesh.rotation.y = -angle;  // Three.js Y 轴朝上，XZ 平面对应俯视 XY
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    g.add(mesh);
  }

  return g;
}
```

> 坐标映射说明：2D 编辑器中 (x, y) 对应 Three.js 中 (x, z)，高度 z 对应 Three.js 的 y。编辑器 y 轴向下为正（屏幕坐标），Three.js z 轴向内为负（右手系）。因此 `mesh.rotation.y = -angle`。具体符号需要写单元测试固定。

### 7.2 门组件（带开合动画）

```ts
// src/modules/walkthrough/builders/door-builder.ts
export function buildDoor(door: Door, wall: Wall, plan: Plan): THREE.Group {
  const g = new THREE.Group();
  g.userData.interactable = {
    type: 'door',
    targetId: door.id,
    action: (scene: Scene) => toggleDoor(door.id, scene),
  };

  const startNode = plan.nodes[wall.startNodeId];
  const endNode = plan.nodes[wall.endNodeId];
  const angle = Math.atan2(
    endNode.position.y - startNode.position.y,
    endNode.position.x - startNode.position.x,
  );

  // 铰链位置：door.hinge === 'start' 时在 offset - width/2
  const hingeOffset = door.hinge === 'start'
    ? door.offset - door.width / 2
    : door.offset + door.width / 2;
  const hingePos = {
    x: (startNode.position.x + Math.cos(angle) * hingeOffset) * CM_TO_M,
    z: (startNode.position.y + Math.sin(angle) * hingeOffset) * CM_TO_M,
  };

  // 门板几何：从铰链向另一侧延伸 door.width
  const geom = new THREE.BoxGeometry(
    door.width * CM_TO_M, door.height * CM_TO_M, 4 * CM_TO_M,
  );
  // 把 geometry 原点移到左侧（绕铰链旋转）
  geom.translate(door.width * CM_TO_M / 2, 0, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
  const panel = new THREE.Mesh(geom, mat);
  panel.name = `door-panel-${door.id}`;

  const pivot = new THREE.Group();
  pivot.name = `door-pivot-${door.id}`;
  pivot.position.set(hingePos.x, door.height * CM_TO_M / 2, hingePos.z);

  // 铰链方向：door.hinge === 'start' 时沿 angle 方向，否则反向
  const hingeAngle = door.hinge === 'start' ? -angle : -angle + Math.PI;
  pivot.rotation.y = hingeAngle;

  pivot.add(panel);
  g.add(pivot);

  // 初始状态
  if (door.state && door.state > 0) {
    pivot.rotation.y = hingeAngle - Math.PI / 2 * door.state;
  }

  return g;
}

function toggleDoor(doorId: string, scene: THREE.Scene) {
  const pivot = scene.getObjectByName(`door-pivot-${doorId}`);
  if (!pivot) return;
  const plan = usePlanStore().plan!;
  const door = plan.openings[doorId] as Door;
  const target = (door.state ?? 0) > 0.5 ? 0 : 1;
  animateDoor(pivot, door, target);
  door.state = target;  // 直接改 runtime 状态
}

function animateDoor(pivot: THREE.Object3D, door: Door, target: number) {
  const startAngle = pivot.rotation.y;
  const baseAngle = /* 从 door 上算的基础角度 */;
  const targetAngle = baseAngle - Math.PI / 2 * target;
  const duration = 400;
  const t0 = performance.now();

  function step() {
    const t = Math.min(1, (performance.now() - t0) / duration);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    pivot.rotation.y = startAngle + (targetAngle - startAngle) * ease;
    if (t < 1) requestAnimationFrame(step);
  }
  step();
}
```

### 7.3 画墙工具完整事件处理

```ts
// src/modules/editor/tools/wall.ts
import { nanoid } from 'nanoid';
import type { Tool, ToolContext } from './base';
import type { Vec2 } from '@/modules/model/types';
import { useHistoryStore } from '@/modules/store/history';
import { usePlanStore } from '@/modules/store/plan';
import { AddWallCommand } from '@/modules/commands/wall/add';

export class WallTool implements Tool {
  readonly name = 'wall';
  readonly cursor = 'crosshair';

  private startPoint: Vec2 | null = null;
  private startNodeId: string | null = null;

  onPointerDown(_e: PointerEvent, ctx: ToolContext) {
    const snap = ctx.snap;
    const point = snap?.point ?? ctx.worldPoint;

    if (!this.startPoint) {
      // 第一次：记录起点
      this.startPoint = point;
      this.startNodeId = snap?.type === 'endpoint' ? snap.sourceId! : null;
      return;
    }

    // 第二次：生成墙
    const endNodeId = snap?.type === 'endpoint' ? snap.sourceId! : null;

    const cmd = new AddWallCommand({
      start: this.startPoint,
      end: point,
      startExistingNodeId: this.startNodeId ?? undefined,
      endExistingNodeId: endNodeId ?? undefined,
      thickness: usePlanStore().plan!.meta.defaultWallThickness,
      height: usePlanStore().plan!.meta.defaultWallHeight,
    });
    useHistoryStore().execute(cmd);

    // 连续画：新起点 = 刚才的终点
    this.startPoint = point;
    this.startNodeId = endNodeId ?? cmd.createdEndNodeId;
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.startPoint = null;
      this.startNodeId = null;
    }
  }

  onDeactivate() {
    this.startPoint = null;
    this.startNodeId = null;
  }
}
```

AddWallCommand：

```ts
// src/modules/commands/wall/add.ts
export class AddWallCommand implements Command {
  readonly name = 'AddWall';
  private wallId = nanoid();
  createdStartNodeId?: string;
  createdEndNodeId?: string;

  constructor(private opts: {
    start: Vec2; end: Vec2;
    startExistingNodeId?: string;
    endExistingNodeId?: string;
    thickness: Cm; height: Cm;
  }) {}

  do() {
    const store = usePlanStore();
    let startId = this.opts.startExistingNodeId;
    let endId = this.opts.endExistingNodeId;

    if (!startId) {
      startId = nanoid();
      store._addNode({ id: startId, position: this.opts.start });
      this.createdStartNodeId = startId;
    }
    if (!endId) {
      endId = nanoid();
      store._addNode({ id: endId, position: this.opts.end });
      this.createdEndNodeId = endId;
    }

    store._addWall({
      id: this.wallId,
      startNodeId: startId, endNodeId: endId,
      thickness: this.opts.thickness, height: this.opts.height,
    });

    store._recomputeRooms();  // 墙变了，重新识别房间
  }

  undo() {
    const store = usePlanStore();
    store._removeWall(this.wallId);
    if (this.createdStartNodeId) store._removeNode(this.createdStartNodeId);
    if (this.createdEndNodeId) store._removeNode(this.createdEndNodeId);
    store._recomputeRooms();
  }
}
```

### 7.4 EditorView 主文件结构

```vue
<!-- src/views/EditorView.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { usePlanStore } from '@/modules/store/plan';
import { useEditorStore } from '@/modules/store/editor';
import { useHistoryStore } from '@/modules/store/history';
import { planRepo } from '@/modules/storage/plan-repo';
import { setupAutoSave } from '@/modules/storage/plan-repo';

import EditorCanvas from '@/modules/editor/Canvas.vue';
import Toolbar from '@/components/Toolbar.vue';
import FurniturePanel from '@/components/FurniturePanel.vue';
import PropertyPanel from '@/components/PropertyPanel.vue';
import WarningsList from '@/components/WarningsList.vue';

const route = useRoute();
const router = useRouter();
const planStore = usePlanStore();
const editorStore = useEditorStore();
const historyStore = useHistoryStore();

onMounted(async () => {
  const planId = route.params.id as string;
  const plan = await planRepo.get(planId);
  if (!plan) { router.push('/'); return; }
  planStore.loadPlan(plan);
  setupAutoSave();
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => window.removeEventListener('keydown', onKeyDown));

function onKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault(); historyStore.undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault(); historyStore.redo();
  }
  // 其他快捷键: Del、R、V、W、D...
}

function enterWalkthrough() {
  router.push({ name: 'walkthrough', params: { planId: planStore.plan!.id } });
}
</script>

<template>
  <div class="editor-layout">
    <Toolbar @enter-walkthrough="enterWalkthrough" />
    <FurniturePanel />
    <EditorCanvas />
    <PropertyPanel />
    <WarningsList />
  </div>
</template>
```

### 7.5 Canvas.vue（Konva 集成）

```vue
<!-- src/modules/editor/Canvas.vue -->
<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import Konva from 'konva';
import { usePlanStore } from '@/modules/store/plan';
import { useEditorStore } from '@/modules/store/editor';
import { TOOLS } from './tools';
import { findSnap } from './snap';

const containerRef = ref<HTMLDivElement>();
const planStore = usePlanStore();
const editorStore = useEditorStore();

let stage: Konva.Stage;
let layers: {
  background: Konva.Layer;
  rooms: Konva.Layer;
  walls: Konva.Layer;
  openings: Konva.Layer;
  furniture: Konva.Layer;
  dimensions: Konva.Layer;
  warnings: Konva.Layer;
  overlay: Konva.Layer;
};

onMounted(() => {
  stage = new Konva.Stage({
    container: containerRef.value!,
    width: containerRef.value!.clientWidth,
    height: containerRef.value!.clientHeight,
    draggable: false,
  });

  layers = {
    background: new Konva.Layer(),
    rooms: new Konva.Layer(),
    walls: new Konva.Layer(),
    openings: new Konva.Layer(),
    furniture: new Konva.Layer(),
    dimensions: new Konva.Layer(),
    warnings: new Konva.Layer(),
    overlay: new Konva.Layer(),
  };
  Object.values(layers).forEach(l => stage.add(l));

  attachEvents();
  setupWatchers();
  drawAll();
});

function attachEvents() {
  stage.on('pointerdown', (e) => {
    const tool = TOOLS[editorStore.activeTool];
    const ctx = buildContext(e);
    tool.onPointerDown?.(e.evt, ctx);
  });
  // pointermove, pointerup, wheel (缩放), drag (平移) 类似
}

function buildContext(e: Konva.KonvaEventObject<PointerEvent>): ToolContext {
  const screenPoint = stage.getPointerPosition()!;
  const worldPoint = screenToWorld(screenPoint, editorStore.viewport);
  const snap = editorStore.snapEnabled
    ? findSnap(worldPoint, planStore.plan!, editorStore.viewport.scale)
    : null;
  return {
    stage, worldPoint, snap,
    modifiers: { shift: e.evt.shiftKey, ctrl: e.evt.ctrlKey, alt: e.evt.altKey },
  };
}

function setupWatchers() {
  watch(() => planStore.walls,    () => drawWallsLayer(),    { deep: true });
  watch(() => planStore.openings, () => drawOpeningsLayer(), { deep: true });
  watch(() => planStore.furniture,() => drawFurnitureLayer(),{ deep: true });
  // ... etc
}

function drawWallsLayer() {
  layers.walls.destroyChildren();
  for (const wall of planStore.walls) {
    const rect = buildWallRect(wall, planStore.plan!);  // 返回 Konva.Rect
    layers.walls.add(rect);
  }
  layers.walls.draw();
}

// ... 其他 draw 函数
</script>

<template>
  <div ref="containerRef" class="editor-canvas" />
</template>

<style scoped>
.editor-canvas { position: absolute; inset: 0; background: #fafafa; }
</style>
```

### 7.6 虚拟人物控制器 + 碰撞整合

```ts
// src/modules/walkthrough/controls/FPSController.vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import * as THREE from 'three';
import { useRenderLoop, useTresContext } from '@tresjs/core';
import { DesktopFPS } from './DesktopFPS';
import { MobileFPS } from './MobileFPS';
import { buildCollider } from '../collision';
import { usePlanStore } from '@/modules/store/plan';

const props = defineProps<{ personHeight: number }>();
const { camera, renderer } = useTresContext();
const planStore = usePlanStore();
const isMobile = /Mobi|Android/i.test(navigator.userAgent);

let controller: DesktopFPS | MobileFPS;
const collider = ref(buildCollider(planStore.plan!));

onMounted(() => {
  const cam = camera.value as THREE.PerspectiveCamera;
  // 初始位置：从 plan 读出或自动
  const start = planStore.plan!.walkthrough.startPosition
    ?? getLargestRoomCenter(planStore.plan!);
  cam.position.set(start.x * 0.01, props.personHeight * 0.01 * 0.94, start.y * 0.01);

  controller = isMobile
    ? new MobileFPS(cam, collider.value, renderer.value.domElement)
    : new DesktopFPS(cam, collider.value, renderer.value.domElement);
});

const { onLoop } = useRenderLoop();
onLoop(({ delta }) => {
  controller?.update(delta);
});

// plan 变了（罕见）重建碰撞体
watch(() => planStore.plan, p => {
  if (p) collider.value = buildCollider(p);
});

onUnmounted(() => controller?.dispose());
</script>
```

### 7.7 Pinia 深拷贝 + 响应式陷阱

Pinia 的 `ref<Plan>` 深层响应式代理对性能有影响。对于 plan 这种大对象（可能几千个属性），建议：

```ts
import { markRaw, shallowRef } from 'vue';

// 使用 shallowRef + 不可变更新模式
const plan = shallowRef<Plan | null>(null);

function _addWall(wall: Wall) {
  if (!plan.value) return;
  plan.value = {
    ...plan.value,
    walls: { ...plan.value.walls, [wall.id]: wall },
  };
}
```

优点：避免深度代理开销，变更追踪明确。
缺点：每次修改新建对象（小对象的浅拷贝成本低）。

对 Konva 层，watch 只监听顶层 ref，手动比对 key 集合差异增量更新。

---

## 第 8 部分 分期任务清单

按 Sprint（2 周）组织。单人全职下，三个 Sprint 完成 P0；业余时间同步到 4–6 周。

### Sprint 0（准备 · 0.5 周）

| # | 任务 | 估时 |
|---|---|---|
| S0-1 | 初始化 Vite + Vue3 + TS 项目，配置路径别名、ESLint、Prettier | 2h |
| S0-2 | 接入 Pinia、VueRouter、UnoCSS、Vitest | 2h |
| S0-3 | 建工程目录骨架（见 §2.3）| 1h |
| S0-4 | 写 `types.ts` 全部类型定义 + 单元测试示例 | 3h |
| S0-5 | 写 `schema.ts` Zod 校验 + 两个导入文件测试 | 2h |
| S0-6 | 配置基础布局：三大路由页空壳（Home/Editor/Walkthrough）| 2h |

交付：空壳工程可跑，数据模型定稿。

### Sprint 1（编辑器核心 · 2 周）

**目标**：能画墙、放门窗、放家具、自动保存。

| # | 任务 | 估时 |
|---|---|---|
| S1-1 | `planStore` + `editorStore` + `historyStore` 完整实现 | 4h |
| S1-2 | Command 基类 + WallTool 流程打通（画墙 + undo）| 4h |
| S1-3 | Konva Canvas 挂载 + 网格背景 + 缩放/平移 | 4h |
| S1-4 | 墙体渲染（walls 层）| 3h |
| S1-5 | 吸附系统（端点 + 网格 + 正交）| 4h |
| S1-6 | 矩形房间工具（一键四墙）| 2h |
| S1-7 | OpeningTool（门/窗放置 + 沿墙滑动）| 5h |
| S1-8 | 门窗 2D 渲染（门带弧线开向）| 3h |
| S1-9 | FurniturePanel UI + 家具库定义（附录 B 全部）| 4h |
| S1-10 | FurnitureTool（拖拽放置 + 移动 + 旋转 + 删除）| 5h |
| S1-11 | 家具 2D 渲染（顶视图 icon）| 3h |
| S1-12 | PropertyPanel（选中时显示可编辑属性）| 3h |
| S1-13 | 测量工具（两点距离）| 2h |
| S1-14 | 快捷键绑定（Undo/Redo/Del/R/V/W/D）| 2h |
| S1-15 | IndexedDB 集成 + 自动保存 + 方案列表页 | 4h |
| S1-16 | JSON 导入导出 + 版本校验 | 3h |
| S1-17 | 户型模板库（6 个预设 + 载入流程）| 4h |
| S1-18 | 基础单元测试：commands、geometry | 6h |
| S1-19 | 移动端触控适配（pinch zoom、pan、long press）| 5h |

交付：完整 2D 编辑器，可以画一个带家具的一居室并导入导出。

### Sprint 2（3D 漫游 + 人体工学 · 2 周）

**目标**：从编辑器进入漫游，第一人称走，带碰撞和交互。完成人体工学警告。

| # | 任务 | 估时 |
|---|---|---|
| S2-1 | TresJS 接入 + WalkthroughView 骨架 | 2h |
| S2-2 | 房间识别算法（detectRooms）+ 单元测试 | 5h |
| S2-3 | 墙体开洞切段算法（splitWallIntoSlabs）+ 测试 | 4h |
| S2-4 | WallBuilder：从 plan 生成 3D 墙 | 5h |
| S2-5 | FloorBuilder：按 room polygon 生成地板 | 3h |
| S2-6 | FurnitureBuilder：家具 Box + 贴图占位 | 4h |
| S2-7 | DoorBuilder + 开合动画 | 4h |
| S2-8 | WindowBuilder（玻璃面片）| 2h |
| S2-9 | 基础光照（环境光 + 平行光 + 天空盒）| 2h |
| S2-10 | DesktopFPS 控制器（WASD + 鼠标锁定）| 4h |
| S2-11 | 碰撞系统（圆 vs AABB 推开算法）| 5h |
| S2-12 | 碰撞体构建器（墙 + 家具 → 障碍列表）| 3h |
| S2-13 | 射线交互检测（凝视物体 + 提示 UI）| 3h |
| S2-14 | 门交互（E 开关）| 2h |
| S2-15 | 开关/灯光交互 + RoomLights 组件 | 4h |
| S2-16 | 电视交互（video 纹理播放/暂停）| 2h |
| S2-17 | MobileFPS 控制器（nipplejs + 右半屏转视角 + 互动按钮）| 5h |
| S2-18 | 身高设置 UI + 相机高度绑定 | 2h |
| S2-19 | 人体工学规则引擎框架 | 3h |
| S2-20 | 实现 8 条人体工学规则（附录 A）| 6h |
| S2-21 | 警告图标渲染在 2D 画布 + 悬停提示 | 3h |
| S2-22 | 动态尺寸标注（选中即显示）| 3h |
| S2-23 | 移动端漫游触控调优（延迟、死区、灵敏度）| 4h |
| S2-24 | 性能：家具 InstancedMesh / 合批 | 3h |

交付：完整 P0 功能，真人可试玩。

### Sprint 3（打磨 + 发布 · 1 周）

| # | 任务 | 估时 |
|---|---|---|
| S3-1 | 性能巡检：中端手机上跑 3 套模板都 ≥ 30fps | 4h |
| S3-2 | 边界测试：空方案、超大方案（200 家具）、异常 JSON | 3h |
| S3-3 | 移动端兼容：iOS Safari、小米/华为 Chrome | 4h |
| S3-4 | 首屏优化：路由分包、图片懒加载 | 3h |
| S3-5 | 错误处理：数据损坏恢复、崩溃降级 | 3h |
| S3-6 | UI 打磨：图标统一、空状态、引导 | 5h |
| S3-7 | 欢迎引导 / 教程覆盖层（首次使用）| 4h |
| S3-8 | 帮助文档 + 快捷键参考 | 2h |
| S3-9 | E2E 冒烟：playwright 覆盖核心路径 | 4h |
| S3-10 | README + 部署（Vercel）| 2h |

交付：可公开分享的 v1.0。

---

## 第 9 部分 测试与质量

### 9.1 单元测试（Vitest）

**覆盖重点**（不是所有文件都要测，是这几类必须测）：

1. **geometry/** 全部纯函数 100% 行覆盖
   - `splitWallIntoSlabs`：空开洞、1 门、1 窗、门 + 窗、紧贴起点/终点、相邻贴边
   - `detectRooms`：矩形、L 型、双房间共享墙、非连通、自相交墙（应报错或忽略）
   - `findSnap`：各优先级触发、无结果、混合多种吸附源
   - `circleVsOrientedBox`：贴边、穿入、完全内部
2. **commands/**
   - 每个命令 `do()` → `undo()` 后 plan 结构与原始完全一致（深度对比）
   - BatchCommand 的部分失败回滚（P1）
3. **ergonomics/**
   - 每条规则的正例和反例各一个 fixture plan
4. **storage/**
   - Dexie 读写往返
   - migrate 从 v1 到 v1 幂等
   - 导入损坏 JSON 抛明确错误

示例：

```ts
// tests/unit/geometry/opening-cut.test.ts
import { describe, it, expect } from 'vitest';
import { splitWallIntoSlabs } from '@/modules/geometry/opening-cut';

describe('splitWallIntoSlabs', () => {
  const mkWall = () => ({ id: 'w1', startNodeId: 'a', endNodeId: 'b',
                          thickness: 12, height: 280 });

  it('无开洞时返回单个完整 slab', () => {
    const slabs = splitWallIntoSlabs(mkWall(), [], 280);
    // 假设墙长 400（外部计算）
    // ...
  });

  it('门在中间切成 3 段：左墙 + 过梁 + 右墙', () => {
    const door = { id: 'd1', kind: 'door', wallId: 'w1',
                   offset: 200, width: 90, height: 210, sillHeight: 0 };
    const slabs = splitWallIntoSlabs(mkWall(), [door as any], 280);
    expect(slabs).toHaveLength(3);
    expect(slabs[1].bottomZ).toBe(210);  // 过梁从门顶开始
  });

  it('窗在中间切成 4 段：左 + 上 + 下 + 右', () => {
    // ...
  });

  it('门紧贴墙起点时切成 2 段（只有过梁 + 右墙）', () => {
    // ...
  });
});
```

### 9.2 组件测试（Vue Test Utils）

- PropertyPanel：选中不同类型对象显示对应字段
- FurniturePanel：拖拽触发事件
- Toolbar：快捷键触发命令

### 9.3 集成测试（Playwright）

覆盖 3 条用户主路径：

```
test 1: 新建方案 → 画一个矩形 → 放一张床 → 保存 → 刷新 → 方案还在
test 2: 载入模板一室一厅 → 进入漫游 → 按 WASD 移动 → 走到门前开门
test 3: 导入损坏 JSON → 看到错误提示 → 列表不变
```

### 9.4 性能基准

```ts
// tests/perf/render.bench.ts
import { bench } from 'vitest';

bench('render 200 furniture items', () => {
  // 构造含 200 家具的 plan
  // 调用 drawFurnitureLayer
  // 期望 < 16ms
}, { time: 3000 });
```

### 9.5 手工测试清单（发布前）

编辑器：
- [ ] 画墙起点/终点都吸附到已有节点
- [ ] 画墙自动形成闭合房间后，房间被识别并命名
- [ ] 删除一面墙，房间相应消失
- [ ] 门放到墙上后，沿墙滑动不会跨角
- [ ] 家具旋转后碰撞检测仍正确（AABB 要考虑 OBB）
- [ ] 连续拖动家具 undo 一次回到起始点（而不是每像素一次）

漫游：
- [ ] 三种户型模板都能正常进入漫游
- [ ] 贴墙走不穿墙
- [ ] 门关着时挡住视线和人
- [ ] 门开着时可以走过
- [ ] 不同身高（140/170/200）视角有明显差异
- [ ] 退出漫游回到编辑器，家具位置/门状态保持

移动端：
- [ ] 编辑器触控画墙
- [ ] 漫游摇杆 + 滑屏都灵敏
- [ ] 电池模式下帧率仍 ≥ 30

---

## 第 10 部分 风险与规避

| 风险 | 影响 | 概率 | 缓解 |
|---|---|---|---|
| 房间识别算法在病态图结构上死循环 | 编辑器卡死 | 中 | 迭代上限 1000，超出报错跳过；fuzz 测试 |
| 移动端 Three.js 性能差 | 漫游卡顿 | 高 | 限制 DPR=2、禁阴影、InstancedMesh、Draw call < 50 |
| iOS Safari PointerLock 不支持 | 桌面 Safari 用户漫游体验差 | 中 | 降级方案：非 PointerLock 模式 + 屏幕边缘转视角 |
| IndexedDB 隐私模式下不可用 | 数据不保存 | 低 | 降级到 localStorage（只存最近一个方案）+ 醒目提示 |
| Plan JSON 膨胀（深响应式导致序列化慢）| 自动保存卡顿 | 中 | shallowRef + 结构共享不可变更新 |
| 人体工学规则太多导致频繁重算 | 拖家具掉帧 | 中 | 规则引擎 debounce 200ms，增量计算（只重算受影响的 ID）|
| Konva 和 Vue 响应式双向同步错乱 | 画面不一致 | 中 | 严格单向：store 是真相源，Konva 只渲染不存状态；watch 手动 diff |
| 门开合角度计算在镜像墙上符号反 | 门开错方向 | 高 | 写 4 种墙朝向 + 2 种铰链 + 2 种开向的 fixtures 回归测试 |
| Three.js 和 2D 编辑器坐标系不一致 | 3D 里家具错位 | 高 | 在 model 层规定唯一坐标约定（见第 7.1），所有 builder 走 CM_TO_M 转换函数 |
| 连续拖动产生几十个 Command 污染历史栈 | Undo 一次只退一像素 | 高 | Command.mergeWith 机制，连续相同 id 的 move 自动合并 |

---

## 附录 A 净空与人体工学规则表

所有阈值单位 cm。来源：住建部《住宅设计规范》GB 50096-2011 + 常见室内设计手册。

| ID | 规则 | 阈值 | 严重性 |
|---|---|---|---|
| walk-width | 任意两件家具间过道净宽 | < 60 | warn |
| walk-width-main | 客厅主通道净宽 | < 90 | warn |
| bed-side | 床侧（非贴墙侧）到墙/家具 | < 50 | warn |
| bed-foot | 床尾到对面家具 | < 60 | warn |
| sofa-tv-min | 沙发到电视距离 | < 电视对角线 × 1.5 | warn |
| sofa-tv-max | 沙发到电视距离 | > 电视对角线 × 4 | warn |
| sofa-coffee | 沙发到茶几 | < 30 或 > 60 | warn |
| dining-chair | 餐椅后方到墙/家具 | < 80 | warn |
| door-swing | 门开启弧线区域有家具 | 相交 | error |
| door-swing-person | 门开启后净宽 | < 75 | warn |
| kitchen-triangle-min | 灶/槽/冰箱两两距离 | < 120 | warn |
| kitchen-triangle-max | 灶/槽/冰箱两两距离 | > 270 | warn |
| kitchen-counter | 厨房操作台前 | < 90 | warn |
| toilet-front | 马桶前 | < 60 | warn |
| toilet-side | 马桶两侧 | < 25 | warn |
| shower | 淋浴空间内尺寸 | 任一边 < 80 | warn |
| wardrobe-open | 衣柜前（打开门）| < 80 | warn |
| desk-chair | 桌椅后方 | < 75 | warn |
| ceiling-low | 墙高 | < 240 | warn（提示低矮感）|

实现原则：
- 每条规则一个独立文件
- 输入 plan，输出 Warning[]
- 规则之间无依赖，可任意启用禁用
- P1 支持用户自定义阈值

---

## 附录 B 家具库定义

```ts
// src/modules/templates/furniture-catalog.ts
export const FURNITURE_CATALOG = {
  // 卧室
  'bed-single':   { name: '单人床',   size: {w: 100, d: 200, h: 45}, defaultColor: '#d4b895', category: 'bedroom' },
  'bed-double':   { name: '双人床',   size: {w: 150, d: 200, h: 45}, defaultColor: '#d4b895', category: 'bedroom' },
  'bed-kingsize': { name: 'King床',   size: {w: 180, d: 200, h: 45}, defaultColor: '#d4b895', category: 'bedroom' },
  'wardrobe-2':   { name: '两门衣柜', size: {w: 100, d: 60,  h: 220}, wallAligned: true, category: 'bedroom' },
  'wardrobe-3':   { name: '三门衣柜', size: {w: 150, d: 60,  h: 220}, wallAligned: true, category: 'bedroom' },
  'side-table':   { name: '床头柜',   size: {w: 40,  d: 40,  h: 50},  category: 'bedroom' },

  // 客厅
  'sofa-2':       { name: '双人沙发', size: {w: 150, d: 90,  h: 85},  category: 'livingroom' },
  'sofa-3':       { name: '三人沙发', size: {w: 210, d: 90,  h: 85},  category: 'livingroom' },
  'sofa-l':       { name: 'L 型沙发', size: {w: 250, d: 180, h: 85},  category: 'livingroom' },
  'armchair':     { name: '单椅',     size: {w: 80,  d: 85,  h: 85},  category: 'livingroom' },
  'coffee-table': { name: '茶几',     size: {w: 120, d: 60,  h: 40},  category: 'livingroom' },
  'tv-cabinet':   { name: '电视柜',   size: {w: 180, d: 40,  h: 45},  wallAligned: true, category: 'livingroom' },
  'tv':           { name: '电视',     size: {w: 130, d: 10,  h: 75},  wallAligned: true,
                    interactive: 'tv', category: 'livingroom' },
  'bookshelf':    { name: '书架',     size: {w: 90,  d: 30,  h: 200}, wallAligned: true, category: 'livingroom' },

  // 餐厨
  'dining-table-4': { name: '四人餐桌', size: {w: 120, d: 80,  h: 75},  category: 'dining' },
  'dining-table-6': { name: '六人餐桌', size: {w: 180, d: 90,  h: 75},  category: 'dining' },
  'dining-chair':   { name: '餐椅',     size: {w: 45,  d: 50,  h: 90},  category: 'dining' },
  'fridge':         { name: '冰箱',     size: {w: 75,  d: 70,  h: 180}, wallAligned: true, category: 'kitchen' },
  'stove':          { name: '灶台',     size: {w: 70,  d: 60,  h: 90},  wallAligned: true, category: 'kitchen' },
  'sink':           { name: '水槽',     size: {w: 80,  d: 60,  h: 90},  wallAligned: true, category: 'kitchen' },
  'kitchen-counter':{ name: '橱柜',     size: {w: 100, d: 60,  h: 90},  wallAligned: true, category: 'kitchen' },

  // 卫浴
  'toilet':  { name: '马桶',   size: {w: 40, d: 70, h: 75},  category: 'bathroom' },
  'basin':   { name: '洗手池', size: {w: 60, d: 50, h: 85},  wallAligned: true, category: 'bathroom' },
  'shower':  { name: '淋浴',   size: {w: 90, d: 90, h: 200}, wallAligned: true, category: 'bathroom' },
  'bathtub': { name: '浴缸',   size: {w: 170, d: 80, h: 55}, wallAligned: true, category: 'bathroom' },

  // 办公
  'desk':         { name: '书桌', size: {w: 120, d: 60, h: 75}, wallAligned: true, category: 'office' },
  'office-chair': { name: '办公椅', size: {w: 60, d: 60, h: 90}, category: 'office' },

  // 灯光/控制
  'lamp-ceiling': { name: '吊灯',     size: {w: 50, d: 50, h: 50}, mountPoint: 'ceiling', interactive: 'light', category: 'lighting' },
  'lamp-floor':   { name: '落地灯',   size: {w: 40, d: 40, h: 160}, interactive: 'light', category: 'lighting' },
  'lamp-wall':    { name: '壁灯',     size: {w: 20, d: 15, h: 30},  wallAligned: true, mountPoint: 'wall', interactive: 'light', category: 'lighting' },
  'switch':       { name: '墙面开关', size: {w: 8,  d: 2,  h: 8},   wallAligned: true, mountPoint: 'wall', interactive: 'switch', category: 'lighting' },
} as const;
```

---

## 附录 C IndexedDB Schema

数据库名：`RoomSim`，版本 1。

### Table: plans

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| id | string | PK | 方案 id |
| name | string | idx | 方案名（用户编辑）|
| updatedAt | number | idx | 最后更新时间戳 |
| data | Plan | - | 完整 Plan 对象 |
| thumbnail | string? | - | 可选 base64 缩略图 |

### Table: settings（预留）

存储用户偏好（不涉及方案内容）：单位、默认墙高、Snap 开关、人体工学开关等。P0 用 localStorage 就够，P1 迁此。

### 迁移策略

```ts
db.version(1).stores({ plans: 'id, name, updatedAt' });

// 未来：
// db.version(2).stores({
//   plans: 'id, name, updatedAt',
//   settings: 'key',
// }).upgrade(tx => { /* ... */ });
```

---

## 文档结束

**下一步建议**：

1. 先按 Sprint 0 的任务清单建项目，把 `types.ts` 确定下来（这是最关键的契约）
2. 第一个可跑的里程碑是 S1-6（矩形房间工具）完成后，能画一个完整房间并看到它被渲染
3. 任何算法在写 UI 之前先写测试（geometry 层）

如有问题或需要调整，常见的几处是：家具库要不要精简、人体工学规则阈值、模板具体尺寸。这些都写在配置里，可随时迭代。
