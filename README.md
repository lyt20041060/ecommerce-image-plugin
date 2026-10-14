# 商品图片提取助手

无需后端和构建工具的 Chrome Manifest V3 扩展。支持淘宝 / 天猫、京东和拼多多商家页面的 DOM 图片采集。页面右下角点击「获取图片」，在新标签页筛选并批量转换为 PNG。

## 加载扩展

1. 在 Chrome 打开 `chrome://extensions/`。
2. 打开右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本项目目录（包含 manifest.json 的目录）。
4. 打开或刷新商品详情页，右下角出现「获取图片」。代码更新后，在扩展管理页点击重新加载，并刷新商品页。

## 使用与真实网站验证

1. 使用自己的正常登录会话进入淘宝 / 天猫、京东商品详情页，或拼多多商家后台的商品编辑、预览、详情页。
2. 展开商品详情，逐步滚动至页面底部，让懒加载图片进入 DOM。点击「获取图片」。扩展不会自动滚动或点击页面，避免触发商家编辑操作。
3. 检查普通图片、data-src / data-original 等懒加载图片、srcset 和 CSS 背景是否出现在结果页。默认排除疑似图标、Logo、占位图片，以及短边小于 160 或面积小于 60000 的图片。可打开「显示小尺寸图片」检查尺寸过滤的结果；名称过滤仍有效。
4. 点击图片查看大图；测试全选、反选及选中数量。勾选实际商品图片，排除推荐商品、店铺广告或二维码。
5. 下载 2–3 张，查看进度和 Chrome 下载记录；打开下载文件，确认实际为 PNG、尺寸正确、按 `商品图_001.png` 编号。
6. 重复批次遇到同名文件时，Chrome 会自动添加冲突后缀，避免覆盖。每批按当前页面顺序重新编号；失败会留下编号空位。下载期间保持结果标签页打开。
7. 在 Chrome 下载记录中取消一项，或断网后下载，验证失败详情是否显示；重新选择失败图片重试。
8. 对三个平台分别执行上述步骤；如按钮未出现，检查站点权限并刷新页面。如图库加载或转换失败，查看失败详情和扩展管理页的 Service Worker 错误。

**未对真实电商网站完成登录访问或下载验证。平台布局、CDN、防盗链、商家账户权限及下载提示需在你的 Chrome 环境手动验证。** 插件不绕过登录、访问控制、防盗链或验证码。

## 实现与边界

- content.js 采集 img、响应式候选、常见懒加载属性，以及元素 / 伪元素 CSS 背景；支持开放的 Shadow DOM。当前只采集顶层文档，不读取 iframe、关闭的 Shadow DOM、canvas 或尚未写入 DOM 的服务端数据。页面隐藏的懒加载地址只要已进入 DOM 也能采集。
- 整页采集兼容不同商品布局，因此无法保证只包含当前商品。按钮注入上述电商域名下页面，商品详情以外的页面也可能显示按钮。每次最多 1500 个候选，不自动进行无限滚动。
- 按标准化 URL 去重，并合并阿里 CDN 常见尺寸后缀。保留查询参数避免破坏签名。不同 URL 的相同像素图片仍可能重复；未使用感知哈希。不会猜测或修改原图地址。
- gallery.js 以 6 路并发检查尺寸，2 路并发下载。直接预览失败时尝试扩展页 fetch；转换始终使用扩展页 fetch → Blob → ImageBitmap → Canvas → PNG，避免内容脚本 Canvas 的跨域污染。动图保存为静态帧，透明度保留。SVG 图片也可能包含不可读取的外部资源而失败。
- 网络读取超时 30 秒、单文件最多 30 MB；PNG 转换最多 4000 万像素，单边最多 16384，避免超长详情图耗尽内存。超出限制明确报错，不偷偷缩小图片。
- chrome.downloads.onChanged 跟踪实际下载完成 / 中断。120 秒仍未完成则请求取消并报错。关闭标签页会停止未完成的转换任务。
- 默认允许 HTTPS 电商域名及 alicdn.com、360buyimg.com、jdimg.com、pddpic.com、pinduoduoimg.com 的子域。不申请全部网站、cookies、webRequest 或 scripting 权限。其他 CDN、HTTP、data/blob 地址不采集；遇到新 CDN 需审查后同时更新 manifest.json 和 shared.js 白名单并重新加载扩展。
- fetch 不携带登录凭据或伪造 Referer。需登录 Cookie 或来源校验的图片可能可预览但无法转换，界面会明确报错。
- storage.local 保存图片 URL、商品标题和页面 URL，不上传服务器。新采集时清理超过 24 小时的旧记录；不是定时清理。卸载扩展会删除记录。URL 可能包含签名信息，请勿公开共享采集记录。

## 本地检查

安装 Node.js 22 或更新版本后，在项目目录执行：

```powershell
node --test tests/*.test.cjs
node --check shared.js
node --check content.js
node --check background.js
node --check gallery.js
```

测试覆盖白名单安全、URL 去重、尺寸过滤、文件命名和 Manifest 文件引用，并用模拟 DOM / Chrome API 验证懒加载、背景图、开放 Shadow DOM 采集及后台记录、消息拒绝与标签页创建流程。纯 Node 测试无法证明真实 Chrome API、真实 DOM、跨域请求、图片转换和真实网站行为有效，需要上述手动验证。

## 文件结构

- manifest.json：MV3 配置及权限
- shared.js：安全 URL、去重、尺寸与命名规则
- content.js / content.css：采集与悬浮按钮
- background.js：记录采集结果及创建图库标签页
- gallery.html / gallery.js / gallery.css：预览、选择、PNG 转换及下载进度
- tests/helpers.test.cjs：本地自动化检查
- tests/integration.test.cjs：模拟内容脚本与后台消息流程

Chrome 官方参考：[跨域网络请求](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)、[下载 API](https://developer.chrome.com/docs/extensions/reference/api/downloads)。
