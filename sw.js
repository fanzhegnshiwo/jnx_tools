const CACHE_PREFIX = 'jnx-tools-';
const CACHE_NAME = 'jnx-tools-v2-74';
const ASSETS = [
  './',
  './index.html',
  './JNC_tools.html',
  './ble_analysis.html',
  './JNA_tools.html',
  './JNA_Plus_Tool.html',
  './JNB_Tool.html',
  './jsqr.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// 安装：缓存应用外壳
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] cache failed', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// 抓取策略：仅当「服务器与本地不一致」时才下载新内容并刷新页面。
// - 有本地缓存：立即返回缓存（秒开、离线可用），后台用 `cache:'no-cache'` 条件请求向服务器校验：
//     · 服务器回 304（ETag/Last-Modified 确认一致）→ 什么都不做，继续用本地；
//     · 服务器回 200 → 与本地缓存做内容比对：一致则忽略；不一致则更新缓存并通知页面自动刷新一次。
// - 无本地缓存（首次访问）：直接走网络并写入缓存。
// 静态托管无需任何服务端代码：绝大多数主机（nginx/Apache/GitHub Pages/CF 等）都支持条件请求；
// 不支持时内容比对兜底，同样能正确判断。
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);

    const revalidate = (async () => {
      const resp = await fetch(event.request, { cache: 'no-cache' }).catch(() => null);
      if (!resp) return null;            // 离线：保持缓存兜底
      if (cached && resp.status === 304) return resp; // 服务器确认一致，不下载内容
      if (resp.status !== 200) return resp;
      // 200：按字节比较，避免 PNG 等二进制文件经文本解码后出现误判。
      if (cached) {
        const newBody = new Uint8Array(await resp.clone().arrayBuffer());
        const oldBody = new Uint8Array(await cached.clone().arrayBuffer());
        if (oldBody.length === newBody.length && oldBody.every((byte, i) => byte === newBody[i])) {
          return resp; // 内容一致，不更新缓存、不提示
        }
        // 内容与本地不一致：写入新内容，并通知页面显示「刷新缓存」按钮（何时刷新由用户决定）
        await cache.put(event.request, resp.clone());
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach((c) => c.postMessage({ type: 'VERSION_UPDATE' }));
      } else {
        // 首次访问无本地缓存：仅写入缓存供离线使用，不提示
        await cache.put(event.request, resp.clone());
      }
      return resp;
    })();

    if (cached) {
      event.waitUntil(revalidate.then(() => { })); // 立即用缓存，后台校验
      return cached;
    }
    return (await revalidate) || cached; // 首次访问：等网络结果（或离线兜底）
  })());
});
