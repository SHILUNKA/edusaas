/*
 * 总部管理: AI 海报生成器 (V16.2)
 * 路径: /hq/courses/PosterGeneratorModal.tsx
 */
'use client';

import { useState } from 'react';
import { X, Sparkles, Download, Share2, Palette } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

interface Course { id: string; name_key: string; default_duration_minutes: number; }

interface Props {
    token: string;
    course: Course;
    onClose: () => void;
}

export default function PosterGeneratorModal({ token, course, onClose }: Props) {
    const [style, setStyle] = useState("tech");
    const [loading, setLoading] = useState(false);
    const [posterUrl, setPosterUrl] = useState<string | null>(null);

    const styles = [
        { id: "tech", name: "未来科技风", color: "bg-blue-900 text-white" },
        { id: "cartoon", name: "活泼卡通风", color: "bg-orange-100 text-orange-800" },
        { id: "minimalist", name: "极简高端风", color: "bg-gray-100 text-gray-800" },
    ];

    const handleGenerate = async () => {
        setLoading(true);
        try {
            // 暂时直接调 Python 接口，或者通过 Rust 转发
            // 这里假设 Rust 有个转发接口，或者直接调 Python (如果是开发环境)
            // 为了方便，我们在 Rust 加一个 proxy，或者前端直接调 (不推荐)。
            // 这里我们模拟请求：实际项目需要在 Rust 加一个 `/api/v1/poster/generate` 转发给 Python
            
            // (模拟等待)
            await new Promise(r => setTimeout(r, 2000));
            
            // 模拟返回一个假数据用于演示交互，真实逻辑需调 API
            alert("AI 正在绘图... (需配置 OpenAI Key 才能生成真图)");
            // setPosterUrl("data:image/png;base64,...."); 
            
        } catch (e) {
            alert("生成失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex overflow-hidden">
                
                {/* 左侧：配置区 */}
                <div className="w-1/3 border-r border-gray-200 p-6 flex flex-col bg-gray-50">
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Sparkles className="text-indigo-600"/> AI 海报工坊
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">为《{course.name_key}》生成推广海报</p>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">选择设计风格</label>
                            <div className="grid grid-cols-1 gap-2">
                                {styles.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setStyle(s.id)}
                                        className={`p-3 rounded-lg text-left border-2 transition-all flex items-center gap-3 ${style === s.id ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-gray-200 hover:border-indigo-300'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full ${s.color} flex items-center justify-center`}>
                                            <Palette size={16}/>
                                        </div>
                                        <span className="font-medium text-sm">{s.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleGenerate}
                        disabled={loading}
                        className="w-full py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <span className="animate-spin">✨</span> : <Sparkles size={18}/>}
                        {loading ? 'AI 正在绘图...' : '立即生成海报'}
                    </button>
                </div>

                {/* 右侧：预览区 */}
                <div className="flex-1 bg-gray-200 flex items-center justify-center p-8 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 bg-white/80 p-2 rounded-full hover:bg-white"><X size={20}/></button>
                    
                    {posterUrl ? (
                        <div className="relative group">
                            <img src={posterUrl} alt="Poster" className="h-[60vh] w-auto rounded-lg shadow-2xl"/>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="bg-white text-black px-4 py-2 rounded-full font-medium shadow-lg flex items-center gap-2 hover:bg-gray-50">
                                    <Download size={16}/> 下载
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400">
                            <div className="w-64 h-96 border-4 border-dashed border-gray-300 rounded-xl mx-auto mb-4 flex items-center justify-center">
                                <Sparkles size={48} className="text-gray-300"/>
                            </div>
                            <p>左侧选择风格，点击生成</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}