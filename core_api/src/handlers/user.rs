/*
 * src/handlers/user.rs
 * 职责: 员工与权限管理
 */
use axum::{extract::State, http::StatusCode, Json};
use uuid::Uuid;
use bcrypt::{hash, DEFAULT_COST};
use crate::models::{UserDetail, CreateUserPayload};
use super::{AppState, auth::Claims};

// (GET /api/v1/tenant/users) 获取所有员工
// (GET) 获取所有员工
pub async fn get_tenant_users(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<UserDetail>>, StatusCode> {
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    if !is_hq {
        return Err(StatusCode::FORBIDDEN);
    }

    let users = sqlx::query_as::<_, UserDetail>(
        r#"
        SELECT 
            u.id, u.email, u.full_name, u.is_active, u.created_at,
            u.phone_number, u.gender, u.blood_type, u.date_of_birth, u.address, -- (新增查询字段)
            b.name as base_name,
            (SELECT r.name_key FROM roles r 
             JOIN user_roles ur ON r.id = ur.role_id 
             WHERE ur.user_id = u.id LIMIT 1) as role_name
        FROM users u
        LEFT JOIN bases b ON u.base_id = b.id
        WHERE u.tenant_id = $1
        ORDER BY u.created_at DESC
        "#
    )
    .bind(claims.tenant_id)
    .fetch_all(&state.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch users: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(users))
}

// (POST) 创建新员工
pub async fn create_tenant_user(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateUserPayload>,
) -> Result<Json<UserDetail>, StatusCode> {
    let is_hq = claims.roles.iter().any(|r| r == "role.tenant.admin");
    if !is_hq {
        return Err(StatusCode::FORBIDDEN);
    }

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let password_hash = hash(payload.password, DEFAULT_COST).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 更新 INSERT 语句
    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO users (
            tenant_id, base_id, email, password_hash, full_name, is_active,
            phone_number, gender, blood_type, date_of_birth, address
        )
        VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10)
        RETURNING id
        "#
    )
    .bind(claims.tenant_id)
    .bind(payload.base_id)
    .bind(&payload.email)
    .bind(password_hash)
    .bind(&payload.full_name)
    // (绑定新字段)
    .bind(&payload.phone_number)
    .bind(&payload.gender)
    .bind(&payload.blood_type)
    .bind(payload.date_of_birth)
    .bind(&payload.address)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create user: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // ... (角色分配逻辑保持不变) ...
    let role_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM roles WHERE name_key = $1 AND tenant_id = $2"
    )
    .bind(&payload.role_key)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await
    .unwrap_or(None);

    if let Some(rid) = role_id {
        sqlx::query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)")
            .bind(user_id)
            .bind(rid)
            .execute(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    } else {
        tx.rollback().await.ok();
        return Err(StatusCode::BAD_REQUEST);
    }

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 返回 (简单构造)
    Ok(Json(UserDetail {
        id: user_id,
        email: payload.email,
        full_name: Some(payload.full_name),
        // (填充新字段)
        phone_number: payload.phone_number,
        gender: payload.gender,
        blood_type: payload.blood_type,
        date_of_birth: payload.date_of_birth,
        address: payload.address,
        is_active: true,
        base_name: None,
        role_name: Some(payload.role_key),
        created_at: chrono::Utc::now(),
    }))
}