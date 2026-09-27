/* Vega Dipper 서비스 워커 - 껍데기 파일 캐시(인터넷 없이 시작), 폰 알림.
 * 회사 자료 묶음은 여기 두지 않는다 (껍데기가 로그인 뒤 IndexedDB 에 둔다).
 * 4cb97116 는 build.py 가 껍데기 내용의 해시로 바꾼다 - 껍데기가 바뀌면 이 파일도 바뀌어 새 워커가 깔린다 */
var CACHE = "vd-shell-4cb97116";
var FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("vd-shell-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* 같은 곳의 GET 만 : 네트워크 먼저(새 판이 바로 들어오게), 4초 안에 안 오거나 끊기면 캐시 */
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin || u.pathname.indexOf(new URL(self.registration.scope).pathname) !== 0) return;
  var fromCache = function () { return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || (r.mode === "navigate" ? caches.match("./index.html") : null); }); };
  e.respondWith(new Promise(function (ok) {
    var done = false, finish = function (x) { if (!done && x) { done = true; ok(x); } };
    var t = setTimeout(function () { fromCache().then(finish); }, 4000);
    fetch(r).then(function (res) {
      clearTimeout(t);
      if (res && res.ok && res.type === "basic") { var c = res.clone(); caches.open(CACHE).then(function (k) { k.put(r.mode === "navigate" ? "./index.html" : r, c); }); }
      finish(res);
    }, function () {
      clearTimeout(t);
      fromCache().then(function (m) { finish(m || Response.error()); });
    });
  }));
});

/* 알림은 내용 없이 온다 (Apps Script 에 내용 암호화가 없어서). 앱이 결재함을 다시 읽는다 */
self.addEventListener("push", function (e) {
  e.waitUntil(self.registration.showNotification("Vega Dipper", { body: "확인할 것이 있습니다", tag: "vd", renotify: true, icon: "icon-192.png", badge: "icon-192.png" }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) if (ws[i].url.indexOf(self.registration.scope) === 0 && "focus" in ws[i]) return ws[i].focus();
    return self.clients.openWindow("./");
  }));
});
