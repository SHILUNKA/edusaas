/*
 * 校区端: 今日课堂 (V14.1 - 状态感知版)
 * 路径: /base/classes/page.tsx
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
    const token = (session?.user as any)?.rawToken;
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

        if (now > end) return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs flex items-center gap-1"><Lock size={10} /> 已结束</span>;
        if (now >= start && now <= end) return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs animate-pulse font-bold">🟢 上课中</span>;
        return <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs">⏳ 待上课</span>;
    };

    return (
        <div className="p-6 max-w-4xl mx-auto min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-indigo-50/20">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-md shadow-indigo-200/40">
                            <Clock className="text-indigo-600" size={28} />
                        </div>
                        今日课堂
                    </h1>
                    <p className="text-sm text-slate-500 mt-2 ml-[4.5rem] font-medium">
                        {new Date().toLocaleDateString()} · 共 {classes.length} 节课程
                    </p>
                </div>
                <button
                    onClick={fetchTodayClasses}
                    className="text-sm font-semibold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-2xl transition-all hover:shadow-sm border border-indigo-200"
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
                                    <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-2xl shadow-md ${isExpired ? 'bg-gradient-to-br from-slate-200 to-gray-200 text-slate-600' : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700'}`}>
                                        <span className="text-lg font-bold">{new Date(cls.start_time).getHours()}</span>
                                        <span className="text-xs font-medium">:{new Date(cls.start_time).getMinutes().toString().padStart(2, '0')}</span>
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-bold transition-colors ${isExpired ? 'text-gray-600' : 'text-gray-900 group-hover:text-indigo-700'}`}>
                                            {cls.course_name_key}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                            <span className="flex items-center gap-1"><MapPin size={14} /> {cls.room_name}</span>
                                            <span className="flex items-center gap-1"><Users size={14} /> {cls.teacher_names || '未排师资'}</span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            {getStatusBadge(cls)}
                                        </div>
                                    </div>
                                </div>

                                {/* 右侧操作 (★ 核心修改) */}
                                <div className="flex items-center gap-3">
                                    {isExpired ? (
                                        <button className="bg-white border-2 border-slate-300 text-slate-600 px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-slate-50 hover:shadow-md flex items-center gap-2 transition-all">
                                            <Eye size={16} /> 查看详情
                                        </button>
                                    ) : (
                                        <button className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-indigo-300/50 shadow-md flex items-center gap-2 transition-all hover:scale-105">
                                            <CheckCircle size={16} /> 点名 / 消课
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