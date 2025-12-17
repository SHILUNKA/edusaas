use axum::{
    extract::{Multipart, multipart::Field},
    http::StatusCode,
    Json,
    body::Bytes,
};
use std::path::Path;
use tokio::fs;
use uuid::Uuid;

#[derive(serde::Serialize)]
pub struct UploadResponse {
    pub url: String,
}

// POST /api/v1/upload
pub async fn upload_file_handler(
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, StatusCode> {
    
    // 使用 loop 循环替代 while let，配合显式 match，解决所有类型推断问题
    loop {
        // 1. 获取下一个字段
        let next_field_result = multipart.next_field().await;
        
        // 显式处理 Result，编译器不再困惑
        let field: Field = match next_field_result {
            Ok(Some(f)) => f,      // 拿到字段
            Ok(None) => break,     // 结束循环
            Err(e) => {
                tracing::error!("Multipart error: {}", e);
                return Err(StatusCode::BAD_REQUEST);
            }
        };

        let name = field.name().unwrap_or("").to_string();
        
        if name == "file" {
            let file_name = field.file_name().unwrap_or("unknown.jpg").to_string();
            
            // 2. 读取二进制数据
            let bytes_result = field.bytes().await;
            let data: Bytes = match bytes_result {
                Ok(d) => d,
                Err(e) => {
                    tracing::error!("Read bytes error: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            };

            // 3. 准备路径
            let ext = Path::new(&file_name).extension().and_then(|s| s.to_str()).unwrap_or("jpg");
            let new_filename = format!("{}.{}", Uuid::new_v4(), ext);
            let upload_dir = "uploads"; 
            
            // 4. 创建目录 (如不存在)
            if !Path::new(upload_dir).exists() {
                if let Err(e) = fs::create_dir_all(upload_dir).await {
                    tracing::error!("Create dir error: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }

            // 5. 写入文件
            let file_path = Path::new(upload_dir).join(&new_filename);
            if let Err(e) = fs::write(&file_path, &data).await {
                tracing::error!("Write file error: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }

            // 6. 返回 URL (生产环境请改为配置项)
            let url = format!("/uploads/{}", new_filename);
            return Ok(Json(UploadResponse { url }));
        }
    }

    // 如果没传 file 字段
    Err(StatusCode::BAD_REQUEST)
}