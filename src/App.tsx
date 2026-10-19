import { useState } from 'react'
import { Link, Route, Routes } from 'react-router'

type TileKind = 'empty' | 'straight' | 'curve' | 'station'
type Tile = { kind: TileKind; rotation?: number; label?: string }
type Position = readonly [row: number, column: number]
type Direction = 'north' | 'east' | 'south' | 'west'

const boardSize = 5

// Author the answer as one ordered route, then derive both its concealed tile
// map and its clues. The route goes from the inbound A to the outbound B.
const hiddenRoute: readonly Position[] = [
  [0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 4], [4, 4],
]

function directionBetween([fromRow, fromColumn]: Position, [toRow, toColumn]: Position): Direction {
  if (toRow === fromRow - 1 && toColumn === fromColumn) return 'north'
  if (toRow === fromRow + 1 && toColumn === fromColumn) return 'south'
  if (toRow === fromRow && toColumn === fromColumn + 1) return 'east'
  if (toRow === fromRow && toColumn === fromColumn - 1) return 'west'
  throw new Error('Every route segment must connect orthogonally adjacent cells.')
}

function assertValidRoute(route: readonly Position[]) {
  if (route.length < 2 || route[0].join() !== '0,0' || route.at(-1)?.join() !== '4,4') throw new Error('The route must run from A to B.')
  const visited = new Set<string>()
  route.forEach((position, index) => {
    const [row, column] = position
    if (row < 0 || row >= boardSize || column < 0 || column >= boardSize || visited.has(position.join())) throw new Error('Route cells must be unique and inside the board.')
    visited.add(position.join())
    if (index > 0) directionBetween(route[index - 1], position)
  })
}

function routeTile(index: number): Tile {
  if (index === 0) return { kind: 'station', rotation: 90, label: 'A' }
  if (index === hiddenRoute.length - 1) return { kind: 'station', rotation: 270, label: 'B' }
  const from = directionBetween(hiddenRoute[index], hiddenRoute[index - 1])
  const to = directionBetween(hiddenRoute[index], hiddenRoute[index + 1])
  if ((from === 'north' && to === 'south') || (from === 'south' && to === 'north')) return { kind: 'straight', rotation: 90 }
  if ((from === 'east' && to === 'west') || (from === 'west' && to === 'east')) return { kind: 'straight', rotation: 0 }
  const curveRotations: Record<string, number> = { 'south,west': 0, 'north,west': 90, 'east,north': 180, 'east,south': 270 }
  return { kind: 'curve', rotation: curveRotations[[from, to].sort().join(',')] }
}

assertValidRoute(hiddenRoute)
const solutionTiles: Tile[] = Array.from({ length: boardSize * boardSize }, () => ({ kind: 'empty' }))
hiddenRoute.forEach(([row, column], index) => { solutionTiles[row * boardSize + column] = routeTile(index) })

function TrackArt({ tile }: { tile: Tile }) {
  if (tile.kind === 'empty') return <span className="sparkle">✦</span>

  const transform = `rotate(${tile.rotation ?? 0} 50 50)`
  const path = tile.kind === 'curve' ? 'M -7 50 H 50 V 107' : 'M -7 50 H 107'
  return (
    <>
      <svg className="track-art" viewBox="0 0 100 100" aria-hidden="true">
        <g transform={transform}>
          <path className="track-shadow" d={path} />
          <path className="track-ties" d={path} />
          <path className="track-rail outer" d={path} />
          <path className="track-rail inner" d={path} />
        </g>
      </svg>
      {tile.kind === 'station' && <span className="station-car"><b>{tile.label}</b><i>◆</i></span>}
    </>
  )
}

function Game() {
  const [selected, setSelected] = useState<number | null>(12)
  const [level, setLevel] = useState(8)
  const visibleTiles = solutionTiles.map((tile) => tile.kind === 'station' ? tile : { kind: 'empty' as const })
  const totalTrackCells = solutionTiles.filter((tile) => tile.kind !== 'empty').length
  const clueForColumn = (column: number) => solutionTiles.filter((tile, index) => index % 5 === column && tile.kind !== 'empty').length
  const clueForRow = (row: number) => solutionTiles.slice(row * 5, row * 5 + 5).filter((tile) => tile.kind !== 'empty').length

  return (
    <main className="game-shell">
      <nav className="topbar" aria-label="Main navigation">
        <Link className="brand" to="/"><span className="brand-mark">↝</span><span>TRACK<span>BOUND</span></span></Link>
        <div className="nav-actions"><button className="icon-button" aria-label="Open level guide">?</button><button className="avatar" aria-label="Player profile">L</button></div>
      </nav>

      <section className="game-header">
        <div><p className="eyebrow">MORNING RUN · {String(level).padStart(2, '0')}</p><h1>Sunflower Bend</h1><p className="subtitle">Guide the Bluebell from station <b>A</b> to station <b>B</b>.</p></div>
        <div className="progress-card"><div className="progress-copy"><span>TRACK PLACED</span><b>0 / {totalTrackCells - 2}</b></div><div className="progress-rail"><i style={{ width: '0%' }} /></div></div>
      </section>

      <section className="play-area" aria-label="Train Tracks puzzle">
        <aside className="mission-card"><div className="ticket-notch" /><span className="mission-icon">♟</span><p className="eyebrow">TODAY'S JOB</p><h2>All aboard!</h2><p>Connect both stations with one continuous railway. No stops, no bumps.</p><div className="legend"><span><i className="dot amber" /> Station A</span><span><i className="dot blue" /> Station B</span></div></aside>

        <div className="board-wrap">
          <p className="clue-key"><b>LINE CLUES</b><span>Each number tells you how many blocks in that row or column contain track.</span></p>
          <div className="puzzle-frame">
            <div className="column-clues" aria-label="Column track counts">
              {Array.from({ length: 5 }, (_, column) => <span key={column} title={`Column ${column + 1}: ${clueForColumn(column)} track cells`}>{clueForColumn(column)}</span>)}
            </div>
            <div className="board-and-row-clues">
              <div className="board" role="grid" aria-label="5 by 5 puzzle board">
                {visibleTiles.map((tile, index) => (
                  <button key={index} role="gridcell" className={`tile ${tile.kind} ${selected === index ? 'selected' : ''}`} onClick={() => setSelected(index)} aria-label={`${tile.kind} track at row ${Math.floor(index / 5) + 1}, column ${(index % 5) + 1}${selected === index ? ', selected' : ''}`}>
                    <TrackArt tile={tile} />
                  </button>
                ))}
              </div>
              <div className="row-clues" aria-label="Row track counts">
                {Array.from({ length: 5 }, (_, row) => <span key={row} title={`Row ${row + 1}: ${clueForRow(row)} track cells`}>{clueForRow(row)}</span>)}
              </div>
            </div>
          </div>
          <p className="board-hint">Select a piece to inspect it · Rotation arrives in the next stop</p>
        </div>

        <aside className="control-panel"><div className="panel-rivet one" /><div className="panel-rivet two" /><p className="eyebrow">ENGINE ROOM</p><h2>Ready when you are.</h2><p className="panel-copy">Every track must be used once before the train leaves the platform.</p><button className="launch-button" onClick={() => setLevel((current) => current + 1)}><span>▶</span> Test the route</button><button className="secondary-button" onClick={() => setSelected(null)}>Clear selection</button></aside>
      </section>

      <footer><span>© Trackbound Rail Co.</span><span>Tap a tile to get started</span><span>Built for curious conductors</span></footer>
    </main>
  )
}

export default function App() {
  return <Routes><Route path="*" element={<Game />} /></Routes>
}
