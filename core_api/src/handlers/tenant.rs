/*
 * src/handlers/tenant.rs
 * 职责: 租户级总览 (V16.2 - 增加基地信息查询)
 */
use axum::{extract::State, http::StatusCode, Json};
use super::AppState;
use crate::models::{Claims, ParticipantDetail};

// (GET /api/v1/tenant/participants)
// (★ V16.3 - 增加 last_class_time)
pub async fn get_all_tenant_participants(
    State(state): State<AppState>,
    claims: Claims, 
) -> Result<Json<Vec<ParticipantDetail>>, StatusCode> {
    
    if !claims.roles.iter().any(|r| r == "role.tenant.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let tenant_id = claims.tenant_id;

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
            
            -- (★ V16.3 新增: 最近一次实到上课时间)
            (
                SELECT MAX(cl.start_time)
                FROM class_enrollments ce
                JOIN classes cl ON ce.class_id = cl.id
                WHERE ce.participant_id = p.id 
                  AND ce.status = 'completed'
            ) as last_class_time

        FROM participants p
        JOIN customers c ON p.customer_id = c.id
        LEFT JOIN bases b ON c.base_id = b.id 
        LEFT JOIN participant_profiles pp ON p.id = pp.participant_id
        LEFT JOIN honor_ranks hr ON pp.current_honor_rank_id = hr.id
        WHERE p.tenant_id = $1
        ORDER BY p.created_at DESC
        "#,
    )
    .bind(tenant_id) 
    .fetch_all(&state.db_pool)
    .await
    {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed to fetch participants: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(participants))
}

// (★ V16.2 Step 2: 新增统计接口)
// GET /api/v1/tenant/participants/stats
pub async fn get_tenant_participant_stats(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<crate::models::TenantParticipantStats>, StatusCode> {
    
    if !claims.roles.iter().any(|r| r == "role.tenant.admin") {
        return Err(StatusCode::FORBIDDEN);
    }

    let tenant_id = claims.tenant_id;

    let stats = match sqlx::query_as::<_, crate::models::TenantParticipantStats>(
        r#"
        SELECT
            -- 1. 总学员数
            (SELECT COUNT(*) FROM participants WHERE tenant_id = $1) AS total_count,
            
            -- 2. 本月新增 (使用 date_trunc 截取当月第一天)
            (SELECT COUNT(*) FROM participants 
             WHERE tenant_id = $1 
             AND created_at >= date_trunc('month', CURRENT_DATE)) AS new_this_month,
             
            -- 3. 付费会员 (持有有效会员卡的去重学员数)
            (SELECT COUNT(DISTINCT participant_id) 
             FROM customer_memberships 
             WHERE tenant_id = $1 AND is_active = true AND participant_id IS NOT NULL) AS active_members
        "#,
    )
    .bind(tenant_id)
    .fetch_one(&state.db_pool)
    .await
    {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to fetch participant stats: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(stats))
}