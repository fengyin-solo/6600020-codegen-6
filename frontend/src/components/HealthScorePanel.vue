<template>
  <div v-if="ranking" class="space-y-3">
    <div class="grid grid-cols-4 gap-3">
      <div class="bg-gray-900 rounded-xl p-4 border-l-4" :class="avgScoreColor">
        <div class="text-xs text-gray-400 mb-1">系统平均评分</div>
        <div class="flex items-end gap-2">
          <span class="text-3xl font-bold" :class="avgScoreTextColor">{{ ranking.overallAverageScore.toFixed(1) }}</span>
          <span class="text-xs text-gray-500 mb-1">/ 100</span>
        </div>
        <div class="text-xs mt-1" :class="avgScoreTextColor">{{ avgLevelLabel }}</div>
      </div>
      <div class="bg-gray-900 rounded-xl p-4 border-l-4 border-blue-500">
        <div class="text-xs text-gray-400 mb-1">设备总数</div>
        <div class="text-3xl font-bold text-blue-400">{{ ranking.totalDevices }}</div>
        <div class="text-xs text-gray-500 mt-1">在线 {{ store.onlineDevices.length }} 台</div>
      </div>
      <div class="bg-gray-900 rounded-xl p-4 border-l-4 border-red-500">
        <div class="text-xs text-gray-400 mb-1">危险状态</div>
        <div class="text-3xl font-bold text-red-400">{{ ranking.criticalCount }}</div>
        <div class="text-xs text-gray-500 mt-1">需立即处理</div>
      </div>
      <div class="bg-gray-900 rounded-xl p-4 border-l-4 border-orange-500">
        <div class="text-xs text-gray-400 mb-1">较差状态</div>
        <div class="text-3xl font-bold text-orange-400">{{ ranking.poorCount }}</div>
        <div class="text-xs text-gray-500 mt-1">建议尽快诊断</div>
      </div>
    </div>

    <div class="bg-gray-900 rounded-xl p-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-sm font-bold text-gray-300 flex items-center gap-2">
          <svg class="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          风险排序（分数越低风险越高）
        </h3>
        <div class="flex gap-2 text-xs">
          <span class="px-2 py-0.5 rounded bg-green-900/50 text-green-400">优秀 90+</span>
          <span class="px-2 py-0.5 rounded bg-blue-900/50 text-blue-400">良好 75+</span>
          <span class="px-2 py-0.5 rounded bg-yellow-900/50 text-yellow-400">一般 60+</span>
          <span class="px-2 py-0.5 rounded bg-orange-900/50 text-orange-400">较差 40+</span>
          <span class="px-2 py-0.5 rounded bg-red-900/50 text-red-400">危险 &lt;40</span>
        </div>
      </div>
      <div class="space-y-2">
        <div v-for="item in ranking.ranking" :key="item.deviceId"
          class="bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition-colors cursor-pointer"
          :class="{ 'ring-1 ring-orange-500': selectedDeviceId === item.deviceId }"
          @click="selectDevice(item.deviceId)">
          <div class="flex items-center gap-4">
            <div class="flex flex-col items-center w-14">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                :class="getRankBadgeClass(item.riskRank)">
                {{ item.riskRank }}
              </div>
              <span class="text-[10px] text-gray-500 mt-1">风险排名</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-gray-200">{{ item.deviceName }}</span>
                <span class="px-2 py-0.5 rounded text-xs" :class="getLevelClass(item.level)">{{ getLevelLabel(item.level) }}</span>
              </div>
              <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                <div class="h-full rounded-full transition-all duration-500" :class="getScoreBarClass(item.totalScore)"
                  :style="{ width: item.totalScore + '%' }"></div>
              </div>
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div class="flex items-center gap-1">
                  <span class="text-gray-500">在线率</span>
                  <span class="font-medium" :class="item.detail.onlineRate >= 0.95 ? 'text-green-400' : 'text-red-400'">
                    {{ (item.detail.onlineRate * 100).toFixed(0) }}%
                  </span>
                  <span class="text-gray-600">({{ item.detail.onlineRateScore.toFixed(0) }}/40)</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-gray-500">告警</span>
                  <span class="font-medium" :class="item.detail.alarmCountWeighted === 0 ? 'text-green-400' : 'text-yellow-400'">
                    加权{{ item.detail.alarmCountWeighted }}次
                  </span>
                  <span class="text-gray-600">({{ item.detail.alarmScore.toFixed(0) }}/35)</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-gray-500">波动</span>
                  <span class="font-medium" :class="item.detail.fluctuationCvAvg < 0.05 ? 'text-green-400' : 'text-orange-400'">
                    CV={{ (item.detail.fluctuationCvAvg * 100).toFixed(1) }}%
                  </span>
                  <span class="text-gray-600">({{ item.detail.fluctuationScore.toFixed(0) }}/25)</span>
                </div>
              </div>
            </div>
            <div class="flex flex-col items-end w-24">
              <div class="text-2xl font-bold" :class="getScoreTextClass(item.totalScore)">{{ item.totalScore.toFixed(1) }}</div>
              <div class="text-[10px] text-gray-500">总分 / 100</div>
            </div>
          </div>
          <div v-if="item.suggestions.length" class="mt-2 pt-2 border-t border-gray-700">
            <div class="flex flex-wrap gap-1">
              <span v-for="(s, idx) in item.suggestions.slice(0, 3)" :key="idx"
                class="text-[11px] px-2 py-0.5 rounded-full"
                :class="item.level === 'critical' || item.level === 'poor' ? 'bg-red-900/30 text-red-300' : 'bg-blue-900/30 text-blue-300'">
                💡 {{ s }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useModbusStore } from '../store/modbus'
import type { DeviceHealthScore } from '../types'

const store = useModbusStore()
const selectedDeviceId = computed(() => store.selectedDevice?.id)

const ranking = computed(() => store.healthRanking)

const avgLevelLabel = computed(() => {
  if (!ranking.value) return ''
  const s = ranking.value.overallAverageScore
  if (s >= 90) return '运行优秀'
  if (s >= 75) return '整体良好'
  if (s >= 60) return '状态一般'
  if (s >= 40) return '表现较差'
  return '状态危险'
})

const avgScoreColor = computed(() => {
  if (!ranking.value) return 'border-gray-500'
  const s = ranking.value.overallAverageScore
  if (s >= 90) return 'border-green-500'
  if (s >= 75) return 'border-blue-500'
  if (s >= 60) return 'border-yellow-500'
  if (s >= 40) return 'border-orange-500'
  return 'border-red-500'
})

const avgScoreTextColor = computed(() => {
  if (!ranking.value) return 'text-gray-400'
  const s = ranking.value.overallAverageScore
  if (s >= 90) return 'text-green-400'
  if (s >= 75) return 'text-blue-400'
  if (s >= 60) return 'text-yellow-400'
  if (s >= 40) return 'text-orange-400'
  return 'text-red-400'
})

function selectDevice(id: string) {
  const dev = store.devices.find(d => d.id === id)
  if (dev) store.selectedDevice = dev
}

function getRankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-red-600 text-white'
  if (rank === 2) return 'bg-orange-600 text-white'
  if (rank === 3) return 'bg-yellow-600 text-white'
  return 'bg-gray-600 text-gray-200'
}

function getLevelClass(level: DeviceHealthScore['level']): string {
  switch (level) {
    case 'excellent': return 'bg-green-900/50 text-green-400'
    case 'good': return 'bg-blue-900/50 text-blue-400'
    case 'fair': return 'bg-yellow-900/50 text-yellow-400'
    case 'poor': return 'bg-orange-900/50 text-orange-400'
    case 'critical': return 'bg-red-900/50 text-red-400'
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

function getScoreBarClass(score: number): string {
  if (score >= 90) return 'bg-gradient-to-r from-green-500 to-green-400'
  if (score >= 75) return 'bg-gradient-to-r from-blue-500 to-blue-400'
  if (score >= 60) return 'bg-gradient-to-r from-yellow-500 to-yellow-400'
  if (score >= 40) return 'bg-gradient-to-r from-orange-500 to-orange-400'
  return 'bg-gradient-to-r from-red-600 to-red-500'
}

function getScoreTextClass(score: number): string {
  if (score >= 90) return 'text-green-400'
  if (score >= 75) return 'text-blue-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}
</script>
