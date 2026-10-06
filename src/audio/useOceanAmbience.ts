import { useEffect } from 'react'
import { playerSailingMetrics } from '../utils/oceanMath'

export function useOceanAmbience(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()

    // 1. Som de ondas base (ruído marinho browniano)
    const seconds = 4
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let index = 0; index < data.length; index++) {
      last = last * 0.982 + (Math.random() * 2 - 1) * 0.08
      data[index] = last
    }

    const oceanSource = context.createBufferSource()
    oceanSource.buffer = buffer
    oceanSource.loop = true

    const oceanFilter = context.createBiquadFilter()
    oceanFilter.type = 'lowpass'
    oceanFilter.frequency.value = 380

    const oceanGain = context.createGain()
    oceanGain.gain.value = 0.055

    oceanSource.connect(oceanFilter).connect(oceanGain).connect(context.destination)
    oceanSource.start()

    // 2. Modulação rítmica das ondas (LFO senoidal de vai-e-vem da maré a cada ~5.5s)
    const waveLfo = context.createOscillator()
    waveLfo.type = 'sine'
    waveLfo.frequency.value = 0.18

    const lfoGain = context.createGain()
    lfoGain.gain.value = 160 // modula corte entre 220Hz e 540Hz
    waveLfo.connect(lfoGain)
    lfoGain.connect(oceanFilter.frequency)
    waveLfo.start()

    // 3. Canal de vento e deslocamento de água (reage dinamicamente à velocidade do barco)
    const sprayBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
    const sprayData = sprayBuffer.getChannelData(0)
    let sprayLast = 0
    for (let index = 0; index < sprayData.length; index++) {
      sprayLast = sprayLast * 0.92 + (Math.random() * 2 - 1) * 0.12
      sprayData[index] = sprayLast
    }
    const spraySource = context.createBufferSource()
    spraySource.buffer = sprayBuffer
    spraySource.loop = true

    const sprayFilter = context.createBiquadFilter()
    sprayFilter.type = 'bandpass'
    sprayFilter.frequency.value = 680
    sprayFilter.Q.value = 1.2

    const sprayGain = context.createGain()
    sprayGain.gain.value = 0.001

    spraySource.connect(sprayFilter).connect(sprayGain).connect(context.destination)
    spraySource.start()

    // Intervalo suave para modular o ganho de corte d'água de acordo com a velocidade
    const interval = window.setInterval(() => {
      const speedRatio = Math.min(Math.abs(playerSailingMetrics.speed) / playerSailingMetrics.maxSpeed, 1.0)
      const targetGain = 0.003 + speedRatio * 0.065
      sprayGain.gain.setTargetAtTime(targetGain, context.currentTime, 0.15)
      sprayFilter.frequency.setTargetAtTime(550 + speedRatio * 350, context.currentTime, 0.2)
    }, 80)

    return () => {
      window.clearInterval(interval)
      oceanSource.stop()
      waveLfo.stop()
      spraySource.stop()
      void context.close()
    }
  }, [enabled])
}
