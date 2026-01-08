// utils/request.js - 通用请求工具
const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * 通用请求函数
 * @param {Object} options - 请求配置
 * @param {string} options.url - 接口路径
 * @param {string} options.method - 方法 (GET/POST/PUT/DELETE)
 * @param {Object} options.data - 数据
 */
function request({ url, method = 'GET', data = {} }) {
    return new Promise((resolve, reject) => {
        const token = wx.getStorageSync('token');

        const header = {
            'Content-Type': 'application/json'
        };

        if (token) {
            header['Authorization'] = `Bearer ${token}`;
        }

        const fullUrl = url.startsWith('http') ? url : (API_BASE_URL + url);
        console.log(`🚀 [API Request] ${method} ${fullUrl}`, data);

        wx.request({
            url: fullUrl,
            method: method,
            data: data,
            header: header,
            success: (res) => {
                const { statusCode, data: resData } = res;
                console.log(`✅ [API Response] ${statusCode}`, resData);

                if (statusCode >= 200 && statusCode < 300) {
                    resolve(resData);
                } else if (statusCode === 401) {
                    console.warn('Unauthorized - redirecting to login');
                    // 处理登录过期
                    wx.removeStorageSync('token');
                    wx.reLaunch({ url: '/pages/launch/index' });
                    reject(new Error('Unauthorized'));
                } else {
                    wx.showToast({
                        title: resData.message || `请求失败 (${statusCode})`,
                        icon: 'none'
                    });
                    reject(resData);
                }
            },
            fail: (err) => {
                console.error('Network Error:', err);
                wx.showToast({ title: '网络连接失败', icon: 'none' });
                reject(err);
            }
        });
    });
}

module.exports = {
    request
};
