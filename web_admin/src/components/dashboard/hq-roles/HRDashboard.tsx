'use client';
import { Users, UserPlus, Briefcase, AlertCircle } from 'lucide-react';

export default function HRDashboard({ pendingStaff, advStats }: { pendingStaff: any[], advStats?: any }) {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">人力资源中心</h2>
                <div className="text-sm font-mono bg-orange-50 text-orange-700 px-3 py-1 rounded-full">
                    👥 人事视图
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 概览卡片 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="bg-orange-100 p-3 rounded-xl text-orange-600"><Users size={24} /></div>
                    <div><div className="text-2xl font-bold">{advStats?.staff_total_count || 0}</div><div className="text-xs text-gray-500 font-bold">在职员工总数</div></div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-xl text-blue-600"><UserPlus size={24} /></div>
                    <div><div className="text-2xl font-bold">{pendingStaff.length}</div><div className="text-xs text-gray-500 font-bold">待入职人员</div></div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="bg-red-100 p-3 rounded-xl text-red-600"><AlertCircle size={24} /></div>
                    <div><div className="text-2xl font-bold">2</div><div className="text-xs text-gray-500 font-bold">合同即将到期</div></div>
                </div>
            </div>

            {/* 待入职名单 (复用真实数据) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Briefcase size={18} className="text-orange-500" /> 待办理入职名单
                </h3>
                <div className="divide-y divide-gray-100">
                    {pendingStaff.length > 0 ? (
                        pendingStaff.map((staff: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                                        {staff.full_name[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900">{staff.full_name}</div>
                                        <div className="text-xs text-gray-500">{staff.role_name}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="inline-block px-2 py-1 bg-orange-50 text-orange-600 text-xs font-bold rounded">待报到</span>
                                    <div className="text-xs text-gray-400 mt-1">{new Date(staff.created_at).toLocaleDateString()} 录入</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-sm">暂无待入职人员</div>
                    )}
                </div>
            </div>
        </div>
    );
}