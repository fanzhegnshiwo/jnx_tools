# JNx 工具箱

JNx 系列产品辅助工具集合，数据均在本地处理，不上传任何数据。

## 工具列表

| 工具 | 说明 | 入口 |
| --- | --- | --- |
| BLE 分析 | 通过 Web Bluetooth API 实时连接 BLE 设备，采集并记录 ADC 数据 | [ble_analysis.html](ble_analysis.html) |
| JNA 工具 | 自动连接 JNA 开头的 BLE 设备，并以 1000ms 间隔订阅 FFE1 数据 | [JNA_tools.html](JNA_tools.html) |
| JNA Plus 工具 | JNA-Plus 系列：单通道 26 字节协议（状态/时间/结果/计时/加样/完成/版本号/T1~T6），FFE2 仅保留重启/关机 | [JNA_Plus_Tool.html](JNA_Plus_Tool.html) |
| JNC 工具 | 连接 JNC 开头的 BLE 设备，通过 FFE2 命令轮询 12 通道数据（C/B/T） | [JNC_tools.html](JNC_tools.html) |
| JNB 工具 | JNB 系列：单通道 27 字节协议，连接后自动更新数据并绘制 C/T2/B/T1 实时曲线，可回看本次连接的全部采样；FFE2 支持点灯 T1~T4、重启、关机 | [JNB_Tool.html](JNB_Tool.html) |

## 目录说明

- [index.html](index.html) ：工具箱首页，展示所有工具入口卡片（可扩展）
- [ble_analysis.html](ble_analysis.html) ：BLE 分析工具
- [JNA_tools.html](JNA_tools.html) ：JNA 工具（FFE1 自动订阅）
- [JNA_Plus_Tool.html](JNA_Plus_Tool.html) ：JNA-Plus 工具（26 字节协议，FFE2 仅重启/关机）
- [JNC_tools.html](JNC_tools.html) ：JNC 工具（FFE2 命令轮询）
- [JNB_Tool.html](JNB_Tool.html) ：JNB 工具（27 字节协议，FFE2 点灯/重启/关机）

### 新增工具

在 `index.html` 的 `TOOLS` 数组中添加一个配置对象即可，无需修改其他代码：

```js
{
  id: 'your-tool',
  title: '工具名称',
  icon: '🔧',
  desc: '工具描述',
  href: './your_tool.html',
  accent: '#10b981',
  accentSoft: '#ecfdf5',
  tags: ['标签1', '标签2'],
  enabled: true,
}
```

## GitHub Pages 自动部署

这个仓库已经配置好 GitHub Actions，推送到 main 分支后会自动部署到 GitHub Pages。

### 操作步骤

1. 将这个仓库推送到 GitHub。
2. 打开仓库的 Settings > Pages。
3. 在 Build and deployment 中，选择 Source 为 GitHub Actions。
4. 提交并推送代码后，GitHub 会自动执行工作流。
5. 部署完成后，访问地址类似：
   - https://你的用户名.github.io/你的仓库名/

### 手动触发部署

也可以在 GitHub 仓库页面进入 Actions，选择 Deploy to GitHub Pages 后手动运行。

## 本地预览

如果你想在本地先预览，可以直接双击打开 [index.html](index.html)，或者使用一个简单的静态服务器：

```bash
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

## 回归检查

安装 Node.js 后，在项目目录运行：

```bash
node --test tests/*.test.js
```

检查覆盖 JNB 数据曲线和自动更新状态、JNC 串口分包与连续帧、写入失败后的锁释放，以及 PWA 缓存隔离和二进制更新检测。BLE 与串口的设备时序仍需连接实物验证。

## PWA 安装

本项目已 PWA 化，支持像小程序/桌面应用一样安装：

- 部署到 GitHub Pages 后，浏览器地址栏会出现「安装」图标（Chrome/Edge 桌面端和移动端均支持）。
- 安装后应用以 `standalone` 模式运行，**不再显示浏览器地址栏**，像独立 App 一样留在桌面/手机主屏。
- 首次联网访问后，Service Worker 会缓存页面，后续可离线使用。

**注意**：Service Worker 必须通过 `http://localhost`、`https://` 等安全上下文访问，直接 `file://` 打开或双击 HTML 无法触发安装。本地测试请用上面的 `python -m http.server`。

主要 PWA 文件：

- `manifest.webmanifest`：应用名称、图标、主题色、启动页。
- `sw.js`：缓存应用外壳与页面，离线可用。
- `icon-*.png`：PWA 桌面/手机图标。
