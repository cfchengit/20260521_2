// ════════════════════════════════════════════════════════
// useAQI.js - 空氣品質資料 Composable
//
// 資料來源：環境部開放資料平台（完全免費，無需申請帳號）
// API：https://data.moenv.gov.tw/api/v2/aqx_p_432
// 更新頻率：每小時更新一次
// ════════════════════════════════════════════════════════

import { ref, computed } from 'vue'

// ── AQI 等級定義 ──────────────────────────────────────
export const AQI_LEVELS = [
  { max: 50,  label: '良好',            en: 'Good',             color: '#22c55e', bg: 'rgba(34,197,94,.15)',   icon: '😊' },
  { max: 100, label: '普通',            en: 'Moderate',         color: '#eab308', bg: 'rgba(234,179,8,.15)',   icon: '😐' },
  { max: 150, label: '對敏感族群不健康', en: 'Unhealthy for SG', color: '#f97316', bg: 'rgba(249,115,22,.15)',  icon: '😷' },
  { max: 200, label: '對所有族群不健康', en: 'Unhealthy',        color: '#ef4444', bg: 'rgba(239,68,68,.15)',   icon: '🤢' },
  { max: 300, label: '非常不健康',      en: 'Very Unhealthy',   color: '#a855f7', bg: 'rgba(168,85,247,.15)',  icon: '🤮' },
  { max: 999, label: '危害',            en: 'Hazardous',        color: '#7f1d1d', bg: 'rgba(127,29,29,.15)',   icon: '💀' },
]

// 依 AQI 數值取得等級資訊
export function getLevel(aqi) {
  const n = parseInt(aqi, 10)
  if (isNaN(n)) return AQI_LEVELS[0]
  return AQI_LEVELS.find(l => n <= l.max) ?? AQI_LEVELS[AQI_LEVELS.length - 1]
}

// ── 主要 Composable ───────────────────────────────────
export function useAQI() {
  const stations  = ref([])
  const isLoading = ref(false)
  const error     = ref(null)
  const lastUpdate = ref('')

  // ── 計算屬性 ──
  // 依 AQI 由高到低排序（最差的在最前面）
  const sortedByAQI = computed(() =>
    [...stations.value].sort((a, b) => b.aqi - a.aqi)
  )

  // 全台平均 AQI
  const avgAQI = computed(() => {
    const valid = stations.value.filter(s => !isNaN(s.aqi) && s.aqi > 0)
    if (!valid.length) return 0
    return Math.round(valid.reduce((sum, s) => sum + s.aqi, 0) / valid.length)
  })

  // 各等級站點統計
  const levelStats = computed(() => {
    const stats = {}
    AQI_LEVELS.forEach(l => { stats[l.label] = 0 })
    stations.value.forEach(s => { stats[s.level.label]++ })
    return stats
  })

  // 最差站點
  const worstStation = computed(() => sortedByAQI.value[0] ?? null)

  // ── 從環保署 API 載入資料 ──────────────────────────
  async function load() {
    isLoading.value = true
    error.value     = null

    try {
      // 改為抓取本地端的 Preview_Data.csv 檔案
      const res = await fetch('Preview_Data.csv')

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const text = await res.text()
      // 移除可能存在的 BOM (Byte Order Mark) 並以換行符號切割
      const cleanText = text.replace(/^\uFEFF/, '')
      const lines = cleanText.trim().split(/\r?\n/)
      
      if (lines.length < 2) throw new Error('CSV 檔案為空或格式錯誤')
      
      // 取出標題列並全部轉小寫，確保相容後續欄位讀取
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())
      
      const records = lines.slice(1).map(line => {
        const values = line.split(',')
        const obj = {}
        headers.forEach((header, i) => {
          obj[header] = (values[i] || '').replace(/^"|"$/g, '').trim()
        })
        return obj
      })

      // 整理資料，過濾無座標的站點（注意：新版 API 欄位已改為全小寫）
      stations.value = records
        .filter(r => r.latitude && r.longitude && parseFloat(r.latitude) > 0)
        .map(r => ({
          id:       r.siteid,
          name:     r.sitename,
          county:   r.county,
          aqi:      parseInt(r.aqi, 10) || 0,
          status:   r.status,
          pollutant: r.pollutant || '—',   // 主要污染物
          pm25:     parseFloat(r['pm2.5'])    || 0,
          pm10:     parseFloat(r.pm10)        || 0,
          pm25avg:  parseFloat(r['pm2.5_avg'])|| 0,
          pm10avg:  parseFloat(r.pm10_avg)    || 0,
          o3:       parseFloat(r.o3)          || 0,
          no2:      parseFloat(r.no2)         || 0,
          so2:      parseFloat(r.so2)         || 0,
          co:       parseFloat(r.co)          || 0,
          windSpeed:parseFloat(r.wind_speed)  || 0,
          windDir:  r.wind_direc || '—',
          time:     r.publishtime,
          lat:      parseFloat(r.latitude),
          lng:      parseFloat(r.longitude),
          level:    getLevel(r.aqi)            // 對應 AQI 等級物件
        }))

      lastUpdate.value = new Date().toLocaleTimeString('zh-TW')

    } catch (err) {
      error.value = `資料載入失敗：${err.message}`
      console.error('[useAQI]', err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    stations,
    isLoading,
    error,
    lastUpdate,
    sortedByAQI,
    avgAQI,
    levelStats,
    worstStation,
    load
  }
}
