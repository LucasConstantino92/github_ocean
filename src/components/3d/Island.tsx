import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
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

type Landmass = ShipProfile['island']['landmasses'][number]

function LandmassTerrain({ land, palette, seed, index }: { land: Landmass; palette: string; seed: number; index: number }) {
  const treeCount = 1 + (seed + index * 7) % 3
  return <group position={[land.x, 0, land.z]} rotation={[0, land.rotation, 0]}>
    {/* A sandy shelf and a rounded grass cap make each coast organic instead of tiled. */}
    <group scale={[land.stretch, 1, 1]}>
      <mesh position={[0, .17, 0]} receiveShadow>
        <cylinderGeometry args={[land.radius * .88, land.radius, .34 + land.height * .18, 9]} />
        <meshStandardMaterial color="#a78351" roughness={1} />
      </mesh>
      <mesh position={[0, .37 + land.height * .1, 0]} scale={[land.radius * .95, .25 + land.height * .2, land.radius * .93]} receiveShadow>
        <sphereGeometry args={[1, 10, 6]} />
        <meshStandardMaterial color={palette} roughness={1} />
      </mesh>
    </group>
    {Array.from({ length: treeCount }, (_, tree) => {
      const angle = (seed * .017 + tree * 2.4 + index) % (Math.PI * 2)
      const distance = land.radius * (.45 + (tree % 2) * .14)
      return <group key={tree} position={[Math.cos(angle) * distance * land.stretch, .58 + land.height * .1, Math.sin(angle) * distance]}>
        <Block position={[0, .17, 0]} size={[.08, .34, .08]} color="#70452b" />
        <mesh position={[0, .48, 0]} castShadow><coneGeometry args={[.23, .6, 6]} /><meshStandardMaterial color={tree % 2 ? '#316d4f' : '#3a7755'} /></mesh>
      </group>
    })}
  </group>
}

function Mountain({ land, index }: { land: Landmass; index: number }) {
  const side = index % 2 ? -.46 : .46
  return <group position={[land.x + Math.cos(land.rotation) * land.radius * side, .53, land.z + Math.sin(land.rotation) * land.radius * side]}>
    <mesh castShadow receiveShadow><coneGeometry args={[land.radius * .32, .75 + land.height * .9, 7]} /><meshStandardMaterial color="#66736a" roughness={1} /></mesh>
    <mesh position={[0, .25 + land.height * .31, 0]} castShadow><coneGeometry args={[land.radius * .22, .48 + land.height * .55, 7]} /><meshStandardMaterial color="#7d8c76" roughness={1} /></mesh>
  </group>
}

function CentralManor({ land, color }: { land: Landmass; color: string }) {
  return <group position={[land.x - Math.cos(land.rotation) * land.radius * .22, .7 + land.height * .16, land.z - Math.sin(land.rotation) * land.radius * .22]} rotation={[0, land.rotation, 0]}>
    <Block position={[0, .32, 0]} size={[.92, .64, .7]} color="#d2bb87" />
    <mesh position={[0, .79, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[.67, .4, 4]} /><meshStandardMaterial color={color} /></mesh>
    <Block position={[0, .25, .36]} size={[.16, .34, .03]} color="#573d2c" />
    <Block position={[-.28, .47, .36]} size={[.13, .13, .025]} color="#f3d987" />
    <Block position={[.28, .47, .36]} size={[.13, .13, .025]} color="#f3d987" />
  </group>
}

function PortResidents({ land, count, seed }: { land: Landmass; count: number; seed: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const dummy = useRef(new THREE.Object3D())
  useFrame(({ clock }) => {
    const marker = dummy.current
    for (let index = 0; index < count; index++) {
      const phase = clock.elapsedTime * (.35 + (index % 3) * .06) + seed * .01 + index * 1.73
      const radius = land.radius * (.28 + (index % 2) * .13)
      marker.position.set(
        land.x + Math.cos(phase) * radius * land.stretch,
        .64 + land.height * .24 + Math.abs(Math.sin(phase * 2)) * .018,
        land.z + Math.sin(phase) * radius
      )
      marker.rotation.set(0, -phase + Math.PI / 2, 0)
      marker.position.y += .13
      marker.updateMatrix()
      bodies.current?.setMatrixAt(index, marker.matrix)
      marker.position.y += .19
      marker.updateMatrix()
      heads.current?.setMatrixAt(index, marker.matrix)
    }
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
  })
  return <>
    <instancedMesh ref={bodies} args={[undefined, undefined, count]} castShadow>
      <cylinderGeometry args={[.055, .075, .26, 5]} />
      <meshStandardMaterial color="#4c7890" />
    </instancedMesh>
    <instancedMesh ref={heads} args={[undefined, undefined, count]} castShadow>
      <sphereGeometry args={[.07, 6, 5]} />
      <meshStandardMaterial color="#d9a478" />
    </instancedMesh>
  </>
}

function MerchantBoat({ land, seed }: { land: Landmass; seed: number }) {
  const boat = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!boat.current) return
    const phase = clock.elapsedTime * .18 + seed * .02
    const offset = Math.sin(phase) * .82
    boat.current.position.set(land.x + Math.cos(land.rotation) * (land.radius * land.stretch + 1.35), .2 + Math.sin(phase * 2) * .035, land.z + Math.sin(land.rotation) * (land.radius + .65) + offset)
    boat.current.rotation.set(0, land.rotation + Math.sin(phase) * .16, Math.sin(phase * 2) * .035)
  })
  return <group ref={boat}>
    <mesh castShadow><boxGeometry args={[.9, .18, .34]} /><meshStandardMaterial color="#69432c" /></mesh>
    <mesh position={[0, .31, 0]} castShadow><cylinderGeometry args={[.025, .025, .66, 6]} /><meshStandardMaterial color="#3b281d" /></mesh>
    <mesh position={[.11, .47, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[.42, .44]} /><meshStandardMaterial color="#e4d5b0" side={THREE.DoubleSide} /></mesh>
  </group>
}

function NightPortLights({ buildings }: { buildings: Building[] }) {
  return <group>
    <pointLight position={[0, 2.8, 0]} color="#ffc66f" intensity={3.2} distance={8} decay={2} />
    {buildings.slice(0, 5).map((building) => <group key={building.id} position={[building.position[0] + .34, building.position[1] + .42, building.position[2] + .3]}>
      <mesh><sphereGeometry args={[.075, 6, 5]} /><meshStandardMaterial color="#ffbc59" emissive="#ff8b38" emissiveIntensity={2.6} /></mesh>
      <mesh position={[0, .12, 0]}><cylinderGeometry args={[.015, .015, .18, 5]} /><meshStandardMaterial color="#433427" /></mesh>
    </group>)}
  </group>
}

function DockingPier({ profile }: { profile: ShipProfile }) {
  const x = profile.position[0] - profile.homePosition[0]
  const z = profile.position[2] - profile.homePosition[2]
  return <group position={[x, .12, z]}>
    {/* A short pier reaches toward the anchored ship without intersecting it. */}
    <Block position={[-1.25, 0, 0]} size={[1.4, .12, .58]} color="#9b6a41" />
    {[-1.85, -.7].flatMap((pierX) => [-.3, .3].map((pierZ) => <Block key={`${pierX}:${pierZ}`} position={[pierX, -.1, pierZ]} size={[.08, .52, .08]} color="#5d4029" />))}
    <Block position={[-1.9, .55, -.3]} size={[.045, 1.05, .045]} color="#5d4029" />
    <mesh position={[-1.9, 1.02, -.3]}><sphereGeometry args={[.09, 7, 6]} /><meshStandardMaterial color="#ffd06d" emissive="#ff9a38" emissiveIntensity={1.8} /></mesh>
  </group>
}

function PathNetwork({ profile }: { profile: ShipProfile }) {
  const paths = useMemo(() => {
    const groups = new Map<number, Building[]>()
    for (const building of profile.progression.buildings) {
      let closest = 0
      let closestDistance = Infinity
      profile.island.landmasses.forEach((land, index) => {
        const distance = (building.position[0] - land.x) ** 2 + (building.position[2] - land.z) ** 2
        if (distance < closestDistance) { closestDistance = distance; closest = index }
      })
      groups.set(closest, [...(groups.get(closest) ?? []), building])
    }
    return [...groups.values()].flatMap((buildings) => buildings.slice(1).map((building) => [buildings[0], building] as const))
  }, [profile])
  const score = profile.progression.score
  const surface = score >= 70 ? '#8d9492' : score >= 38 ? '#9c9278' : '#aa855d'
  const width = score >= 70 ? .28 : score >= 38 ? .22 : .16
  return <group>
    {paths.map(([from, to]) => {
      const dx = to.position[0] - from.position[0]
      const dz = to.position[2] - from.position[2]
      const length = Math.hypot(dx, dz)
      if (length < .1) return null
      return <mesh key={`${from.id}:${to.id}`} position={[(from.position[0] + to.position[0]) / 2, Math.min(from.position[1], to.position[1]) - .08, (from.position[2] + to.position[2]) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]} receiveShadow>
        <boxGeometry args={[length, .035, width]} />
        <meshStandardMaterial color={surface} roughness={.96} />
      </mesh>
    })}
  </group>
}

export function HomeIsland({ profile, onClick, onRepositoryClick, onBuildingClick, isNight = false, ambient = true, shadows = true }: {
  profile: ShipProfile; onClick?: () => void
  onRepositoryClick?: (repository: RepositoryIsland) => void
  onBuildingClick: (building: Building) => void
  isNight?: boolean
  ambient?: boolean
  shadows?: boolean
}) {
  const { landmasses, level } = profile.island
  const seed = hash(profile.user.login)
  const palette = ['#6fa666', '#80a96c', '#619b77', '#95a66a'][seed % 4]
  const harbor = profile.progression.buildings.find((building) => building.id === 'harbor')
  const mainLand = landmasses[0]
  const mountainCount = Math.min(3, Math.floor(level / 3))
  const islandRef = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    islandRef.current?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = shadows
      object.receiveShadow = shadows
    })
  }, [shadows])
  return <group ref={islandRef} position={profile.homePosition} onClick={(event) => { event.stopPropagation(); onClick?.() }}>
    {landmasses.map((land, index) => <LandmassTerrain key={index} land={land} palette={(seed + index) % 3 === 0 ? '#80af71' : palette} seed={seed} index={index} />)}
    {Array.from({ length: mountainCount }, (_, index) => <Mountain key={index} land={landmasses[(seed + index * 2) % landmasses.length]} index={index} />)}
    {level >= 5 && <CentralManor land={mainLand} color={profile.languages[0]?.color ?? '#875337'} />}
    {ambient && <PortResidents land={mainLand} count={Math.min(6, 2 + Math.floor(level / 2))} seed={seed} />}
    {ambient && <MerchantBoat land={mainLand} seed={seed} />}
    <PathNetwork profile={profile} />
    {profile.progression.buildings.map((building) => {
      const repository = profile.repositories.find((repo) => repo.html_url === building.repositoryUrl)
      return <InteractiveBuilding key={building.id} building={building} repository={repository}
        color={repository?.color ?? profile.languages[0]?.color ?? '#c6844f'}
        onClick={() => repository ? onRepositoryClick?.(repository) : onBuildingClick(building)} />
    })}
    {harbor && <group position={[mainLand.x + Math.cos(mainLand.rotation) * mainLand.radius * mainLand.stretch, .3, mainLand.z + Math.sin(mainLand.rotation) * mainLand.radius]} rotation={[0, mainLand.rotation, 0]} onClick={(event) => { event.stopPropagation(); onBuildingClick(harbor) }}>
      <Block position={[0, 0, 0]} size={[.95, .12, .65]} color="#997044" />
      {[-.26, .26].map((z) => <Block key={z} position={[.4, .03, z]} size={[.09, .5, .09]} color="#62492f" />)}
    </group>}
    <DockingPier profile={profile} />
    {isNight && ambient && <NightPortLights buildings={profile.progression.buildings} />}
  </group>
}
