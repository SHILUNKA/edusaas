import request from './request';

/**
 * StaffService
 * 人效风控 - Personnel Efficiency & Risk Control Service
 */
class StaffService {
    /**
     * 获取风控统计数据
     * @returns {Promise} { health_score: number, alerts: Array }
     */
    static getRiskStats() {
        return request.get('/api/v1/hq/staff/risk-stats');
    }

    /**
     * 获取关键人员列表 (HQ管理员、基地校长)
     * @returns {Promise} Array of key personnel
     */
    static getKeyPersonnel() {
        return request.get('/api/v1/hq/staff/key-personnel');
    }

    /**
     * 获取基地采购排行榜
     * @returns {Promise} Array of base rankings by purchase amount
     */
    static getPurchaseRankings() {
        return request.get('/api/v1/hq/staff/rankings/purchase');
    }

    /**
     * 获取基地活跃度排行榜
     * @returns {Promise} Array of base rankings by activity score
     */
    static getActivityRankings() {
        return request.get('/api/v1/hq/staff/rankings/activity');
    }
}

export default StaffService;
