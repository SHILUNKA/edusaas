from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import random

app = FastAPI()

# --- 数据模型 (与 Rust 端对应) ---

class TimeSlot(BaseModel):
    day_of_week: int    # 1-7
    start_time: str     # "09:00"
    end_time: str       # "12:00"

class Teacher(BaseModel):
    id: str
    name: str
    skills: List[str]   # course_id 列表
    availability: List[TimeSlot]

class Course(BaseModel):
    id: str
    name: str
    duration: int       # 分钟

class Room(BaseModel):
    id: str
    name: str
    capacity: int

class ScheduleRequest(BaseModel):
    base_id: str
    start_date: str     # "2025-11-24" (本周一)
    teachers: List[Teacher]
    courses: List[Course]
    rooms: List[Room]
    # 简单的排课目标: 每个课程排几节? 
    # (简化: 默认每门课排 2 节)
    density: int = 2 

class ScheduledClass(BaseModel):
    course_id: str
    teacher_id: str
    room_id: str
    start_time: str # ISO format
    end_time: str   # ISO format
    day_label: str  # "周一"

# --- 核心算法 ---

def check_conflict(schedule, new_class):
    """检查是否有时间/资源冲突"""
    new_start = datetime.fromisoformat(new_class["start_time"])
    new_end = datetime.fromisoformat(new_class["end_time"])

    for item in schedule:
        existing_start = datetime.fromisoformat(item["start_time"])
        existing_end = datetime.fromisoformat(item["end_time"])

        # 时间重叠判断
        if max(new_start, existing_start) < min(new_end, existing_end):
            # 检查资源冲突 (同一老师 或 同一教室)
            if item["teacher_id"] == new_class["teacher_id"] or item["room_id"] == new_class["room_id"]:
                return True
    return False

@app.post("/schedule/generate")
def generate_schedule(req: ScheduleRequest):
    print(f"🤖 AI 收到排课请求: 基地 {req.base_id}")
    print(f"   资源: {len(req.teachers)}老师, {len(req.courses)}课程, {len(req.rooms)}教室")

    generated_schedule = []
    
    # 解析周一日期
    base_date = datetime.strptime(req.start_date, "%Y-%m-%d")

    # 简单的贪心算法
    # 1. 遍历每门课程
    for course in req.courses:
        scheduled_count = 0
        
        # 2. 寻找能教这门课的老师
        qualified_teachers = [t for t in req.teachers if course.id in t.skills]
        if not qualified_teachers:
            print(f"⚠️ 警告: 课程 {course.name} 没有老师能教，跳过。")
            continue

        # 3. 尝试排课 (目标: 排够 density 节)
        for _ in range(req.density):
            placed = False
            
            # 随机打乱资源顺序，避免总是排给同一个老师/教室
            random.shuffle(qualified_teachers)
            shuffled_rooms = req.rooms.copy()
            random.shuffle(shuffled_rooms)

            # 尝试匹配老师的时间表
            for teacher in qualified_teachers:
                if placed: break
                
                for slot in teacher.availability:
                    if placed: break
                    
                    # 在该时间段内尝试插入
                    # (简化: 直接尝试安排在 slot 的开始时间)
                    
                    # 计算具体的日期时间
                    # day_of_week: 1=Mon ... 7=Sun
                    # slot.day_of_week - 1 是天数偏移
                    day_offset = slot.day_of_week - 1
                    current_day = base_date + timedelta(days=day_offset)
                    
                    # 组合日期和时间字符串
                    class_start_dt = datetime.combine(
                        current_day.date(), 
                        datetime.strptime(slot.start_time, "%H:%M:%S").time() # 注意Rust传来的可能是HH:MM:SS
                    )
                    class_end_dt = class_start_dt + timedelta(minutes=course.duration)
                    
                    # 检查是否超出老师空闲结束时间
                    slot_end_dt = datetime.combine(
                        current_day.date(), 
                        datetime.strptime(slot.end_time, "%H:%M:%S").time()
                    )
                    
                    if class_end_dt > slot_end_dt:
                        continue # 这个空闲段不够长

                    # 寻找可用教室
                    for room in shuffled_rooms:
                        # 构造候选排课对象
                        candidate = {
                            "course_id": course.id,
                            "teacher_id": teacher.id,
                            "room_id": room.id,
                            "start_time": class_start_dt.isoformat(),
                            "end_time": class_end_dt.isoformat(),
                            "day_label": f"周{slot.day_of_week}"
                        }
                        
                        # 检查全局冲突
                        if not check_conflict(generated_schedule, candidate):
                            generated_schedule.append(candidate)
                            placed = True
                            scheduled_count += 1
                            break # 教室定了

    return {
        "status": "success",
        "total_generated": len(generated_schedule),
        "results": generated_schedule
    }

@app.get("/")
def root():
    return {"message": "Edusaas AI Engine Online"}

@app.get("/health")
def health():
    return {"status": "ok"}