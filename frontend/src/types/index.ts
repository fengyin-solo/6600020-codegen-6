export interface ModbusRegister {
  address: number
  name: string
  type: 'coil' | 'discrete' | 'holding' | 'input'
  value: number | boolean
  unit: string
  updatedAt: number
}

export interface Device {
  id: string
  name: string
  ip: string
  port: number
  slaveId: number
  online: boolean
  registers: ModbusRegister[]
}

export interface Alarm {
  id: string
  deviceId: string
  register: string
  message: string
  level: 'info' | 'warning' | 'critical'
  timestamp: number
  acknowledged: boolean
}

export interface HealthScoreDetail {
  onlineRateScore: number
  alarmScore: number
  fluctuationScore: number
  onlineRate: number
  alarmCountWeighted: number
  fluctuationCvAvg: number
}

export interface DeviceHealthScore {
  deviceId: string
  deviceName: string
  totalScore: number
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  detail: HealthScoreDetail
  riskRank: number
  suggestions: string[]
}

export interface HealthRanking {
  ranking: DeviceHealthScore[]
  overallAverageScore: number
  totalDevices: number
  criticalCount: number
  poorCount: number
}

export interface DeviceOnlineStats {
  deviceId: string
  onlineDuration: number
  totalDuration: number
  lastOnlineTime: number | null
  stateHistory: { time: number; online: boolean }[]
}
