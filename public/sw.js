/**
 * 오프라인 실행과 두 번째 진입의 속도를 맡는다. 모델만 4.2MB 라 한 번 받은 것을 다시
 * 받지 않는 것만으로도 체감이 크게 달라진다.
 *
 * 두 가지로만 나눈다.
 *  - 변하지 않는 것(해시 붙은 번들·모델·아이콘): 캐시부터. 내용이 바뀌면 이름이 바뀐다.
 *  - 나머지(주로 index.html): 네트워크부터, 실패하면 캐시. 안 그러면 배포해도 옛 화면이 남는다.
 *
 * 빌드 시점에 파일 목록을 심지 않는다 — 그러려면 플러그인이 하나 더 붙는데, 처음 한 번
 * 온라인으로 열어야 하는 것 말고는 차이가 없다.
 */
const CACHE = 'gambit-v1'
const IMMUTABLE = /\.(glb|gltf|png|jpg|jpeg|webp|woff2?|css)$|-[A-Za-z0-9_-]{8}\.js$/

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

const keep = async (request, response) => {
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
  return response
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return

  if (IMMUTABLE.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit ?? fetch(e.request).then((res) => keep(e.request, res))),
    )
    return
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => keep(e.request, res))
      .catch(() => caches.match(e.request).then((hit) => hit ?? caches.match('./'))),
  )
})
