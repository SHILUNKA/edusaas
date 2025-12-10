'use client';
import { Clock, CheckCircle, Calendar, BookOpen } from 'lucide-react';

export default function TeacherDashboard() {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">👋 欢迎回来，老师</h2>
                <p className="text-gray-500">今天也是充满活力的一天，准备好上课了吗？</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* 左侧：巨大的下一节课卡片 */}
                <div className="md:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-xl p-8">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center gap-2 opacity-80 mb-2 font-bold uppercase tracking-wider text-sm">
                                <Clock size={18}/> Next Class
                            </div>
                            <h3 className="text-4xl font-bold mb-2">14:00 - 15:30</h3>
                            <div className="text-xl font-medium text-indigo-100">少儿羽毛球 L2 进阶班</div>
                            <div className="mt-2 flex items-center gap-2 text-sm bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                1号场地 / 预计 8 人
                            </div>
                        </div>
                        
                        <div className="mt-8 flex gap-4">
                            <button className="flex-1 bg-white text-indigo-600 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg flex items-center justify-center gap-2">
                                <CheckCircle size={20}/> 一键点名
                            </button>
                            <button className="flex-1 bg-indigo-800/50 text-white font-bold py-3 rounded-xl hover:bg-indigo-800/70 transition-colors border border-indigo-400/30">
                                查看教案
                            </button>
                        </div>
                    </div>
                    {/* 背景装饰 */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                {/* 右侧：统计与待办 */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-3 text-gray-800 font-bold mb-4">
                            <Calendar className="text-orange-500"/> 本周课时
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-bold text-gray-900">12</span>
                            <span className="text-gray-400 mb-1">/ 20 节</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full mt-3 overflow-hidden">
                            <div className="bg-orange-500 h-full w-[60%] rounded-full"></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-3 text-gray-800 font-bold mb-4">
                            <BookOpen className="text-blue-500"/> 课后反馈
                        </div>
                        <div className="text-sm text-gray-500 mb-4">您有 <b className="text-red-500">3</b> 节课的学员评价未填写。</div>
                        <button className="w-full py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">
                            去填写
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}