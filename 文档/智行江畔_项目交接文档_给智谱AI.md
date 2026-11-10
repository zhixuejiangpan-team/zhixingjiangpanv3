# 智行江畔 · 项目交接文档（交接给智谱 AI）

> 版本：V12.1 ｜ 最后更新：2026-11-09 ｜ 交接对象：智谱 AI（GLM 编码代理）
>
> **本文档定位**：一份自包含的「项目设计 + 迭代历史 + 现存 Bug + 接手须知」总览。读完本文档 + 既有 4 篇专项文档，即可在不翻阅历史对话的情况下继续开发。

---

## 1. 文档说明（给接手 AI 的指引）

- 本项目是**纯静态、零构建**的前端单页应用，双击 `index.html` 即可运行（file:// 直开）。
- 3D 部分全部使用 **Three.js r147（本地 vendor）+ OrbitControls**，不使用任何其他 3D 库、不使用打包器。
- **优先修复第 11 节的「已知问题」**（尤其「孪生界面按键无法点击」），再谈新功能。
- 既有 4 篇文档（放在 `文档/`）是本文档的延伸阅读：
  - `智行江畔-全站架构与3D建模规格.md`
  - `智行江畔-技术架构学习手册.md`
  - `智行江畔-数据与AI安全咨询材料.md`
  - `智行江畔-3D建模优化提示词V1.md`
- 本文档以「当前代码真实状态」为准；若与旧文档冲突，以本文档 + 代码为准。

---

## 2. 项目概览

| 项 | 内容 |
|---|---|
| 名称 | 智行江畔（江财校园生活智能助手） |
| 场景 | 大创 / iCAN 等竞赛展示 |
| 目标 | 把「校园地图 + 拥挤度预测 + AI 问答 + 数字孪生 3D + 办事指南」整合为一个可演示的单页应用 |
| 版本 | V12.0（多网络数字孪生） |
| 形态 | 纯静态前端（file:// 可直开），可选本地 Node 代理接 DeepSeek，可选 Render/Cloudflare 部署代理 |
| 线上 | GitHub Pages：`https://zhixuejiangpan-team.github.io/zhixuejiangpan-v2/`（仓库 `zhixuejiangpan-team/zhixuejiangpan-v2`） |
| 设计语言 | 涂鸦 / 手绘 / 纸片风（Nomadic Tribe 式柔和玩具感） |

**答辩核心亮点**：所有网络数据「当前为 AI 模拟，但统一走 `NetworkData` 接口，`__USE_REAL_API__` 一置 true 即可无缝切真实接口」——数据契约清晰是加分项。

---

## 3. 运行与部署

### 3.1 本地运行

- **直接双击 `index.html`**：核心四章节 + 3D 孪生可用。AI 问答需要本地代理（见下）。
- 本地起静态服务器（可选，避免个别浏览器 file:// 限制）：
  ```bash
  # 任选其一
  npx serve .
  python -m http.server 8080
  ```

### 3.2 AI 代理（DeepSeek）

- `server.js`：本地跨域代理，监听 `3001`，把 `/ai` 请求原样透传到 `https://api.deepseek.com/chat/completions`。
  ```bash
  set DEEPSEEK_KEY=你的key   # Windows
  node server.js
  ```
  前端在 `js/config.js` 的 `AI_CONFIG.PROXY_URL` 填 `http://localhost:3001/ai`。
- **严禁前端直连 DeepSeek**（会暴露 Key），必须经代理。
- `render.yaml`：Render 一键部署代理（`DEEPSEEK_KEY` 手动配）。
- `worker.js` + `wrangler.toml`：Cloudflare Worker 版代理（备用部署方式）。

### 3.3 在线依赖（重要）

`index.html` 头部通过 CDN 引入：高德地图 AMap JS API、AMap.Loca、D3 v7、ECharts 5、Google Fonts（ZCOOL KuaiLe）。

- **核心 3D 与页面骨架不依赖网络**（Three.js 是本地 vendor）。
- **地图页、力导向图谱、部分字体需要联网**；无网时这些区域会降级/空白，不影响孪生 3D。

### 3.4 缓存陷阱（接手必读）

所有脚本/样式都带 `?v=xxx` 版本参数（如 `app.js?v=110`、`twin-overview.js?v=120`）。

- **修改 JS/CSS 后，必须把 `index.html` 里对应 `?v=` 号 +1**，否则浏览器可能继续用旧缓存，出现「改了没生效 / 按键没反应」的假象。
- 调试时优先 **Ctrl+Shift+R 硬刷新**或关闭标签重开。

---

## 4. 目录结构与文件职责

```
智行江畔/
├─ index.html            27KB  单页骨架：5 个 section（首页/地图/AI/数字孪生/指南）+ 脚本加载顺序
├─ js/
│  ├─ config.js          5.2KB  全局配置（AI_CONFIG、高德 key、主题开关等）
│  ├─ data.js            47KB   静态数据核心：64 点位 window.spots、别名、敏感词表、日历等
│  ├─ guide-data.js      7.4KB  办事指南数据（流程/材料）
│  ├─ survey-data.js     7.2KB  问卷/统计模拟数据
│  ├─ data-source.js     12KB   数据源抽象（getCrowd 等，模拟/真实切换）
│  ├─ network-data.js    19KB   ★ NetworkData 数据层（生活/教育/交通/校园网/教师/应急/人流）
│  ├─ ai-service.js      6.9KB  AI 服务层（DeepSeek 调用、敏感词分级、医疗过滤、点位解析）
│  ├─ themes.js          3.6KB  主题/深浅色
│  ├─ gestures.js        7KB    手势（含摄像头 HUD，本期起停用）
│  ├─ scene-fx.js        10.6KB 天气/粒子特效（雨/雪/闪电）
│  ├─ app.js             153KB  ★ 主应用逻辑（章节导航、地图、AI、孪生模块 TwinModule、图谱）
│  ├─ twin3d.js          64KB   ★ 单栋 3D 查看器（BUILDERS 六类 + 碎片 + kit 工具库）
│  ├─ twin-overview.js   79KB   ★ 多栋总览/网络视图（P1–P5 核心）
│  ├─ intro.js           17.7KB 开屏引导叙事
│  └─ vendor/
│     ├─ three.min.js    Three.js r147（本地）
│     └─ OrbitControls.js
├─ css/
│  ├─ style.css          85.5KB 全站样式（含 V12 孪生段、P4/P5 新增样式）
│  └─ intro.css          13.4KB 开屏样式
├─ 文档/                 4 篇既有规格/学习/安全/提示词文档
├─ server.js             DeepSeek 本地代理（端口 3001）
├─ render.yaml           Render 部署蓝图
├─ worker.js / wrangler.toml  Cloudflare Worker 代理
└─ .gitignore
```

**脚本加载顺序（index.html 底部）**：
`config → data → guide-data → survey-data → data-source → network-data → ai-service → themes → gestures → scene-fx → app.js → twin3d → twin-overview → intro`
（顺序敏感：`twin-overview` 依赖 `Twin3D.kit` 与 `NetworkData`，务必在两者之后。）

---

## 5. 整体架构

### 5.1 单页章节

`#sec-home`（首页）→ `#sec-map`（地图/点位）→ `#sec-ai`（AI 问答）→ `#sec-twin`（数字孪生）→ `#sec-guide`（办事指南）。
由 `app.js` 的导航（goTo + 底栏 Dock）切换；每章有独立模块。

### 5.2 数字孪生模块（TwinModule，在 app.js 内）

TwinModule 负责：列表渲染、时间轴、天气/演示模式、心跳 `tick()`（每 30s，演示模式 1s）、网络入口、校区切换、求助弹窗。
- **心跳**：`tick()` → `NetworkData.getLife/getEdu` → 更新列表数值 + 调用 `TwinOverview.sync(mins)` 同步 3D。
- **TwinOverview**：多栋总览 3D 场景（`js/twin-overview.js`）。
- **Twin3D**：单栋完整模型查看器（`js/twin3d.js`）。

### 5.3 数据流

```
点击/心跳
  → NetworkData.getXxx(campus, minute)  （mock 或 fetch 真实接口）
  → TwinModule.tick() 更新 DOM 列表
  → TwinOverview.sync() 更新 3D（旗帜颜色/数字/亮灯率/各网络视图）
  → 用户交互（网络入口/校区/时间轴/单击建筑）→ TwinOverview.setNetwork / setCampus / enterSingle
```

---

## 6. 数据层契约（NetworkData）

`js/network-data.js` 暴露 `window.NetworkData`：

```js
NetworkData = {
  CAMPUSES: ['ml_south','ml_north','jq_south','jq_north'],
  CAMPUS_MAP: { ml_south:{campus:'麦庐园',area:'南区'}, ... },
  spotsOf(campus),          // 按 campus+area 过滤 window.spots
  netKind(spot),            // canteen/library/express/hospital/stadium/dorm/admin/academic
  eduPeriodOf(minute),      // 教育时段分桶 0~7
  __USE_REAL_API__: false,
  getLife(campus, minute),  // 食堂楼层/窗口、快递取寄、building.crowd/color
  getEdu(campus, minute),   // 教学楼层/zone、图书馆自习室、buildings.openRate
  getTraffic(campus, minute),// roads/parkings/bikes（单车路线/速度/停靠）
  getWifi(campus, minute),  // buildings[{spotId,density,occupancy}]
  getTeachers(campus, minute),// teachers[{status:'free'|'busy'}] + courses[{type,color,name,start,end}]
  getRisk(campus, minute),  // score + items[{spotId,score,reasons}]
  getFlow(campus, minute)   // roads[{lngA,latA,lngB,latB,density}]
}
```

- **统一路由**：`route(net, campus, minute)`，mock 时 `Promise.resolve(simulate[net](...))`；`__USE_REAL_API__=true` 时 `fetch('/api/'+net+'?...')`。**接口契约即真实接口**。
- **确定性**：所有随机量用 `hashSeed(str) + mulberry32`，同一 `spotId/campus` 每次结果稳定；交通路线种子稳定（切 tick 不跳变）。
- **校区差异**：`CAMPUS_PARAMS = { ml_south:{canteenFactor,lunch,dinner}, ml_north, jq_south, jq_north }`，食堂强度/高峰时刻按校区微调。
- **铁律**：视图层禁止自行生成业务随机数据，必须来自 NetworkData（视觉效果如旗帜相位、碎片抖动除外）。

---

## 7. 涂鸦设计系统

| 角色 | 值 |
|---|---|
| 纸底 | `#FEFBF6` |
| 墨线 | `#2B2B2B` |
| 马克笔四色 | `#FF2E63`（红）/ `#08D9D6`（青）/ `#F9ED69`（黄）/ `#6BCB77`（绿） |
| 字体 | `--font-doodle`（ZCOOL KuaiLe）+ 系统黑体 |

规则：低饱和纸底 + 一个高饱和点缀 + 墨线描边；**不引入新色相**；拥挤度三档映射 60%/85% 阈值不随意改。

---

## 8. 3D 孪生架构

### 8.1 总览（twin-overview.js）

- **相机**：45° 俯瞰，`OrbitControls` polar 30°–60°，距离 25–110；默认 `(0,46,42)` 看向原点。
- **地形**：`PlaneGeometry(96,96)` + 程序化 Canvas 贴图（道路/绿地/水体），随校区重建。
- **建筑**：每校区取 13–15 栋（`OV` builders：canteen/library/express/hospital/stadium/dorm/admin/academic），按经纬度线性投影排布。
- **建筑质感**：`bevelBox` 圆角盒、顶部收分、暖调 5 阶 `gradientMap`、纸纹理三层、接触 AO/低端机假阴影、建筑微呼吸、屋顶摆动、窗光呼吸。
- **旗帜**：`PlaneGeometry(1.6×0.95, 8×6)` + Canvas 旗面，CPU 顶点鼓起/扭转动画，颜色=拥挤度三档，`depthTest:false` 永远最前。
- **数字**：蜡笔字 `Sprite`，悬浮建筑斜上方。
- **昼夜**：读 `window.__twinNight`，夜间降光照、深色雾、窗光至少 55% 亮。

### 8.2 单栋（twin3d.js）

- `Twin3D.open(opts)` 全屏查看器，复用 `BUILDERS` 六类完整模型 + 850ms 碎片聚合 + 环绕碎片。
- `window.Twin3D.kit` 导出工具库（`bevelBox` 不在此，`part/flat/wobbleGeo/toonGradient/paperShard/...`）。
- `window.__twin3dStats = { triangles, meshes, fragments, kind, id }`。

### 8.3 网络视图（P2–P4）

| 视图 | 实现 |
|---|---|
| 生活/教育 | 建筑高亮/压暗 50%，单栋面板展示楼层窗口/自习室/课程 |
| 交通 | 独立视图：路网 Line + 停车点数字 + `InstancedMesh` 单车（60~100）逐帧插值，30s 仅刷新派车 |
| 校园网 | 每栋 `ShaderMaterial` 云团 billboard（噪声+密度配色，`AdditiveBlending`），低端机降级静态色环 |
| 教师 | 教师光点（绿空闲/灰外出）+ 教学楼窗户课程色块，点窗看课程名 |
| 应急 | 风险预测面板；触发后红脉冲环 + 碎片箭头 + 疏散流动带；被动触发（crowd>95 真实持续 60s）；`window.__twinForceEmergency` 测试钩子 |
| 全网叠加 | 人流色带 + 云团 + 交通色点 + 状态旗帜，逐项图层开关；低端机关云团/交通点 |
| 双指聚类 | 相机距离<阈值时网格聚类，过密建筑群 0.6s 补间散开，回位还原 |

### 8.4 性能预算

单栋 ≤800 三角、同屏 ≤15 栋、总 ≤15000、单 RAF、DPR≤2、云团 ≤15 billboard、单车 ≤100、单栋碎片 ≤50、Sprite ≤15。
`window.__twin3dStats` 每 128 帧输出 `{mode, buildings, triangles, meshes}`。

---

## 9. V12 迭代历程（本会话完成的工作）

> 顺序即真实开发顺序，便于理解每处代码的来历。

1. **P1 多栋总览骨架**：新建 `twin-overview.js`，45° 俯瞰、地形、13 栋低模、旗帜/数字、单击飞入/长按详情/返回、网络入口框架、校区切换器、`NetworkData` mock。
2. **P2 生活+教育网络 + 时间轴**：楼层窗口/快递/自习室面板；时间轴拖动预览、天气、昼夜。
3. **P1 补充「建模质感强化」**（据提示词文档）：`bevelBox` 圆角、顶部收分、屋顶微倾、暖调 5 阶渐变、纸纹理三层、阴影（自阴影/AO/低端贴片/层间）、流动性（呼吸/屋顶摆/窗光呼吸）、旗帜 8×6 鼓起、数字投影、水体 UV 滚动、远景低模、墨线飞白。
4. **G1–G5 差距补齐**：返回总览恢复散场建筑 + 错峰缩放聚合（修 bug）；`emissive` 暖色暗部；窗光呼吸周期改 ~6s；远景装饰独立摆动；数字投影移到建筑顶部。
5. **P3 交通 + 校园网 + 双指聚类**：`getTraffic/getWifi`、交通独立视图（单车 InstancedMesh）、云团 Shader、网格聚类展开。
6. **光照修复**：夜间不再发白——接入 `__twinNight`，降环境光/半球光/平行光，深色背景，窗光夜间亮起。
7. **P4 教师 + 应急 + 全网叠加 + 人流色带**：`getTeachers/getRisk/getFlow`、教师视图、应急视图（红脉冲/箭头/疏散带/弹窗/求助按钮/AI 安全链路/`zxsj66_sos_pending`）、全网叠加图层开关、人流色带（`depthTest:false` 渲染最前、距离渐隐）。
8. **P5 四校区接入**：`pickSpots(campus)`、`switchCampus()`、`setCampus` 资源释放、`CAMPUS_PARAMS` 校区差异、校区菜单全开。
9. **按钮无法点击的多轮修复**（未完全解决，见第 11 节）：应急时间门、非阻塞横幅、遮罩 `display:none !important`、`enter()` 清理残留、`buildDomRefs` 逐项 try/catch、document 级委托、mount/tick try/catch。
10. **V12.1（本次）——「按键无法点击」根因确认并修复 + 建模质感专项**（详见第 9.1 节）。

### 9.1 V12.1 本次会话完成的工作（按优先级）

**A.【P0】「孪生按键无法点击」根因确认并彻底修复**（实测复现 + 诊断页堆栈定位）：
1. **根因一（网络按钮全死）**：`bindNetwork` 委托处理器首行用了 jQuery 语法 `querySelectorAll('.net-btn[data-net!="all"]')`——原生 CSS 无 `!=` 属性选择器，每次点击必抛 `SyntaxError`，7 个网络入口 100% 无反应。已改为合法的 `.net-btn:not([data-net="all"])`（app.js 共 3 处）。
2. **根因二（切校区无反应）**：`disposeGroup` 对嵌套 Group（K.part 返回值就是 Group，建筑内必存在）执行 `ms=[o.material]` 得 `[undefined]`，接着 `m.map` 抛 `TypeError`——首次切校区/释放网络视图必炸，且旧代码把 UI 更新放在 3D 调用之后，异常导致按钮/列表全部不更新。已加 `if (!m) return;` 守卫。
3. **防御加固**：`TwinOverview` 全部公共方法（setNetwork/setCampus/focus/triggerEmergency/returnOverview/exitEmergency）改为「未挂载安全返回 + 内部兜底不抛错」；`TwinModule.enter()` 整体 try/catch + 失败放开 openFlag 可重试（bindDone 防重复绑定）；`switchCampus` UI 先行、3D 独立 try/catch；3D 失败时 toast 反馈（不再静默）。
4. **附带修复**：`leave()` 从未真正停帧（`active` 从未被检查）→ loop 不活跃即停 RAF；`exitEmergency`/`setNetwork` 未收起风险预测面板导致遮挡 → 补 `hideNetworkPanel()`；mount 失败占位 HTML 修正；相机 aspect 零高度守卫。

**B.【P1】Three.js 建模质感专项**（总览八类全面升级，三角预算 15 栋 6007t，远低于 15000 红线）：
- 食堂：歪烟囱 + 3 个渐大手绘烟圈 Sprite 循环上浮（低端机省略）+ 门口条纹遮阳篷（accent+白条纹 Canvas 贴图）。
- 图书馆：退台 6 本撞色书脊 + 顶层 5 片两色碎片玻璃幕墙（拼缝可见）+ 顶部风车式旋转手绘星。
- 快递：门头胶带斜贴 + 6~8 个撞色小盒堆叠纸箱山。
- 医院：胶囊十字（CapsuleGeometry 末端圆头）+ 3s 周期呼吸发光 + 门前药瓶道具。
- 体育场：内圈换色 + 白色车道线环 + 5 片两色五边形碎片草皮 + 看台 3 个小人观众。
- 宿舍：阳台小凸台阵列（随机留空）+ 晾衣杆 + 3 块撞色被子。
- 行政：门厅圆形校徽（黄色碎片圆盘 + 墨线环）。
- 教学楼：院牌色条（微歪）。
- 环境：树冠改 3 片四面体碎纸拼合（两色绿）+ 2 朵 makemepulse 式纸云（3 压扁椭球，慢速漂浮）。

**C.【P1】窗户错位 bug（新发现）**：`ovWindows` 旧签名 8 参 vs 调用 9 参错位，导致窗户浮在屋顶外 1~2.5 单位处。已改 `(g,v,cols,rows,w,h,faceZ,baseY)` 并修正全部 6 处调用，窗户落回前立面（教师视图点窗看课程也因此变准）。

**D.【P2】稀疏校区修复（原 11.4）**：`pickSpots` 只筛生活类导致麦庐北仅 4 条、蛟桥南约 2 条。现在全 kind 覆盖（canteen→library→express→hospital→stadium→dorm→admin→academic 优先排序），与 3D `buildCampus` 同序同集合：麦庐南 14 条/15 栋、蛟桥南 10 条/10 栋、麦庐北 4 条/4 栋，列表即孪生建筑清单。

**E. 验证（诊断页实测）**：四校区循环切换（15b→4b→10b→15b 重建成功）、7 个网络入口 + 图层开关 + 应急触发/退出 + 紧急求助弹窗全部响应，全程零报错；`node --check` 通过；`?v=` 已升（app.js→111、twin-overview.js→121）。

---

## 10. 关键实现细节（便于定位代码）

- `bevelBox(w,h,d,bevel)`：`ExtrudeGeometry` 圆角矩形 + bevel，替代 `BoxGeometry`（twin-overview）。
- `makeGradient5()`：暖调 5 阶（`#fff → #fffaeb → #f8f0dc → #f0e6d2 → #e8dcc8`）。
- `makePaperTex()`：白底 + 纤维噪点 + 手绘高光笔触；每栋 `paperTex.clone()` + 随机 offset。
- 接触阴影：高配 `RingGeometry` AO；低端 `makeFakeShadow` 径向渐变椭圆。
- 旗帜：`flagTexture` + CPU 顶点 z 位移（含鼓起项），`lookAt(camera)`。
- 数字：`numberTexture` + `Sprite`，`depthTest:false`。
- 交通：`mergeGeos([wheel,wheel,frame,seat])` → `InstancedMesh`，`updateBikeInstances` 逐帧写矩阵。
- 云团：`WIFI_FRAG` GLSL（hash/noise 流动 + 密度配色），`uTime` 每帧更新，`lookAt`。
- 应急：`buildEmergencyScene`（红环 + `makeTri` 碎片 + `ribbonQuad` 疏散带）。
- 校区切换：`setCampus` 先 dispose 全部网络视图 + 单栋/碎片，再 `buildCampus()`；`buildTerrain` 销毁旧 `terrainTex` 防泄漏。
- 聚类：`updateCluster` 网格聚类 + `applyCluster` 0.6s 补间，`b.movers` 同步移动 group/旗/数字/阴影。

---

## 11. 已知问题与 Bug 清单（★ 接手优先看）

### 11.1 ✅ 孪生界面按键无法点击（**V12.1 已彻底解决**，根因与修复见第 9.1 节 A）

**现象（历史记录）**：进入「数字孪生」段后，网络入口/校区切换/时间轴等按键点击无响应（“一个都按不了”）。

**历史修复（均已在代码中，未命中根因，留档备查）**：应急真实时间门、非阻塞横幅、遮罩 `display:none !important`、`enter()` 清理残留、`buildDomRefs` 逐项 try/catch、document 级事件委托、mount/tick try/catch。V12.1 证实真正根因是 `data-net!="all"` 非法选择器与 `disposeGroup` 嵌套 Group 崩溃，两个异常都被静默吞掉，表现为「点了没反应」；当时怀疑的遮罩/openFlag/缓存方向均未命中根因（硬刷新/elementFromPoint/CDN 等排查步骤留档不再展开）。

### 11.2 交通按钮点击「没反应」（已修）

早期点击交通只调 console.log / 视觉几乎不可见。已修：路网改墨色、单车放大亮青、MeshBasicMaterial 不受夜间变暗、相机拉近、空数据兜底、构建失败 console.error。

### 11.3 夜间 3D 发白（已修）

根因：红色点光源强度 8 + 环境光过强 + 未接夜间。已改为点光 0.35/夜间 0.55、ambient 0.42、hemi 0.36、接 `__twinNight` 平滑转夜色。

### 11.4 校区列表稀疏（✅ V12.1 已修复，见 9.1 节 D）

原 `pickSpots` 只筛生活类导致麦庐北仅 4 条、蛟桥南约 2 条；现已全 kind 覆盖并与 3D 建筑同步。

### 11.5 水体/远景装饰静态（已知限制）

地形是单张 Canvas 贴图，水体未拆独立水面做 UV 滚动（仅总览装饰层有独立水面）。远景树/塔为静态低模。

### 11.6 管理员端仅数据结构预留

`zxsj66_sos_pending` 内含 `admin:{acknowledged:false}`，但没有管理员界面（按要求本期只做数据结构）。

### 11.7 其他注意

- `sync` 曾每 30s 重建面板导致楼层选择重置（已改成仅刷新数据；如仍有问题可加「保留当前楼层」逻辑）。
- 手势模块已停用（`gestures.js` 保留但按钮只留 gestureMapBtn）。

---

## 12. 调试与自检入口

| 入口 | 用途 |
|---|---|
| `window.__twin3dStats` | 总览三角面/网格数（`{mode,buildings,triangles,meshes}`） |
| `window.__twinForceEmergency('fire'\|'medical', spotId?)` | 强制触发应急视图（自检用） |
| `TwinOverview.getNetView()` / `getMode()` | 当前网络视图 / 3D 模式（overview/single/flying） |
| `TwinOverview.setNetwork(net)` / `setCampus(c)` | 程序化切网络/校区 |
| Console 日志 | `[twin] bind failed`、`[twin] overview mount failed`、`[network]`、`[traffic]`、`[campus]` |
| `node --check js/xxx.js` | 语法检查（不执行） |
| 移动端 375px | 检查无横向溢出 |
| 低端机降级 | `LOWEND` 判定：关 shadowMap/云团/交通点、用假阴影贴片 |

---

## 13. 对话历史摘要（便于理解演进与偏好）

- **V10.x 阶段**：首页重构、开屏引导叙事、底栏 Dock；git push 到 GitHub；输出规格/学习/安全三份文档；整理 `E:\ican比赛` 目录（`智行江畔` 为最新主目录，`智学江畔 - 重构` 为旧 git 仓库，`_归档_旧版本` 归档）。
- **V12 学习**：阅读 V12 多网络数字孪生技术方案，确定 P1–P5 分期。
- **P1–P5**：见第 9 节。
- **多轮修复**：交通无反应、夜间发白、按键无法点击（多次）。
- **用户偏好**：中文回答；分期交付、每期自检并诚实标注偏差；文件命名中文；**不引入新依赖**（GSAP 用自写 tween 替代）；file:// 必须能直开。

---

## 14. 铁律与交接注意事项

1. **纯静态、零构建**：不引入打包器、不新增 npm 依赖；Three.js 用本地 vendor。
2. **64 点位 id 不断链**：`window.spots` 的 id 是地图/指南/孪生的共同主键，改名/删除需全链路评估。
3. **kind 映射与阈值不动**：`netKind`、拥挤度 60%/85% 三档映射保持。
4. **存储前缀 `zxsj66_`**：所有 localStorage 键。
5. **数据只走 NetworkData**：视图层不自造业务数据。
6. **单 RAF**：所有动画进现有 `loop`，不新增 `requestAnimationFrame`。
7. **涂鸦设计系统**：不引入新色相。
8. **改 JS 必升 `?v=`**：否则缓存导致「改了没生效」。

---

## 15. 下一步建议（优先级，V12.1 后更新）

1. ~~【P0】修掉「孪生按键无法点击」~~ ✅ V12.1 已解决（见 9.1 节 A）。
2. ~~【P1】建模质感专项~~ ✅ V12.1 已完成总览八类升级（见 9.1 节 B）；后续可选：单栋查看器（twin3d.js BUILDERS）同步升级。
3. **【P1】真实接口对接**：把 `__USE_REAL_API__` 置 true，后端按第 6 节契约实现 `/api/life|edu|traffic|wifi|teachers|risk|flow`。
4. **【P2】管理员端**：基于 `zxsj66_sos_pending.admin` 做只读列表（本期仅数据结构）。
5. **【P2】性能调优**：全网叠加 ≥30fps，必要时加 FPS 守卫自动降级云团/色点。
6. ~~【P2】列表丰富度~~ ✅ V12.1 已解决（见 9.1 节 D）。

---

## 附录 A：快速验收清单

- [ ] 双击 `index.html` 直开无报错；四章节可切换。
- [ ] 孪生段：15 栋可见、旗帜/数字正常、昼夜跟随。
- [ ] 网络入口：生活/教育/交通/校园网/教师/应急/全网叠加 均可点击并有反馈。
- [ ] 校区切换：麦庐南/北、蛟桥南/北 场景与列表同步重建。
- [ ] 单栋：单击飞入、长按详情、返回/ESC 回总览且其余建筑恢复。
- [ ] 应急：`__twinForceEmergency('fire')` 触发，退出需确认；弹窗可关闭。
- [ ] `node --check` 全部 JS 通过；375px 无横向溢出；低端机降级正常。

---

## 附录 B：会话未完成事项（V12.1 后更新）

1. ~~「孪生按键无法点击」最终根因尚未确认~~ ✅ V12.1 已确认并修复（非法选择器 + disposeGroup 嵌套 Group 崩溃，见 9.1 节 A）。
2. ~~建模质感专项尚未开始~~ ✅ V12.1 已完成总览八类升级；单栋查看器（twin3d.js）向同一风格升级可作为下一期。
3. 真实接口、管理员端、FPS 守卫、单栋 BUILDERS 同步升级均为后续期。

---

> 交接完成。接手 AI 若需要更细的接口字段/几何参数，可直接阅读 `js/network-data.js`、`js/twin-overview.js` 顶部注释与既有 4 篇文档；若需要本会话的逐轮实现细节，可回看对话记录，本文档第 9/11/13 节已做浓缩。
