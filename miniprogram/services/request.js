// services/request.js
import { API_BASE_URL } from '../config/index';
import { userStore } from '../store/userStore';
import AuthService from './AuthService';

/**
 * 通用请求函数
 * @param {String} url - 接口路径 (如 '/dashboard/stats')
 * @param {String} method - 'GET' | 'POST' | 'PUT' | 'DELETE'
 * @param {Object} data - 请求参数
 */
function request(url, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    // 1. 获取 Token
    const token = userStore.token;

    // 2. 组装 Header
    const header = {
      'Content-Type': 'application/json'
    };
    if (token) {
      header['Authorization'] = `Bearer ${token}`; // 标准 JWT 格式
    }

    // 3. 发起请求
    const fullUrl = API_BASE_URL + url;
    console.log(`🚀 [API Request] ${method} ${fullUrl}`, data);

    wx.request({
      url: fullUrl,
      method: method,
      data: data,
      header: header,
      success: (res) => {
        const { statusCode, data: resData } = res;
        console.log(`✅ [API Response] ${method} ${fullUrl} [${statusCode}]`, resData);

        // 4. 处理业务逻辑
        if (statusCode >= 200 && statusCode < 300) {
          // 请求成功
          resolve(resData);
        } else if (statusCode === 401) {
          // Token 过期或无效
          console.warn('⚠️ [API Auth] Token expired or invalid');
          AuthService.handleSessionExpired(); // 踢回登录页
          reject(resData);
        } else {
          // 其他错误 (404, 500 等)
          console.error(`❌ [API Error] ${statusCode}`, resData);
          wx.showToast({
            title: resData.message || '网络请求错误',
            icon: 'none'
          });
          reject(resData);
        }
      },
      fail: (err) => {
        console.error(`💥 [API Network Fail] ${method} ${fullUrl}`, err);
        wx.showToast({ title: '网络连接失败', icon: 'none' });
        reject(err);
      }
    });
  });
}

// 导出常用的方法
export default {
  get: (url, data) => request(url, 'GET', data),
  post: (url, data) => request(url, 'POST', data),
  put: (url, data) => request(url, 'PUT', data),
  del: (url, data) => request(url, 'DELETE', data),
};