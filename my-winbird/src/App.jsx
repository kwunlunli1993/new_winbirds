// @ts-nocheck
import { useState, useEffect, useRef } from 'react'

document.documentElement.style.colorScheme = 'light'
document.body.style.background = '#ffffff'
document.body.style.color = '#000000'

const DEFAULT_TAGS = [
  "A類馬", "B類馬", "C類馬", "D類馬", "E類馬",
  "鬼鼠馬", "賺住贏", "欣欣杯",
  "指數哥", "隔夜哥", "孖寶哥", "三橙俠", "古惑飛",
  "近3指數90", "近3跌30"
]

const PERIODS = [
  { id: '2526', label: '2025-2026馬季' },
  { id: '2509now', label: '2025年9月至今' },
  { id: '2609now', label: '2026年9月至今' },
]

const PLACE_COLORS = {
  1: '#EEBABA',
  2: '#FFFF9F',
  3: '#BAE8A4',
  4: '#A8CADA',
}

const PLACE_SCORE = {
  1: 12,
  2: 6,
  3: 4,
}

const API_BASE = 'https://new-winbirds.onrender.com'

// Fallback 如果 race-dates 空
const FALLBACK_DATES = [
  "2026-10-26",
  "2026-10-21",
  "2026-10-18",
  "2026-10-14",
  "2026-10-11",
]

function App() {
  const [currentDate, setCurrentDate] = useState("")
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [raceDates, setRaceDates] = useState([])
  const [datesLoading, setDatesLoading] = useState(true)
  const [datesError, setDatesError] = useState("")
  const [rates, setRates] = useState(null)
  const [sortBy, setSortBy] = useState("winRate")
  const [sortDesc, setSortDesc] = useState(true)
  const [allCombos, setAllCombos] = useState(null)
  const [comboLoading, setComboLoading] = useState(false)
  const [comboSortBy, setComboSortBy] = useState("winRate")
  const [comboSortDesc, setComboSortDesc] = useState(true)
  const [shownTagsSingle, setShownTagsSingle] = useState(new Set(DEFAULT_TAGS))
  const [shownTagsCombo, setShownTagsCombo] = useState(new Set(DEFAULT_TAGS))
  const [comboPeriod, setComboPeriod] = useState('2509now')
  const [tagSortMode, setTagSortMode] = useState("default")
  const [hideEmptySingle, setHideEmptySingle] = useState(false)
  const [hideEmptyCombo, setHideEmptyCombo] = useState(false)

  const [collapsed, setCollapsed] = useState({
    main: false,
    count: false,
    follow: false,
    rank: false,
    single: false,
    combo: false,
    weight: false,
    bets: false,
  })

  const topTableRef = useRef(null)
  const singleTableRef = useRef(null)
  const comboTableRef = useRef(null)
  const countTableRef = useRef(null)

  useEffect(() => {
    document.body.style.margin = '0'
    document.body.style.padding = '0'

    setDatesLoading(true)
    setDatesError("")
    fetch(`${API_BASE}/api/race-dates`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(json => {
        let dates = json.dates || []
        if (dates.length === 0) {
          dates = FALLBACK_DATES
          setDatesError("伺服器冇返回日期，已用備用日期")
        }
        setRaceDates(dates)
        if (dates.length > 0) setCurrentDate(dates[0])
      })
      .catch(err => {
        console.error(err)
        setDatesError("載入日期失敗，已用備用日期")
        setRaceDates(FALLBACK_DATES)
        setCurrentDate(FALLBACK_DATES[0])
      })
      .finally(() => setDatesLoading(false))
  }, [])

  useEffect(() => {
    if (!currentDate) return
    let cancelled = false
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const watchResults = currentDate >= todayStr

    const loadDay = (first) => {
      if (first) setLoading(true)
      fetch(`${API_BASE}/api/day-tags?date=${currentDate}`)
        .then(r => r.json())
        .then(json => { if (!cancelled) setData(json) })
        .catch(() => { if (first && !cancelled) setData(null) })
        .finally(() => { if (first && !cancelled) setLoading(false) })
    }

    loadDay(true)
    if (!watchResults) return () => { cancelled = true }
    const timer = setInterval(() => loadDay(false), 20000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [currentDate])

  useEffect(() => {
    loadRates('2509now')
    loadAllCombos('2509now')
  }, [])

  const enableDragScroll = (ref) => {
    const el = ref.current
    if (!el) return
    let isDown = false
    let startX
    let scrollLeft

    const onMouseDown = (e) => {
      isDown = true
      el.style.cursor = 'grabbing'
      startX = e.pageX - el.offsetLeft
      scrollLeft = el.scrollLeft
    }
    const onMouseLeave = () => { isDown = false; el.style.cursor = 'grab' }
    const onMouseUp = () => { isDown = false; el.style.cursor = 'grab' }
    const onMouseMove = (e) => {
      if (!isDown) return
      e.preventDefault()
      const x = e.pageX - el.offsetLeft
      const walk = (x - startX) * 1.5
      el.scrollLeft = scrollLeft - walk
    }

    el.style.cursor = 'grab'
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mouseleave', onMouseLeave)
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mousemove', onMouseMove)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mouseleave', onMouseLeave)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mousemove', onMouseMove)
    }
  }

  useEffect(() => { return enableDragScroll(topTableRef) }, [data, collapsed.main])
  useEffect(() => { return enableDragScroll(singleTableRef) }, [rates, data, collapsed.single])
  useEffect(() => { return enableDragScroll(comboTableRef) }, [allCombos, data, collapsed.combo])
  useEffect(() => { return enableDragScroll(countTableRef) }, [data, collapsed.count])

  const toggleCollapse = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const loadRates = (period) => {
    fetch(`${API_BASE}/api/tag-rates?period=${period}`)
      .then(r => r.json())
      .then(json => setRates(json))
      .catch(() => setRates(null))
  }

  const loadAllCombos = (period) => {
    setComboPeriod(period)
    setComboLoading(true)
    fetch(`${API_BASE}/api/all-combo-rates?period=${period}`)
      .then(r => r.json())
      .then(json => setAllCombos(json))
      .catch(() => setAllCombos(null))
      .finally(() => setComboLoading(false))
  }

  const toggleShownSingle = (tag) => {
    setShownTagsSingle(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const toggleShownCombo = (tag) => {
    setShownTagsCombo(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const selectAllSingle = () => setShownTagsSingle(new Set(DEFAULT_TAGS))
  const deselectAllSingle = () => setShownTagsSingle(new Set())
  const selectAllCombo = () => setShownTagsCombo(new Set(DEFAULT_TAGS))
  const deselectAllCombo = () => setShownTagsCombo(new Set())

  const handleSort = (field) => {
    if (sortBy === field) setSortDesc(!sortDesc)
    else { setSortBy(field); setSortDesc(true) }
  }

  const handleComboSort = (field) => {
    if (comboSortBy === field) setComboSortDesc(!comboSortDesc)
    else { setComboSortBy(field); setComboSortDesc(true) }
  }

  const getSortedStats = () => {
    if (!rates || !rates.stats) return []
    const entries = Object.entries(rates.stats).filter(([tag]) => shownTagsSingle.has(tag))
    return entries.sort((a, b) => {
      const valA = a[1][sortBy] || 0
      const valB = b[1][sortBy] || 0
      return sortDesc ? valB - valA : valA - valB
    })
  }

  const getWeightRows = () => {
    if (!rates || !rates.stats) return []
    const base = rates.baseline?.top3Rate ?? 26.9
    return Object.entries(rates.stats).map(([tag, s]) => {
      const n = s.total || 0
      const gap = Math.round(((s.top3Rate || 0) - base) * 10) / 10
      const weight = Math.round(gap * n / (n + 100) * 10) / 10
      return { tag, n, top3Rate: s.top3Rate || 0, gap, weight }
    }).sort((a, b) => b.weight - a.weight || b.n - a.n)
  }

  const getSortedCombos = () => {
    if (!allCombos || !allCombos.combos) return []
    let filtered = allCombos.combos.filter(c => 
      shownTagsCombo.has(c.tag1) && shownTagsCombo.has(c.tag2)
    )
    return filtered.sort((a, b) => {
      const valA = a[comboSortBy] || 0
      const valB = b[comboSortBy] || 0
      return comboSortDesc ? valB - valA : valA - valB
    })
  }

  const getSortedTagsForCheckboxes = () => {
    if (!rates || !rates.stats) return DEFAULT_TAGS
    const entries = Object.entries(rates.stats)
    return entries.sort((a, b) => {
      const valA = a[1][sortBy] || 0
      const valB = b[1][sortBy] || 0
      return sortDesc ? valB - valA : valA - valB
    }).map(([tag]) => tag)
  }

  const getTagScores = () => {
    if (!data || !data.races) return {}
    const scores = {}
    DEFAULT_TAGS.forEach(tag => scores[tag] = 0)
    data.races.forEach(race => {
      DEFAULT_TAGS.forEach(tag => {
        const horses = race.tags[tag] || []
        horses.forEach(h => {
          const score = PLACE_SCORE[h.place] || 0
          scores[tag] += score
        })
      })
    })
    return scores
  }

  const getTagPlaceCounts = () => {
    const counts = {}
    DEFAULT_TAGS.forEach(tag => { counts[tag] = { 1: 0, 2: 0, 3: 0, 4: 0 } })
    if (!data || !data.races) return counts
    data.races.forEach(race => {
      DEFAULT_TAGS.forEach(tag => {
        const horses = race.tags[tag] || []
        horses.forEach(h => {
          const place = Number(h.place) || 0
          if (place >= 1 && place <= 4) counts[tag][place] += 1
        })
      })
    })
    return counts
  }

  const getDisplayTags = () => {
    if (tagSortMode === "score") {
      const scores = getTagScores()
      return [...DEFAULT_TAGS].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
    }
    if (tagSortMode === "win") {
      const counts = getTagPlaceCounts()
      return [...DEFAULT_TAGS].sort((a, b) => {
        const ca = counts[a]
        const cb = counts[b]
        for (const place of [1, 2, 3, 4]) {
          if (cb[place] !== ca[place]) return cb[place] - ca[place]
        }
        return 0
      })
    }
    return DEFAULT_TAGS
  }

  const renderHorses = (horses) => {
    if (!horses || horses.length === 0) return <span style={{ display: 'block', lineHeight: '36px' }}>-</span>
    const perLine = 4
    const lines = []
    for (let i = 0; i < horses.length; i += perLine) {
      lines.push(horses.slice(i, i + perLine))
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', justifyContent: 'center', minHeight: 36 }}>
        {lines.map((line, lineIdx) => (
          <div key={lineIdx} style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
            {line.map((h, i) => (
              <span key={i} style={{
                background: PLACE_COLORS[h.place] || 'transparent',
                padding: '1px 3px',
                borderRadius: 2,
                fontSize: 15,
                fontWeight: 600,
                minWidth: 16,
                textAlign: 'center',
                display: 'inline-block',
                lineHeight: '1.1',
                color: '#000000'
              }}>
                {h.no}
              </span>
            ))}
          </div>
        ))}
      </div>
    )
  }

  const getRaceTagHorses = (race, tag) => {
    if (!race || !race.tags || !race.tags[tag]) return []
    return race.tags[tag]
  }

  const getRaceComboHorses = (race, tag1, tag2) => {
    if (!race || !race.tags) return []
    const horses1 = race.tags[tag1] || []
    const horses2 = race.tags[tag2] || []
    const set2 = new Set(horses2.map(h => h.no))
    return horses1.filter(h => set2.has(h.no))
  }

  const getPlaceMap = (race) => {
    const map = {}
    if (!race || !race.tags) return map
    Object.values(race.tags).forEach(horses => {
      horses.forEach(h => {
        if (h.place) map[h.no] = h.place
      })
    })
    return map
  }

  const get1TagCounts = (race) => {
    if (!race || !race.tags) return []
    const countMap = {}
    DEFAULT_TAGS.forEach(tag => {
      if (!shownTagsSingle.has(tag)) return
      (race.tags[tag] || []).forEach(h => {
        countMap[h.no] = (countMap[h.no] || 0) + 1
      })
    })
    return Object.entries(countMap)
      .map(([no, count]) => ({ no: parseInt(no), count }))
      .sort((a, b) => b.count - a.count || a.no - b.no)
  }

  const get2TagCounts = (race) => {
    if (!race || !race.tags || !allCombos || !allCombos.combos) return []
    const countMap = {}
    allCombos.combos.forEach(c => {
      if (!shownTagsCombo.has(c.tag1) || !shownTagsCombo.has(c.tag2)) return
      const horses = getRaceComboHorses(race, c.tag1, c.tag2)
      horses.forEach(h => {
        countMap[h.no] = (countMap[h.no] || 0) + 1
      })
    })
    return Object.entries(countMap)
      .map(([no, count]) => ({ no: parseInt(no), count }))
      .sort((a, b) => b.count - a.count || a.no - b.no)
  }

  const getRaceWeights = (race) => {
    if (!race || !race.tags || !rates || !rates.stats) return []
    const weights = {}
    getWeightRows().forEach(row => { weights[row.tag] = row.weight })
    const horseTags = {}
    Object.entries(race.tags).forEach(([tag, horses]) => {
      if (weights[tag] == null) return
      ;(horses || []).forEach(h => {
        if (!h || !h.no) return
        if (!horseTags[h.no]) horseTags[h.no] = new Set()
        horseTags[h.no].add(tag)
      })
    })
    return Object.entries(horseTags)
      .map(([no, tags]) => {
        let total = 0
        tags.forEach(tag => { total += weights[tag] || 0 })
        const rounded = Math.round(total * 10) / 10
        const label = (rounded > 0 ? '+' : '') + rounded.toFixed(1)
        return { no: parseInt(no), count: label, value: rounded, tags: [...tags] }
      })
      .sort((a, b) => b.value - a.value || a.no - b.no)
  }

  const judgeScore = (horse) => {
    if (!horse) return 0
    const tags = new Set(horse.tags || [])
    const n = tags.size
    let score = horse.value || 0
    if (tags.has('B類馬')) score -= 3
    if (tags.has('D類馬')) score -= 3
    if (n >= 10) score -= 4
    if (tags.has('古惑飛') && n >= 5 && n <= 7 && !tags.has('B類馬') && !tags.has('D類馬')) score += 2
    return Math.round(score * 10) / 10
  }

  const adviseHorse = (top, second) => {
    if (!top) return { label: '—', tone: '#fff', gap: null, n: 0, notes: [] }
    const gap = second ? Math.round(((top.score ?? top.value) - (second.score ?? second.value)) * 10) / 10 : null
    const tags = new Set(top.tags || [])
    const n = tags.size
    const hasG = tags.has('古惑飛')
    const hasZ = tags.has('指數哥')
    const hasB = tags.has('B類馬')
    const hasD = tags.has('D類馬')
    const notes = []
    if (hasG) notes.push('古惑飛')
    if (hasZ) notes.push('指數哥')
    if (tags.has('E類馬')) notes.push('E')
    if (hasB) notes.push('B')
    if (hasD) notes.push('D')
    let label = '一般'
    let tone = '#ffffff'
    if (hasG && gap != null && gap >= 5 && gap < 8 && n >= 5 && n <= 7 && !hasB && !hasD) {
      label = '優先'
      tone = '#c8efd4'
    } else if (gap != null && gap >= 12) {
      label = '唔好追'
      tone = '#f6d5d5'
    } else if ((hasB || hasD) && !hasG) {
      label = '有B/D'
      tone = '#f6d5d5'
    } else if ((hasG || hasZ) && gap != null && gap < 12 && n <= 9 && !hasD) {
      label = '可看'
      tone = '#fff3c4'
    } else if (n >= 10) {
      label = 'tag太多'
      tone = '#f6d5d5'
    }
    return { label, tone, gap, n, notes }
  }

  const judgeRace = (race) => {
    const ranked = getRaceWeights(race)
      .map(h => ({ ...h, score: judgeScore(h) }))
      .sort((a, b) => b.score - a.score || b.value - a.value || a.no - b.no)
    const top = ranked[0]
    const second = ranked[1]
    return { ranked, top, second, advice: adviseHorse(top, second) }
  }

  const pickTicket = (ranked) => {
    const top6 = (ranked || []).slice(0, 6)
    const clean = top6.filter(h => {
      const tags = new Set(h.tags || [])
      return !tags.has('B類馬') && !tags.has('D類馬')
    })
    if (top6.length > 0 && clean.length === 0) {
      return { banker: null, legs: [], skipped: true }
    }
    const banker = clean[0] || null
    const legs = top6.filter(h => banker && h.no !== banker.no)
    return { banker, legs, skipped: false }
  }

  const renderCountList = (items, race, wide) => {
    if (!items || items.length === 0) return <span style={{ color: '#999' }}>-</span>
    const placeMap = getPlaceMap(race)
    const perLine = wide ? 2 : 4
    const lines = []
    for (let i = 0; i < items.length; i += perLine) {
      lines.push(items.slice(i, i + perLine))
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
        {lines.map((line, lineIdx) => (
          <div key={lineIdx} style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            {line.map((item, i) => {
              const place = placeMap[item.no]
              return (
                <span key={i} style={{
                  background: PLACE_COLORS[place] || 'transparent',
                  padding: '1px 4px',
                  borderRadius: 2,
                  fontSize: 13,
                  fontWeight: 600,
                  minWidth: wide ? 78 : 42,
                  textAlign: 'center',
                  display: 'inline-block',
                  lineHeight: '1.2',
                  color: '#000000',
                  whiteSpace: 'nowrap'
                }}>
                  {item.no}({item.count})
                </span>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const hasAnyHorseToday = (tag) => {
    if (!data || !data.races) return false
    return data.races.some(race => (race.tags[tag] || []).length > 0)
  }

  const hasAnyComboHorseToday = (tag1, tag2) => {
    if (!data || !data.races) return false
    return data.races.some(race => getRaceComboHorses(race, tag1, tag2).length > 0)
  }

  const idx = raceDates.indexOf(currentDate)
  const goPrev = () => {
    if (idx < raceDates.length - 1) setCurrentDate(raceDates[idx + 1])
  }
  const goNext = () => {
    if (idx > 0) setCurrentDate(raceDates[idx - 1])
  }

  const displayTags = getDisplayTags()
  const tagScores = getTagScores()
  const tagPlaceCounts = getTagPlaceCounts()
  const races = data?.races || []
  const sortedTagsForCheckboxes = getSortedTagsForCheckboxes()

  const filteredStats = getSortedStats().filter(([tag]) => !hideEmptySingle || hasAnyHorseToday(tag))
  const filteredCombos = getSortedCombos().filter(c => !hideEmptyCombo || hasAnyComboHorseToday(c.tag1, c.tag2))

  const CollapseBtn = ({ id }) => (
    <button
      onClick={() => toggleCollapse(id)}
      style={{
        position: 'absolute',
        top: 4,
        left: 4,
        fontSize: 12,
        padding: '2px 8px',
        cursor: 'pointer',
        zIndex: 10,
        background: '#fff',
        border: '1px solid #999',
        borderRadius: 3,
      }}
    >
      {collapsed[id] ? '展開' : '最小化'}
    </button>
  )

  return (
    <div style={{ padding: '12px 0', fontFamily: 'sans-serif', width: '100%', boxSizing: 'border-box', background: '#ffffff', color: '#000000', minHeight: '100vh' }}>
      <div style={{
        position: 'sticky',
        top: 0,
        background: '#ffffff',
        zIndex: 200,
        padding: '8px 12px',
        borderBottom: '1px solid #ccc',
        marginBottom: 8
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#000000' }}>楊超越！！</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={goPrev} disabled={idx >= raceDates.length - 1 || datesLoading}>上一日</button>
            <select 
              value={currentDate} 
              onChange={(e) => setCurrentDate(e.target.value)}
              disabled={datesLoading}
              style={{ margin: '0 8px', fontSize: 16, minWidth: 140 }}
            >
              {raceDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button onClick={goNext} disabled={idx <= 0 || datesLoading}>下一日</button>
          </div>
        </div>
        {datesLoading && <div style={{ textAlign: 'center', fontSize: 13, color: '#666' }}>載入日期中...</div>}
        {datesError && <div style={{ textAlign: 'center', fontSize: 13, color: '#c00' }}>{datesError}</div>}
      </div>

      {loading && <p style={{ textAlign: 'center' }}>載入中...</p>}

      <div style={{ position: 'relative' }}>
        <CollapseBtn id="main" />
        <h2 style={{ textAlign: 'center', color: '#000000', marginTop: 28 }}>分場表</h2>
        {!collapsed.main && data && data.races && data.races.length > 0 && (
          <div style={{ marginBottom: 32, paddingLeft: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, gap: 8, paddingRight: 8 }}>
              <button 
                onClick={() => setTagSortMode("default")}
                style={{ fontWeight: tagSortMode === "default" ? 'bold' : 'normal' }}
              >
                默認排序
              </button>
              <button 
                onClick={() => setTagSortMode("score")}
                style={{ fontWeight: tagSortMode === "score" ? 'bold' : 'normal' }}
              >
                分數排序
              </button>
              <button 
                onClick={() => setTagSortMode("win")}
                style={{ fontWeight: tagSortMode === "win" ? 'bold' : 'normal' }}
              >
                獨贏排序
              </button>
            </div>
            <div ref={topTableRef} style={{ overflowX: 'auto', userSelect: 'none' }}>
              <table cellPadding="6" style={{ borderCollapse: 'collapse', fontSize: 14, tableLayout: 'fixed', width: 'max-content', background: '#ffffff', border: '1px solid #000' }}>
                <colgroup>
                  <col style={{ width: 110 }} />
                  {data.races.map(race => (
                    <col key={race.no} style={{ width: 105 }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, background: '#f5f5f5', zIndex: 1, border: '1px solid #000' }}>Tags</th>
                    {data.races.map(race => (
                      <th key={race.no} style={{ textAlign: 'center', border: '1px solid #000' }}>第 {race.no} 場</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayTags.map(tag => (
                    <tr key={tag}>
                      <td style={{ fontWeight: 'bold', position: 'sticky', left: 0, background: '#f5f5f5', textAlign: 'center', border: '1px solid #000', whiteSpace: 'nowrap' }}>
                        {tag}
                        {tagSortMode === "score" && (
                          <div style={{ fontSize: 12, color: '#666', fontWeight: 'normal' }}>
                            {tagScores[tag] || 0}分
                          </div>
                        )}
                        {tagSortMode === "win" && (
                          <div style={{ fontSize: 12, color: '#666', fontWeight: 'normal' }}>
                            {(tagPlaceCounts[tag]?.[1] || 0)}-{(tagPlaceCounts[tag]?.[2] || 0)}-{(tagPlaceCounts[tag]?.[3] || 0)}-{(tagPlaceCounts[tag]?.[4] || 0)}
                          </div>
                        )}
                      </td>
                      {data.races.map(race => (
                        <td key={race.no} style={{ textAlign: 'center', verticalAlign: 'middle', padding: '4px 2px', border: '1px solid #000' }}>
                          {renderHorses(race.tags[tag])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <hr />

      <div style={{ position: 'relative' }}>
        <CollapseBtn id="count" />
        <h2 style={{ textAlign: 'center', color: '#000000', marginTop: 28 }}>計數表</h2>
        {!collapsed.count && data && data.races && data.races.length > 0 && (
          <div style={{ marginBottom: 32, paddingLeft: 12 }}>
            <div ref={countTableRef} style={{ overflowX: 'auto', userSelect: 'none' }}>
              <table cellPadding="6" style={{ borderCollapse: 'collapse', fontSize: 14, background: '#ffffff', border: '1px solid #000', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 70 }} />
                  {races.map(race => (
                    <col key={race.no} style={{ width: 200 }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #000', textAlign: 'center', background: '#f5f5f5' }}> </th>
                    {races.map(race => (
                      <th key={race.no} style={{ border: '1px solid #000', textAlign: 'center', whiteSpace: 'nowrap' }}>第{race.no}場</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', background: '#f5f5f5' }}>權重</td>
                    {races.map(race => (
                      <td key={race.no} style={{ border: '1px solid #000', textAlign: 'center', padding: '4px', verticalAlign: 'top', width: 200 }}>
                        {rates && rates.stats ? renderCountList(getRaceWeights(race), race, true) : <span style={{ color: '#999' }}>載入權重中</span>}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', background: '#f5f5f5' }}>1tag</td>
                    {races.map(race => (
                      <td key={race.no} style={{ border: '1px solid #000', textAlign: 'center', padding: '4px', verticalAlign: 'top', width: 200 }}>
                        {renderCountList(get1TagCounts(race), race)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', background: '#f5f5f5' }}>2tag</td>
                    {races.map(race => (
                      <td key={race.no} style={{ border: '1px solid #000', textAlign: 'center', padding: '4px', verticalAlign: 'top', width: 200 }}>
                        {allCombos ? renderCountList(get2TagCounts(race), race) : <span style={{ color: '#999' }}>請先載入2tags</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              權重：該場每隻馬所有 tag 權重加總，格式馬號(總分)，由高至低。1tag：該場每隻馬被多少個單 tag 命中（由多至少）；2tag：該場每隻馬被多少個雙 tag 組合命中（需先載入 2tags 統計）
            </p>
          </div>
        )}
      </div>

      <hr />

      <div style={{ position: 'relative' }}>
        <CollapseBtn id="follow" />
        <h2 style={{ textAlign: 'center', color: '#000000', marginTop: 28 }}>跟買參考</h2>
        {!collapsed.follow && (
          <div style={{ marginBottom: 32, paddingLeft: 12, paddingRight: 12 }}>
            <p style={{ textAlign: 'center', fontSize: 14, color: '#000', marginTop: 0, lineHeight: 1.6 }}>
              判斷分 = 權重合計 − 有B就3 − 有D就3 − tag數10個或以上就4 + 有古惑飛而且tag數5至7又冇B/D就2
              <br />
              每場只取判斷分最高的馬號。只跟「優先」同「可看」，其餘唔好當買入。
            </p>
            {data && races.length > 0 && rates && rates.stats && (() => {
              const judged = races.map(race => ({ race, ...judgeRace(race) }))
              const ready = races.some(race => ['古惑飛', '指數哥', 'E類馬'].some(tag => (race.tags?.[tag] || []).length > 0))
              const picks = judged.filter(j => j.advice.label === '優先' || j.advice.label === '可看')
              const placeOf = (race, no) => getPlaceMap(race)[no]
              const horseNo = (race, item) => {
                if (!item) return '—'
                const place = placeOf(race, item.no)
                return (
                  <span style={{ background: PLACE_COLORS[place] || 'transparent', padding: '1px 6px', fontWeight: 800, fontSize: 18 }}>
                    {item.no}
                  </span>
                )
              }
              return (
                <>
                  {!ready && (
                    <p style={{ textAlign: 'center', color: '#9b1c1c', fontWeight: 700 }}>
                      今場未有古惑飛、指數哥、E類，公式未夠料，下面馬號唔好用。
                    </p>
                  )}
                  {ready && (
                    <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }}>
                      {picks.length === 0
                        ? '今場冇優先或可看的馬。'
                        : '值得睇：' + picks.map(j => `第${j.race.no}場 ${j.top.no}號（${j.advice.label}）`).join('、')}
                    </p>
                  )}
                  <div style={{ overflowX: 'auto' }}>
                    <table cellPadding="6" style={{ borderCollapse: 'collapse', fontSize: 14, background: '#ffffff', border: '1px solid #000' }}>
                      <thead>
                        <tr>
                          {['場次', '判斷', '建議馬號', '判斷分', '次選', '差距', 'tag數', '重點'].map(h => (
                            <th key={h} style={{ border: '1px solid #000', background: '#f5f5f5', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {judged.map(({ race, top, second, advice }) => (
                          <tr key={race.no}>
                            <td style={{ border: '1px solid #000', textAlign: 'center' }}>第{race.no}場</td>
                            <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 700, background: advice.tone, whiteSpace: 'nowrap' }}>{advice.label}</td>
                            <td style={{ border: '1px solid #000', textAlign: 'center' }}>{horseNo(race, top)}</td>
                            <td style={{ border: '1px solid #000', textAlign: 'center' }}>{top ? (top.score > 0 ? '+' : '') + top.score.toFixed(1) : '—'}</td>
                            <td style={{ border: '1px solid #000', textAlign: 'center' }}>{horseNo(race, second)}</td>
                            <td style={{ border: '1px solid #000', textAlign: 'center' }}>{advice.gap == null ? '—' : advice.gap.toFixed(1)}</td>
                            <td style={{ border: '1px solid #000', textAlign: 'center' }}>{advice.n || '—'}</td>
                            <td style={{ border: '1px solid #000', textAlign: 'center', whiteSpace: 'nowrap' }}>{advice.notes.length ? advice.notes.join('、') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>

      <hr />

      <div style={{ position: 'relative' }}>
        <CollapseBtn id="rank" />
        <h2 style={{ textAlign: 'center', color: '#000000', marginTop: 28 }}>推薦排序</h2>
        {!collapsed.rank && (
          <div style={{ marginBottom: 32, paddingLeft: 12, paddingRight: 12 }}>
            <p style={{ textAlign: 'center', fontSize: 14, marginTop: 0, lineHeight: 1.6 }}>
              推薦分 = 權重合計 − 有B就3 − 有D就3 − tag數10個或以上就4 + 有古惑飛而且tag數5至7又冇B/D就2
              <br />
              每場由高至低排。頭6名入面，冇B／D而且分數最高的做馬膽，其餘5隻做腳。
              <br />
              頭6隻都有B／D就放棄嗰場，唔買。
              <br />
              頭3隻做六寶，再加3隻（即頭6隻）做3T。
            </p>
            {data && races.length > 0 && rates && rates.stats ? (() => {
              const judged = races.map(race => {
                const judgedRace = judgeRace(race)
                return { race, ...judgedRace, ticket: pickTicket(judgedRace.ranked) }
              })
              const ready = races.some(race => ['古惑飛', '指數哥', 'E類馬'].some(tag => (race.tags?.[tag] || []).length > 0))
              const maxN = Math.max(0, ...judged.map(j => j.ranked.length))
              const rowBg = (rank) => rank <= 3 ? '#c8efd4' : rank <= 6 ? '#fff3c4' : '#ffffff'
              const rowName = (rank) => rank <= 3 ? '六寶' : rank <= 6 ? '3T' : ''
              return (
                <>
                  {!ready && (
                    <p style={{ textAlign: 'center', color: '#9b1c1c', fontWeight: 700 }}>
                      今場未有古惑飛、指數哥、E類，推薦分未夠料，排序只供參考。
                    </p>
                  )}
                  <div style={{ overflowX: 'auto' }}>
                    <table cellPadding="4" style={{ borderCollapse: 'collapse', fontSize: 14, background: '#ffffff', border: '1px solid #000' }}>
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid #000', background: '#f5f5f5', position: 'sticky', left: 0, zIndex: 1, minWidth: 72 }}>排名</th>
                          {judged.map(j => (
                            <th key={j.race.no} style={{ border: '1px solid #000', background: j.ticket.skipped ? '#d0d0d0' : '#f5f5f5', minWidth: 72, whiteSpace: 'nowrap' }}>
                              第{j.race.no}場
                              {j.ticket.skipped ? <div style={{ color: '#9b1c1c' }}>放棄</div> : null}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: maxN }, (_, i) => i + 1).map(rank => (
                          <tr key={rank}>
                            <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 700, background: rowBg(rank), position: 'sticky', left: 0 }}>
                              {rank}{rowName(rank) ? ` ${rowName(rank)}` : ''}
                            </td>
                            {judged.map(j => {
                              const horse = j.ranked[rank - 1]
                              const place = horse ? getPlaceMap(j.race)[horse.no] : 0
                              const isBanker = horse && j.ticket.banker && horse.no === j.ticket.banker.no
                              return (
                                <td key={j.race.no} style={{ border: '1px solid #000', textAlign: 'center', background: j.ticket.skipped ? '#eeeeee' : rowBg(rank), verticalAlign: 'middle' }}>
                                  {horse ? (
                                    <div>
                                      <span style={{
                                        background: PLACE_COLORS[place] || 'transparent',
                                        padding: '0 4px',
                                        fontWeight: 800,
                                        fontSize: 16,
                                        ...(isBanker ? { display: 'inline-block', border: '3px solid #e10600', lineHeight: 1.2 } : {})
                                      }}>{horse.no}</span>
                                      <div style={{ fontSize: 12, color: '#333' }}>{horse.score > 0 ? '+' : ''}{horse.score.toFixed(1)}</div>
                                    </div>
                                  ) : '—'}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: 12, color: '#666' }}>綠色頭3行 = 六寶。黃色第4至6行 = 3T再加的3隻。紅色粗框 = 頭6名入面最高、又冇B／D的馬膽。灰色「放棄」= 頭6隻都有B／D，唔買。馬號有底色代表已跑完的名次。</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      const lines = judged.map(j => {
                        if (j.ticket.skipped) return `第${j.race.no}場　放棄`
                        const banker = j.ticket.banker
                        if (!banker) return `第${j.race.no}場　未有馬`
                        const placeOf = getPlaceMap(j.race)
                        const mark = (no) => {
                          const place = Number(placeOf[no])
                          return `${no}${place >= 1 && place <= 3 ? '✅' : ''}`
                        }
                        const legs = j.ticket.legs.map(h => mark(h.no)).join(',')
                        return `第${j.race.no}場　膽${mark(banker.no)}　腳${legs}`
                      })
                      const text = `${currentDate} 湯馬推薦 🏇\n\n${lines.join('\n\n')}`
                      const btn = e.currentTarget
                      const old = btn.textContent
                      const flash = () => {
                        btn.textContent = '已複製'
                        setTimeout(() => { btn.textContent = old }, 1500)
                      }
                      const fallback = () => {
                        const ta = document.createElement('textarea')
                        ta.value = text
                        document.body.appendChild(ta)
                        ta.select()
                        document.execCommand('copy')
                        document.body.removeChild(ta)
                        flash()
                      }
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(text).then(flash).catch(fallback)
                      } else {
                        fallback()
                      }
                    }}
                    style={{ display: 'block', margin: '12px auto 0', padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    複製今場 1膽5腳
                  </button>
                  <p style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>
                    撳一下就複製，去 WhatsApp 自己貼上。
                  </p>
                </>
              )
            })() : (
              <p style={{ textAlign: 'center' }}>載入推薦分中...</p>
            )}
          </div>
        )}
      </div>

      <hr />

      <div style={{ position: 'relative' }}>
        <CollapseBtn id="weight" />
        <h2 style={{ textAlign: 'center', color: '#000000', marginTop: 28 }}>權重表</h2>
        {!collapsed.weight && (
          <div style={{ marginBottom: 32, paddingLeft: 12, paddingRight: 12 }}>
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  onClick={() => loadRates(p.id)}
                  style={{ marginRight: 8, fontWeight: rates?.period === p.id ? 'bold' : 'normal' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {!rates || !rates.stats ? (
              <p style={{ textAlign: 'center' }}>載入權重中...</p>
            ) : (
              <>
                <p style={{ textAlign: 'center', margin: '8px 0' }}>
                  統計期間：{rates.label}（{rates.start} ~ {rates.end}）
                  <br />
                  普通馬前三率 {rates.baseline?.top3Rate ?? 26.9}%（每匹馬只計一次）
                </p>
                <p style={{ textAlign: 'center', fontSize: 12, color: '#666', marginTop: 0 }}>
                  權重 =（前三率 − 普通馬前三率）× 次數 ÷（次數 + 100）。正數高過普通馬，負數低過。15 個 tag 全部保留。
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table cellPadding="6" style={{ borderCollapse: 'collapse', fontSize: 14, background: '#ffffff', border: '1px solid #000', margin: '0 auto' }}>
                    <thead>
                      <tr>
                        {['Tag', '次數', '前三率', '差距', '權重'].map(h => (
                          <th key={h} style={{ border: '1px solid #000', textAlign: 'center', whiteSpace: 'nowrap', background: '#f5f5f5' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getWeightRows().map(row => (
                        <tr key={row.tag}>
                          <td style={{ border: '1px solid #000', textAlign: 'center', whiteSpace: 'nowrap' }}>{row.tag}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{row.n}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{row.top3Rate}%</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center', color: row.gap < 0 ? '#9b1c1c' : '#000' }}>{row.gap > 0 ? '+' : ''}{row.gap}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 700, color: row.weight < 0 ? '#9b1c1c' : '#000' }}>{row.weight > 0 ? '+' : ''}{row.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <hr />

      <div style={{ position: 'relative' }}>
        <CollapseBtn id="single" />
        <h2 style={{ textAlign: 'center', color: '#000000', marginTop: 28 }}>單tags</h2>
        {!collapsed.single && (
          <>
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              {PERIODS.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => loadRates(p.id)} 
                  style={{ marginRight: 8 }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {rates && (
              <div style={{ marginBottom: 32, paddingLeft: 12 }}>
                <p style={{ textAlign: 'center' }}>統計期間：{rates.label}（{rates.start} ~ {rates.end}）</p>

                <div style={{ marginBottom: 12, padding: 12, background: '#f5f5f5', borderRadius: 6, maxWidth: 900, position: 'relative' }}>
                  <strong>顯示以下 Tags：</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                    {sortedTagsForCheckboxes.map(tag => (
                      <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
                        <input 
                          type="checkbox" 
                          checked={shownTagsSingle.has(tag)} 
                          onChange={() => toggleShownSingle(tag)} 
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
                      <input type="checkbox" checked={shownTagsSingle.size === 0} onChange={deselectAllSingle} />
                      全取消
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
                      <input type="checkbox" checked={shownTagsSingle.size === DEFAULT_TAGS.length} onChange={selectAllSingle} />
                      全選
                    </label>
                  </div>
                </div>

                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 12 }}>
                  <div>
                    <span style={{ marginRight: 8 }}>排序：</span>
                    <button 
                      onClick={() => handleSort('winRate')} 
                      style={{ marginRight: 4, fontWeight: sortBy === 'winRate' ? 'bold' : 'normal' }}
                    >
                      勝率 {sortBy === 'winRate' && (sortDesc ? '↓' : '↑')}
                    </button>
                    <button 
                      onClick={() => handleSort('top3Rate')}
                      style={{ marginRight: 4, fontWeight: sortBy === 'top3Rate' ? 'bold' : 'normal' }}
                    >
                      前三率 {sortBy === 'top3Rate' && (sortDesc ? '↓' : '↑')}
                    </button>
                    <button 
                      onClick={() => handleSort('total')}
                      style={{ fontWeight: sortBy === 'total' ? 'bold' : 'normal' }}
                    >
                      總數 {sortBy === 'total' && (sortDesc ? '↓' : '↑')}
                    </button>
                  </div>
                  <label style={{ fontSize: 14 }}>
                    <input type="checkbox" checked={hideEmptySingle} onChange={() => setHideEmptySingle(!hideEmptySingle)} />
                    隱藏當日沒有
                  </label>
                </div>
                <div ref={singleTableRef} style={{ overflowX: 'auto', userSelect: 'none' }}>
                  <table cellPadding="6" style={{ borderCollapse: 'collapse', fontSize: 14, background: '#ffffff', border: '1px solid #000' }}>
                    <thead>
                      <tr>
                        <th style={{ border: '1px solid #000', textAlign: 'center', whiteSpace: 'nowrap' }}>Tag</th>
                        <th style={{ border: '1px solid #000', textAlign: 'center' }}>總數</th>
                        <th style={{ border: '1px solid #000', textAlign: 'center' }}>勝出</th>
                        <th style={{ border: '1px solid #000', textAlign: 'center' }}>前三</th>
                        <th style={{ border: '1px solid #000', textAlign: 'center' }}>勝率</th>
                        <th style={{ border: '1px solid #000', textAlign: 'center' }}>前三率</th>
                        {races.map(race => (
                          <th key={race.no} style={{ border: '1px solid #000', textAlign: 'center', whiteSpace: 'nowrap' }}>第{race.no}場</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStats.map(([tag, s]) => (
                        <tr key={tag}>
                          <td style={{ border: '1px solid #000', textAlign: 'center', whiteSpace: 'nowrap' }}>{tag}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{s.total}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{s.win}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{s.top3}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{s.winRate}%</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{s.top3Rate}%</td>
                          {races.map(race => (
                            <td key={race.no} style={{ border: '1px solid #000', textAlign: 'center', padding: '2px' }}>
                              {renderHorses(getRaceTagHorses(race, tag))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <hr />

      <div style={{ position: 'relative' }}>
        <CollapseBtn id="combo" />
        <h2 style={{ textAlign: 'center', color: '#000000', marginTop: 28 }}>2tags</h2>
        {!collapsed.combo && (
          <>
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              {PERIODS.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => loadAllCombos(p.id)} 
                  disabled={comboLoading}
                  style={{ marginRight: 8, fontWeight: comboPeriod === p.id ? 'bold' : 'normal' }}
                >
                  {p.label}
                </button>
              ))}
              {comboLoading && <span style={{ marginLeft: 8 }}>計算中...</span>}
            </div>

            {allCombos && (
              <div style={{ paddingLeft: 12 }}>
                <p style={{ textAlign: 'center' }}>統計期間：{allCombos.label}（{allCombos.start} ~ {allCombos.end}）</p>
                
                <div style={{ marginBottom: 12, padding: 12, background: '#f5f5f5', borderRadius: 6, maxWidth: 900, position: 'relative' }}>
                  <strong>顯示包含以下 Tags 的組合：</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                    {sortedTagsForCheckboxes.map(tag => (
                      <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
                        <input 
                          type="checkbox" 
                          checked={shownTagsCombo.has(tag)} 
                          onChange={() => toggleShownCombo(tag)} 
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
                      <input type="checkbox" checked={shownTagsCombo.size === 0} onChange={deselectAllCombo} />
                      全取消
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
                      <input type="checkbox" checked={shownTagsCombo.size === DEFAULT_TAGS.length} onChange={selectAllCombo} />
                      全選
                    </label>
                  </div>
                </div>

                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 12 }}>
                  <div>
                    <span style={{ marginRight: 8 }}>排序：</span>
                    <button 
                      onClick={() => handleComboSort('winRate')} 
                      style={{ marginRight: 4, fontWeight: comboSortBy === 'winRate' ? 'bold' : 'normal' }}
                    >
                      勝率 {comboSortBy === 'winRate' && (comboSortDesc ? '↓' : '↑')}
                    </button>
                    <button 
                      onClick={() => handleComboSort('top3Rate')}
                      style={{ marginRight: 4, fontWeight: comboSortBy === 'top3Rate' ? 'bold' : 'normal' }}
                    >
                      前三率 {comboSortBy === 'top3Rate' && (comboSortDesc ? '↓' : '↑')}
                    </button>
                    <button 
                      onClick={() => handleComboSort('total')}
                      style={{ fontWeight: comboSortBy === 'total' ? 'bold' : 'normal' }}
                    >
                      總數 {comboSortBy === 'total' && (comboSortDesc ? '↓' : '↑')}
                    </button>
                  </div>
                  <label style={{ fontSize: 14 }}>
                    <input type="checkbox" checked={hideEmptyCombo} onChange={() => setHideEmptyCombo(!hideEmptyCombo)} />
                    隱藏當日沒有
                  </label>
                </div>
                <div ref={comboTableRef} style={{ overflowX: 'auto', userSelect: 'none' }}>
                  <table cellPadding="6" style={{ borderCollapse: 'collapse', fontSize: 14, background: '#ffffff', border: '1px solid #000' }}>
                    <thead>
                      <tr>
                        <th style={{ border: '1px solid #000', textAlign: 'center', whiteSpace: 'nowrap' }}>組合</th>
                        <th style={{ border: '1px solid #000', textAlign: 'center' }}>總數</th>
                        <th style={{ border: '1px solid #000', textAlign: 'center' }}>勝出</th>
                        <th style={{ border: '1px solid #000', textAlign: 'center' }}>前三</th>
                        <th style={{ border: '1px solid #000', textAlign: 'center' }}>勝率</th>
                        <th style={{ border: '1px solid #000', textAlign: 'center' }}>前三率</th>
                        {races.map(race => (
                          <th key={race.no} style={{ border: '1px solid #000', textAlign: 'center', whiteSpace: 'nowrap' }}>第{race.no}場</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCombos.map((c, i) => (
                        <tr key={i}>
                          <td style={{ border: '1px solid #000', textAlign: 'center', whiteSpace: 'nowrap' }}>{c.tag1} + {c.tag2}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{c.total}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{c.win}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{c.top3}</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{c.winRate}%</td>
                          <td style={{ border: '1px solid #000', textAlign: 'center' }}>{c.top3Rate}%</td>
                          {races.map(race => (
                            <td key={race.no} style={{ border: '1px solid #000', textAlign: 'center', padding: '2px' }}>
                              {renderHorses(getRaceComboHorses(race, c.tag1, c.tag2))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 13, color: '#666' }}>
                  顯示 {filteredCombos.length} 個組合
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <hr />

      <div style={{ position: 'relative' }}>
        <CollapseBtn id="bets" />
        <h2 style={{ textAlign: 'center', color: '#000000', marginTop: 28 }}>注碼成績</h2>
        {!collapsed.bets && (() => {
          const money = (n) => Math.round(n).toLocaleString('en-HK')
          const hitText = (r) => r.mid
          const renderBetTable = (title, rows) => (
            <table cellPadding="6" style={{ borderCollapse: 'collapse', fontSize: 14, background: '#ffffff', border: '1px solid #000', margin: '0 auto 16px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', background: '#fff3c4', textAlign: 'left', whiteSpace: 'nowrap' }}>{title}</th>
                  {['中', '成本', '派彩', '輸贏'].map(h => (
                    <th key={h} style={{ border: '1px solid #000', background: '#f5f5f5', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.pool}>
                    <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 700 }}>{r.pool}</td>
                    <td style={{ border: '1px solid #000', textAlign: 'center' }}>{hitText(r)}</td>
                    <td style={{ border: '1px solid #000', textAlign: 'right' }}>${money(r.cost)}</td>
                    <td style={{ border: '1px solid #000', textAlign: 'right' }}>${money(r.div)}</td>
                    <td style={{ border: '1px solid #000', textAlign: 'right', fontWeight: 700, color: r.profit >= 0 ? '#0a7a2f' : '#9b1c1c' }}>
                      {r.profit >= 0 ? '賺' : '蝕'} ${money(Math.abs(r.profit))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
          const mixedRows = [
            { pool: '獨贏', mid: '37／141', cost: 1410, div: 1778.5, profit: 368.5 },
            { pool: '位置', mid: '81／141', cost: 1410, div: 1557.7, profit: 147.7 },
            { pool: '單T', mid: '42／141', cost: 14100, div: 17355, profit: 3255 },
            { pool: '三重彩', mid: '18／141', cost: 28200, div: 35634, profit: 7434 },
            { pool: '孖T', mid: '6／43 口', cost: 43000, div: 152375, profit: 109375 },
            { pool: '三T', mid: '1／15 口', cost: 150000, div: 404526, profit: 254526 },
          ]
          const seasonRows = [
            { pool: '獨贏', mid: '37／141', cost: 1410, div: 1766, profit: 356 },
            { pool: '位置', mid: '77／141', cost: 1410, div: 1461.7, profit: 51.7 },
            { pool: '單T', mid: '40／141', cost: 14100, div: 16218, profit: 2118 },
            { pool: '三重彩', mid: '17／141', cost: 28200, div: 37981, profit: 9781 },
            { pool: '孖T', mid: '5／43 口', cost: 43000, div: 59053, profit: 16053 },
            { pool: '三T', mid: '0／15 口', cost: 150000, div: 7500, profit: -142500 },
          ]
          const sameRows = [
            { pool: '獨贏', mid: '20／80', cost: 800, div: 893.5, profit: 93.5 },
            { pool: '位置', mid: '47／80', cost: 800, div: 893.6, profit: 93.6 },
            { pool: '單T', mid: '25／80', cost: 8000, div: 8972, profit: 972 },
            { pool: '三重彩', mid: '10／80', cost: 16000, div: 16179, profit: 179 },
            { pool: '孖T', mid: '2／12 口', cost: 12000, div: 42832, profit: 30832 },
            { pool: '三T', mid: '0／1 口', cost: 10000, div: 0, profit: -10000 },
          ]
          return (
            <div style={{ marginBottom: 32, paddingLeft: 12, paddingRight: 12 }}>
              <p style={{ textAlign: 'center', margin: '8px 0' }}>
                三張都係 2026年9月6日至10月28日，15 個賽馬日、141 場。馬匹 tag 一樣，只係權重唔同。
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
                {renderBetTable('權重：2025年9月至今', mixedRows)}
                {renderBetTable('權重：2026年9月至今', seasonRows)}
                {renderBetTable('兩套權重膽腳相同', sameRows)}
              </div>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>
                三T 是 15 個賽馬日各一口。冇人中頭獎的日子，用該三場的頭三名對。兩套權重三場膽腳都一樣先買，今季只有 10 月 11 日一口，中唔到。
              </p>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default App