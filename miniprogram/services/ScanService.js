import { userStore } from '../store/userStore';

class ScanService {
  async handleScan(scanResult) {
    const role = userStore.role;
    const code = scanResult.result;

    const strategies = {
      'HQ': this._handleHqScan,
      'BASE': this._handleBaseScan,
      'CONSUMER': this._handleConsumerScan
    };

    const strategy = strategies[role];
    if (strategy) {
      await strategy.call(this, code);
    } else {
      wx.showToast({ title: '无权操作', icon: 'none' });
    }
  }

  // 私有处理逻辑
  async _handleHqScan(code) {
    // 总部逻辑：跳转到防伪码批次追踪页
    wx.navigateTo({ url: `/pkg_hq/qrcode_ops/detail?code=${code}` });
  }

  async _handleBaseScan(code) {
    // 校区逻辑：根据码类型判断是入库还是核销
    // 这里可以进一步封装逻辑...
    wx.navigateTo({ url: `/pkg_base/inventory/inbound?code=${code}` });
  }

  async _handleConsumerScan(code) {
    // C端逻辑：溯源
    wx.navigateTo({ url: `/pkg_customer/verify_result/index?code=${code}` });
  }
}

export default new ScanService();