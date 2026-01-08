// CustomerService.js - C端用户相关API服务
const { request } = require('../utils/request');

class CustomerService {
    /**
     * 获取C端用户档案(包含所有学员及荣誉信息)
     */
    async getProfile() {
        return request({
            url: '/customer/profile',
            method: 'GET'
        });
    }

    /**
     * 获取学员课表
     * @param {Object} params - 查询参数
     * @param {string} params.participant_id - 学员ID
     * @param {string} params.start_date - 开始日期 (可选)
     * @param {string} params.end_date - 结束日期 (可选)
     * @param {string} params.status - 状态筛选 (可选: upcoming|completed)
     */
    async getSchedule(params) {
        return request({
            url: '/customer/schedule',
            method: 'GET',
            data: params
        });
    }

    /**
     * GET课时余额
     * @param {string} participantId - 学员ID
     */
    async getCourseBalance(participantId) {
        return request({
            url: '/customer/course-balance',
            method: 'GET',
            data: { participant_id: participantId }
        });
    }

    /**
     * 获取荣誉信息
     * @param {string} participantId - 学员ID
     */
    async getHonor(participantId) {
        return request({
            url: '/customer/honor',
            method: 'GET',
            data: { participant_id: participantId }
        });
    }

    /**
     * 获取积分明细
     * @param {Object} params - 查询参数
     * @param {string} params.participant_id - 学员ID
     * @param {string} params.start_date - 开始日期 (可选)
     * @param {string} params.end_date - 结束日期 (可选)
     * @param {number} params.page - 页码 (可选)
     * @param {number} params.limit - 每页数量 (可选)
     */
    async getPointsHistory(params) {
        return request({
            url: '/customer/points-history',
            method: 'GET',
            data: params
        });
    }

    /**
     * 获取用户订单记录
     */
    async getOrders() {
        return request({
            url: '/customer/orders',
            method: 'GET'
        });
    }

    /**
     * 获取可用会员/产品列表 (商城页)
     */
    async getMembershipTiers() {
        return request({
            url: '/customer/membership-tiers',
            method: 'GET'
        });
    }

    /**
     * 获取系统通知/公告
     */
    async getNotices() {
        return request({
            url: '/customer/notices',
            method: 'GET'
        });
    }

    /**
     * 获取学员成长报告
     * @param {string} participantId - 学员ID
     */
    async getReport(participantId) {
        return request({
            url: '/customer/report',
            method: 'GET',
            data: { participant_id: participantId }
        });
    }
}

module.exports = new CustomerService();
