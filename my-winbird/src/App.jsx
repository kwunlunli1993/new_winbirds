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

function App() {
  const [currentDate, setCurrentDate] = useState("")
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [raceDates, setRaceDates] = useState([])
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
    single: false,
    combo: false,
  })

  const topTableRef = useRef(null)
  const singleTableRef = useRef(null)
  const comboTableRef = useRef(null)
  const countTableRef = useRef(null)

  useEffect(() => {
    document.body.style.margin = '0'
    document.body.style.padding = '0'

    fetch(`${API_BASE}/api/race-dates`)
      .then(r => r.json())
      .then(json => {
        const dates = json.dates || []
        setRaceDates(dates)
        if (dates.length > 0) setCurrentDate(dates[0])
      })
  }, [])

  useEffect(() => {
    if (!currentDate) return
    setLoading(true)
    fetch(`${API_BASE}/api/day-tags?date=${currentDate}`)
      .then(r => r.json())
      .then(json => setData(json))
      .finally(() => setLoading(false))

    const timer = setInterval(() => {
      fetch(`${API_BASE}/api/day-tags?date=${currentDate}`)
        .then(r => r.json())
        .then(json => setData(json))
    }, 5 * 60 * 1000)

    return () => clearInterval(timer)
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
  }

  const loadAllCombos = (period) => {
    setComboPeriod(period)
    setComboLoading(true)
    fetch(`${API_BASE}/api/all-combo-rates?period=${period}`)
      .then(r => r.json())
      .then(json => setAllCombos(json))
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

  const selectAllSingle = () => {
    setShownTagsSingle(new Set(DEFAULT_TAGS))
  }

  const selectAllCombo = () => {
    setShownTagsCombo(new Set(DEFAULT_TAGS))
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc)
    } else {
      setSortBy(field)
      setSortDesc(true)
    }
  }

  const handleComboSort = (field) => {
    if (comboSortBy === field) {
      setComboSortDesc(!comboSortDesc)
    } else {
      setComboSortBy(field)
      setComboSortDesc(true)
    }
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

  const getDisplayTags = () => {
    if (tagSortMode === "score") {
      const scores = getTagScores()
      return [...DEFAULT_TAGS].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
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

  const renderCountList = (items, race) => {
    if (!items || items.length === 0) return <span style={{ color: '#999' }}>-</span>
    const placeMap = getPlaceMap(race)
    const perLine = 4
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
                  minWidth: 42,
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
          <div>
            <button onClick={goPrev} disabled={idx >= raceDates.length - 1}>上一日</button>
            <select 
              value={currentDate} 
              onChange={(e) => setCurrentDate(e.target.value)}
              style={{ margin: '0 12px', fontSize: 16 }}
            >
              {raceDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button onClick={goNext} disabled={idx <= 0}>下一日</button>
          </div>
        </div>
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
            </div>
            <div ref={topTableRef} style={{ overflowX: 'auto', userSelect: 'none' }}>
              <table cellPadding="6" style={{ borderCollapse: 'collapse', fontSize: 14, tableLayout: 'fixed', width: 'max-content', background: '#ffffff', border: '1px solid #000' }}>
                <colgroup>
                  <col style={{ width: 90 }} />
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
              1tag：該場每隻馬被多少個單 tag 命中（由多至少）；2tag：該場每隻馬被多少個雙 tag 組合命中（需先載入 2tags 統計）
            </p>
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
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
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
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
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
    </div>
  )
}

export default App