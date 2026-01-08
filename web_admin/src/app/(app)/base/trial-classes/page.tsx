/*
 * 基地试听课管理 - 列表页
 * 路径: /base/trial-classes
 */
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { API_BASE_URL } from '@/lib/config';
import {
    Calendar, Clock, User, Phone, BookOpen,
    Plus, Search, Filter, Star, CheckCircle, XCircle, Clock3, Target
} from 'lucide-react';
import CreateTrialClassModal from './CreateTrialClassModal';
import TrialClassDetailDrawer from './TrialClassDetailDrawer';

interface TrialClass {
    id: number;
    student_name: string;
    student_age?: number;
    parent_name: string;
    parent_phone: string;
    scheduled_at: string;
    teacher_name?: string;
    classroom?: string;
    course_type?: string;
    status: string;
    student_performance?: number;
    parent_satisfaction?: number;
    conversion_intent?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '待确认', color: 'text-yellow-700', bg: 'bg-yellow-50' },
    confirmed: { label: '已安排', color: 'text-blue-700', bg: 'bg-blue-50' },
    completed: { label: '已完成', color: 'text-green-700', bg: 'bg-green-50' },
    cancelled: { label: '已取消', color: 'text-gray-700', bg: 'bg-gray-50' },
};

export default function TrialClassesPage() {
    const { data: session } = useSession();
    const token = (session?.user as any)?.rawToken;
    const [trialClasses, setTrialClasses] = useState<TrialClass[]>([]);
    const [filteredClasses, setFilteredClasses] = useState<TrialClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedClass, setSelectedClass] = useState<number | null>(null);

    // 统计数据
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
    });

    useEffect(() => {
        if (token) {
            fetchTrialClasses();
        }
    }, [token]);

    useEffect(() => {
        filterClasses();
    }, [trialClasses, searchTerm, statusFilter]);

    const fetchTrialClasses = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/base/trial-classes`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setTrialClasses(data);
                calculateStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch trial classes:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data: TrialClass[]) => {
        setStats({
            total: data.length,
            pending: data.filter(tc => tc.status === 'pending').length,
            confirmed: data.filter(tc => tc.status === 'confirmed').length,
            completed: data.filter(tc => tc.status === 'completed').length,
            cancelled: data.filter(tc => tc.status === 'cancelled').length,
        });
    };

    const filterClasses = () => {
        let filtered = [...trialClasses];

        // 状态筛选
        if (statusFilter !== 'all') {
            filtered = filtered.filter(tc => tc.status === statusFilter);
        }

        // 搜索筛选
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(tc =>
                tc.student_name.toLowerCase().includes(term) ||
                tc.parent_name.toLowerCase().includes(term) ||
                tc.parent_phone.includes(term)
            );
        }

        setFilteredClasses(filtered);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${month}-${day} ${hours}:${minutes}`;
    };

    if (loading) {
        return <div className="p-8 text-center">加载中...</div>;
    }

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="text-indigo-600" size={32} /> 试听课管理
                    </h1>
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <span>总数: <b className="text-gray-900">{stats.total}</b></span>
                        <span className="w-[1px] bg-gray-300 h-4 self-center"></span>
                        <span className="text-yellow-600">待确认: <b>{stats.pending}</b></span>
                        <span className="text-blue-600">已安排: <b>{stats.confirmed}</b></span>
                        <span className="text-green-600">已完成: <b>{stats.completed}</b></span>
                    </div>
                </div>
                <button
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all hover:scale-105"
                    onClick={() => setShowCreateModal(true)}
                >
                    <Plus size={18} /> 安排试听课
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="搜索学员、家长姓名或电话..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>

                {/* Status Filter */}
                <div className="flex gap-2">
                    {[
                        { key: 'all', label: '全部' },
                        { key: 'pending', label: '待确认' },
                        { key: 'confirmed', label: '已安排' },
                        { key: 'completed', label: '已完成' },
                    ].map(status => (
                        <button
                            key={status.key}
                            onClick={() => setStatusFilter(status.key)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${statusFilter === status.key
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {status.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Trial Classes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClasses.map(tc => (
                    <div
                        key={tc.id}
                        onClick={() => setSelectedClass(tc.id)}
                        className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer p-5 border border-gray-100"
                    >
                        {/* Status Badge */}
                        <div className="flex justify-between items-start mb-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_MAP[tc.status].bg} ${STATUS_MAP[tc.status].color}`}>
                                {STATUS_MAP[tc.status].label}
                            </span>
                            {tc.conversion_intent === 'high' && (
                                <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-bold">
                                    🔥 高意向
                                </span>
                            )}
                        </div>

                        {/* Student Info */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <User className="text-indigo-600" size={16} />
                                <span className="font-bold text-gray-900">{tc.student_name}</span>
                                {tc.student_age && <span className="text-sm text-gray-500">({tc.student_age}岁)</span>}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone size={14} />
                                <span>{tc.parent_name} {tc.parent_phone}</span>
                            </div>
                        </div>

                        {/* Schedule Info */}
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-700">
                                <Clock className="text-indigo-500" size={14} />
                                <span className="font-medium">{formatDate(tc.scheduled_at)}</span>
                            </div>
                            {tc.teacher_name && (
                                <div className="flex items-center gap-2 text-gray-600">
                                    <User size={14} />
                                    <span>老师: {tc.teacher_name}</span>
                                </div>
                            )}
                            {tc.course_type && (
                                <div className="flex items-center gap-2 text-gray-600">
                                    <BookOpen size={14} />
                                    <span>{tc.course_type}</span>
                                </div>
                            )}
                        </div>

                        {/* Feedback (if completed) */}
                        {tc.status === 'completed' && tc.student_performance && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    <Star className="text-yellow-500 fill-yellow-500" size={14} />
                                    <span className="text-sm text-gray-700">
                                        学员表现: {tc.student_performance}/5
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {filteredClasses.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl">
                    <Calendar className="mx-auto text-gray-300" size={64} />
                    <p className="mt-4 text-gray-500">暂无试听课</p>
                </div>
            )}

            {/* Modals */}
            {showCreateModal && (
                <CreateTrialClassModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        fetchTrialClasses();
                    }}
                />
            )}

            {selectedClass && (
                <TrialClassDetailDrawer
                    trialClassId={selectedClass}
                    onClose={() => setSelectedClass(null)}
                    onUpdate={() => fetchTrialClasses()}
                />
            )}
        </div>
    );
}
