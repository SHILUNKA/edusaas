// web_admin/src/components/HqLogo.tsx

import React from 'react';

const HqLogo = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="600"
      height="400"
      viewBox="0 0 600 400"
      xmlns="http://www.w3.org/2000/svg"
      {...props} // 允许从外部传入 className, style, width, height 等属性
    >
      <defs>
        <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#00F2FF', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#0066FF', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="600" height="400" fill="#0A1128" />
      <g transform="translate(300, 200)" filter="url(#glow)">
        <path
          d="M-80,-40 C-120,-60 -140,0 -100,60 C-60,120 80,120 120,60 C160,0 140,-60 100,-80 L130,-100 M100,-80 C60,-100 -80,-100 -120,-60 L-150,-80"
          fill="none"
          stroke="url(#blueGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          transform="rotate(-30)"
        />
        <path
          d="M-80,40 C-120,60 -140,0 -100,-60 C-60,-120 80,-120 120,-60 C160,0 140,60 100,80 L130,100 M100,80 C60,100 -80,100 -120,60 L-150,80"
          fill="none"
          stroke="url(#blueGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          transform="rotate(30)"
        />
        <ellipse
          cx="0"
          cy="0"
          rx="130"
          ry="50"
          fill="none"
          stroke="url(#blueGradient)"
          strokeWidth="8"
          transform="rotate(90)"
        />

        <g>
          <circle
            cx="0"
            cy="0"
            r="45"
            fill="none"
            stroke="#00F2FF"
            strokeWidth="3"
            opacity="0.8"
          />
          <circle
            cx="0"
            cy="0"
            r="30"
            fill="none"
            stroke="#00F2FF"
            strokeWidth="4"
            opacity="1"
          />
          <circle cx="0" cy="0" r="15" fill="#00F2FF" opacity="0.3" />
          <path d="M0,-20 L5,-5 L20,0 L5,5 L0,20 L-5,5 L-20,0 L-5,-5 Z" fill="#FFFFFF" />
        </g>
      </g>
      <text
        x="300"
        y="350"
        fontFamily="Arial, sans-serif"
        fontSize="24"
        fill="#FFFFFF"
        textAnchor="middle"
        letterSpacing="2"
      >
        全域感知 HQ
      </text>
    </svg>
  );
};

export default HqLogo;