// pages/launch/index.js
import AuthService from '../../services/AuthService';

Page({
  onLoad() {
    // 页面加载时，立刻执行路由分发
    // 如果没登录，AuthService 会自动把你踢到 pages/login/index
    AuthService.initAppRoute();
  }
});