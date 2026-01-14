/*
 * 校区端: 智能点名弹窗 (V14.5 - 修复函数名引用错误)
 * 路径: /base/classes/RollCallModal.tsx
 */
'use client';

import { useState, useEffect } from 'react';
import {
    X, CheckCircle, XCircle, Loader2, Lock,
    Clock, MoreHorizontal, Undo2, CheckSquare
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

interface EnrollmentDetail {
    id: string;
    participant_id: string;
    participant_name: string;
    participant_avatar: string | null;
    status: string; // 'enrolled', 'completed', 'absent', 'leave'
}

interface RollCallModalProps {
    token: string;
    classData: { id: string; course_name_key: string; start_time: string; end_time: string };
    onClose: () => void;
    onSuccess: () => void;
}

export default function RollCallModal({ token, classData, onClose, onSuccess }: RollCallModalProps) {
    const API = API_BASE_URL;
    const [students, setStudents] = useState<EnrollmentDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [batchLoading, setBatchLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // 选中的学员ID，用于显示修改菜单
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    const isExpired = new Date() > new Date(classData.end_time);

    // 加载数据
    const fetchRoster = async () => {
        try {
            const res = await fetch(`${API}/classes/${classData.id}/enrollments`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setStudents(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchRoster(); }, []);

    // 提交状态更新
    const submitStatus = async (enrollment: EnrollmentDetail, newStatus: string) => {
        setProcessingId(enrollment.id);
        setActiveMenuId(null);

        try {
            const res = await fetch(`${API}/enrollments/${enrollment.id}/complete`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus, teacher_feedback: '点名更新' })
            });

            if (!res.ok) throw new Error("操作失败");

            setStudents(prev => prev.map(s => s.id === enrollment.id ? { ...s, status: newStatus } : s));
            onSuccess();
        } catch (e) {
            alert("操作失败");
        } finally {
            setProcessingId(null);
        }
    };

    // 点击已处理的卡片 -> 打开修改菜单
    const handleProcessedCardClick = (student: EnrollmentDetail) => {
        if (isExpired) return;
        if (processingId) return;

        if (activeMenuId === student.id) {
            setActiveMenuId(null);
        } else {
            setActiveMenuId(student.id);
        }
    };

    // (★ 修复: 函数名统一为 handleBatchCheckIn)
    const handleBatchCheckIn = async () => {
        // 找出所有还没点名的学生 (enrolled)
        const pendingStudents = students.filter(s => s.status === 'enrolled');

        if (pendingStudents.length === 0) return alert("所有学员都已处理完毕！");
        if (isExpired) return alert("课程已结束");

        const confirmMsg = `确认下课？\n\n将把剩余 ${pendingStudents.length} 名【未标记】的学员全部设为【✅ 实到】，并扣除课时。`;
        if (!confirm(confirmMsg)) return;

        setBatchLoading(true);
        try {
            await Promise.all(pendingStudents.map(s =>
                fetch(`${API}/enrollments/${s.id}/complete`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ status: 'completed', teacher_feedback: '批量实到' })
                })
            ));
            fetchRoster();
            onSuccess();
            alert("🎉 点名完成！");
        } catch (e) { alert("部分操作失败"); fetchRoster(); }
        finally { setBatchLoading(false); }
    };

    // UI 辅助
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-50 border-green-500 text-green-700';
            case 'absent': return 'bg-red-50 border-red-500 text-red-700 opacity-80';
            case 'leave': return 'bg-yellow-50 border-yellow-500 text-yellow-700 opacity-80';
            default: return 'bg-white border-gray-200 shadow-sm';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <span className="flex items-center gap-1 text-green-600 text-sm font-bold"><CheckCircle size={16} /> 已实到</span>;
            case 'absent': return <span className="flex items-center gap-1 text-red-600 text-sm font-bold"><XCircle size={16} /> 旷课</span>;
            case 'leave': return <span className="flex items-center gap-1 text-yellow-600 text-sm font-bold"><Clock size={16} /> 请假</span>;
            default: return <span className="text-gray-400 text-xs">待点名</span>;
        }
    };

    const pendingCount = students.filter(s => s.status === 'enrolled').length;
    const arrivedCount = students.filter(s => s.status === 'completed').length;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-in fade-in" onClick={() => setActiveMenuId(null)}>
            <div className="bg-gradient-to-br from-white to-slate-50/30 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100" onClick={e => e.stopPropagation()}>

                {/* Header - Soft UI */}
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{classData.course_name_key}</h2>
                        <p className="text-slate-600 mt-2 text-sm flex gap-4 font-medium">
                            <span>应到 {students.length}</span>
                            <span className="text-emerald-600 font-bold">实到 {arrivedCount}</span>
                            <span className="text-indigo-600 font-bold">待处理 {pendingCount}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-white/80 rounded-2xl transition-all hover:shadow-sm"><X size={24} className="text-slate-500" /></button>
                </div>

                {isExpired && <div className="bg-amber-50 px-6 py-2 text-xs text-amber-800 border-b border-amber-100 flex items-center gap-2"><Lock size={14} /> 课程已结束，操作已锁定。</div>}

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
                    {loading ? (
                        <div className="text-center py-20 text-gray-500">加载名单中...</div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">暂无学员报名</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {students.map(student => {
                                const isProcessing = processingId === student.id;
                                const status = student.status;
                                const isDone = status !== 'enrolled';
                                const isMenuOpen = activeMenuId === student.id;

                                return (
                                    <div
                                        key={student.id}
                                        onClick={() => isDone ? handleProcessedCardClick(student) : null}
                                        className={`
                                            relative flex flex-col items-center p-4 rounded-xl border-2 transition-all select-none
                                            ${getStatusColor(status)}
                                            ${isDone && !isExpired ? 'cursor-pointer hover:scale-[1.02]' : ''}
                                        `}
                                    >
                                        {/* 头像 */}
                                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-2 overflow-hidden bg-white/80`}>
                                            {student.participant_avatar ? <img src={student.participant_avatar} className="w-full h-full object-cover" /> : student.participant_name[0]}
                                        </div>

                                        {/* 姓名 */}
                                        <h3 className="font-bold text-base mb-1">{student.participant_name}</h3>

                                        {/* 状态显示 */}
                                        <div className="h-8 flex items-center justify-center w-full">
                                            {isProcessing ? (
                                                <Loader2 className="animate-spin text-indigo-600" size={16} />
                                            ) : isDone ? (
                                                getStatusBadge(status)
                                            ) : !isExpired ? (
                                                <div className="flex gap-2 w-full justify-center px-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); submitStatus(student, 'leave'); }}
                                                        className="flex-1 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-xs hover:bg-yellow-100 transition-colors"
                                                    >
                                                        请假
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); submitStatus(student, 'absent'); }}
                                                        className="flex-1 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs hover:bg-red-100 transition-colors"
                                                    >
                                                        旷课
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs">未到 (已锁定)</span>
                                            )}
                                        </div>

                                        {/* 修改菜单 */}
                                        {isMenuOpen && !isExpired && (
                                            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl flex flex-col justify-center gap-2 p-4 z-10 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                                <div className="text-xs text-center text-gray-400 mb-1">修改状态为:</div>
                                                <div className="grid grid-cols-2 gap-2 w-full">
                                                    <button onClick={() => submitStatus(student, 'leave')} className="py-2 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 text-xs">请假</button>
                                                    <button onClick={() => submitStatus(student, 'absent')} className="py-2 bg-red-50 text-red-700 rounded hover:bg-red-100 text-xs">旷课</button>
                                                    <button onClick={() => submitStatus(student, 'completed')} className="col-span-2 py-2 bg-green-50 text-green-700 rounded hover:bg-green-100 text-xs font-bold">实到</button>
                                                </div>
                                                <button onClick={() => submitStatus(student, 'enrolled')} className="mt-1 w-full py-1 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
                                                    <Undo2 size={12} /> 撤销操作 (重置)
                                                </button>
                                            </div>
                                        )}

                                        {isDone && !isMenuOpen && !isExpired && (
                                            <div className="absolute top-2 right-2 text-gray-400 opacity-50">
                                                <MoreHorizontal size={16} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                        {pendingCount > 0
                            ? "👉 先标记请假/旷课学员，最后点击右侧按钮一键结课。"
                            : "✅ 所有学员已处理完毕。"}
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold transition-all">关 闭</button>

                        {!isExpired && pendingCount > 0 && (
                            <button
                                onClick={handleBatchCheckIn}
                                disabled={batchLoading}
                                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-indigo-300/50 shadow-md flex items-center gap-2 disabled:opacity-50 transition-all hover:scale-105"
                            >
                                {batchLoading ? <Loader2 className="animate-spin" /> : <CheckSquare size={18} />}
                                下课：其余 {pendingCount} 人全员实到
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}