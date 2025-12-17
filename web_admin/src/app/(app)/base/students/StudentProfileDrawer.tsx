/*
 * 校区学员画像抽屉 (V17.2)
 * 路径: /base/students/StudentProfileDrawer.tsx
 */
'use client';

import { X, User, Phone, Award, Clock, History, CreditCard } from 'lucide-react';

export default function StudentProfileDrawer({ student, onClose }: any) {
    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative w-full max-w-md h-full bg-white shadow-2xl animate-in slide-in-from-right flex flex-col">
                {/* Header */}
                <div className="p-6 bg-emerald-600 text-white flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold border-2 border-white/30">
                            {student.name[0]}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{student.name}</h2>
                            <p className="text-emerald-100 text-sm mt-1 flex items-center gap-2">
                                <Award size={14}/> {student.rank_name_key || '无军衔'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full"><X size={20}/></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50">
                    
                    {/* 资产卡片 */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                            <CreditCard size={14}/> 课时资产
                        </h3>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-3xl font-extrabold text-emerald-600">{student.remaining_counts || 0}</div>
                                <div className="text-xs text-gray-500 mt-1">剩余可用课时 (次)</div>
                            </div>
                            <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-emerald-700">
                                立即续费
                            </button>
                        </div>
                    </div>

                    {/* 家长信息 */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                            <User size={14}/> 家长档案
                        </h3>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50">
                            <span className="text-gray-500 text-sm">姓名</span>
                            <span className="font-medium">{student.customer_name}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-gray-500 text-sm">电话</span>
                            <a href={`tel:${student.customer_phone}`} className="font-mono text-emerald-600 flex items-center gap-1 hover:underline">
                                <Phone size={14}/> {student.customer_phone}
                            </a>
                        </div>
                    </div>

                    {/* 最近动态 (Mock) */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                            <History size={14}/> 最近动态
                        </h3>
                        <div className="space-y-4">
                            {student.last_class_time ? (
                                <div className="flex gap-3">
                                    <div className="mt-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div></div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">完成课程学习</p>
                                        <p className="text-xs text-gray-400">{new Date(student.last_class_time).toLocaleString()}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic">暂无上课记录</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}