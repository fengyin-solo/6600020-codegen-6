from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ModbusRegister(BaseModel):
    address: int
    name: str
    type: str
    value: float
    unit: str

class Device(BaseModel):
    id: str
    name: str
    ip: str
    port: int
    slave_id: int
    online: bool
    registers: List[ModbusRegister] = []

class HealthScoreDetail(BaseModel):
    online_rate_score: float
    alarm_score: float
    fluctuation_score: float
    online_rate: float
    alarm_count_weighted: int
    fluctuation_cv_avg: float

class DeviceHealthScore(BaseModel):
    device_id: str
    device_name: str
    total_score: float
    level: str
    detail: HealthScoreDetail
    risk_rank: int
    suggestions: List[str]

class HealthRankingResponse(BaseModel):
    ranking: List[DeviceHealthScore]
    overall_average_score: float
    total_devices: int
    critical_count: int
    poor_count: int
