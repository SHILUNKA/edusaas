
import request from './request';

/**
 * 基地管理服务
 */
class BaseService {
  /**
   * 获取基地列表
   */
  static getBases() {
    return request.get('/api/v1/bases');
  }

  /**
   * 创建基地
   * @param {Object} data 
   * @param {String} data.name
   * @param {String} data.code
   * @param {String} data.address
   * @param {String} data.auth_start_date (YYYY-MM-DD)
   * @param {String} data.auth_end_date (YYYY-MM-DD)
   */
  static createBase(data) {
    return request.post('/api/v1/bases', data);
  }

  /**
   * 更新基地信息
   * @param {String} id 
   * @param {Object} data 
   */
  static updateBase(id, data) {
    return request.put(`/api/v1/bases/${id}`, data);
  }
}

export default BaseService;
