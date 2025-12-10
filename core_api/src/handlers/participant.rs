/*
 * src/handlers/participant.rs
 * 职责: 学员 (Participant) 管理 (SaaS 强化)
 * (★ V2 - 事务修复版 ★)
 */

use axum::{
    extract::{State, Path},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

// 导入在 mod.rs 中定义的 AppState
use super::AppState;
// 导入 models
use crate::models::{Claims, Participant, CreateParticipantPayload, ParticipantDetail};


// (POST /api/v1/participants - 创建一个新学员并关联到家长)
// (★ V2 - 事务修复版 ★)
pub async fn create_participant_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 自动验证 Token, 获取 Claims
    Json(payload): Json<CreateParticipantPayload>,
) -> Result<Json<Participant>, StatusCode> {
    
    let tenant_id = claims.tenant_id;

    // --- (★ 关键: 启动数据库事务 ★) ---
    let mut tx = match state.db_pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("Failed to start transaction: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // --- (★ 事务内: 安全校验 ★) ---
    let parent_check = sqlx::query(
        "SELECT id FROM customers WHERE id = $1 AND tenant_id = $2"
    )
    .bind(payload.customer_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx) // (★ 关键: 使用事务 'tx')
    .await;

    if let Err(e) = parent_check {
        tracing::error!("Failed to check parent customer: {}", e);
        tx.rollback().await.ok(); // (回滚)
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    if parent_check.unwrap().is_none() {
        tracing::warn!(
            "User {} tried to create participant for non-existent or cross-tenant customer_id {}",
            claims.sub,
            payload.customer_id
        );
        tx.rollback().await.ok(); // (回滚)
        return Err(StatusCode::NOT_FOUND); 
    }

    // --- (★ 事务内: 核心操作 1: 创建 Participant) ---
    let new_participant = match sqlx::query_as::<_, Participant>(
        r#"
        INSERT INTO participants 
            (tenant_id, customer_id, name, date_of_birth, gender, school_name, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(payload.customer_id)
    .bind(payload.name)
    .bind(payload.date_of_birth)
    .bind(payload.gender)
    .bind(payload.school_name)
    .bind(payload.notes)
    .fetch_one(&mut *tx) // (★ 关键: 使用事务 'tx')
    .await
    {
        Ok(participant) => participant,
        Err(e) => {
            tracing::error!("Failed to create participant: {}", e);
            tx.rollback().await.ok(); // (回滚)
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // --- (★ 事务内: 核心操作 2: 【BUG 修复】创建空的 Participant Profile) ---
    // (为新学员初始化积分为 0)
    let profile_result = sqlx::query(
        r#"
        INSERT INTO participant_profiles
            (participant_id, tenant_id, current_total_points, current_honor_rank_id)
        VALUES ($1, $2, 0, NULL)
        "#,
    )
    .bind(new_participant.id) // (★ 关键) 使用新创建的学员ID
    .bind(tenant_id)
    .execute(&mut *tx) // (★ 关键: 使用事务 'tx')
    .await;

    if let Err(e) = profile_result {
        tracing::error!("Failed to create participant profile: {}", e);
        tx.rollback().await.ok(); // (回滚)
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    // --- (★ 关键: 提交事务 ★) ---
    if let Err(e) = tx.commit().await {
        tracing::error!("Failed to commit transaction: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // (事务成功)
    Ok(Json(new_participant))
}


// (GET /api/v1/customers/:customer_id/participants)
// (★ V1 - 无修改 ★)
pub async fn get_participants_for_customer_handler(
    State(state): State<AppState>,
    claims: Claims,        // <-- 自动验证 Token, 获取 Claims
    Path(customer_id): Path<Uuid>, // <-- 从 URL 路径中提取 'customer_id'
) -> Result<Json<Vec<Participant>>, StatusCode> {
    
    let tenant_id = claims.tenant_id;
    
    let participants = match sqlx::query_as::<_, Participant>(
        r#"
        SELECT * FROM participants
        WHERE customer_id = $1 AND tenant_id = $2
        ORDER BY name ASC
        "#,
    )
    .bind(customer_id)
    .bind(tenant_id)
    .fetch_all(&state.db_pool) // (★ 'GET' 操作不需要事务)
    .await
    {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed to fetch participants for customer {}: {}", customer_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(participants))
}


// (GET /api/v1/participants)
// (★ V1 - 无修改 ★)
pub async fn get_participants_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 自动验证 Token
) -> Result<Json<Vec<Participant>>, StatusCode> {
    
    let participants: Vec<Participant>;
    let tenant_id = claims.tenant_id;
    
    if let Some(base_id) = claims.base_id {
        // --- 场景 A: 基地员工 (Base Employee) ---
        tracing::debug!("Fetching participants for base_id: {}", base_id);
        
        participants = sqlx::query_as::<_, Participant>(
            r#"
            SELECT p.*
            FROM participants p
            JOIN customers c ON p.customer_id = c.id
            WHERE p.tenant_id = $1 AND c.base_id = $2
            ORDER BY p.name ASC
            "#,
        )
        .bind(tenant_id)
        .bind(base_id)
        .fetch_all(&state.db_pool) // (★ 'GET' 操作不需要事务)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch base participants: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    } else {
        // --- 场景 B: 租户管理员 (Tenant Admin) ---
        tracing::debug!("Fetching all participants for tenant_id: {}", tenant_id);
        
        participants = sqlx::query_as::<_, Participant>(
            r#"
            SELECT * FROM participants
            WHERE tenant_id = $1
            ORDER BY name ASC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&state.db_pool) // (★ 'GET' 操作不需要事务)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch all tenant participants: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    Ok(Json(participants))
}

pub async fn get_base_participants_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<ParticipantDetail>>, StatusCode> {
    
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;

    let participants = match sqlx::query_as::<_, ParticipantDetail>(
        r#"
        SELECT 
            p.id, p.name, p.date_of_birth, p.gender,
            c.name AS customer_name,
            c.phone_number AS customer_phone,
            pp.current_total_points,
            hr.name_key AS rank_name_key,
            b.id as base_id,
            b.name as base_name,
            
            -- 最近上课时间
            (
                SELECT MAX(cl.start_time)
                FROM class_enrollments ce
                JOIN classes cl ON ce.class_id = cl.id
                WHERE ce.participant_id = p.id AND ce.status = 'completed'
            ) as last_class_time,

            -- (★ 新增: 剩余总课次 - 统计该学员名下所有有效次卡的剩余次数之和)
            (
                SELECT COALESCE(SUM(remaining_uses), 0)
                FROM customer_memberships cm
                WHERE cm.participant_id = p.id 
                  AND cm.is_active = true 
                  AND (cm.expiry_date IS NULL OR cm.expiry_date > NOW())
            ) as remaining_counts

        FROM participants p
        JOIN customers c ON p.customer_id = c.id
        LEFT JOIN bases b ON c.base_id = b.id
        LEFT JOIN participant_profiles pp ON p.id = pp.participant_id
        LEFT JOIN honor_ranks hr ON pp.current_honor_rank_id = hr.id
        WHERE c.base_id = $1
        ORDER BY p.created_at DESC
        "#,
    )
    .bind(base_id)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(participants))
}