/*
 * src/handlers/enrollment.rs
 * 职责: 学员报名 (Enrollment) 管理
 * (★ V1.1c - 调试日志版 ★)
 */

use axum::{
    extract::{State, Path},
    http::StatusCode, 
    Json
};
use sqlx::Row;
use uuid::Uuid;
// (★ V1.1b 修复: 移除了 futures)

// 导入 AppState 和 Claims
use super::AppState;
use super::auth::Claims;
// 导入 models
use crate::models::{
    ClassEnrollment, 
    CreateEnrollmentPayload,
    UpdateEnrollmentPayload,
    MembershipTierType,
};

// --- API-F: 学员报名上课 (V1.1c) ---

// (POST /api/v1/enrollments - 学员报名上课)
pub async fn create_enrollment_handler(
    State(state): State<AppState>,
    claims: Claims, // <-- 【安全】自动验证 Token
    Json(payload): Json<CreateEnrollmentPayload>,
) -> Result<Json<ClassEnrollment>, StatusCode> {
    
    let tenant_id = claims.tenant_id;
    
    // --- (★ 调试日志 1 ★) ---
    tracing::debug!(
        "Attempting enrollment: participant_id={}, class_id={}, membership_id={}",
        payload.participant_id,
        payload.class_id,
        payload.customer_membership_id
    );

    // --- (★ 安全校验 1: 必须是基地员工) ---
    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("(LOG) Tenant admin (user {}) tried to create enrollment", claims.sub);
            return Err(StatusCode::FORBIDDEN);
        }
    };
    
    // --- (★ 调试日志 2 ★) ---
    tracing::debug!("(LOG) User {} at base_id {} is proceeding...", claims.sub, base_id);

    // --- (★ 关键: 启动数据库事务 ★) ---
    let mut tx = match state.db_pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("(LOG) Failed to start transaction: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // --- (★ V1.1 商务检查: 校验 'customer_membership_id') ---
    // 1. 检查 'participant_id' (学员) 是否属于本租户, 并获取 'customer_id'
    let customer_id: Uuid = match sqlx::query_scalar("SELECT customer_id FROM participants WHERE id = $1 AND tenant_id = $2")
        .bind(payload.participant_id)
        .bind(tenant_id)
        .fetch_optional(&mut *tx)
        .await {
            Ok(Some(id)) => {
                // --- (★ 调试日志 3 ★) ---
                tracing::debug!("(LOG) Participant check PASSED. Found customer_id: {}", id);
                id
            },
            Ok(None) => {
                tracing::warn!("(LOG) Participant check FAILED (404). User {} tried to enroll non-existent participant_id {}", claims.sub, payload.participant_id);
                tx.rollback().await.ok();
                return Err(StatusCode::NOT_FOUND);
            },
            Err(e) => {
                tracing::error!("(LOG) Participant check DB ERROR: {}", e);
                tx.rollback().await.ok();
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        };

    // 2. 检查 'customer_membership_id' (会员卡) 是否有效
    let membership_check_query = sqlx::query(
        r#"
        SELECT mt.tier_type, cm.remaining_uses, cm.expiry_date
        FROM customer_memberships cm
        JOIN membership_tiers mt ON cm.tier_id = mt.id
        WHERE cm.id = $1 
          AND cm.customer_id = $2 
          AND cm.tenant_id = $3
          AND cm.is_active = true
        "#
    )
    .bind(payload.customer_membership_id)
    .bind(customer_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await;

    match membership_check_query {
        Ok(Some(row)) => {
            // --- (★ 调试日志 4 ★) ---
            tracing::debug!("(LOG) Membership check PASSED. Validating tier type...");
            let tier_type: MembershipTierType = row.get("tier_type");
            
            if tier_type == MembershipTierType::UsageBased {
                let remaining_uses: Option<i32> = row.get("remaining_uses");
                tracing::debug!("(LOG) Membership is 'UsageBased'. remaining_uses: {:?}", remaining_uses);
                if remaining_uses.unwrap_or(0) <= 0 {
                    tracing::warn!("(LOG) Membership check FAILED (403). User {} tried to enroll with membership {} (no uses left)", claims.sub, payload.customer_membership_id);
                    tx.rollback().await.ok();
                    return Err(StatusCode::FORBIDDEN);
                }
            }
            if tier_type == MembershipTierType::TimeBased {
                let expiry_date: Option<chrono::DateTime<chrono::Utc>> = row.get("expiry_date");
                tracing::debug!("(LOG) Membership is 'TimeBased'. expiry_date: {:?}", expiry_date);
                if expiry_date.is_none() || expiry_date.unwrap() < chrono::Utc::now() {
                    tracing::warn!("(LOG) Membership check FAILED (403). User {} tried to enroll with membership {} (expired)", claims.sub, payload.customer_membership_id);
                    tx.rollback().await.ok();
                    return Err(StatusCode::FORBIDDEN);
                }
            }
        },
        Ok(None) => {
            tracing::warn!("(LOG) Membership check FAILED (404). User {} tried to enroll with non-existent or inactive membership_id {}", claims.sub, payload.customer_membership_id);
            tx.rollback().await.ok();
            return Err(StatusCode::NOT_FOUND);
        },
        Err(e) => {
            tracing::error!("(LOG) Membership check DB ERROR: {}", e);
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    // --- (★ V1.1 运营检查: 校验 'class_id' 和 '物料库存') ---
    // 1. 检查 'class_id' (要报的课) 是否存在于 *本基地*, 并获取 'course_id'
    let course_id: Uuid = match sqlx::query_scalar(
        "SELECT course_id FROM classes WHERE id = $1 AND tenant_id = $2 AND base_id = $3"
    )
    .bind(payload.class_id)
    .bind(tenant_id)
    .bind(base_id)
    .fetch_optional(&mut *tx)
    .await {
        Ok(Some(id)) => {
            // --- (★ 调试日志 5 ★) ---
            tracing::debug!("(LOG) Class check PASSED. Found course_id: {}", id);
            id
        },
        Ok(None) => {
            tracing::warn!("(LOG) Class check FAILED (404). User {} tried to enroll in non-existent or cross-base class_id {}", claims.sub, payload.class_id);
            tx.rollback().await.ok();
            return Err(StatusCode::NOT_FOUND);
        },
        Err(e) => {
            tracing::error!("(LOG) Class check DB ERROR: {}", e);
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // 2. (★ 关键) 检查该 'course_id' 所需的 *所有* 物料库存
    let required_materials: Vec<(Uuid, i32)> = sqlx::query_as(
        "SELECT material_id, quantity_required FROM course_required_materials WHERE course_id = $1"
    )
    .bind(course_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("(LOG) Failed to fetch required materials: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // --- (★【V1.1c 修复】: 串行检查库存) ---
    for (material_id, quantity_required) in required_materials {
        
        // --- (★ 调试日志 6 ★) ---
        tracing::debug!("(LOG) Checking stock for material_id: {} (requires {})", material_id, quantity_required);
        
        let stock: Option<i32> = sqlx::query_scalar(
            "SELECT SUM(change_amount) FROM material_stock_changes WHERE material_id = $1 AND base_id = $2"
        )
        .bind(material_id)
        .bind(base_id)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(None);

        let current_stock = stock.unwrap_or(0);
        let is_sufficient = current_stock >= (quantity_required as i32);

        // --- (★ 调试日志 7 ★) ---
        tracing::debug!("(LOG) Stock check result for {}: Found {}, Required {}. Sufficient: {}", material_id, current_stock, quantity_required, is_sufficient);

        if !is_sufficient {
            // (★ 如果任何一个物料不够，立即失败并回滚 ★)
            tracing::warn!("(LOG) Stock check FAILED (409). User {} failed to enroll in class {}: Insufficient stock for material {}", claims.sub, payload.class_id, material_id);
            tx.rollback().await.ok();
                return Err(StatusCode::CONFLICT); // 409 Conflict: "物料库存不足"
        }
    }
    // --- (修复结束) ---

    // --- (★ 调试日志 8 ★) ---
    tracing::debug!("(LOG) ALL CHECKS PASSED. Inserting into class_enrollments...");

    // --- (★ 核心操作: INSERT) ---
    let new_enrollment = match sqlx::query_as::<_, ClassEnrollment>(
        r#"
        INSERT INTO class_enrollments 
            (tenant_id, class_id, participant_id, customer_id, customer_membership_id, status)
        VALUES ($1, $2, $3, $4, $5, 'enrolled')
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(payload.class_id)
    .bind(payload.participant_id)
    .bind(customer_id)
    .bind(payload.customer_membership_id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(enrollment) => enrollment,
        Err(e) => {
            if let Some(db_err) = e.as_database_error() {
                if db_err.is_unique_violation() {
                    tracing::warn!("(LOG) Enrollment insert FAILED (409). User {} tried to create duplicate enrollment", claims.sub);
                    tx.rollback().await.ok();
                    return Err(StatusCode::CONFLICT);
                }
            }
            tracing::error!("(LOG) Enrollment insert DB ERROR: {}", e);
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // --- (★ 关键: 提交事务 ★) ---
    if let Err(e) = tx.commit().await {
        tracing::error!("(LOG) Failed to commit enrollment transaction: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // --- (★ 调试日志 9 ★) ---
    tracing::debug!("(LOG) Transaction COMMITTED successfully.");
    Ok(Json(new_enrollment))
}


// --- API-G: 获取课程花名册 (V1.0) ---
// (此 API 无需修改)
pub async fn get_enrollments_for_class_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(class_id): Path<Uuid>,
) -> Result<Json<Vec<ClassEnrollment>>, StatusCode> {
    
    let tenant_id = claims.tenant_id;

    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("Tenant admin (user {}) tried to access enrollment roster", claims.sub);
            return Err(StatusCode::FORBIDDEN); 
        }
    };

    let class_check = sqlx::query("SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND base_id = $3")
        .bind(class_id)
        .bind(tenant_id)
        .bind(base_id)
        .fetch_optional(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check class for roster: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if class_check.is_none() {
        tracing::warn!("User {} tried to access roster for non-existent or cross-base class_id {}", claims.sub, class_id);
        return Err(StatusCode::NOT_FOUND); 
    }
    
    let enrollments = match sqlx::query_as::<_, ClassEnrollment>(
        r#"
        SELECT * FROM class_enrollments
        WHERE class_id = $1 AND tenant_id = $2
        ORDER BY created_at ASC
        "#,
    )
    .bind(class_id)
    .bind(tenant_id)
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed to fetch enrollments for class {}: {}", class_id, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(enrollments))
}


// --- API-H: 教师结课 (V1.1) ---
// (★ V1.1c - 调试日志版 ★)
pub async fn complete_enrollment_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(enrollment_id): Path<Uuid>,
    Json(payload): Json<UpdateEnrollmentPayload>,
) -> Result<Json<ClassEnrollment>, StatusCode> {

    let tenant_id = claims.tenant_id;

    let base_id = match claims.base_id {
        Some(id) => id,
        None => {
            tracing::warn!("(LOG) Tenant admin (user {}) tried to complete enrollment", claims.sub);
            return Err(StatusCode::FORBIDDEN);
        }
    };
    
    // --- (★ 调试日志 1 ★) ---
    tracing::debug!(
        "Attempting to complete enrollment_id: {} with status: {}",
        enrollment_id,
        payload.status
    );

    // --- (★ 关键: 启动数据库事务 ★) ---
    let mut tx = match state.db_pool.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("(LOG) Failed to start transaction: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    // --- (★ 事务内: 安全校验 2: 校验 'enrollment_id') ---
    let check_result = sqlx::query(
        r#"
        SELECT 
            e.participant_id, e.status, e.customer_membership_id,
            cl.course_id
        FROM class_enrollments e
        JOIN classes cl ON e.class_id = cl.id
        WHERE e.id = $1 AND cl.base_id = $2 AND e.tenant_id = $3
        FOR UPDATE OF e
        "#
    )
    .bind(enrollment_id)
    .bind(base_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await;

    let (participant_id, current_status, customer_membership_id, course_id): (Uuid, String, Option<Uuid>, Uuid) = match check_result {
        Ok(Some(row)) => {
             // --- (★ 调试日志 2 ★) ---
            tracing::debug!("(LOG) Enrollment check PASSED. Found participant_id: {}, course_id: {}", row.get::<Uuid, _>("participant_id"), row.get::<Uuid, _>("course_id"));
            (
                row.get("participant_id"), 
                row.get("status"),
                row.get("customer_membership_id"),
                row.get("course_id")
            )
        },
        Ok(None) => {
            tracing::warn!("(LOG) Enrollment check FAILED (404). User {} tried to complete non-existent or cross-base enrollment_id {}", claims.sub, enrollment_id);
            tx.rollback().await.ok();
            return Err(StatusCode::NOT_FOUND);
        },
        Err(e) => {
            tracing::error!("(LOG) Enrollment check DB ERROR: {}", e);
            tx.rollback().await.ok();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if current_status == "completed" {
        tracing::warn!("(LOG) Enrollment check FAILED (409). User {} tried to complete already completed enrollment_id {}", claims.sub, enrollment_id);
        tx.rollback().await.ok();
        return Err(StatusCode::CONFLICT);
    }

    // --- (★ 事务内: 核心操作 V0.5: 更新报名状态) ---
    let updated_enrollment = sqlx::query_as::<_, ClassEnrollment>(
        r#"
        UPDATE class_enrollments
        SET status = $1, teacher_feedback = $2
        WHERE id = $3
        RETURNING *
        "#,
    )
    .bind(&payload.status)
    .bind(&payload.teacher_feedback)
    .bind(enrollment_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("(LOG) Failed to update enrollment status: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // --- (★ 事务内: 仅当结课时才触发核销和积分) ---
    if updated_enrollment.status == Some("completed".to_string()) {
        
        // --- (★ 调试日志 3 ★) ---
        tracing::debug!("(LOG) Status is 'completed'. Proceeding to V1.1/V1.0 logic...");
        
        // --- (★ V1.1 商务核销 (扣卡)) ---
        if let Some(cm_id) = customer_membership_id {
            // ... (省略 V1.1 商务核销的日志, 但逻辑保留) ...
            let tier_type: Option<MembershipTierType> = sqlx::query_scalar(
                "SELECT mt.tier_type FROM membership_tiers mt JOIN customer_memberships cm ON mt.id = cm.tier_id WHERE cm.id = $1 AND cm.tenant_id = $2"
            )
            .bind(cm_id)
            .bind(tenant_id)
            .fetch_optional(&mut *tx)
            .await
            .unwrap_or(None);

            if tier_type == Some(MembershipTierType::UsageBased) {
                tracing::debug!("(LOG) Consuming 1 use from membership card {}", cm_id);
                sqlx::query(
                    "UPDATE customer_memberships SET remaining_uses = remaining_uses - 1, is_active = CASE WHEN remaining_uses - 1 <= 0 THEN false ELSE is_active END WHERE id = $1"
                )
                .bind(cm_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    tracing::error!("(LOG) Failed to consume membership use: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            }
        }

        // --- (★ V1.1 运营核销 (扣物料)) ---
        let required_materials: Vec<(Uuid, i32)> = sqlx::query_as(
            "SELECT material_id, quantity_required FROM course_required_materials WHERE course_id = $1"
        )
        .bind(course_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("(LOG) Failed to fetch required materials for consumption: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        for (material_id, quantity_required) in required_materials {
            tracing::debug!("(LOG) Consuming {} of material {} for base {}", quantity_required, material_id, base_id);
            sqlx::query(
                "INSERT INTO material_stock_changes (material_id, base_id, change_amount, reason_key) VALUES ($1, $2, $3, 'stock.reason.course_consumption')"
            )
            .bind(material_id)
            .bind(base_id)
            .bind( -(quantity_required as i32) )
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("(LOG) Failed to consume material stock: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }

        // --- (★ V1.0 积分发放) ---
        let points_awarded: i32 = sqlx::query_scalar("SELECT points_awarded FROM courses WHERE id = $1")
            .bind(course_id)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or(0);
        
        // --- (★ 调试日志 4 ★) ---
        tracing::debug!("(LOG) Course points_awarded: {}", points_awarded);

        if points_awarded > 0 {
            // (a. 记账)
            sqlx::query(
                "INSERT INTO point_transactions (participant_id, tenant_id, points_change, reason_key) VALUES ($1, $2, $3, 'tx.reason.course_complete')"
            )
            .bind(participant_id)
            .bind(tenant_id)
            .bind(points_awarded)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("(LOG) Failed to insert point transaction: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            // (b. 更新总分)
            sqlx::query(
                "UPDATE participant_profiles SET current_total_points = current_total_points + $1 WHERE participant_id = $2"
            )
            .bind(points_awarded)
            .bind(participant_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("(LOG) Failed to update participant total points: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
            
            // (c. 检查晋升)
            let new_total_points: i32 = sqlx::query_scalar(
                "SELECT current_total_points FROM participant_profiles WHERE participant_id = $1"
            )
            .bind(participant_id)
            .fetch_one(&mut *tx)
            .await
            .unwrap_or(0);
            
            // --- (★ 调试日志 5 ★) ---
            tracing::debug!("(LOG) Participant new total points: {}", new_total_points);

            let new_rank_id: Option<Uuid> = sqlx::query_scalar(
                "SELECT id FROM honor_ranks WHERE tenant_id = $1 AND points_required <= $2 ORDER BY points_required DESC LIMIT 1"
            )
            .bind(tenant_id)
            .bind(new_total_points)
            .fetch_one(&mut *tx)
            .await
            .ok();

            if let Some(rank_id) = new_rank_id {
                // --- (★ 调试日志 6 ★) ---
                tracing::debug!("(LOG) Participant achieved new rank_id: {}", rank_id);
                sqlx::query(
                    "UPDATE participant_profiles SET current_honor_rank_id = $1 WHERE participant_id = $2"
                )
                .bind(rank_id)
                .bind(participant_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    tracing::error!("(LOG) Failed to update participant rank: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            }
        }
    }
    
    // --- (★ 关键: 提交事务 ★) ---
    if let Err(e) = tx.commit().await {
        tracing::error!("(LOG) Failed to commit transaction: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // --- (★ 调试日志 7 ★) ---
    tracing::debug!("(LOG) Transaction COMMITTED successfully.");
    Ok(Json(updated_enrollment))
}