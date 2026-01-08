/**
 * Soft UI Evolution - Design System Constants
 * 柔和UI设计系统 - 全局配置
 */

// 🎨 Soft Pastel Color Palette
export const SOFT_COLORS = {
    // Primary Soft Colors
    softBlue: '#87CEEB',      // 柔和天蓝
    softPink: '#FFB6C1',      // 柔和粉色
    softGreen: '#90EE90',     // 柔和绿色
    lavender: '#A78BFA',      // 薰衣草紫
    peach: '#FECACA',         // 桃色

    // Neutral Colors
    background: '#F8FAFC',    // 页面背景
    cardBg: '#FFFFFF',        // 卡片背景
    text: '#334155',          // 主文本
    textMuted: '#64748B',     // 次要文本
    border: '#E2E8F0',        // 边框

    // Semantic Colors
    success: '#10B981',       // 成功
    warning: '#F59E0B',       // 警告
    error: '#EF4444',         // 错误
    info: '#3B82F6',          // 信息
};

// 🌈 Gradient Backgrounds
export const SOFT_GRADIENTS = {
    // Page Backgrounds
    pageBackground: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',

    // Card Gradients (15% → 5% opacity)
    blue: 'linear-gradient(135deg, rgba(135, 206, 235, 0.15), rgba(135, 206, 235, 0.05))',
    pink: 'linear-gradient(135deg, rgba(255, 182, 193, 0.12), rgba(255, 182, 193, 0.05))',
    green: 'linear-gradient(135deg, rgba(144, 238, 144, 0.12), rgba(144, 238, 144, 0.05))',
    purple: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(167, 139, 250, 0.05))',
    peach: 'linear-gradient(135deg, rgba(254, 202, 202, 0.2), rgba(254, 202, 202, 0.08))',

    // Button Gradients
    buttonBlue: 'linear-gradient(135deg, #87CEEB, #A78BFA)',
    buttonPink: 'linear-gradient(135deg, #FFB6C1, #FECACA)',
    buttonGreen: 'linear-gradient(135deg, #90EE90, #34D399)',
};

// 💫 Soft Shadows (softer than flat, clearer than neumorphism)
export const SOFT_SHADOWS = {
    // Card Shadows (color-tinted)
    cardBlue: '0 8px 32px rgba(135, 206, 235, 0.15), 0 2px 8px rgba(0, 0, 0, 0.05)',
    cardPink: '0 8px 32px rgba(255, 182, 193, 0.15), 0 2px 8px rgba(0, 0, 0, 0.05)',
    cardGreen: '0 8px 32px rgba(144, 238, 144, 0.12), 0 2px 8px rgba(0, 0, 0, 0.05)',
    cardPurple: '0 8px 32px rgba(167, 139, 250, 0.12), 0 2px 8px rgba(0, 0, 0, 0.05)',

    // Hover Shadows (enhanced)
    cardHover: '0 12px 48px rgba(135, 206, 235, 0.25), 0 4px 12px rgba(0, 0, 0, 0.08)',

    // Button Shadows
    buttonBlue: '0 4px 15px rgba(135, 206, 235, 0.3)',
    buttonPink: '0 4px 15px rgba(255, 182, 193, 0.3)',
    buttonGreen: '0 4px 15px rgba(144, 238, 144, 0.3)',

    // Subtle Shadows
    sm: '0 4px 16px rgba(0, 0, 0, 0.03)',
    md: '0 8px 32px rgba(0, 0, 0, 0.05)',
    lg: '0 12px 48px rgba(0, 0, 0, 0.08)',
};

// 📐 Border Radius
export const SOFT_RADIUS = {
    sm: '12px',    // 小组件
    md: '16px',    // 中等卡片
    lg: '20px',    // 大卡片
    xl: '24px',    // 超大容器
    '2xl': '32px', // 页面级容器
    '3xl': '48px', // 特大容器
    full: '9999px' // 圆形
};

// 🎭 Typography
export const SOFT_TYPOGRAPHY = {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",

    // Font Weights
    weights: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        black: 900,
    },

    // Font Sizes
    sizes: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
    }
};

// ⏱️ Animation Timing
export const SOFT_TRANSITIONS = {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '350ms ease',

    // Cubic Bezier
    spring: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// 📦 Component Spacing
export const SOFT_SPACING = {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
};

// 🎯 Z-Index Layers
export const SOFT_Z_INDEX = {
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    fixed: 1200,
    modalBackdrop: 1300,
    modal: 1400,
    popover: 1500,
    tooltip: 1600,
};

export default {
    colors: SOFT_COLORS,
    gradients: SOFT_GRADIENTS,
    shadows: SOFT_SHADOWS,
    radius: SOFT_RADIUS,
    typography: SOFT_TYPOGRAPHY,
    transitions: SOFT_TRANSITIONS,
    spacing: SOFT_SPACING,
    zIndex: SOFT_Z_INDEX,
};
