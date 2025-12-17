/*
 * 总部端: 学员活跃度图表组件
 * 路径: /hq/dashboard/ActivityChart.tsx
 */
'use client';

import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer 
} from 'recharts';

// (暂用模拟数据，后续对接后端 API)
const data = [
    { name: '周一', active: 120, new: 5 },
    { name: '周二', active: 132, new: 8 },
    { name: '周三', active: 101, new: 2 },
    { name: '周四', active: 134, new: 10 },
    { name: '周五', active: 190, new: 15 },
    { name: '周六', active: 230, new: 30 },
    { name: '周日', active: 210, new: 25 },
];

export default function ActivityChart() {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[400px]">
            <h3 className="text-lg font-bold text-gray-800 mb-4">学员活跃度趋势 (近7日)</h3>
            
            <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 30,
                            left: 0,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#6B7280', fontSize: 12 }} 
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#6B7280', fontSize: 12 }} 
                        />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        {/* 活跃学员曲线 */}
                        <Line 
                            type="monotone" 
                            dataKey="active" 
                            name="上课人次"
                            stroke="#4F46E5" // Indigo-600
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6 }}
                        />
                        {/* 新增学员曲线 */}
                        <Line 
                            type="monotone" 
                            dataKey="new" 
                            name="新增报名"
                            stroke="#10B981" // Green-500
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}