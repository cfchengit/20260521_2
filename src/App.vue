<template>
  <div id="app-root">

    <!-- ══ 頂部標題列 ══ -->
    <header class="header">
      <div class="header-left">
        <span class="header-icon">💨</span>
        <div>
          <div class="header-title">台灣空氣品質即時地圖</div>
          <div class="header-sub">
            資料來源：
            <a href="https://data.moenv.gov.tw" target="_blank">環境部開放資料平台</a>
            ・完全免費・無需申請帳號
          </div>
        </div>
      </div>
      <div class="header-right">
        <span class="update-time" v-if="lastUpdate">🕐 {{ lastUpdate }}</span>
        <button class="refresh-btn" @click="load" :disabled="isLoading">
          <span :class="{ spin: isLoading }">🔄</span>
          {{ isLoading ? '更新中...' : '重新整理' }}
        </button>
      </div>
    </header>

    <!-- ══ AQI 等級說明列 ══ -->
    <div class="legend-bar">
      <div
        v-for="lv in AQI_LEVELS" :key="lv.label"
        class="legend-item"
        :class="{ active: filterLevel === lv.label }"
        :style="{ borderColor: filterLevel === lv.label ? lv.color : 'transparent' }"
        @click="toggleFilter(lv.label)"
      >
        <div class="legend-dot" :style="{ background: lv.color }"></div>
        <span class="legend-label">{{ lv.icon }} {{ lv.label }}</span>
        <span class="legend-count" :style="{ color: lv.color }">
          {{ levelStats[lv.label] ?? 0 }}
        </span>
      </div>
    </div>

    <!-- ══ 主版面：左側面板 + 右側地圖 ══ -->
    <div class="main-layout">

      <!-- 左側面板 -->
      <aside class="sidebar">

        <!-- 搜尋欄 -->
        <div class="search-wrap">
          <input
            class="search-input"
            v-model="searchQuery"
            placeholder="🔍 搜尋測站名稱或縣市..."
          />
        </div>

        <!-- 狀態訊息 -->
        <div v-if="isLoading" class="status loading">📡 正在從環境部載入空氣品質資料...</div>
        <div v-else-if="error" class="status error">❌ {{ error }}</div>
        <div v-else-if="stations.length > 0" class="status success">
          ✅ 共 {{ filteredStations.length }} 個測站・全台平均 AQI：
          <strong :style="{ color: avgLevel.color }">{{ avgAQI }}</strong>
        </div>

        <!-- 統計卡片 -->
        <div class="stats-row" v-if="stations.length > 0">
          <div class="stat-card">
            <div class="stat-num" :style="{ color: avgLevel.color }">{{ avgAQI }}</div>
            <div class="stat-label">全台平均 AQI</div>
          </div>
          <div class="stat-card" v-if="worstStation">
            <div class="stat-num" :style="{ color: worstStation.level.color }">
              {{ worstStation.aqi }}
            </div>
            <div class="stat-label">最高（{{ worstStation.name }}）</div>
          </div>
          <div class="stat-card">
            <div class="stat-num" style="color:#22c55e">
              {{ levelStats['良好'] ?? 0 }}
            </div>
            <div class="stat-label">良好站點數</div>
          </div>
        </div>

        <!-- 測站列表 -->
        <div class="station-list">
          <div
            v-for="s in filteredStations"
            :key="s.id"
            class="station-card"
            :class="{ selected: selectedId === s.id }"
            :style="{
              borderLeft: `4px solid ${s.level.color}`,
              background: selectedId === s.id ? s.level.bg : ''
            }"
            @click="selectStation(s)"
          >
            <!-- 測站名稱 + AQI 數值 -->
            <div class="station-top">
              <div class="station-info">
                <span class="station-name">{{ s.name }}</span>
                <span class="station-county">{{ s.county }}</span>
              </div>
              <div class="aqi-badge" :style="{ background: s.level.bg, color: s.level.color }">
                <span class="aqi-icon">{{ s.level.icon }}</span>
                <span class="aqi-num">{{ s.aqi }}</span>
              </div>
            </div>

            <!-- AQI 等級標籤 -->
            <div class="level-label" :style="{ color: s.level.color }">
              {{ s.level.label }}
              <span v-if="s.pollutant !== '—'" class="pollutant">・主要污染物：{{ s.pollutant }}</span>
            </div>

            <!-- AQI 進度條 -->
            <div class="aqi-bar">
              <div
                class="aqi-fill"
                :style="{
                  width: Math.min(s.aqi / 300 * 100, 100) + '%',
                  background: s.level.color
                }"
              ></div>
            </div>

            <!-- 污染物數值（展開時顯示）-->
            <div class="pollutants" v-if="selectedId === s.id">
              <div class="poll-item">
                <span class="poll-label">PM2.5</span>
                <span class="poll-val">{{ s.pm25 }} μg/m³</span>
              </div>
              <div class="poll-item">
                <span class="poll-label">PM10</span>
                <span class="poll-val">{{ s.pm10 }} μg/m³</span>
              </div>
              <div class="poll-item">
                <span class="poll-label">O₃</span>
                <span class="poll-val">{{ s.o3 }} ppb</span>
              </div>
              <div class="poll-item">
                <span class="poll-label">NO₂</span>
                <span class="poll-val">{{ s.no2 }} ppb</span>
              </div>
              <div class="poll-item">
                <span class="poll-label">SO₂</span>
                <span class="poll-val">{{ s.so2 }} ppb</span>
              </div>
              <div class="poll-item">
                <span class="poll-label">CO</span>
                <span class="poll-val">{{ s.co }} ppm</span>
              </div>
              <div class="poll-item">
                <span class="poll-label">風速</span>
                <span class="poll-val">{{ s.windSpeed }} m/s {{ s.windDir }}</span>
              </div>
              <div class="poll-time">🕐 {{ s.time }}</div>
            </div>
          </div>

          <div class="empty" v-if="!isLoading && filteredStations.length === 0">
            😢 找不到符合的測站
          </div>
        </div>
      </aside>

      <!-- 右側地圖 -->
      <div ref="mapEl" class="map-area"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import { useAQI, AQI_LEVELS, getLevel } from './composables/useAQI'

// ── Composable 解構 ──
const {
  stations, isLoading, error, lastUpdate,
  sortedByAQI, avgAQI, levelStats, worstStation, load
} = useAQI()

// ── 本地狀態 ──
const mapEl      = ref(null)       // 地圖 DOM 元素
const searchQuery = ref('')
const filterLevel = ref('')        // 篩選的 AQI 等級
const selectedId  = ref(null)

let map     = null
let markers = {}                   // id → Leaflet marker

// ── 全台平均 AQI 對應的等級 ──
const avgLevel = computed(() => getLevel(avgAQI.value))

// ── 篩選後的測站列表 ──
const filteredStations = computed(() => {
  let list = sortedByAQI.value    // 依 AQI 高到低排列

  // 搜尋過濾
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.county.toLowerCase().includes(q)
    )
  }

  // 等級過濾（點擊圖例時）
  if (filterLevel.value) {
    list = list.filter(s => s.level.label === filterLevel.value)
  }

  return list
})

// ── 初始化地圖 ──
function initMap() {
  map = L.map(mapEl.value, {
    center: [23.8, 121.0],    // 台灣中心
    zoom: 8,
    zoomControl: true
  })

  // OpenStreetMap 圖層（完全免費）
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(map)
}

// ── 在地圖上渲染 AQI 測站 ──
function renderMarkers() {
  // 清除舊標記
  Object.values(markers).forEach(m => map.removeLayer(m))
  markers = {}

  stations.value.forEach(s => {
    if (!s.lat || !s.lng) return

    // 自訂圓形標記，顏色和數字代表 AQI
    const icon = L.divIcon({
      className: '',
      html: `
        <div style="
          width: 38px; height: 38px;
          border-radius: 50%;
          background: ${s.level.color};
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          font-family: sans-serif;
          cursor: pointer;
        ">${s.aqi}</div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    })

    const marker = L.marker([s.lat, s.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <div style="min-width:200px;line-height:1.7">
          <div style="font-size:1rem;font-weight:700;margin-bottom:6px">
            ${s.level.icon} ${s.name}
            <small style="color:#94a3b8;font-weight:400">（${s.county}）</small>
          </div>
          <div style="font-size:1.5rem;font-weight:700;color:${s.level.color};margin-bottom:4px">
            AQI ${s.aqi}
            <span style="font-size:0.85rem">${s.level.label}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:0.82rem;color:#94a3b8">
            <span>PM2.5：<strong style="color:#e2e8f0">${s.pm25}</strong></span>
            <span>PM10：<strong style="color:#e2e8f0">${s.pm10}</strong></span>
            <span>O₃：<strong style="color:#e2e8f0">${s.o3}</strong></span>
            <span>NO₂：<strong style="color:#e2e8f0">${s.no2}</strong></span>
          </div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:8px">🕐 ${s.time}</div>
        </div>
      `, { maxWidth: 240 })

    marker.on('click', () => {
      selectedId.value = s.id
    })

    markers[s.id] = marker
  })
}

// ── 點選列表，地圖飛到該測站 ──
function selectStation(s) {
  selectedId.value = s.id
  map.setView([s.lat, s.lng], 12, { animate: true })
  markers[s.id]?.openPopup()
}

// ── 切換等級篩選 ──
function toggleFilter(label) {
  filterLevel.value = filterLevel.value === label ? '' : label
}

// ── 監聽資料更新，重新渲染地圖 ──
watch(stations, () => {
  if (map) renderMarkers()
})

// ── 初始化 ──
onMounted(() => {
  initMap()
  load()
  // 每 60 分鐘自動更新（配合環境部更新頻率）
  const timer = setInterval(load, 60 * 60 * 1000)
  onUnmounted(() => {
    clearInterval(timer)
    map?.remove()
  })
})
</script>

<style scoped>
#app-root { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* ══ 頂部標題 ══ */
.header {
  background: #1e293b;
  border-bottom: 1px solid #334155;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  gap: 12px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-icon { font-size: 1.8rem; }
.header-title { font-size: 1.05rem; font-weight: 700; color: #f1f5f9; }
.header-sub { font-size: 0.7rem; color: #64748b; margin-top: 2px; }
.header-sub a { color: #3b82f6; text-decoration: none; }
.header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.update-time { font-size: 0.72rem; color: #475569; }
.refresh-btn {
  background: rgba(59,130,246,.15); border: 1px solid rgba(59,130,246,.3);
  border-radius: 8px; padding: 7px 14px; color: #93c5fd;
  font-size: 0.8rem; font-family: 'Noto Sans TC', sans-serif;
  display: flex; align-items: center; gap: 6px; transition: all 0.2s;
}
.refresh-btn:hover:not(:disabled) { background: rgba(59,130,246,.25); }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ══ AQI 等級說明列 ══ */
.legend-bar {
  display: flex;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  padding: 6px 16px;
  gap: 4px;
  overflow-x: auto;
  flex-shrink: 0;
}
.legend-bar::-webkit-scrollbar { display: none; }
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 20px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}
.legend-item:hover { background: rgba(255,255,255,.05); }
.legend-item.active { background: rgba(255,255,255,.08); }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-label { font-size: 0.72rem; color: #94a3b8; }
.legend-count { font-size: 0.7rem; font-weight: 700; }

/* ══ 主版面 ══ */
.main-layout { display: flex; flex: 1; overflow: hidden; }

/* ══ 左側面板 ══ */
.sidebar {
  width: 340px;
  flex-shrink: 0;
  background: #1e293b;
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-wrap { padding: 10px 14px; flex-shrink: 0; }
.search-input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 9px 12px;
  color: #e2e8f0;
  font-size: 0.85rem;
  font-family: 'Noto Sans TC', sans-serif;
  transition: border-color 0.2s;
}
.search-input:focus { outline: none; border-color: #3b82f6; }
.search-input::placeholder { color: #475569; }

/* 狀態訊息 */
.status {
  margin: 0 14px 8px;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.78rem;
  flex-shrink: 0;
}
.loading { background: rgba(59,130,246,.08); border: 1px solid #3b82f6; color: #93c5fd; }
.success { background: rgba(34,197,94,.08);  border: 1px solid #22c55e; color: #86efac; }
.error   { background: rgba(239,68,68,.08);  border: 1px solid #ef4444; color: #f87171; }

/* 統計卡片 */
.stats-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; padding: 0 14px 8px; flex-shrink: 0; }
.stat-card { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px; text-align: center; }
.stat-num  { font-size: 1.3rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: 0.62rem; color: #64748b; margin-top: 4px; }

/* 測站列表 */
.station-list { flex: 1; overflow-y: auto; padding: 0 14px 12px; display: flex; flex-direction: column; gap: 7px; }

.station-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 11px 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.station-card:hover { border-color: #475569; }
.station-card.selected { border-color: #3b82f6 !important; }

.station-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; gap: 8px; }
.station-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.station-name { font-size: 0.88rem; font-weight: 600; color: #e2e8f0; }
.station-county { font-size: 0.7rem; color: #64748b; }

.aqi-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  flex-shrink: 0;
}
.aqi-icon { font-size: 0.9rem; }
.aqi-num  { font-size: 1rem; font-weight: 700; }

.level-label { font-size: 0.72rem; margin-bottom: 6px; }
.pollutant   { color: #94a3b8; }

.aqi-bar  { height: 4px; background: #1e293b; border-radius: 4px; overflow: hidden; margin-bottom: 0; }
.aqi-fill { height: 100%; border-radius: 4px; transition: width 0.8s ease; }

/* 展開的污染物詳細資訊 */
.pollutants {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #1e293b;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}
.poll-item { display: flex; justify-content: space-between; font-size: 0.75rem; padding: 3px 0; }
.poll-label { color: #64748b; }
.poll-val   { color: #94a3b8; font-weight: 500; }
.poll-time  { grid-column: 1 / -1; font-size: 0.68rem; color: #475569; margin-top: 4px; }

.empty { text-align: center; color: #64748b; padding: 40px 0; font-size: 0.9rem; }

/* ══ 地圖 ══ */
.map-area { flex: 1; }

/* ══ 動畫 ══ */
@keyframes spin { to { transform: rotate(360deg); } }
.spin { display: inline-block; animation: spin 0.8s linear infinite; }

/* ══ 響應式 ══ */
@media (max-width: 768px) {
  .main-layout { flex-direction: column; }
  .sidebar { width: 100%; max-height: 50vh; border-right: none; border-bottom: 1px solid #334155; }
  .header-right .update-time { display: none; }
  .legend-label { display: none; }   /* 手機只顯示圓點和數字 */
}
</style>
