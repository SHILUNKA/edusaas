# ai_api/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import qrcode
from PIL import Image, ImageDraw, ImageFont
import io
import base64
# import openai # (实际使用时解开)

app = FastAPI()

# ... (保留之前的 health check 和 schedule 接口) ...

# --- 海报生成模块 ---

class PosterRequest(BaseModel):
    course_name: str
    course_info: str  # e.g. "60分钟 | 10积分"
    qr_content: str   # 报名链接
    style: str        # "cartoon", "tech", "minimalist"

def generate_ai_background(style: str, subject: str) -> Image.Image:
    """
    模拟调用 AI 绘图 API (如 DALL-E 3)
    实际项目中，这里会发送请求给 OpenAI 并下载图片
    """
    print(f"🎨 AI 正在绘制: 风格={style}, 主题={subject}")
    
    # --- (模拟) 创建一个纯色背景代替 AI 生成图 ---
    # 在真实场景中，这里应该是: response = openai.Image.create(...)
    img = Image.new('RGB', (1080, 1920), color=(240, 240, 255)) # 9:16 手机海报尺寸
    draw = ImageDraw.Draw(img)
    
    # 模拟 AI 画的背景元素
    if style == "tech":
        draw.rectangle([0, 0, 1080, 1920], fill="#0f172a") # 深蓝背景
        draw.ellipse([100, 100, 500, 500], outline="#3b82f6", width=10)
    elif style == "cartoon":
        draw.rectangle([0, 0, 1080, 1920], fill="#fff7ed") # 暖色背景
        draw.ellipse([600, 1200, 1200, 1800], fill="#fdba74")
        
    return img

def overlay_text_and_qr(bg_img: Image.Image, req: PosterRequest) -> str:
    """
    使用 Pillow 进行图文合成
    """
    draw = ImageDraw.Draw(bg_img)
    width, height = bg_img.size
    
    # 1. 写入标题 (需要中文字体文件，Docker里可能需要安装或映射)
    # 这里为了演示不报错，使用默认字体(可能不支持中文)，实际需加载 .ttf
    # font = ImageFont.truetype("simhei.ttf", 80) 
    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
    except:
        font_title = ImageFont.load_default()
        
    # 模拟居中写字 (在图片上方 1/4 处)
    # draw.text((width/2 - 200, 400), req.course_name, fill="black", font=font_title)
    # (由于默认字体不支持中文，这里暂时 print log)
    print(f"✍️ 写入文字: {req.course_name}")

    # 2. 生成二维码
    qr = qrcode.QRCode(box_size=10, border=2)
    qr.add_data(req.qr_content)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    # 3. 粘贴二维码 (在底部)
    qr_pos = ((width - qr_img.size[0]) // 2, height - 500)
    bg_img.paste(qr_img, qr_pos)
    
    # 4. 转 Base64 返回 (或者上传 OSS 返回 URL)
    buffered = io.BytesIO()
    bg_img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

@app.post("/poster/generate")
def generate_poster_api(req: PosterRequest):
    try:
        # 1. AI 生成底图
        background = generate_ai_background(req.style, req.course_name)
        
        # 2. 算法合成文字
        poster_url = overlay_text_and_qr(background, req)
        
        return {"status": "success", "poster_url": poster_url}
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))