import { useState } from 'react'
import { Html } from '@react-three/drei'
import type { Building, RepositoryIsland, ShipProfile } from '../../types/ocean'
import { hash } from '../../utils/oceanMath'

function Block({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.85} /></mesh>
}

export function BuildingModel({ building, color }: { building: Building; color: string }) {
  const { kind, level } = building
  if (kind === 'campfire') return (
    <group>
      {Array.from({ length: 5 + level * 2 }, (_, i) => {
        const angle = i / (5 + level * 2) * Math.PI * 2
        return <mesh key={i} position={[Math.cos(angle) * .27, .06, Math.sin(angle) * .27]}><dodecahedronGeometry args={[.08, 0]} /><meshStandardMaterial color="#79786e" /></mesh>
      })}
      <mesh position={[0, .11, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.06, .06, .5, 5]} /><meshStandardMaterial color="#704129" /></mesh>
      <mesh position={[0, .17 + level * .045, 0]}><coneGeometry args={[.1 + level * .03, .22 + level * .1, 5]} /><meshStandardMaterial color="#ff9b39" emissive="#ff5c18" emissiveIntensity={1.5} /></mesh>
      {level >= 2 && <Block position={[.4, .1, 0]} size={[.15, .2, .65]} color="#97643d" />}
      {level === 3 && <Block position={[-.4, .1, 0]} size={[.15, .2, .65]} color="#97643d" />}
    </group>
  )
  if (kind === 'harbor') return (
    <group>
      {Array.from({ length: 4 + level }, (_, i) => <Block key={i} position={[-.43 + i * .16, .12, 0]} size={[.13, .15, .62 + level * .08]} color={i % 2 ? '#9b6a41' : '#b17d4b'} />)}
      {[-1, 1].flatMap((side) => [-1, 1].map((end) => <Block key={side + ':' + end} position={[end * .44, .2, side * .38]} size={[.07, .48, .07]} color="#59402b" />))}
      {level >= 2 && <Block position={[.22, .34, 0]} size={[.25, .3, .27]} color="#c2985b" />}
      {level === 3 && <><Block position={[-.2, .65, -.3]} size={[.07, 1.2, .07]} color="#5b412e" /><Block position={[.08, 1.2, -.3]} size={[.6, .08, .1]} color="#a87946" /></>}
    </group>
  )
  if (kind === 'market') return (
    <group>
      <Block position={[0, .25, 0]} size={[.72, .5, .5]} color="#af7742" />
      {[-.34, .34].map((x) => <Block key={x} position={[x, .55, 0]} size={[.055, .8, .55]} color="#59412c" />)}
      <Block position={[0, .9, 0]} size={[.85, .08, .72]} color={color} />
      {Array.from({ length: level }, (_, i) => <group key={i} position={[-.25 + i * .24, .51, .18]}>
        <Block position={[0, .08, 0]} size={[.18, .16, .2]} color="#855020" />
        <Block position={[0, .17, 0]} size={[.19, .04, .21]} color="#e9bd61" />
      </group>)}
      {level >= 2 && <Block position={[.43, .17, .05]} size={[.18, .34, .3]} color="#c19c57" />}
      {level === 3 && <Block position={[0, 1.07, 0]} size={[.5, .24, .12]} color="#edcb78" />}
    </group>
  )
  if (kind === 'fort') return (
    <group>
      <Block position={[0, .22, 0]} size={[.85, .44, .72]} color="#737e83" />
      {Array.from({ length: level }, (_, i) => {
        const x = level === 1 ? 0 : -.28 + i * .56 / (level - 1)
        return <group key={i} position={[x, 0, -.15]}>
          <Block position={[0, .45 + level * .09, 0]} size={[.26, .9 + level * .18, .3]} color="#95a0a0" />
          <Block position={[0, .94 + level * .18, 0]} size={[.33, .13, .38]} color="#c3c5b4" />
          <Block position={[0, .63, .155]} size={[.06, .18, .015]} color="#273943" />
        </group>
      })}
      <Block position={[0, .26, .365]} size={[.2, .42, .025]} color="#4c3426" />
      <Block position={[.43, .6, .33]} size={[.025, .8, .025]} color="#59402b" />
      <Block position={[.33, .92, .33]} size={[.2, .16, .025]} color={color} />
    </group>
  )
  return (
    <group>
      <Block position={[0, .19 + level * .08, 0]} size={[.62, .38 + level * .16, .6]} color={level === 3 ? '#c3b598' : '#c9935a'} />
      <mesh position={[0, .52 + level * .16, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[.55, .35, 4]} /><meshStandardMaterial color={color} /></mesh>
      <Block position={[0, .17, .305]} size={[.14, .32, .02]} color="#563e2c" />
      {level >= 2 && <Block position={[-.19, .46, .31]} size={[.12, .14, .025]} color="#ffd797" />}
      {level === 3 && <><Block position={[.19, .68, .31]} size={[.12, .14, .025]} color="#ffd797" /><Block position={[-.22, .98, -.12]} size={[.13, .45, .15]} color="#88685c" /></>}
    </group>
  )
}

function InteractiveBuilding({ building, repository, color, onClick }: { building: Building; repository?: RepositoryIsland; color: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return <group position={building.position}
    onClick={(event) => { event.stopPropagation(); onClick() }}
    onPointerOver={(event) => { event.stopPropagation(); setHovered(true) }}
    onPointerOut={() => setHovered(false)}>
    <Block position={[0, -.025, 0]} size={[1.08, .06, 1.08]} color={hovered ? '#c1b47c' : '#a19a70'} />
    <BuildingModel building={building} color={color} />
    {repository && <mesh position={[.4, .13, .43]} rotation={[0, Math.PI / 4, 0]}><octahedronGeometry args={[.1]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.4} /></mesh>}
    {hovered && <Html position={[0, 1.85, 0]} center style={{ pointerEvents: 'none' }}><div className="building-tooltip">{repository?.name ?? building.title}<small>{building.title} · Nv. {building.level} · Clique para ver</small></div></Html>}
  </group>
}

export function HomeIsland({ profile, onClick, onRepositoryClick, onBuildingClick }: {
  profile: ShipProfile; onClick?: () => void
  onRepositoryClick?: (repository: RepositoryIsland) => void
  onBuildingClick: (building: Building) => void
}) {
  const { columns, rows, spacing } = profile.island
  const seed = hash(profile.user.login)
  const palette = ['#6fa666', '#80a96c', '#619b77', '#95a66a'][seed % 4]
  const harbor = profile.progression.buildings.find((building) => building.id === 'harbor')
  return <group position={profile.homePosition} onClick={(event) => { event.stopPropagation(); onClick?.() }}>
    <Block position={[0, .1, 0]} size={[columns * spacing + .16, .72, rows * spacing + .16]} color="#9c8050" />
    <Block position={[0, .49, 0]} size={[columns * spacing, .12, rows * spacing]} color={palette} />
    {Array.from({ length: rows * columns }, (_, index) => {
      const x = (index % columns - (columns - 1) / 2) * spacing
      const z = (Math.floor(index / columns) - (rows - 1) / 2) * spacing
      return <group key={index} position={[x, 0, z]}>
        <Block position={[0, .57, 0]} size={[spacing - .08, .12, spacing - .08]} color={(seed + index) % 3 === 0 ? '#80af71' : palette} />
      </group>
    })}
    {profile.progression.buildings.map((building) => {
      const repository = profile.repositories.find((repo) => repo.html_url === building.repositoryUrl)
      return <InteractiveBuilding key={building.id} building={building} repository={repository}
        color={repository?.color ?? profile.languages[0]?.color ?? '#c6844f'}
        onClick={() => repository ? onRepositoryClick?.(repository) : onBuildingClick(building)} />
    })}
    {Array.from({ length: rows * columns - profile.progression.buildings.length }, (_, i) => {
      const index = profile.progression.buildings.length + i
      return <group key={index} position={[(index % columns - (columns - 1) / 2) * spacing, .65, (Math.floor(index / columns) - (rows - 1) / 2) * spacing]}>
        <Block position={[0, .22, 0]} size={[.1, .44, .1]} color="#775434" />
        <mesh position={[0, .68, 0]} castShadow><coneGeometry args={[.35, .95, 6]} /><meshStandardMaterial color="#2f6b50" /></mesh>
      </group>
    })}
    {harbor && <group position={[columns * spacing / 2 + .4, .3, (rows - 1) * spacing / 2]} onClick={(event) => { event.stopPropagation(); onBuildingClick(harbor) }}>
      <Block position={[0, 0, 0]} size={[.95, .12, .65]} color="#997044" />
      {[-.26, .26].map((z) => <Block key={z} position={[.4, .03, z]} size={[.09, .5, .09]} color="#62492f" />)}
    </group>}
  </group>
}
