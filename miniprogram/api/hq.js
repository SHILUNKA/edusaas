import request from '../services/request';

/**
 * 获取总部仪表盘统计数据
 */
export function getDashboardStats() {
    return request.get('/api/v1/hq/dashboard/stats');
}
