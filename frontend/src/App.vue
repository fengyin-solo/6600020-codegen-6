<template>
  <div class="flex h-screen">
    <!-- Sidebar -->
    <div class="w-64 bg-gray-900 p-4 flex flex-col gap-3 border-r border-gray-800 overflow-y-auto">
      <h1 class="text-lg font-bold text-orange-400">Modbus 工业监控</h1>
      <div class="flex gap-2">
        <button @click="handleStartPoll" :disabled="store.isPolling" class="flex-1 bg-green-700 py-1.5 rounded text-xs hover:bg-green-600 disabled:opacity-50">
          {{ store.isPolling ? '采集中...' : '开始采集' }}
        </button>
        <button @click="handleStopPoll" :disabled="!store.isPolling" class="flex-1 bg-red-700 py-1.5 rounded text-xs hover:bg-red-600 disabled:opacity-50">
          停止
        </button>
      </div>
      <div>
        <label class="text-gray-400 text-xs">轮询间隔: {{ store.pollInterval }}ms</label>
        <input type="range" v-model.number="store.pollInterval" min="200" max="5000" step="100" class="w-full" />
      </div>

      <div class="flex border border-gray-700 rounded overflow-hidden">
        <button v-for="t in tabs" :key="t.key" @click="activeTab = t.key"
          class="flex-1 py-1.5 text-xs transition-colors"
          :class="activeTab === t.key ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'">
          {{ t.label }}
        </button>
      </div>

      <template v-if="activeTab === 'devices'">
        <h3 class="text-gray-400 text-xs mt-2">设备列表</h3>
        <div v-for="d in store.devices" :key="d.id" @click="store.selectDeviceById(d.id)"
          class="bg-gray-800 rounded p-2 cursor-pointer text-sm"
          :class="store.selectedDevice?.id === d.id ? 'ring-1 ring-orange-500' : ''">
          <div class="flex justify-between">
            <span>{{ d.name }}</span>
            <span class="w-2 h-2 rounded-full mt-1.5" :class="d.online ? 'bg-green-500' : 'bg-red-500'"></span>
          </div>
          <div class="text-xs text-gray-500">{{ d.ip }}:{{ d.port }} [{{ d.slaveId }}]</div>
        </div>
      </template>

      <template v-else>
        <h3 class="text-gray-400 text-xs mt-2">风险TOP3</h3>
        <div v-if="store.healthRanking" v-for="item in store.healthRanking.ranking.slice(0, 3)" :key="item.deviceId"
          @click="goDevice(item.deviceId)"
          class="bg-gray-800 rounded p-2 cursor-pointer text-sm border-l-2"
          :class="getLevelBorderClass(item.level)">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-1">
              <span class="w-5 h-5 rounded-full text-xs flex items-center justify-center"
                :class="getRankBadgeClass(item.riskRank)">
                {{ item.riskRank }}
              </span>
              <span class="truncate max-w-[120px]">{{ item.deviceName }}</span>
            </div>
            <span class="font-bold" :class="getScoreTextClass(item.totalScore)">{{ item.totalScore.toFixed(0) }}</span>
          </div>
          <div class="text-[10px] mt-1" :class="getLevelTextClass(item.level)">{{ getLevelLabel(item.level) }}</div>
        </div>
      </template>

      <div v-if="store.criticalAlarms.length" class="bg-red-900/50 rounded p-2 mt-2">
        <h4 class="text-red-400 text-xs font-bold">⚠ 严重告警 {{ store.criticalAlarms.length }}</h4>
        <div v-for="a in store.criticalAlarms.slice(0, 3)" :key="a.id" class="text-xs text-red-300 mt-1 truncate">
          {{ a.message }}
        </div>
      </div>

      <div class="text-xs text-gray-600 mt-auto">
        在线: {{ store.onlineDevices.length }}/{{ store.devices.length }}
      </div>
    </div>

    <!-- Main Dashboard -->
    <div class="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
      <HealthScorePanel />

      <div class="grid grid-cols-2 gap-3 flex-1 min-h-0">
        <!-- Chart -->
        <div class="bg-gray-900 rounded-xl p-3 flex flex-col min-h-0">
          <h3 class="text-sm text-gray-400 mb-2">
            实时趋势 — {{ store.selectedDevice?.name || '选择设备' }}
          </h3>
          <div class="flex-1 min-h-0">
            <TrendChart />
          </div>
        </div>

        <div class="flex flex-col gap-3 min-h-0">
          <!-- Register Gauges for selected device -->
          <div class="bg-gray-900 rounded-xl p-3">
            <h3 class="text-sm text-gray-400 mb-2">
              {{ store.selectedDevice?.name || '选择设备' }} — 寄存器
            </h3>
            <div v-if="store.selectedDevice" class="grid grid-cols-2 gap-2">
              <div v-for="r in store.selectedDevice.registers" :key="r.address"
                class="bg-gray-800 rounded-lg p-2">
                <div class="text-xs text-gray-400">{{ r.name }}</div>
                <div class="text-xl font-bold" :class="store.selectedDevice.online ? 'text-orange-400' : 'text-gray-600'">
                  {{ typeof r.value === 'number' ? r.value.toFixed(r.value > 100 ? 0 : 2) : r.value ? 'ON' : 'OFF' }}
                </div>
                <div class="text-[10px] text-gray-500">{{ r.unit }} · Addr:0x{{ r.address.toString(16).padStart(2, '0') }}</div>
              </div>
            </div>
            <div v-else class="text-gray-600 text-xs py-6 text-center">请从左侧选择设备</div>
          </div>

          <!-- Alarm List -->
          <div class="bg-gray-900 rounded-xl p-3 flex-1 flex flex-col min-h-0">
            <h3 class="text-sm text-gray-400 mb-2">告警记录 ({{ store.alarms.length }})</h3>
            <div class="flex-1 overflow-y-auto space-y-1 pr-1">
              <div v-for="a in store.alarms.slice(0, 20)" :key="a.id"
                class="flex justify-between text-xs bg-gray-800 rounded p-2"
                :class="{ 'border-l-4 border-red-500': a.level === 'critical', 'border-l-4 border-yellow-500': a.level === 'warning', 'border-l-4 border-blue-500': a.level === 'info' }">
                <span>{{ a.message }}</span>
                <div class="flex gap-2 flex-shrink-0">
                  <span class="text-gray-500">{{ new Date(a.timestamp).toLocaleTimeString() }}</span>
                  <button v-if="!a.acknowledged" @click="store.acknowledgeAlarm(a.id)" class="text-blue-400 hover:underline">确认</button>
                </div>
              </div>
              <div v-if="!store.alarms.length" class="text-gray-600 text-xs py-4 text-center">暂无告警</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useModbusStore } from './store/modbus'
import TrendChart from './components/TrendChart.vue'
import HealthScorePanel from './components/HealthScorePanel.vue'
import type { DeviceHealthScore } from './types'

const store = useModbusStore()
const tabs = [
  { key: 'devices', label: '设备' },
  { key: 'risk', label: '风险' }
]
const activeTab = ref('devices')

function handleStartPoll() {
  store.startPoll()
}

function handleStopPoll() {
  store.stopPoll()
}

function goDevice(id: string) {
  store.selectDeviceById(id)
  activeTab.value = 'devices'
}

watch(() => store.pollInterval, () => {
  if (store.isPolling) {
    store.startPoll()
  }
})

function getLevelBorderClass(level: DeviceHealthScore['level']): string {
  switch (level) {
    case 'excellent': return 'border-green-500'
    case 'good': return 'border-blue-500'
    case 'fair': return 'border-yellow-500'
    case 'poor': return 'border-orange-500'
    case 'critical': return 'border-red-500'
  }
}

function getLevelTextClass(level: DeviceHealthScore['level']): string {
  switch (level) {
    case 'excellent': return 'text-green-400'
    case 'good': return 'text-blue-400'
    case 'fair': return 'text-yellow-400'
    case 'poor': return 'text-orange-400'
    case 'critical': return 'text-red-400'
  }
}

function getLevelLabel(level: DeviceHealthScore['level']): string {
  switch (level) {
    case 'excellent': return '优秀'
    case 'good': return '良好'
    case 'fair': return '一般'
    case 'poor': return '较差'
    case 'critical': return '危险'
  }
}

function getRankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-red-600 text-white'
  if (rank === 2) return 'bg-orange-600 text-white'
  if (rank === 3) return 'bg-yellow-600 text-white'
  return 'bg-gray-600 text-gray-200'
}

function getScoreTextClass(score: number): string {
  if (score >= 90) return 'text-green-400'
  if (score >= 75) return 'text-blue-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

onMounted(() => store.initMockDevices())
onUnmounted(() => store.stopPoll())
</script>
