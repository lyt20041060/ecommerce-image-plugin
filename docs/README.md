# 官网预览与部署

本目录为纯静态官网。无框架、构建步骤、远程字体或后端请求。插件原文件保持不变。

## 本地预览

直接双击 `index.html`，或将其拖入 Chrome。所有资源均为相对路径，离线也可展示。复制地址功能在浏览器不允许剪贴板访问时，会选中地址并提示手动复制。ZIP 下载使用普通相对链接，在 file:// 模式下由浏览器保存或打开系统下载操作，若浏览器直接打开 ZIP，使用右键「链接另存为」。

也可在项目根目录运行：

```powershell
python -m http.server 8080 --directory docs --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:8080/`。按 Ctrl+C 停止服务。

## GitHub Pages

1. 将项目上传到你实际创建的 GitHub 仓库，确保 docs 内的 ZIP 文件也被提交。
2. 在仓库 Settings → Pages 中，Source 选择 Deploy from a branch。
3. 选择实际分支（例如 main）和 `/docs`，点击 Save。
4. 等待部署完成，使用 GitHub 显示的真实网站地址访问。

无需修改资源前缀，项目子路径也可使用。当前没有已确认的仓库地址，页面 GitHub 区域明确显示待补充；后续确认后，可将该区域改为实际仓库链接。此任务仅生成本地官网，没有上传或发布。

## 安装包与更新

`assets/product-image-helper-v1.0.0.zip` 是由当前插件生成的可下载包，包含 manifest.json、shared.js、background.js、content.js、content.css、gallery.html、gallery.js、gallery.css 和原项目 README.md。不包含官网或测试文件。解压后选择包含 manifest.json 的目录加载；不是 CRX，也不代表 Chrome 商店版本。

插件升级后重新打包，并同步修改页面版本、下载链接。安装包中的原 README 保持原样，其中此前的测试状态描述可能早于用户已确认的京东实测；官网以当前确认的京东提取、预览、PNG 下载结果为准。

## 内容与检查

首页图库是可勾选的 HTML/CSS 示意，耳机为本地 SVG 插画，不是插件截图。图片尺寸为示意值。淘宝和拼多多商家版标为待实测，京东标为已实测，不承诺全部商品页面可用。

本地检查脚本：`python docs/check_site.py`；JavaScript 语法：`node --check docs/js/main.js`；模拟交互测试：`node --test docs/test_interactions.cjs`。检查脚本验证 HTML 层级、资源与锚点、CSS 括号、SVG 解析、ZIP 内容与原文件一致性。交互测试覆盖勾选、全选、反选、菜单和剪贴板降级。浏览器外观、响应式效果和交互需结合实际浏览器确认，静态和模拟检查不能代替浏览器验证。
