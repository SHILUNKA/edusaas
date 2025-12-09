import React from 'react';

// 1. 定义配置项的结构接口
interface BaseLogoConfig {
  coreElementPath: string;
  gradientId: string;
  gradientDef: JSX.Element;
  primaryText: string;
  secondaryText: string;
}

// 2. 定义基地配置映射表 (包含具体的数据)
const baseConfigs: Record<string, BaseLogoConfig> = {
  // === 配置 1: 西部 (山脉) ===
  '西部': {
    coreElementPath: "M-70,50 L-40,-10 L0,40 L30,-40 L70,50 Z",
    gradientId: "earthToTechGrad_western",
    primaryText: "西部内陆基地",
    secondaryText: "WESTERN INLAND BASE",
    gradientDef: (
      <linearGradient id="earthToTechGrad_western" x1="50%" y1="100%" x2="50%" y2="0%" key="western">
        <stop offset="0%" style={{ stopColor: '#CD853F', stopOpacity: 1 }} />
        <stop offset="60%" style={{ stopColor: '#8B4513', stopOpacity: 0.8 }} />
        <stop offset="100%" style={{ stopColor: '#00F2FF', stopOpacity: 1 }} />
      </linearGradient>
    )
  },
  // === 配置 2: 北京 (长城烽火台 - 简化示意) ===
  '北京': {
    coreElementPath: "M-40,50 L-30,0 L-50,-20 L-20,-20 L-20,-40 L20,-40 L20,-20 L50,-20 L30,0 L40,50 Z",
    gradientId: "brickToTechGrad_beijing",
    primaryText: "北京示范基地",
    secondaryText: "BEIJING DEMO BASE",
    gradientDef: (
      <linearGradient id="brickToTechGrad_beijing" x1="50%" y1="100%" x2="50%" y2="0%" key="beijing">
        <stop offset="0%" style={{ stopColor: '#8B0000', stopOpacity: 1 }} /> 
        <stop offset="50%" style={{ stopColor: '#FF4500', stopOpacity: 0.9 }} />
        <stop offset="100%" style={{ stopColor: '#00F2FF', stopOpacity: 1 }} />
      </linearGradient>
    )
  },
  // ... 未来可以在这里添加 '上海', '广州' 等配置
};

// 3. 定义默认配置 (防止匹配失败报错)
const defaultConfig = baseConfigs['西部'];

// 4. 组件 Props 定义
interface DynamicBaseLogoProps extends React.SVGProps<SVGSVGElement> {
  location: string; 
  hideText?: boolean;
}

// 5. 组件主体
const DynamicBaseLogo: React.FC<DynamicBaseLogoProps> = ({ 
  location, 
  hideText = false, 
  ...props 
}) => {
  // 根据 location 查找配置，找不到则用默认
  // 使用 includes 进行模糊匹配 (例如 "北京朝阳" -> 匹配 "北京")
  const configKey = Object.keys(baseConfigs).find(key => location && location.includes(key));
  const config = configKey ? baseConfigs[configKey] : defaultConfig;

  const { coreElementPath, gradientId, gradientDef, primaryText, secondaryText } = config;

  return (
    <svg
      width="500"
      height="500"
      viewBox="0 0 500 500"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        {/* 通用的科技蓝光渐变 (用于轨道和飞翼) */}
        <linearGradient id="blueTechGrad_common" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#00F2FF', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#0066FF', stopOpacity: 1 }} />
        </linearGradient>

        {/* 动态插入核心元素的渐变定义 */}
        {gradientDef}

        {/* 通用发光滤镜 */}
        <filter id="techGlow_common" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 背景 (可通过 CSS 类 .logo-bg 隐藏) */}
      <rect className="logo-bg" width="500" height="500" fill="#0A0A12" rx="20" ry="20" />

      <g transform="translate(250, 230)" filter="url(#techGlow_common)">
        
        {/* 通用外部结构：飞翼和轨道 */}
        <g fill="url(#blueTechGrad_common)" opacity="0.8">
          <path d="M-160,20 C-180,-30 -140,-80 -100,-60 L-120,20 L-100,80 C-140,60 -180,50 -160,20 Z" />
          <path d="M160,20 C180,-30 140,-80 100,-60 L120,20 L100,80 C140,60 180,50 160,20 Z" />
        </g>
        <g fill="none" stroke="url(#blueTechGrad_common)" strokeWidth="6" strokeLinecap="round" opacity="0.9">
          <ellipse cx="0" cy="0" rx="120" ry="50" transform="rotate(10)" />
          <ellipse cx="0" cy="0" rx="120" ry="50" transform="rotate(65)" />
          <ellipse cx="0" cy="0" rx="120" ry="50" transform="rotate(115)" />
        </g>

        {/* 动态渲染核心元素 */}
        <g transform="translate(0, 10)">
          {/* 主体填充 */}
          <path
            d={coreElementPath}
            fill={`url(#${gradientId})`}
            stroke="none"
            opacity="0.95"
          />
          {/* 发光轮廓 */}
          <path
            d={coreElementPath}
            fill="none"
            stroke="#00F2FF"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* 底部光辉 */}
          <rect x="-80" y="45" width="160" height="5" fill="url(#blueTechGrad_common)" opacity="0.5" rx="2" />
        </g>
      </g>

      {/* 动态渲染文字 */}
      {!hideText && (
        <>
          <text
            x="250"
            y="420"
            fontFamily="Arial, sans-serif"
            fontSize="20"
            fontWeight="bold"
            fill="#FFFFFF"
            textAnchor="middle"
            letterSpacing="2"
          >
            {primaryText}
          </text>
          <text
            x="250"
            y="445"
            fontFamily="Arial, sans-serif"
            fontSize="12"
            fill="#00F2FF"
            textAnchor="middle"
            letterSpacing="1"
            opacity="0.8"
          >
            {secondaryText}
          </text>
        </>
      )}
    </svg>
  );
};

export default DynamicBaseLogo;