import request from './request';

class FinanceService {
    /**
     * 获取 HQ 财务仪表盘数据
     */
    static getHqDashboard() {
        return request.get('/api/v1/hq/finance/dashboard');
    }

    /**
     * 获取流水记录 (分页/筛选)
     * @param {Object} params { status, user_id, date, page, limit }
     */
    static getPaymentRecords(params = {}) {
        return request.get('/api/v1/finance/payments', params);
    }
}

export default FinanceService;
