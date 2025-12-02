/*
 * 校区端: 今日课堂 (V14.1 - 状态感知版)
 * 路径: /campus/classes/page.tsx
 * 优化: 列表上的按钮根据课程状态自动变化 (点名 vs 查看)
 */
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import { Clock, MapPin, Users, CheckCircle, ChevronRight, Lock, Eye } from 'lucide-react';
import RollCallModal from './RollCallModal'; 

interface ClassDetail {
    id: string;
    course_name_key: string;
    teacher_names: string | null;
    room_name: string;
    start_time: string;
    end_time: string;
    status: string; 
}

export default function TodayClassesPage() {
    const { data: session } = useSession();
    const token = session?.user?.rawToken;
    const API = API_BASE_URL;

    const [classes, setClasses] = useState<ClassDetail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState<ClassDetail | null>(null);

    const fetchTodayClasses = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API}/base/classes?date=today`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setClasses(await res.json());
            }
        } catch (e) { console.error(e); } 
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchTodayClasses(); }, [token]);

    // 判断是否过期
    const checkIsExpired = (endTime: string) => new Date() > new Date(endTime);

    // 状态徽章
    const getStatusBadge = (cls: ClassDetail) => {
        const now = new Date();
        const start = new Date(cls.start_time);
        const end = new Date(cls.end_time);
        
        if (now > end) return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs flex items-center gap-1"><Lock size={10}/> 已结束</span>;
        if (now >= start && now <= end) return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs animate-pulse font-bold">🟢 上课中</span>;
        return <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs">⏳ 待上课</span>;
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Clock className="text-indigo-600" /> 今日课堂
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {new Date().toLocaleDateString()} · 共 {classes.length} 节课程
                    </p>
                </div>
                <button 
                    onClick={fetchTodayClasses} 
                    className="text-sm text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded transition-colors"
                >
                    刷新列表
                </button>
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-20 text-gray-400">加载课程中...</div>
                ) : classes.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                        <div className="text-4xl mb-2">☕️</div>
                        <p className="text-gray-500">今天没有安排课程，休息一下吧</p>
                    </div>
                ) : (
                    classes.map(cls => {
                        const isExpired = checkIsExpired(cls.end_time);
                        return (
                            <div 
                                key={cls.id}
                                onClick={() => setSelectedClass(cls)}
                                className={`
                                    border rounded-xl p-5 flex items-center justify-between transition-all group cursor-pointer
                                    ${isExpired 
                                        ? 'bg-gray-50 border-gray-200 opacity-80 hover:opacity-100' 
                                        : 'bg-white border-gray-200 hover:shadow-md hover:border-indigo-300'
                                    }
                                `}
                            >
                                {/* 左侧信息 */}
                                <div className="flex items-start gap-4">
                                    <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-lg ${isExpired ? 'bg-gray-200 text-gray-500' : 'bg-indigo-50 text-indigo-700'}`}>
                                        <span className="text-lg font-bold">{new Date(cls.start_time).getHours()}</span>
                                        <span className="text-xs font-medium">:{new Date(cls.start_time).getMinutes().toString().padStart(2,'0')}</span>
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-bold transition-colors ${isExpired ? 'text-gray-600' : 'text-gray-900 group-hover:text-indigo-700'}`}>
                                            {cls.course_name_key}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                            <span className="flex items-center gap-1"><MapPin size={14}/> {cls.room_name}</span>
                                            <span className="flex items-center gap-1"><Users size={14}/> {cls.teacher_names || '未排师资'}</span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            {getStatusBadge(cls)}
                                        </div>
                                    </div>
                                </div>

                                {/* 右侧操作 (★ 核心修改) */}
                                <div className="flex items-center gap-3">
                                    {isExpired ? (
                                        <button className="bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                                            <Eye size={16}/> 查看详情
                                        </button>
                                    ) : (
                                        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2">
                                            <CheckCircle size={16}/> 点名 / 消课
                                        </button>
                                    )}
                                    <ChevronRight className="text-gray-300 group-hover:text-indigo-400" />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {selectedClass && token && (
                <RollCallModal 
                    token={token}
                    classData={selectedClass}
                    onClose={() => setSelectedClass(null)}
                    onSuccess={fetchTodayClasses}
                />
            )}
        </div>
    );
}