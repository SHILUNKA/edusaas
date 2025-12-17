'use client';

import { Building2, ChevronRight, Users } from 'lucide-react';

interface Base {
    id: string;
    name: string;
}

interface OrgTreeProps {
    bases: Base[];
    selectedBaseId: string | null;
    onSelect: (baseId: string | null) => void;
    totalCount: number;
}

export default function OrgTree({ bases, selectedBaseId, onSelect, totalCount }: OrgTreeProps) {
    return (
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
            {/* 标题 */}
            <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Building2 size={18} className="text-indigo-600"/>
                    组织架构
                </h3>
            </div>

            {/* 树形列表 */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* 1. 总部/全部节点 */}
                <div 
                    onClick={() => onSelect(null)}
                    className={`
                        flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all
                        ${selectedBaseId === null 
                            ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm' 
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                    `}
                >
                    <div className="flex items-center gap-2">
                        <Building2 size={16} className={selectedBaseId === null ? 'text-indigo-500' : 'text-gray-400'}/>
                        <span>全部员工</span>
                    </div>
                    <span className="text-xs bg-white px-1.5 py-0.5 rounded-full border text-gray-400">
                        {totalCount}
                    </span>
                </div>

                {/* 2. 基地列表 */}
                <div className="pt-2 pb-1 px-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    下属基地 ({bases.length})
                </div>
                
                {bases.map(base => (
                    <div 
                        key={base.id}
                        onClick={() => onSelect(base.id)}
                        className={`
                            flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ml-2 border-l-2
                            ${selectedBaseId === base.id 
                                ? 'bg-white border-indigo-500 text-indigo-700 font-medium shadow-sm' 
                                : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                        `}
                    >
                        <ChevronRight size={14} className={`transition-transform ${selectedBaseId === base.id ? 'rotate-90 text-indigo-500' : 'text-gray-300'}`}/>
                        <span className="truncate">{base.name}</span>
                    </div>
                ))}
            </div>
            
            {/* 底部统计 */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400 text-center">
                共 {bases.length + 1} 个组织节点
            </div>
        </div>
    );
}