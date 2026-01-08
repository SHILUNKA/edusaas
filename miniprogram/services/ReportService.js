import request from './request';

/**
 * ReportService
 * 数据报表 - Data Reports Service
 */
class ReportService {
    /**
     * 获取热销产品/服务排行
     * @returns {Promise} Array of top products
     */
    static getTopProducts() {
        return request.get('/api/v1/hq/reports/top-products');
    }

    /**
     * 获取订单趋势数据 (最近6个月)
     * @returns {Promise} { labels: Array, values: Array }
     */
    static getOrderTrend() {
        return request.get('/api/v1/hq/reports/order-trend');
    }

    /**
     * 获取加盟漏斗数据
     * @returns {Promise} { leads, contracts, firstOrders, contractRate, orderRate }
     */
    static getFunnelData() {
        return request.get('/api/v1/hq/reports/funnel');
    }
}

export default ReportService;
