// components/dynamic-tab-bar/index.js
import { storeBindingsBehavior } from 'mobx-miniprogram-bindings';
import { userStore } from '../../store/userStore';

// --- 配置中心 ---
// 定义不同角色的 TabBar 数据（颜色、菜单列表）
// 图片路径对应你之前放入 images/tabbar/ 目录下的文件
const TAB_CONFIG = {
  'HQ': { // 总部视角
    color: "#94A3B8", // 未选中颜色 (灰色)
    selectedColor: "#4F46E5", // 选中颜色 (总部蓝)
    list: [
      {
        pagePath: "/pkg_hq/dashboard/index",
        text: "驾驶舱",
        iconPath: "/images/tabbar/tab_hq.png",
        selectedIconPath: "/images/tabbar/tab_hq_on.png"
      }
      // 未来可以在这里添加更多总部 Tab，如 "审批", "报表"
    ]
  },
  'BASE': { // 校区视角
    color: "#94A3B8",
    selectedColor: "#059669", // 选中颜色 (校区绿)
    list: [
      {
        pagePath: "/pkg_base/pages/dashboard/index",
        text: "看板",
        iconPath: "/images/tabbar/tab_base.png",
        selectedIconPath: "/images/tabbar/tab_base_on.png"
      },
      {
        pagePath: "/pkg_base/workspace/index",
        text: "工作台",
        iconPath: "/images/tabbar/tab_home.png",
        selectedIconPath: "/images/tabbar/tab_home_on.png"
      }
    ]
  },
  'CONSUMER': { // C端视角
    color: "#94A3B8",
    selectedColor: "#3B82F6", // 蓝色系
    list: [
      {
        pagePath: "/pkg_customer/pages/home/index",
        text: "首页",
        iconPath: "/images/tabbar/tab_home.png",
        selectedIconPath: "/images/tabbar/tab_home_on.png"
      },
      {
        pagePath: "/pkg_customer/pages/schedule/index",
        text: "课表",
        iconPath: "/images/tabbar/tab_home.png", // 暂用 Home 图标
        selectedIconPath: "/images/tabbar/tab_home_on.png"
      },
      {
        pagePath: "/pkg_customer/pages/honor/index",
        text: "荣誉",
        iconPath: "/images/tabbar/tab_base.png", // 暂用 Base 图标
        selectedIconPath: "/images/tabbar/tab_base_on.png"
      },
      {
        pagePath: "/pkg_customer/pages/profile/index",
        text: "我的",
        iconPath: "/images/tabbar/tab_hq.png", // 暂用 HQ 图标
        selectedIconPath: "/images/tabbar/tab_hq_on.png"
      }
    ]
  }
};

Component({
  // 1. 注入 MobX Behavior，让组件能响应 Store 变化
  behaviors: [storeBindingsBehavior],

  // 2. 定义组件属性（父页面传入）
  properties: {
    // 当前选中项的索引，默认第0个
    selected: {
      type: Number,
      value: 0
    }
  },

  // 3. 组件内部数据
  data: {
    color: "#999999",
    selectedColor: "#000000",
    list: [] // 初始化为空，等待 JS 动态填充
  },

  // 4. MobX Store 绑定配置
  storeBindings: {
    store: userStore,
    fields: {
      userRole: 'role' // 将 Store 中的 role 字段绑定到当前组件的 userRole 数据字段
    }
  },

  // 5. 数据监听器
  observers: {
    // 监听 userRole 的变化。当用户登录、退出导致角色变化时，触发此函数
    'userRole': function (newRole) {
      console.log('🔄 [DynamicTabBar] 检测到角色变化:', newRole);
      this.initTabBarData(newRole);
    }
  },

  // 6. 组件生命周期
  lifetimes: {
    // 组件实例进入页面节点树时执行
    attached() {
      // 兜底初始化：如果 observers 还没触发，手动初始化一次
      if (this.data.list.length === 0 && this.data.userRole) {
        this.initTabBarData(this.data.userRole);
      }
    }
  },

  // 7. 组件方法
  methods: {
    /**
     * 根据角色初始化 TabBar 数据
     */
    initTabBarData(role) {
      // 获取对应角色的配置，如果找不到（比如未登录状态的 GUEST），默认使用 CONSUMER 配置
      const config = TAB_CONFIG[role] || TAB_CONFIG['CONSUMER'];

      console.log('🎨 [DynamicTabBar] 应用配置:', role, config.list.length + '个菜单项');

      this.setData({
        list: config.list,
        color: config.color,
        selectedColor: config.selectedColor
      });
    },

    /**
     * 点击 Tab 项的处理函数
     */
    switchTab(e) {
      const url = e.currentTarget.dataset.path;

      // 获取当前页面栈
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const currentRoute = '/' + currentPage.route;

      // 优化体验：如果点击的 Tab 就是当前所在的页面，则不做任何反应
      // 避免重复刷新页面
      if (currentRoute.includes(url)) {
        console.log('🚫 [DynamicTabBar] 已在当前页，忽略跳转');
        return;
      }

      console.log('🚀 [DynamicTabBar] 切换 Tab 至:', url);

      // 核心：因为我们的页面分布在不同的分包，属于“平行世界”
      // 所以必须用 reLaunch 关闭所有旧页面，打开新页面。
      // 这不能用 wx.switchTab，因为我们不是标准的 tabbar 页面。
      wx.reLaunch({
        url: url,
        fail: (err) => {
          console.error('❌ [DynamicTabBar] 跳转失败，请检查路径:', err);
        }
      });
    }
  }
});