import request from './request';

/**
 * LeadService
 * 销售线索管理服务
 */
class LeadService {
    /**
     * 获取线索列表
     * @param {Object} params - 查询参数
     * @param {string} params.status - 状态筛选 (new/contacted/qualified/trial_scheduled/converted/lost)
     * @param {string} params.assigned_to - 销售顾问ID
     * @param {number} params.page - 页码
     * @param {number} params.limit - 每页数量
     * @returns {Promise<Array>}
     */
    static getLeads(params = {}) {
        return request.get('/api/v1/base/leads', params);
    }

    /**
     * 创建线索
     * @param {Object} data - 线索数据
     * @param {string} data.contact_name - 联系人姓名
     * @param {string} data.phone_number - 联系电话
     * @param {string} data.wechat_id - 微信号
     * @param {string} data.child_name - 孩子姓名
     * @param {number} data.child_age - 孩子年龄
     * @param {string} data.child_grade - 孩子年级
     * @param {string} data.source - 线索来源
     * @param {number} data.quality_score - 质量评分 (1-5)
     * @param {string} data.notes - 备注
     * @returns {Promise}
     */
    static createLead(data) {
        return request.post('/api/v1/base/leads', data);
    }

    /**
     * 获取线索详情
     * @param {string} leadId - 线索ID
     * @returns {Promise<Object>}
     */
    static getLeadDetail(leadId) {
        return request.get(`/api/v1/base/leads/${leadId}`);
    }

    /**
     * 更新线索
     * @param {string} leadId - 线索ID
     * @param {Object} data - 更新数据
     * @param {string} data.status - 状态
     * @param {number} data.quality_score - 质量评分
     * @param {string} data.assigned_to - 分配给
     * @param {string} data.next_follow_up_at - 下次跟进时间
     * @param {string} data.notes - 备注
     * @param {Array<string>} data.tags - 标签
     * @returns {Promise}
     */
    static updateLead(leadId, data) {
        return request.put(`/api/v1/base/leads/${leadId}`, data);
    }

    /**
     * 添加跟进记录
     * @param {string} leadId - 线索ID
     * @param {Object} data - 跟进数据
     * @param {string} data.follow_up_type - 跟进方式 (call/wechat/visit/email)
     * @param {string} data.content - 跟进内容
     * @param {string} data.outcome - 跟进结果 (positive/neutral/negative/no_answer)
     * @param {string} data.next_follow_up_at - 下次跟进时间
     * @returns {Promise}
     */
    static addFollowUp(leadId, data) {
        return request.post(`/api/v1/base/leads/${leadId}/follow-up`, data);
    }

    /**
     * 获取线索统计
     * @returns {Promise<Object>}
     */
    static getLeadStats() {
        // TODO: 实现统计API
        return Promise.resolve({
            total: 0,
            new: 0,
            contacted: 0,
            qualified: 0,
            converted: 0
        });
    }
}

export default LeadService;
