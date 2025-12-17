/*
 * 学员详情抽屉 (V16.2)
 * 路径: /hq/participants/ParticipantDrawer.tsx
 */
'use client';

import { X, User, Phone, Award, MapPin, Calendar, Baby } from 'lucide-react';

interface ParticipantDetail {
    id: string;
    name: string;
    date_of_birth: string | null;
    gender: string | null;
    customer_name: string | null;
    customer_phone: string;
    current_total_points: number | null;
    rank_name_key: string | null;
    base_name: string | null;
}

interface Props {
    participant: ParticipantDetail;
    onClose: () => void;
}

export default function ParticipantDrawer({ participant, onClose }: Props) {
    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* 遮罩 */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            
            {/* 抽屉内容 */}
            <div className="relative w-full max-w-md h-full bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-start bg-indigo-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 shadow-sm">
                            {participant.name[0]}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{participant.name}</h2>
                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${participant.gender==='男'?'bg-blue-100 text-blue-700':'bg-pink-100 text-pink-700'}`}>
                                    {participant.gender || '未知'}
                                </span>
                                <span>·</span>
                                <span>{participant.date_of_birth || '生日未录入'}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} className="text-gray-500"/></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* 核心指标 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <div className="text-xs text-amber-600 font-bold uppercase mb-1 flex items-center gap-1"><Award size={12}/> 荣誉军衔</div>
                            <div className="text-xl font-bold text-amber-900">{participant.rank_name_key || '列兵'}</div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="text-xs text-blue-600 font-bold uppercase mb-1 flex items-center gap-1"><Award size={12}/> 成长积分</div>
                            <div className="text-xl font-bold text-blue-900">{participant.current_total_points || 0}</div>
                        </div>
                    </div>

                    {/* 归属信息 */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <MapPin size={16} className="text-gray-400"/> 归属信息
                        </h3>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">所在校区</span>
                                <span className="text-sm font-medium text-gray-900">{participant.base_name || '总部直属'}</span>
                            </div>
                            {/* 可以在这里扩展: 班级、主课老师等 */}
                        </div>
                    </section>

                    {/* 家长信息 */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <User size={16} className="text-gray-400"/> 家长档案
                        </h3>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">家长姓名</span>
                                <span className="text-sm font-medium text-gray-900">{participant.customer_name || '未录入'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">联系电话</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-indigo-600 font-mono">{participant.customer_phone}</span>
                                    <a href={`tel:${participant.customer_phone}`} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"><Phone size={12}/></a>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 text-center text-xs text-gray-400">
                    学员 ID: {participant.id}
                </div>
            </div>
        </div>
    );
}