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

if __name__ == "__main__":
    # 这只是为了本地调试，Docker 会直接用 uvicorn 命令
    uvicorn.run(app, host="0.0.0.0", port=8001)