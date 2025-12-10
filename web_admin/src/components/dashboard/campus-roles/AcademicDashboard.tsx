'use client';
import { Calendar, School, Users, CheckCircle } from 'lucide-react';

export default function AcademicDashboard() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">教务管理工作台</h2>
                <div className="text-sm font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                    🎓 教务视图
                </div>
            </div>

            {/* 今日概况 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-sm text-gray-500 font-bold">今日总课次</div>
                        <div className="text-3xl font-bold text-gray-900 mt-1">18 <span className="text-sm font-normal text-gray-400">节</span></div>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-xl text-blue-600"><Calendar size={24}/></div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-sm text-gray-500 font-bold">教室利用率</div>
                        <div className="text-3xl font-bold text-gray-900 mt-1">85%</div>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-xl text-purple-600"><School size={24}/></div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-sm text-gray-500 font-bold">今日签到学员</div>
                        <div className="text-3xl font-bold text-gray-900 mt-1">42 <span className="text-sm font-normal text-gray-400">人</span></div>
                    </div>
                    <div className="bg-green-100 p-3 rounded-xl text-green-600"><Users size={24}/></div>
                </div>
            </div>

            {/* 课程监控列表 */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">今日课程实时监控</h3>
                    <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> 进行中
                    </span>
                </div>
                <div className="divide-y divide-gray-100">
                    <ClassItem time="09:00 - 10:30" name="少儿编程 L1" room="302教室" teacher="张老师" status="已结课" />
                    <ClassItem time="10:45 - 12:15" name="机器人搭建" room="305教室" teacher="李老师" status="已结课" />
                    <ClassItem time="14:00 - 15:30" name="无人机入门" room="操场" teacher="王老师" status="进行中" isLive={true} />
                    <ClassItem time="16:00 - 17:30" name="科学实验" room="实验室A" teacher="赵老师" status="未开始" />
                </div>
            </div>
        </div>
    );
}

function ClassItem({ time, name, room, teacher, status, isLive }: any) {
    return (
        <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-6">
                <div className="font-mono text-sm font-bold text-gray-500">{time}</div>
                <div>
                    <div className="font-bold text-gray-900">{name}</div>
                    <div className="text-xs text-gray-500 flex gap-2 mt-1">
                        <span>{room}</span>
                        <span>•</span>
                        <span>{teacher}</span>
                    </div>
                </div>
            </div>
            <div>
                {isLive ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">正在上课</span>
                ) : (
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${status === '已结课' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>
                        {status}
                    </span>
                )}
            </div>
        </div>
    );
}