/*
 * 校区端: 专注点名弹窗 (V14.1 - 过期只读版)
 * 路径: /campus/classes/RollCallModal.tsx
 */
'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, Loader2, Lock } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

interface EnrollmentDetail {
    id: string;
    participant_id: string;
    participant_name: string;
    participant_avatar: string | null;
    status: string; 
}

interface RollCallModalProps {
    token: string;
    classData: { id: string; course_name_key: string; start_time: string; end_time: string }; // (★ 必须包含 end_time)
    onClose: () => void;
    onSuccess: () => void;
}

export default function RollCallModal({ token, classData, onClose, onSuccess }: RollCallModalProps) {
    const API = API_BASE_URL;
    const [students, setStudents] = useState<EnrollmentDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // (★ 核心逻辑: 判断是否过期)
    const isExpired = new Date() > new Date(classData.end_time);

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

    const handleCheckIn = async (enrollment: EnrollmentDetail) => {
        // 1. 已签到不能重复点
        if (enrollment.status === 'completed') return;
        
        // 2. (★ 关键) 过期不能点
        if (isExpired) {
            alert("🔒 课程已结束，无法进行签到操作。");
            return;
        }
        
        if (!confirm(`确认【${enrollment.participant_name}】已到课？\n将扣除课时并增加积分。`)) return;

        setProcessingId(enrollment.id);
        try {
            const res = await fetch(`${API}/enrollments/${enrollment.id}/complete`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'completed', teacher_feedback: '现场点名' })
            });

            if (!res.ok) throw new Error("签到失败");
            
            setStudents(prev => prev.map(s => s.id === enrollment.id ? { ...s, status: 'completed' } : s));
            onSuccess(); 
        } catch (e) { alert("签到失败"); } 
        finally { setProcessingId(null); }
    };

    const arrivedCount = students.filter(s => s.status === 'completed').length;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center relative overflow-hidden">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            {classData.course_name_key}
                            {isExpired && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1"><Lock size={12}/> 已锁定</span>}
                        </h2>
                        <p className="text-gray-500 mt-1 text-sm">
                            {new Date(classData.start_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · 
                            应到 {students.length} 人 · 
                            <span className="text-green-600 font-bold ml-2">实到 {arrivedCount} 人</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={28} className="text-gray-500"/></button>
                </div>

                {/* (★ 过期提示条) */}
                {isExpired && (
                    <div className="bg-amber-50 px-6 py-2 text-xs text-amber-800 border-b border-amber-100 flex items-center gap-2">
                        <Lock size={14}/> 本课程已结束，名单仅供查看，无法修改考勤状态。
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
                    {loading ? (
                        <div className="text-center py-20 text-gray-500">加载中...</div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">暂无学员报名</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {students.map(student => {
                                const isChecked = student.status === 'completed';
                                const isProcessing = processingId === student.id;

                                return (
                                    <div 
                                        key={student.id}
                                        onClick={() => handleCheckIn(student)}
                                        className={`
                                            relative flex flex-col items-center p-6 rounded-2xl border-2 transition-all select-none
                                            ${isChecked 
                                                ? 'bg-green-50 border-green-500 shadow-none opacity-80' 
                                                : (isExpired 
                                                    ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' // 过期样式
                                                    : 'bg-white border-transparent shadow-md hover:shadow-lg hover:scale-[1.02] cursor-pointer'
                                                  )
                                            }
                                        `}
                                    >
                                        <div className={`
                                            w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mb-3 overflow-hidden
                                            ${isChecked ? 'bg-green-200 text-green-700' : 'bg-indigo-100 text-indigo-600'}
                                            ${!isChecked && isExpired ? 'grayscale bg-gray-200 text-gray-500' : ''} 
                                        `}>
                                            {student.participant_avatar ? (
                                                <img src={student.participant_avatar} alt={student.participant_name} className="w-full h-full object-cover"/>
                                            ) : (
                                                <span>{student.participant_name[0]}</span>
                                            )}
                                        </div>

                                        <h3 className={`text-lg font-bold mb-1 ${isChecked ? 'text-green-800' : 'text-gray-800'}`}>
                                            {student.participant_name}
                                        </h3>
                                        
                                        <div className="h-6 flex items-center justify-center">
                                            {isProcessing ? (
                                                <Loader2 className="animate-spin text-indigo-600" size={20}/>
                                            ) : isChecked ? (
                                                <span className="flex items-center gap-1 text-green-600 text-sm font-bold"><CheckCircle size={16}/> 已签到</span>
                                            ) : (
                                                <span className={`text-sm ${isExpired ? 'text-gray-400' : 'text-indigo-500 font-medium'}`}>
                                                    {isExpired ? '未到' : '点击签到'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                        {isExpired ? "🔒 历史课程归档" : "💡 点击卡片快速签到"}
                    </div>
                    <button onClick={onClose} className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors">
                        {isExpired ? "关 闭" : "完成点名"}
                    </button>
                </div>
            </div>
        </div>
    );
}