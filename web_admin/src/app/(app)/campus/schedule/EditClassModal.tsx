/*
 * 校区端: 班级控制台 (V12.6 - 修复搜索功能的最终版)
 * 路径: /campus/schedule/EditClassModal.tsx
 * 修复: 恢复"按姓名搜索学员"功能，移除繁琐的"查手机号"流程。
 */
'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import { 
    X, UserCog, Users, Trash2, CheckCircle, 
    Search, UserPlus, CreditCard, User, ChevronRight, AlertCircle, ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/config';

// --- 类型定义 ---
interface Teacher { user_id: string; full_name: string; }
interface Enrollment {
    id: string;
    participant_id: string;
    status: string;
    participant_name?: string; 
}
interface Participant { id: string; name: string; customer_id: string; }
interface Membership { 
    id: string; 
    tier_id: string; 
    remaining_uses: number | null; 
    expiry_date: string | null;    
    tier_name?: string 
} 
interface Tier { id: string; name_key: string; }

interface EditClassModalProps {
    token: string;
    classData: any; // 包含 room_rows, room_columns 等信息
    onClose: () => void;
    onSuccess: () => void;
}

export default function EditClassModal({ token, classData, onClose, onSuccess }: EditClassModalProps) {
    const API = API_BASE_URL;
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'roster' | 'settings'>('roster');
    const searchInputRef = useRef<HTMLInputElement>(null);

    // --- 数据状态 ---
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [allStudents, setAllStudents] = useState<Participant[]>([]); 
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    
    // --- 交互状态 ---
    const [activeSeatIndex, setActiveSeatIndex] = useState<number | null>(null);
    const [studentSearch, setStudentSearch] = useState("");
    const [selectedStudent, setSelectedStudent] = useState<Participant | null>(null);
    const [studentCards, setStudentCards] = useState<Membership[]>([]);
    const [selectedCardId, setSelectedCardId] = useState("");
    
    const [loadingCards, setLoadingCards] = useState(false);
    const [loading, setLoading] = useState(false);

    // Settings Tab
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

    // 1. 初始化数据 (关键修复: 必须加载 allStudents)
    useEffect(() => {
        const initData = async () => {
            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                
                // 并行加载: 老师 + 全校学员
                const [teachRes, studRes] = await Promise.all([
                    fetch(`${API}/base/teachers`, { headers }),
                    fetch(`${API}/participants`, { headers })
                ]);

                if (teachRes.ok) setTeachers(await teachRes.json());
                
                if (studRes.ok) {
                    const students = await studRes.json();
                    console.log(`[Debug] 已加载本校区学员: ${students.length} 人`);
                    setAllStudents(students);
                }

                fetchEnrollments();
            } catch (e) { console.error(e); }
        };
        initData();
    }, [token, classData.id]);

    const fetchEnrollments = async () => {
        try {
            const res = await fetch(`${API}/classes/${classData.id}/enrollments`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setEnrollments(await res.json());
        } catch (e) { console.error(e); }
    };

    // --- 搜索过滤 (按姓名) ---
    const filteredStudents = allStudents.filter(s => {
        if (!studentSearch) return false;
        // 模糊匹配姓名，且排除已报名的
        return s.name.toLowerCase().includes(studentSearch.toLowerCase()) && 
               !enrollments.some(e => e.participant_id === s.id);
    });

    // --- 选择学生并加载会员卡 ---
    const handleSelectStudent = async (student: Participant) => {
        setSelectedStudent(student);
        setStudentSearch(""); 
        setStudentCards([]);
        setSelectedCardId("");
        setLoadingCards(true);

        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const [cardRes, tierRes] = await Promise.all([
                fetch(`${API}/customers/${student.customer_id}/memberships`, { headers }),
                fetch(`${API}/membership-tiers`, { headers })
            ]);
            
            if (cardRes.ok && tierRes.ok) {
                const cards: Membership[] = await cardRes.json();
                const tiers: Tier[] = await tierRes.json();
                
                const validCards = cards.map(c => ({
                    ...c,
                    tier_name: tiers.find(t => t.id === c.tier_id)?.name_key || '未知卡种'
                })).filter(c => {
                    if (c.remaining_uses !== null) return c.remaining_uses > 0;
                    if (c.expiry_date) return new Date(c.expiry_date) > new Date();
                    return true;
                });
                
                setStudentCards(validCards);
                if (validCards.length > 0) setSelectedCardId(validCards[0].id);
            }
        } catch (e) { console.error("查卡失败", e); } 
        finally { setLoadingCards(false); }
    };

    const handleEnroll = async () => {
        if (!selectedStudent || !selectedCardId) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/enrollments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    class_id: classData.id,
                    participant_id: selectedStudent.id,
                    customer_membership_id: selectedCardId
                })
            });
            if (!res.ok) throw new Error("报名失败");
            closeAddPopover();
            fetchEnrollments();
        } catch (e) { alert("报名失败"); } finally { setLoading(false); }
    };

    // --- 辅助函数 ---
    const handleCancelEnrollment = async (enrollmentId: string, studentName: string) => {
        if (!confirm(`取消【${studentName}】的报名？`)) return;
        try { await fetch(`${API}/enrollments/${enrollmentId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); fetchEnrollments(); } catch (e) { alert("取消失败"); }
    };
    const handleEmptySeatClick = (index: number) => {
        setActiveSeatIndex(index); setStudentSearch(""); setSelectedStudent(null); setStudentCards([]);
        setTimeout(() => searchInputRef.current?.focus(), 100);
    };
    const closeAddPopover = () => setActiveSeatIndex(null);
    const toggleTeacher = (id: string) => setSelectedTeacherIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
    const handleUpdateClass = async () => { /* ...略... */ alert("功能演示：保存设置"); };
    const handleDeleteClass = async () => {
        if (!confirm("⚠️ 确定删除课程？")) return;
        try { await fetch(`${API}/base/classes/${classData.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); onSuccess(); onClose(); } catch (e) { alert("删除失败"); }
    };
    const handleCompleteClass = async (enrollmentId: string) => {
         if (!confirm("确认签到？")) return;
         try {
            await fetch(`${API}/enrollments/${enrollmentId}/complete`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'completed', teacher_feedback: '' })
            });
            fetchEnrollments();
        } catch (e) { alert("操作失败"); }
    };
    const handleGoToMembership = () => {
        if(confirm("即将跳转到会员管理页面，当前窗口将关闭。")) router.push('/campus/memberships');
    };

    // 渲染逻辑
    const rowsCount = classData.room_rows || 5;
    const colsCount = classData.room_columns || 6;
    const maxSeats = rowsCount * colsCount;
    const seats = Array.from({ length: maxSeats });
    const getStudentName = (pid: string) => allStudents.find(s => s.id === pid)?.name || '未知';
    const getSeatLabel = (idx: number) => `${Math.floor(idx / colsCount) + 1}排${idx % colsCount + 1}座`;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] relative">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">{classData.course_name_key}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {new Date(classData.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · {classData.room_name} · {classData.teacher_names}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 text-sm">
                    <button onClick={() => setActiveTab('roster')} className={`flex-1 py-2.5 font-medium ${activeTab === 'roster' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>座位表 ({enrollments.length}/{maxSeats})</button>
                    <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2.5 font-medium ${activeTab === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}>排课设置</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 bg-white relative">
                    
                    {/* === TAB 1: 座位表 === */}
                    {activeTab === 'roster' && (
                        <div className="space-y-5 h-full pb-20">
                            <div className="flex justify-center mb-4">
                                <div className="w-2/3 h-6 bg-gray-200 border border-gray-300 rounded-b-xl flex items-center justify-center text-xs text-gray-500 shadow-inner font-bold tracking-widest">讲 台</div>
                            </div>

                            <div className="grid gap-2 justify-center mx-auto" style={{ gridTemplateColumns: `repeat(${colsCount}, minmax(0, 1fr))`, maxWidth: '100%' }}>
                                {seats.map((_, idx) => {
                                    const enrollment = enrollments[idx]; 
                                    const studentName = enrollment ? getStudentName(enrollment.participant_id) : null;
                                    const isCompleted = enrollment?.status === 'completed';
                                    
                                    return (
                                        <div key={idx} onClick={() => enrollment ? handleCancelEnrollment(enrollment.id, studentName!) : handleEmptySeatClick(idx)} className={`aspect-square rounded-md border flex flex-col items-center justify-center relative transition-all group select-none ${enrollment ? (isCompleted ? 'bg-green-50 border-green-200 opacity-80' : 'bg-indigo-50 border-indigo-200 hover:border-red-300 cursor-pointer shadow-sm') : 'bg-slate-50 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer hover:bg-white'}`} title={enrollment ? "点击退选" : "点击添加"}>
                                            {enrollment ? (
                                                <>
                                                    <div className="w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-xs font-bold mb-1">{studentName?.[0]}</div>
                                                    <span className="text-[10px] font-bold text-gray-700 truncate w-full text-center px-1">{studentName}</span>
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-mono text-slate-300 group-hover:text-indigo-400">{idx + 1}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* === 弹框添加学员 (悬浮层) === */}
                    {activeSeatIndex !== null && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={closeAddPopover}></div>
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm z-30 overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center p-3 border-b bg-indigo-50/50">
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm"><UserPlus size={16} className="text-indigo-600"/> 添加学员 <span className="text-xs font-normal text-gray-500">({getSeatLabel(activeSeatIndex)})</span></h4>
                                    <button onClick={closeAddPopover} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
                                </div>
                                
                                <div className="p-4 space-y-4">
                                    {!selectedStudent && (
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                                <input ref={searchInputRef} type="text" placeholder="输入学员姓名搜索..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="w-full pl-9 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                            </div>
                                            
                                            {/* 搜索结果 */}
                                            <div className="border rounded-lg max-h-40 overflow-y-auto divide-y">
                                                {filteredStudents.length > 0 ? filteredStudents.map(s => (
                                                    <div key={s.id} onClick={() => handleSelectStudent(s)} className="p-2.5 hover:bg-indigo-50 cursor-pointer flex items-center justify-between text-sm">
                                                        <div className="flex items-center gap-2"><User size={14} className="text-gray-400"/> <span>{s.name}</span></div>
                                                        <ChevronRight size={14} className="text-gray-300"/>
                                                    </div>
                                                )) : (
                                                    // (★ 优化: 无结果或空数据时的提示)
                                                    <div className="p-4 text-center">
                                                        <p className="text-xs text-gray-400 mb-2">
                                                            {allStudents.length === 0 ? "本校区暂无学员数据" : "无匹配学员"}
                                                        </p>
                                                        {allStudents.length === 0 && (
                                                            <button onClick={handleGoToMembership} className="text-xs text-indigo-600 hover:underline">去录入新生 &rarr;</button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {selectedStudent && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex justify-between items-center bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                                                <span className="text-sm font-bold text-indigo-900 flex items-center gap-2"><User size={14}/> {selectedStudent.name}</span>
                                                <button onClick={() => setSelectedStudent(null)} className="text-xs text-indigo-600 hover:underline">重选</button>
                                            </div>

                                            {loadingCards ? (
                                                <div className="text-center py-2 text-xs text-gray-500">正在查询会员卡...</div>
                                            ) : studentCards.length > 0 ? (
                                                <>
                                                    <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                                                        {studentCards.map(c => (
                                                            <option key={c.id} value={c.id}>{c.tier_name} ({c.remaining_uses !== null ? `余 ${c.remaining_uses} 次` : `有效期至 ${c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '无限'}`})</option>
                                                        ))}
                                                    </select>
                                                    <button onClick={handleEnroll} disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">{loading ? '提交中...' : '确认添加'}</button>
                                                </>
                                            ) : (
                                                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center space-y-2">
                                                    <div className="text-red-600 font-bold text-sm flex items-center justify-center gap-1"><AlertCircle size={16}/> 暂无可用会员卡</div>
                                                    <button onClick={handleGoToMembership} className="w-full flex items-center justify-center gap-1 bg-white border border-red-200 text-red-600 py-1.5 rounded text-xs hover:bg-red-100 transition-colors"><CreditCard size={14}/> 去办理会员卡 <ExternalLink size={12}/></button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                         <div className="space-y-6 pt-2">
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h4 className="font-bold text-gray-700 text-sm mb-2">师资安排</h4>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto mb-4">
                                    {teachers.map(t => (
                                        <label key={t.user_id} className="flex items-center gap-2 p-2 bg-white border rounded cursor-pointer hover:border-indigo-300">
                                            <input type="checkbox" className="rounded text-indigo-600" checked={selectedTeacherIds.includes(t.user_id)} onChange={() => toggleTeacher(t.user_id)}/>
                                            <span className="text-xs">{t.full_name}</span>
                                        </label>
                                    ))}
                                </div>
                                <button onClick={handleUpdateClass} className="w-full bg-white border border-gray-300 text-gray-700 py-1.5 rounded text-sm hover:bg-gray-50">保存设置</button>
                            </div>
                            <button onClick={handleDeleteClass} className="w-full flex items-center justify-center gap-2 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 text-sm"><Trash2 size={16} /> 删除此课程</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}