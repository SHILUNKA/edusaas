import { observable, action } from 'mobx-miniprogram';

export const userStore = observable({
  // 数据字段
  token: wx.getStorageSync('token') || '',
  userInfo: wx.getStorageSync('userInfo') || null,
  role: wx.getStorageSync('role') || 'GUEST', // 核心字段: HQ, BASE, CONSUMER

  // 动作: 登录成功后调用
  setLoginSuccess: action(function (token, userInfo, role) {
    this.token = token;
    this.userInfo = userInfo;
    this.role = role;
    
    // 持久化存储，防止刷新丢失
    wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('role', role);
  }),

  // 动作: 退出登录
  logout: action(function () {
    this.token = '';
    this.userInfo = null;
    this.role = 'GUEST';
    wx.clearStorageSync();
  })
});