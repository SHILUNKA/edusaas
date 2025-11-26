from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello from Python (ai_api)!"}

@app.get("/health")
def health_check():
    """
    一个简单的健康检查，用于被 Rust 服务调用
    """
    return {"status": "ok", "service": "ai_api", "language": "python"}

class ScheduleRequest(BaseModel):
    tenant_id: str
    base_id: str
    week_start: str

@app.post("/schedule/generate")
def generate_schedule(req: ScheduleRequest):
    """
    AI 自动排课接口
    输入：基地ID、日期范围
    输出：推荐的排课列表
    逻辑：
    1. 获取该基地所有“待排课程” (通常是根据消课进度预测)
    2. 获取所有老师的 Availability 和 Skills
    3. 使用贪心算法或约束满足(CSP)算法进行匹配
    """
    print(f"正在为基地 {req.base_id} 计算排课方案...")
    
    # --- 模拟 AI 计算过程 ---
    # 假设我们找到了 5 节课的最优安排
    proposed_schedule = []
    
    # 模拟数据：周一到周五
    courses = ["少儿编程 L1", "乐高机器人", "科学实验", "Python进阶"]
    times = ["09:00", "10:30", "14:00", "16:00"]
    
    for i in range(5):
        proposed_schedule.append({
            "day_offset": i, # 距周一的天数
            "start_time": random.choice(times),
            "duration": 60,
            "course_name": random.choice(courses),
            "teacher_name": "AI推荐老师", # 实际应返回 teacher_id
            "room_name": "智能教室A"      # 实际应返回 room_id
        })
        
    return {
        "status": "success",
        "generated_classes": proposed_schedule,
        "message": "AI 排课完成，生成了 5 节推荐课程"
    }

if __name__ == "__main__":
    # 这只是为了本地调试，Docker 会直接用 uvicorn 命令
    uvicorn.run(app, host="0.0.0.0", port=8001)