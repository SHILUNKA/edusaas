// 课表页面
const CustomerService = require('../../../services/CustomerService');
Page({
  data: {
    participantId: '',
    viewMode: 'calendar', // calendar | list
    currentMonth: '',
    classes: [],
    loading: false,

    // 日历数据
    calendarDays: [],
    selectedDate: null,

    // 筛选
    filterStatus: 'all' // all | upcoming | completed
  },

  onLoad(options) {
    if (options.participant_id) {
      this.setData({ participantId: options.participant_id });
    }
    this.initCalendar();
    this.loadClasses();
  },

  // 初始化日历
  initCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    this.setData({
      currentMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
      selectedDate: now.toISOString().split('T')[0]
    });

    this.generateCalendar(year, month);
  },

  // 生成日历数据
  generateCalendar(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // 填充前置空白
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ empty: true });
    }

    // 填充日期
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({
        date: i,
        fullDate: date.toISOString().split('T')[0],
        isToday: this.isToday(date),
        hasClass: false
      });
    }

    this.setData({ calendarDays: days });
  },

  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  },

  // 加载课程
  async loadClasses() {
    if (!this.data.participantId) return;
    this.setData({ loading: true });

    try {
      const result = await CustomerService.getSchedule({
        participant_id: this.data.participantId,
        // 这里可以根据当前月份范围加载
        // 暂时加载全部或当前月的
      });

      const classes = result.classes || [];
      this.setData({ classes });
      this.markClassDays(classes);
    } catch (err) {
      console.error('加载课程失败', err);
      wx.showToast({ title: '加载课表失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 标记有课的日期
  markClassDays(classes) {
    const classDateSet = new Set(
      classes.map(c => c.start_time.split('T')[0])
    );

    const calendarDays = this.data.calendarDays.map(day => {
      if (day.fullDate && classDateSet.has(day.fullDate)) {
        return { ...day, hasClass: true };
      }
      return day;
    });

    this.setData({ calendarDays });
  },

  // 切换视图模式
  switchView(e) {
    const { mode } = e.currentTarget.dataset;
    this.setData({ viewMode: mode });
  },

  // 选择日期
  onDateTap(e) {
    const { date } = e.currentTarget.dataset;
    this.setData({ selectedDate: date });
  },

  // 查看课程详情
  navToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `./detail/index?id=${id}`
    });
  },

  // 请假
  navToLeave() {
    wx.navigateTo({
      url: '/pkg_customer/pages/leave/apply/index'
    });
  },

  onPullDownRefresh() {
    this.loadClasses().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
