/**
 * Soft UI Evolution - Reusable Components
 * 柔和UI设计系统 - 可复用组件库
 */

import React, { CSSProperties, ReactNode } from 'react';
import { SOFT_COLORS, SOFT_GRADIENTS, SOFT_SHADOWS, SOFT_RADIUS } from '@/lib/softui-theme';

// ============ SoftCard ============
interface SoftCardProps {
    children: ReactNode;
    variant?: 'blue' | 'pink' | 'green' | 'purple' | 'white';
    padding?: 'sm' | 'md' | 'lg';
    className?: string;
    onClick?: () => void;
    hover?: boolean;
}

export function SoftCard({
    children,
    variant = 'blue',
    padding = 'md',
    className = '',
    onClick,
    hover = true
}: SoftCardProps) {
    const paddingMap = { sm: '16px', md: '24px', lg: '32px' };
    const gradientMap = {
        blue: SOFT_GRADIENTS.blue,
        pink: SOFT_GRADIENTS.pink,
        green: SOFT_GRADIENTS.green,
        purple: SOFT_GRADIENTS.purple,
        white: SOFT_COLORS.cardBg,
    };
    const shadowMap = {
        blue: SOFT_SHADOWS.cardBlue,
        pink: SOFT_SHADOWS.cardPink,
        green: SOFT_SHADOWS.cardGreen,
        purple: SOFT_SHADOWS.cardPurple,
        white: SOFT_SHADOWS.md,
    };

    return (
        <div
            className={`rounded-3xl transition-all ${hover ? 'hover:scale-105 cursor-pointer' : ''} ${className}`}
            style={{
                background: gradientMap[variant],
                boxShadow: shadowMap[variant],
                padding: paddingMap[padding],
            }}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

// ============ SoftButton ============
interface SoftButtonProps {
    children: ReactNode;
    variant?: 'blue' | 'pink' | 'green';
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    icon?: ReactNode;
}

export function SoftButton({
    children,
    variant = 'blue',
    size = 'md',
    onClick,
    disabled = false,
    className = '',
    icon
}: SoftButtonProps) {
    const sizeMap = {
        sm: { padding: '8px 16px', fontSize: '14px' },
        md: { padding: '10px 24px', fontSize: '15px' },
        lg: { padding: '12px 32px', fontSize: '16px' },
    };

    const gradientMap = {
        blue: SOFT_GRADIENTS.buttonBlue,
        pink: SOFT_GRADIENTS.buttonPink,
        green: SOFT_GRADIENTS.buttonGreen,
    };

    const shadowMap = {
        blue: SOFT_SHADOWS.buttonBlue,
        pink: SOFT_SHADOWS.buttonPink,
        green: SOFT_SHADOWS.buttonGreen,
    };

    return (
        <button
            className={`flex items-center gap-2 rounded-xl font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            style={{
                background: gradientMap[variant],
                color: '#FFF',
                boxShadow: shadowMap[variant],
                padding: sizeMap[size].padding,
                fontSize: sizeMap[size].fontSize,
            }}
            onClick={onClick}
            disabled={disabled}
        >
            {icon}
            {children}
        </button>
    );
}

// ============ SoftBadge ============
interface SoftBadgeProps {
    children: ReactNode;
    variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    size?: 'sm' | 'md';
}

export function SoftBadge({ children, variant = 'neutral', size = 'sm' }: SoftBadgeProps) {
    const variantMap = {
        success: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
        warning: { bg: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
        error: { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
        info: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
        neutral: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' },
    };

    const sizeMap = {
        sm: { padding: '4px 12px', fontSize: '12px' },
        md: { padding: '6px 16px', fontSize: '14px' },
    };

    const config = variantMap[variant];
    const sizeConfig = sizeMap[size];

    return (
        <span
            className="inline-flex items-center rounded-xl font-semibold"
            style={{
                background: config.bg,
                color: config.color,
                border: `1.5px solid ${config.border}`,
                padding: sizeConfig.padding,
                fontSize: sizeConfig.fontSize,
            }}
        >
            {children}
        </span>
    );
}

// ============ SoftPageContainer ============
interface SoftPageContainerProps {
    children: ReactNode;
    maxWidth?: '5xl' | '7xl' | 'full';
}

export function SoftPageContainer({ children, maxWidth = '7xl' }: SoftPageContainerProps) {
    const widthMap = {
        '5xl': '1024px',
        '7xl': '1280px',
        'full': '100%',
    };

    return (
        <div
            className="p-6 md:p-8 mx-auto min-h-screen space-y-6"
            style={{
                background: SOFT_GRADIENTS.pageBackground,
                maxWidth: widthMap[maxWidth],
            }}
        >
            {children}
        </div>
    );
}

// ============ SoftHeader ============
interface SoftHeaderProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
    variant?: 'blue' | 'pink' | 'green' | 'purple';
    icon?: ReactNode;
}

export function SoftHeader({ title, subtitle, action, variant = 'blue', icon }: SoftHeaderProps) {
    const gradientMap = {
        blue: SOFT_GRADIENTS.blue,
        pink: SOFT_GRADIENTS.pink,
        green: SOFT_GRADIENTS.green,
        purple: SOFT_GRADIENTS.purple,
    };

    const shadowMap = {
        blue: SOFT_SHADOWS.cardBlue,
        pink: SOFT_SHADOWS.cardPink,
        green: SOFT_SHADOWS.cardGreen,
        purple: SOFT_SHADOWS.cardPurple,
    };

    return (
        <div
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl"
            style={{
                background: gradientMap[variant],
                boxShadow: shadowMap[variant],
            }}
        >
            <div className="flex items-center gap-3">
                {icon}
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: SOFT_COLORS.text }}>
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-sm mt-1" style={{ color: SOFT_COLORS.textMuted }}>
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {action && <div>{action}</div>}
        </div>
    );
}

// ============ SoftLoadingState ============
interface SoftLoadingStateProps {
    message?: string;
    variant?: 'blue' | 'purple';
}

export function SoftLoadingState({ message = '加载中...', variant = 'purple' }: SoftLoadingStateProps) {
    const colorMap = {
        blue: SOFT_COLORS.softBlue,
        purple: SOFT_COLORS.lavender,
    };

    const gradientMap = {
        blue: SOFT_GRADIENTS.blue,
        purple: SOFT_GRADIENTS.purple,
    };

    return (
        <div
            className="h-64 flex flex-col items-center justify-center gap-4 p-8 rounded-3xl"
            style={{
                background: gradientMap[variant],
                boxShadow: variant === 'blue' ? SOFT_SHADOWS.cardBlue : SOFT_SHADOWS.cardPurple,
            }}
        >
            <div
                className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: `${colorMap[variant]}40`, borderTopColor: colorMap[variant] }}
            />
            <p className="text-sm font-medium" style={{ color: SOFT_COLORS.textMuted }}>
                {message}
            </p>
        </div>
    );
}

// ============ SoftEmptyState ============
interface SoftEmptyStateProps {
    message: string;
    variant?: 'blue' | 'purple' | 'pink';
}

export function SoftEmptyState({ message, variant = 'purple' }: SoftEmptyStateProps) {
    const gradientMap = {
        blue: SOFT_GRADIENTS.blue,
        purple: SOFT_GRADIENTS.purple,
        pink: SOFT_GRADIENTS.pink,
    };

    return (
        <div
            className="p-16 text-center rounded-3xl"
            style={{
                background: gradientMap[variant],
                color: SOFT_COLORS.textMuted,
            }}
        >
            <p className="font-medium">{message}</p>
        </div>
    );
}

// ============ SoftInput ============
interface SoftInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function SoftInput({ label, className = '', ...props }: SoftInputProps) {
    return (
        <div>
            {label && (
                <label className="block text-xs font-bold mb-2" style={{ color: SOFT_COLORS.textMuted }}>
                    {label}
                </label>
            )}
            <input
                {...props}
                className={`w-full p-3 rounded-xl border-2 font-semibold outline-none transition-colors ${className}`}
                style={{
                    borderColor: SOFT_COLORS.border,
                    color: SOFT_COLORS.text,
                    backgroundColor: SOFT_COLORS.cardBg,
                }}
            />
        </div>
    );
}

// ============ SoftSelect ============
interface SoftSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
}

export function SoftSelect({ label, className = '', children, ...props }: SoftSelectProps) {
    return (
        <div>
            {label && (
                <label className="block text-xs font-bold mb-2" style={{ color: SOFT_COLORS.textMuted }}>
                    {label}
                </label>
            )}
            <select
                {...props}
                className={`w-full p-3 rounded-xl border-2 font-semibold outline-none transition-colors ${className}`}
                style={{
                    borderColor: SOFT_COLORS.border,
                    color: SOFT_COLORS.text,
                    backgroundColor: SOFT_COLORS.cardBg,
                }}
            >
                {children}
            </select>
        </div>
    );
}
