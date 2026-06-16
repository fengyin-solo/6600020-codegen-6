import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Device, Alarm, ModbusRegister, DeviceHealthScore, HealthRanking, DeviceOnlineStats } from '../types'

export const useModbusStore = defineStore('modbus', () => {
  const devices = ref<Device[]>([])
  const alarms = ref<Alarm[]>([])
  const historyData = ref<Record<string, { time: number[]; values: number[] }>>({})
  const isPolling = ref(false)
  const pollInterval = ref(1000)
  const selectedDevice = ref<Device | null>(null)
  const onlineStats = ref<Record<string, DeviceOnlineStats>>({})

  const criticalAlarms = computed(() => alarms.value.filter(a => a.level === 'critical' && !a.acknowledged))
  const onlineDevices = computed(() => devices.value.filter(d => d.online))

  const healthRanking = computed<HealthRanking | null>(() => {
    if (devices.value.length === 0) return null
    const scores: DeviceHealthScore[] = devices.value.map(dev => {
      const { onlineRate, onlineScore } = calcOnlineRate(dev.id, dev.online)
      const { alarmWeighted, alarmScore } = calcAlarmScore(dev.id)
      const { cvAvg, fluctScore } = calcFluctuation(dev.id)
      const total = Math.round((onlineScore + alarmScore + fluctScore) * 100) / 100
      const level = getLevel(total)
      const suggestions = getSuggestions(onlineRate, alarmWeighted, cvAvg, level, dev.online)
      return {
        deviceId: dev.id,
        deviceName: dev.name,
        totalScore: total,
        level,
        detail: {
          onlineRateScore: onlineScore,
          alarmScore,
          fluctuationScore: fluctScore,
          onlineRate: Math.round(onlineRate * 10000) / 10000,
          alarmCountWeighted: alarmWeighted,
          fluctuationCvAvg: cvAvg
        },
        riskRank: 0,
        suggestions
      }
    })
    scores.sort((a, b) => a.totalScore - b.totalScore)
    scores.forEach((s, i) => s.riskRank = i + 1)
    const avgScore = scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length
    const criticalCount = scores.filter(s => s.level === 'critical').length
    const poorCount = scores.filter(s => s.level === 'poor').length
    return {
      ranking: scores,
      overallAverageScore: Math.round(avgScore * 100) / 100,
      totalDevices: scores.length,
      criticalCount,
      poorCount
    }
  })

  function calcOnlineRate(deviceId: string, currentOnline: boolean): { onlineRate: number; onlineScore: number } {
    if (!onlineStats.value[deviceId]) {
      onlineStats.value[deviceId] = {
        deviceId,
        onlineDuration: 0,
        totalDuration: 0,
        lastOnlineTime: null,
        stateHistory: []
      }
    }
    const stats = onlineStats.value[deviceId]
    const now = Date.now()
    stats.stateHistory.push({ time: now, online: currentOnline })
    if (stats.stateHistory.length > 100) stats.stateHistory.shift()
    const total = stats.stateHistory.length
    const onlineCount = stats.stateHistory.filter(s => s.online).length
    const rate = total > 0 ? onlineCount / total : (currentOnline ? 1 : 0)
    return { onlineRate: rate, onlineScore: Math.round(rate * 40 * 100) / 100 }
  }

  function calcAlarmScore(deviceId: string): { alarmWeighted: number; alarmScore: number } {
    const now = Date.now()
    const windowMs = 3600 * 1000
    const recentAlarms = alarms.value.filter(a => a.deviceId === deviceId && (now - a.timestamp) < windowMs && !a.acknowledged)
    let weighted = 0
    recentAlarms.forEach(a => {
      if (a.level === 'critical') weighted += 3
      else if (a.level === 'warning') weighted += 2
      else weighted += 1
    })
    let score = 35
    if (weighted === 0) score = 35
    else if (weighted <= 2) score = 30
    else if (weighted <= 5) score = 20
    else if (weighted <= 10) score = 10
    else score = 0
    return { alarmWeighted: weighted, alarmScore: score }
  }

  function calcFluctuation(deviceId: string): { cvAvg: number; fluctScore: number } {
    const dev = devices.value.find(d => d.id === deviceId)
    if (!dev || !dev.registers.length) return { cvAvg: 0, fluctScore: 25 }
    const cvList: number[] = []
    dev.registers.forEach(reg => {
      if (typeof reg.value !== 'number') return
      const key = `${deviceId}_${reg.address}`
      const hist = historyData.value[key]
      if (!hist || hist.values.length < 5) return
      const n = hist.values.length
      const mean = hist.values.reduce((s, v) => s + v, 0) / n
      if (mean === 0) return
      const variance = hist.values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n
      const std = Math.sqrt(variance)
      const cv = std / Math.abs(mean)
      cvList.push(cv)
    })
    if (!cvList.length) return { cvAvg: 0, fluctScore: 25 }
    const avgCv = cvList.reduce((s, v) => s + v, 0) / cvList.length
    let score = 25
    if (avgCv <= 0.01) score = 25
    else if (avgCv <= 0.05) score = 20
    else if (avgCv <= 0.1) score = 15
    else if (avgCv <= 0.2) score = 8
    else score = 0
    return { cvAvg: Math.round(avgCv * 10000) / 10000, fluctScore: score }
  }

  function getLevel(total: number): DeviceHealthScore['level'] {
    if (total >= 90) return 'excellent'
    if (total >= 75) return 'good'
    if (total >= 60) return 'fair'
    if (total >= 40) return 'poor'
    return 'critical'
  }

  function getSuggestions(onlineRate: number, alarmWeighted: number, cvAvg: number, level: DeviceHealthScore['level'], online: boolean): string[] {
    const suggestions: string[] = []
    if (!online) {
      suggestions.push('设备当前离线，请立即检查网络连接和供电状态')
    } else if (onlineRate < 0.95) {
      suggestions.push(`在线率偏低(${(onlineRate * 100).toFixed(1)}%)，建议排查网络稳定性问题`)
    }
    if (alarmWeighted >= 5) {
      suggestions.push(`近期告警频繁(加权${alarmWeighted}次)，请重点关注告警来源`)
    } else if (alarmWeighted >= 2) {
      suggestions.push('存在少量告警，建议及时复核处理')
    }
    if (cvAvg >= 0.1) {
      suggestions.push(`数据波动较大(CV=${(cvAvg * 100).toFixed(1)}%)，建议检查传感器校准或信号干扰`)
    }
    if (level === 'critical') {
      suggestions.push('综合状态危险，请安排运维人员现场排查')
    } else if (level === 'poor') {
      suggestions.push('综合状态较差，建议尽快安排诊断')
    }
    if (!suggestions.length) {
      suggestions.push('设备运行状态良好，继续保持')
    }
    return suggestions
  }

  function initMockDevices() {
    devices.value = [
      {
        id: 'dev1', name: '温湿度传感器-A区', ip: '192.168.1.101', port: 502, slaveId: 1, online: true,
        registers: [
          { address: 0, name: '温度', type: 'holding', value: 25.6, unit: '°C', updatedAt: Date.now() },
          { address: 1, name: '湿度', type: 'holding', value: 62.3, unit: '%RH', updatedAt: Date.now() },
          { address: 2, name: '露点', type: 'holding', value: 17.8, unit: '°C', updatedAt: Date.now() },
        ]
      },
      {
        id: 'dev2', name: '压力变送器-B区', ip: '192.168.1.102', port: 502, slaveId: 2, online: true,
        registers: [
          { address: 0, name: '管道压力', type: 'holding', value: 3.45, unit: 'MPa', updatedAt: Date.now() },
          { address: 1, name: '差压', type: 'holding', value: 0.12, unit: 'kPa', updatedAt: Date.now() },
        ]
      },
      {
        id: 'dev3', name: '电机控制器-C区', ip: '192.168.1.103', port: 502, slaveId: 3, online: false,
        registers: [
          { address: 0, name: '转速', type: 'holding', value: 1480, unit: 'RPM', updatedAt: Date.now() },
          { address: 1, name: '电流', type: 'holding', value: 12.5, unit: 'A', updatedAt: Date.now() },
          { address: 2, name: '运行状态', type: 'coil', value: true, unit: '', updatedAt: Date.now() },
        ]
      },
      {
        id: 'dev4', name: '流量计-D区', ip: '192.168.1.104', port: 502, slaveId: 4, online: true,
        registers: [
          { address: 0, name: '瞬时流量', type: 'holding', value: 156.7, unit: 'L/min', updatedAt: Date.now() },
          { address: 1, name: '累计流量', type: 'holding', value: 98234, unit: 'L', updatedAt: Date.now() },
        ]
      },
    ]
    selectedDevice.value = devices.value[0]
  }

  function simulatePoll() {
    for (const dev of devices.value) {
      if (!dev.online) continue
      for (const reg of dev.registers) {
        if (typeof reg.value === 'number') {
          const noise = (Math.random() - 0.5) * reg.value * 0.02
          reg.value = Math.round((reg.value + noise) * 100) / 100
          reg.updatedAt = Date.now()
          const key = `${dev.id}_${reg.address}`
          if (!historyData.value[key]) historyData.value[key] = { time: [], values: [] }
          historyData.value[key].time.push(Date.now())
          historyData.value[key].values.push(reg.value)
          if (historyData.value[key].time.length > 100) {
            historyData.value[key].time.shift()
            historyData.value[key].values.shift()
          }
          // Check thresholds
          if (reg.name === '温度' && reg.value > 28) {
            alarms.value.unshift({
              id: `a_${Date.now()}`, deviceId: dev.id, register: reg.name,
              message: `${dev.name} ${reg.name}超限: ${reg.value}${reg.unit}`,
              level: reg.value > 30 ? 'critical' : 'warning',
              timestamp: Date.now(), acknowledged: false
            })
          }
        }
      }
    }
    if (alarms.value.length > 50) alarms.value = alarms.value.slice(0, 50)
  }

  function acknowledgeAlarm(id: string) {
    const a = alarms.value.find(a => a.id === id)
    if (a) a.acknowledged = true
  }

  function toggleDevice(id: string) {
    const d = devices.value.find(d => d.id === id)
    if (d) d.online = !d.online
  }

  return {
    devices, alarms, historyData, isPolling, pollInterval, selectedDevice, onlineStats,
    criticalAlarms, onlineDevices, healthRanking,
    initMockDevices, simulatePoll, acknowledgeAlarm, toggleDevice
  }
})
