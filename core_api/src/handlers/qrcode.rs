use axum::{
    extract::{Path, State, Json, Query}, // ★ 引入 Query 提取器
    http::{StatusCode, header},
    response::{IntoResponse},
    Json as AxumJson,
};
use rand::{distributions::Alphanumeric, Rng};
use uuid::Uuid;
use sqlx::Postgres;
use super::AppState;
use serde::Deserialize;
use crate::models::{
    Claims, 
    GenerateQrcodePayload, 
    GenerateQRResponse, 
    VerifyQRResponse, 
    DbExportItem, 
    DbVerifyItem, 
    BatchSummary
};

// ==========================================
// DTOs (本地定义)
// ==========================================
#[derive(Deserialize)]
pub struct VerifyQuery {
    pub s: Option<String>, // URL 中的签名参数 ?s=...
}

// ==========================================
// 工具函数
// ==========================================
fn generate_secure_string(len: usize) -> String {
    rand::thread_rng().sample_iter(&Alphanumeric).take(len).map(char::from).collect()
}

// ==========================================
// 1. 生成接口 (管理员) - 保持不变
// POST /api/v1/admin/qrcodes/generate
// ==========================================
pub async fn generate_qrcodes_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<GenerateQrcodePayload>,
) -> Result<impl IntoResponse, StatusCode> {
    
    if payload.quantity > 50000 { return Err(StatusCode::BAD_REQUEST); }

    let batch_no = format!("B{}-{}", chrono::Utc::now().format("%Y%m%d"), generate_secure_string(4).to_uppercase());

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let batch_id: Uuid = sqlx::query_scalar::<Postgres, Uuid>(
        "INSERT INTO qrcode_batches (batch_no, name, quantity, created_by) VALUES ($1, $2, $3, $4) RETURNING id"
    )
    .bind(&batch_no)
    .bind(&payload.batch_name)
    .bind(payload.quantity as i32)
    .bind(Uuid::parse_str(&claims.sub).unwrap_or_default())
    .fetch_one(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut all_items = Vec::with_capacity(payload.quantity);
    for _ in 0..payload.quantity {
        all_items.push((generate_secure_string(8), generate_secure_string(16)));
    }

    for chunk in all_items.chunks(1000) {
        let mut query_builder = sqlx::QueryBuilder::new("INSERT INTO qrcode_items (batch_id, short_code, secret_salt) ");
        query_builder.push_values(chunk, |mut b, item| {
            b.push_bind(batch_id).push_bind(&item.0).push_bind(&item.1);
        });
        query_builder.build().execute(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(AxumJson(GenerateQRResponse {
        batch_id,
        batch_no,
        message: format!("成功生成 {} 个码", payload.quantity),
    }))
}

// ==========================================
// 2. 导出 CSV 接口 (管理员) - ★ 核心修改
// GET /api/v1/admin/qrcodes/:batch_id/export
// ==========================================
pub async fn export_batch_csv_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(batch_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    
    // ★ 修改：查询时带上 secret_salt
    let items = sqlx::query_as::<Postgres, DbExportItem>(
        "SELECT short_code, secret_salt FROM qrcode_items WHERE batch_id = $1 ORDER BY id ASC"
    )
    .bind(batch_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Export failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 假设前端验证页地址 (请替换为真实域名)
    let base_url = "http://192.168.10.59:3000/verify/"; 
    
    let mut csv_content = String::from("QR_URL,SHORT_CODE,SALT_SIGN\n");
    for item in items {
        // ★ 核心逻辑：取 salt 的前 6 位作为签名
        let sign = &item.secret_salt[0..6];
        // URL 格式：domain.com/verify/ABCDEF?s=123456
        let url = format!("{}{}{}?s={}", base_url, item.short_code, "", sign); // 这里为了逻辑清晰拆开了写
        
        csv_content.push_str(&format!("{},{},{}\n", url, item.short_code, sign));
    }

    let headers = [
        (header::CONTENT_TYPE, "text/csv; charset=utf-8"),
        (header::CONTENT_DISPOSITION, "attachment; filename=\"qrcodes_secure.csv\""),
    ];

    Ok((headers, csv_content))
}

// ==========================================
// 3. 验证接口 (公开 Public) - ★ 核心修改
// GET /api/public/verify/:code?s=...
// ==========================================
pub async fn verify_qrcode_handler(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Query(query): Query<VerifyQuery>, // ★ 获取 URL 参数
) -> Result<impl IntoResponse, StatusCode> {
    
    // ★ 修改：查询时带上 secret_salt
    let item = sqlx::query_as::<Postgres, DbVerifyItem>(
        r#"
        SELECT id, status, batch_id, secret_salt,
               to_char(first_scan_time, 'YYYY-MM-DD HH24:MI:SS') as scan_time 
        FROM qrcode_items WHERE short_code = $1
        "#
    )
    .bind(code)
    .fetch_optional(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Verify db error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let res = match item {
        None => VerifyQRResponse {
            valid: false,
            status: "NOT_FOUND".to_string(),
            message: "未识别的防伪码 (Code Invalid)".to_string(),
            product_info: None,
            scan_time: None,
        },
        Some(record) => {
            // ★★★ 安全校验核心逻辑 ★★★
            // 取出数据库里真实 salt 的前 6 位
            let real_sign = &record.secret_salt[0..6];
            // 获取用户传上来的 s 参数
            let user_sign = query.s.unwrap_or_default();

            // 如果签名对不上 -> 视为伪造链接/暴力破解
            if user_sign != real_sign {
                return Ok(AxumJson(VerifyQRResponse {
                    valid: false,
                    status: "FAKE_LINK".to_string(),
                    message: "安全校验失败：二维码链接可能被篡改！".to_string(),
                    product_info: None,
                    scan_time: None,
                }));
            }

            // --- 下面是正常的业务逻辑 ---
            let status = record.status.unwrap_or_else(|| "UNKNOWN".to_string());

            if status == "DORMANT" {
                 VerifyQRResponse {
                    valid: false,
                    status: "DORMANT".to_string(),
                    message: "该防伪码尚未激活（未出库），请联系商家。".to_string(),
                    product_info: None,
                    scan_time: None,
                }
            } else if status == "SCANNED" {
                VerifyQRResponse {
                    valid: true,
                    status: "SCANNED".to_string(),
                    message: "正品认证 (注意：此码已被查询过)".to_string(),
                    product_info: Some("IP正版授权文创".to_string()),
                    scan_time: record.scan_time,
                }
            } else {
                // First Scan
                let _ = sqlx::query(
                    "UPDATE qrcode_items SET status = 'SCANNED', scan_count = 1, first_scan_time = NOW() WHERE id = $1"
                )
                .bind(record.id)
                .execute(&state.db_pool).await;

                VerifyQRResponse {
                    valid: true,
                    status: "ACTIVE".to_string(),
                    message: "正品认证 (首次查询)".to_string(),
                    product_info: Some("IP正版授权文创".to_string()),
                    scan_time: None,
                }
            }
        }
    };

    Ok(AxumJson(res))
}

// ==========================================
// 4. 获取批次列表接口 (管理员) - 保持不变
// ==========================================
pub async fn list_batches_handler(
    State(state): State<AppState>,
    _claims: Claims,
) -> Result<impl IntoResponse, StatusCode> {
    
    let sql = r#"
        SELECT 
            b.id, 
            b.batch_no, 
            b.name, 
            b.quantity, 
            b.created_at,
            COUNT(CASE WHEN i.status = 'ACTIVE' THEN 1 END) as active_count,
            COUNT(CASE WHEN i.status = 'SCANNED' THEN 1 END) as scan_count
        FROM qrcode_batches b
        LEFT JOIN qrcode_items i ON b.id = i.batch_id
        GROUP BY b.id
        ORDER BY b.created_at DESC
    "#;

    let batches = sqlx::query_as::<Postgres, BatchSummary>(sql)
        .fetch_all(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("List batches failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(AxumJson(batches))
}

// ==========================================
// 5. 激活/发货接口 (管理员) - 保持不变
// ==========================================
pub async fn activate_batch_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(batch_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    
    let mut tx = state.db_pool.begin().await.map_err(|e| {
        tracing::error!("Begin tx failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let result = sqlx::query(
        "UPDATE qrcode_items SET status = 'ACTIVE' WHERE batch_id = $1::uuid AND status = 'DORMANT'"
    )
    .bind(batch_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Activate items failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("Commit tx failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let rows_affected = result.rows_affected();
    
    Ok(AxumJson(serde_json::json!({
        "success": true,
        "message": format!("成功激活 {} 个防伪码", rows_affected),
        "activated_count": rows_affected
    })))
}