"""Modbus service with mock data (replace with pymodbus for production)."""
import random
import math
from typing import List, Dict, Any, Tuple
from collections import deque
import time

MOCK_DEVICES = [
    {"id": "dev1", "name": "温湿度传感器-A区", "ip": "192.168.1.101", "port": 502, "slave_id": 1, "online": True},
    {"id": "dev2", "name": "压力变送器-B区", "ip": "192.168.1.102", "port": 502, "slave_id": 2, "online": True},
    {"id": "dev3", "name": "电机控制器-C区", "ip": "192.168.1.103", "port": 502, "slave_id": 3, "online": False},
]

device_online_history: Dict[str, deque] = {}
device_register_history: Dict[str, Dict[int, deque]] = {}
device_alarms: Dict[str, List[Dict[str, Any]]] = {}

MAX_HISTORY_POINTS = 100
WINDOW_DURATION_MS = 3600 * 1000

def _init_device_history(device_id: str):
    if device_id not in device_online_history:
        device_online_history[device_id] = deque(maxlen=MAX_HISTORY_POINTS)
    if device_id not in device_register_history:
        device_register_history[device_id] = {}
    if device_id not in device_alarms:
        device_alarms[device_id] = []

def get_device_status() -> List[Dict[str, Any]]:
    return MOCK_DEVICES

def read_registers(device_id: str, address: int, count: int) -> Dict[str, Any]:
    """Read registers via pymodbus (mock implementation)."""
    values = [round(random.uniform(0, 100), 2) for _ in range(count)]
    _init_device_history(device_id)
    for i, val in enumerate(values):
        addr = address + i
        if addr not in device_register_history[device_id]:
            device_register_history[device_id][addr] = deque(maxlen=MAX_HISTORY_POINTS)
        device_register_history[device_id][addr].append({"time": time.time() * 1000, "value": val})
    return {"device_id": device_id, "address": address, "values": values}

def _calc_online_rate(device_id: str, current_online: bool) -> Tuple[float, float]:
    _init_device_history(device_id)
    history = device_online_history[device_id]
    history.append({"time": time.time() * 1000, "online": current_online})
    if not history:
        return (1.0 if current_online else 0.0, 40.0 if current_online else 0.0)
    total = len(history)
    online_count = sum(1 for h in history if h["online"])
    online_rate = online_count / total if total > 0 else 0
    score = online_rate * 40.0
    return (online_rate, round(score, 2))

def _calc_alarm_score(device_id: str) -> Tuple[int, float]:
    _init_device_history(device_id)
    alarms = device_alarms.get(device_id, [])
    now = time.time() * 1000
    recent_alarms = [a for a in alarms if now - a["timestamp"] < WINDOW_DURATION_MS]
    weighted = 0
    for a in recent_alarms:
        level = a.get("level", "info")
        if level == "critical":
            weighted += 3
        elif level == "warning":
            weighted += 2
        else:
            weighted += 1
    if weighted == 0:
        score = 35.0
    elif weighted <= 2:
        score = 30.0
    elif weighted <= 5:
        score = 20.0
    elif weighted <= 10:
        score = 10.0
    else:
        score = 0.0
    return (weighted, round(score, 2))

def _calc_fluctuation(device_id: str) -> Tuple[float, float]:
    _init_device_history(device_id)
    reg_histories = device_register_history.get(device_id, {})
    if not reg_histories:
        return (0.0, 25.0)
    cv_list = []
    for addr, hist in reg_histories.items():
        if len(hist) < 5:
            continue
        values = [h["value"] for h in hist]
        n = len(values)
        mean = sum(values) / n
        if mean == 0:
            continue
        variance = sum((v - mean) ** 2 for v in values) / n
        std = math.sqrt(variance)
        cv = std / abs(mean)
        cv_list.append(cv)
    if not cv_list:
        return (0.0, 25.0)
    avg_cv = sum(cv_list) / len(cv_list)
    if avg_cv <= 0.01:
        score = 25.0
    elif avg_cv <= 0.05:
        score = 20.0
    elif avg_cv <= 0.1:
        score = 15.0
    elif avg_cv <= 0.2:
        score = 8.0
    else:
        score = 0.0
    return (round(avg_cv, 4), round(score, 2))

def _get_level(total_score: float) -> str:
    if total_score >= 90:
        return "excellent"
    elif total_score >= 75:
        return "good"
    elif total_score >= 60:
        return "fair"
    elif total_score >= 40:
        return "poor"
    else:
        return "critical"

def _get_suggestions(device_id: str, online_rate: float, alarm_weighted: int, cv_avg: float, level: str, online: bool) -> List[str]:
    suggestions = []
    if not online:
        suggestions.append("设备当前离线，请立即检查网络连接和供电状态")
    elif online_rate < 0.95:
        suggestions.append(f"在线率偏低({online_rate*100:.1f}%)，建议排查网络稳定性问题")
    if alarm_weighted >= 5:
        suggestions.append(f"近期告警频繁(加权{alarm_weighted}次)，请重点关注告警来源")
    elif alarm_weighted >= 2:
        suggestions.append("存在少量告警，建议及时复核处理")
    if cv_avg >= 0.1:
        suggestions.append(f"数据波动较大(CV={cv_avg:.2%})，建议检查传感器校准或信号干扰")
    if level == "critical":
        suggestions.append("综合状态危险，请安排运维人员现场排查")
    elif level == "poor":
        suggestions.append("综合状态较差，建议尽快安排诊断")
    if not suggestions:
        suggestions.append("设备运行状态良好，继续保持")
    return suggestions

def calculate_health_scores() -> Dict[str, Any]:
    """计算所有设备健康评分并返回风险排序"""
    results = []
    for dev in MOCK_DEVICES:
        device_id = dev["id"]
        _init_device_history(device_id)
        online_rate, online_score = _calc_online_rate(device_id, dev["online"])
        alarm_weighted, alarm_score = _calc_alarm_score(device_id)
        cv_avg, fluct_score = _calc_fluctuation(device_id)
        total = round(online_score + alarm_score + fluct_score, 2)
        level = _get_level(total)
        suggestions = _get_suggestions(device_id, online_rate, alarm_weighted, cv_avg, level, dev["online"])
        results.append({
            "device_id": device_id,
            "device_name": dev["name"],
            "total_score": total,
            "level": level,
            "detail": {
                "online_rate_score": online_score,
                "alarm_score": alarm_score,
                "fluctuation_score": fluct_score,
                "online_rate": round(online_rate, 4),
                "alarm_count_weighted": alarm_weighted,
                "fluctuation_cv_avg": cv_avg
            },
            "risk_rank": 0,
            "suggestions": suggestions
        })
    results.sort(key=lambda x: x["total_score"])
    for i, r in enumerate(results):
        r["risk_rank"] = i + 1
    total_score_sum = sum(r["total_score"] for r in results)
    avg_score = round(total_score_sum / len(results), 2) if results else 0
    critical_count = sum(1 for r in results if r["level"] == "critical")
    poor_count = sum(1 for r in results if r["level"] == "poor")
    return {
        "ranking": results,
        "overall_average_score": avg_score,
        "total_devices": len(results),
        "critical_count": critical_count,
        "poor_count": poor_count
    }
