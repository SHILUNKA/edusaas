import UserService from '../../../../services/UserService';

Page({
  data: {
    baseId: '',
    baseName: '',
    email: '',
    name: '',
    password: '',
    loading: false
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      // Fetch base details or use passed data. 
      // Ideally we should fetch name if not passed, but for now let's assume we can get it or just show generic if missing.
      // But wait, list page doesn't pass name yet? I should have updated list page to pass name or fetch it here.
      // Let's trying fetching details if we have BaseService, or just use a placeholder if name missing.
      // Actually simpler: let's assume we pass name in query param for now as it's efficient.
      // I'll update list page to pass name in next step if I haven't.
      // For now, let's reset password.
      this.generatePassword();
      this.setData({
        baseId: id,
        baseName: options.name ? decodeURIComponent(options.name) : '该基地' // Fallback
      });
    }
  },

  generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.setData({ password: pwd });
  },

  onRefreshPassword() {
    this.generatePassword();
  },

  onCopyPassword() {
    wx.setClipboardData({
      data: this.data.password,
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    });
  },

  onEmailInput(e) {
    this.setData({ email: e.detail.value });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  async onSubmit() {
    const { baseId, email, name, password } = this.data;

    if (!email || !name) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    if (!baseId) {
      wx.showToast({ title: '缺少基地信息', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const payload = {
        base_id: baseId,
        role_key: 'role.base.admin', // Default role for Principal
        email,
        full_name: name,
        password: password || undefined
      };

      await UserService.createUser(payload);

      wx.showToast({ title: '任命成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (err) {
      console.error(err);
      wx.showToast({
        title: err.message || '任命失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});
