/*
 * src/handlers/enrollment.rs
 * 职责: 学员报名 (Enrollment) 管理
 * (★ V15.2 - 通用记账版: 期限卡也能产生流水 ★)
 */

use axum::{
    extract::{State, Path},
    http::StatusCode, 
    Json
};
use sqlx::Row;
use uuid::Uuid;
use chrono::{Utc, DateTime};

use super::AppState;
use super::auth::Claims;
use crate::models::{
    ClassEnrollment, 
    CreateEnrollmentPayload,
    UpdateEnrollmentPayload,
    MembershipTierType,
    EnrollmentDetail,
    TransactionType,
    TransactionCategory
};

// (POST create_enrollment_handler ... 保持不变)
pub async fn create_enrollment_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateEnrollmentPayload>,
) -> Result<Json<ClassEnrollment>, StatusCode> {
    // ... (请保留原有的 create 逻辑) ...
    // (为节省篇幅，此处省略 create 代码，请直接复制之前的或保持原样)
    let tenant_id = claims.tenant_id;
    let base_id = match claims.base_id { Some(id) => id, None => return Err(StatusCode::FORBIDDEN) };
    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let exists = sqlx::query("SELECT id FROM class_enrollments WHERE class_id=$1 AND participant_id=$2").bind(payload.class_id).bind(payload.participant_id).fetch_optional(&mut *tx).await.unwrap_or(None);
    if exists.is_some() { return Err(StatusCode::CONFLICT); }

    let customer_id: Uuid = sqlx::query_scalar("SELECT customer_id FROM participants WHERE id=$1").bind(payload.participant_id).fetch_one(&mut *tx).await.map_err(|_| StatusCode::NOT_FOUND)?;

    let new_enrollment = sqlx::query_as::<_, ClassEnrollment>(
        "INSERT INTO class_enrollments (tenant_id, class_id, participant_id, customer_id, customer_membership_id, status) VALUES ($1, $2, $3, $4, $5, 'enrolled') RETURNING *"
    ).bind(tenant_id).bind(payload.class_id).bind(payload.participant_id).bind(customer_id).bind(payload.customer_membership_id)
    .fetch_one(&mut *tx).await.map_err(|e| { tracing::error!("{}",e); StatusCode::INTERNAL_SERVER_ERROR })?;
    
    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(new_enrollment))
}

// (GET get_enrollments_for_class_handler ... 保持不变)
pub async fn get_enrollments_for_class_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(class_id): Path<Uuid>,
) -> Result<Json<Vec<EnrollmentDetail>>, StatusCode> {
    let tenant_id = claims.tenant_id;
    let base_id = match claims.base_id { Some(id) => id, None => return Err(StatusCode::FORBIDDEN) };

    let enrollments = match sqlx::query_as::<_, EnrollmentDetail>(
        r#"
        SELECT 
            e.id, e.tenant_id, e.participant_id, e.status, e.created_at,
            p.name AS participant_name, p.avatar_url AS participant_avatar, p.gender AS participant_gender
        FROM class_enrollments e
        JOIN participants p ON e.participant_id = p.id
        WHERE e.class_id = $1 AND e.tenant_id = $2
        ORDER BY p.name ASC
        "#,
    ).bind(class_id).bind(tenant_id).fetch_all(&state.db_pool).await
    { Ok(list) => list, Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR) };
    Ok(Json(enrollments))
}

// (PATCH complete_enrollment_handler - ★ 核心修改 ★)
pub async fn complete_enrollment_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(enrollment_id): Path<Uuid>,
    Json(payload): Json<UpdateEnrollmentPayload>,
) -> Result<Json<ClassEnrollment>, StatusCode> {

    let tenant_id = claims.tenant_id;
    let base_id = claims.base_id.ok_or(StatusCode::FORBIDDEN)?;
    let user_id_uuid = Uuid::parse_str(&claims.sub).unwrap_or_default();

    let mut tx = state.db_pool.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 1. 锁定并查询
    let row = sqlx::query(
        r#"
        SELECT e.participant_id, e.status, e.customer_membership_id, cl.course_id
        FROM class_enrollments e
        JOIN classes cl ON e.class_id = cl.id
        WHERE e.id = $1 AND cl.base_id = $2 AND e.tenant_id = $3
        FOR UPDATE OF e
        "#
    )
    .bind(enrollment_id).bind(base_id).bind(tenant_id)
    .fetch_optional(&mut *tx).await.unwrap_or(None).ok_or(StatusCode::NOT_FOUND)?;

    let current_status: String = row.get("status");
    if current_status == "completed" || current_status == "absent" || current_status == "leave" {
        return Err(StatusCode::CONFLICT);
    }

    // 2. 更新状态
    let new_status = payload.status.as_str();
    let updated_enrollment = sqlx::query_as::<_, ClassEnrollment>(
        "UPDATE class_enrollments SET status = $1, teacher_feedback = $2 WHERE id = $3 RETURNING *"
    )
    .bind(new_status).bind(&payload.teacher_feedback).bind(enrollment_id)
    .fetch_one(&mut *tx).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cm_id: Option<Uuid> = row.get("customer_membership_id");
    let course_id: Uuid = row.get("course_id");
    let pid: Uuid = row.get("participant_id");

    // --- A. 扣费 & 记账 (核心修改部分) ---
    if new_status == "completed" || new_status == "absent" {
        if let Some(cmid) = cm_id {
            // 查询卡种信息
            let membership_info = sqlx::query(
                r#"
                SELECT mt.tier_type, mt.price_in_cents, mt.usage_count, mt.name_key
                FROM membership_tiers mt 
                JOIN customer_memberships cm ON mt.id = cm.tier_id 
                WHERE cm.id = $1
                "#
            )
            .bind(cmid)
            .fetch_optional(&mut *tx)
            .await
            .unwrap_or(None);

            if let Some(info) = membership_info {
                let tier_type: MembershipTierType = info.get("tier_type");
                let price_total: i32 = info.get("price_in_cents");
                let usage_total: Option<i32> = info.get("usage_count");
                let tier_name: String = info.get("name_key");

                // 1. 扣次 (仅次卡)
                if tier_type == MembershipTierType::UsageBased {
                    sqlx::query("UPDATE customer_memberships SET remaining_uses = remaining_uses - 1 WHERE id = $1")
                        .bind(cmid).execute(&mut *tx).await.ok();
                }

                // 2. (★ 修改: 通用记账逻辑)
                // 即使是期限卡 (0元), 也要记一笔流水, 证明"上过课"
                let revenue_amount = if tier_type == MembershipTierType::UsageBased {
                    // 次卡: 均摊
                    if let Some(count) = usage_total {
                        if count > 0 { price_total / count } else { 0 }
                    } else { 0 }
                } else {
                    // 期限卡: 暂记 0 元 (未来可对接 AI 规则引擎算出每节课估值)
                    0 
                };

                let status_desc = if new_status == "completed" { "正常上课" } else { "旷课扣费" };
                let desc = format!("消课: {} (卡种: {})", status_desc, tier_name);
                
                sqlx::query(
                    r#"
                    INSERT INTO financial_transactions 
                    (tenant_id, base_id, amount_in_cents, transaction_type, category, related_entity_id, description, created_by, debit_subject, credit_subject)
                    VALUES ($1, $2, $3, 'usage', 'course_revenue', $4, $5, $6, 'contract_liability', 'revenue')
                    "#
                )
                .bind(tenant_id)
                .bind(base_id)
                .bind(revenue_amount)
                .bind(enrollment_id)
                .bind(desc)
                .bind(user_id_uuid)
                .execute(&mut *tx).await.ok();
            }
        }
    }

    // --- B. 扣库存 (保持不变) ---
    if new_status == "completed" || new_status == "absent" {
        let materials: Vec<(Uuid, i32)> = sqlx::query_as(
            "SELECT material_id, quantity_required FROM course_required_materials WHERE course_id = $1"
        ).bind(course_id).fetch_all(&mut *tx).await.unwrap_or(vec![]);
        for (mid, qty) in materials {
            sqlx::query("INSERT INTO material_stock_changes (material_id, base_id, change_amount, reason_key) VALUES ($1, $2, $3, 'consumption')")
                .bind(mid).bind(base_id).bind(-(qty as i32)).execute(&mut *tx).await.ok();
        }
    }

    // --- C. 加积分 (保持不变) ---
    if new_status == "completed" {
        let points: i32 = sqlx::query_scalar("SELECT points_awarded FROM courses WHERE id = $1").bind(course_id).fetch_one(&mut *tx).await.unwrap_or(0);
        if points > 0 {
            sqlx::query("INSERT INTO point_transactions (participant_id, tenant_id, points_change, reason_key) VALUES ($1, $2, $3, 'course')")
                .bind(pid).bind(tenant_id).bind(points).execute(&mut *tx).await.ok();
            sqlx::query("UPDATE participant_profiles SET current_total_points = current_total_points + $1 WHERE participant_id = $2")
                .bind(points).bind(pid).execute(&mut *tx).await.ok();
        }
    }

    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(updated_enrollment))
}

// (DELETE delete_enrollment_handler ... 保持不变)
pub async fn delete_enrollment_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(enrollment_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let tenant_id = claims.tenant_id;
    sqlx::query("DELETE FROM class_enrollments WHERE id = $1 AND tenant_id = $2")
        .bind(enrollment_id).bind(tenant_id).execute(&state.db_pool).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}