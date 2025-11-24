/*
 * B端后台: 添加新会员 (第1步: 创建家长)
 * 路径: /tenant/participants/new
 * 修复: 替换 useAuthStore 为 useSession
 */
'use client';

import { useState, FormEvent } from 'react';
// 1. 修改导入
import { useSession } from 'next-auth/react';

interface Customer {
    id: string;
    name: string | null;
    phone_number: string;
}

interface CreateCustomerPayload {
    name: string | null;
    phone_number: string;
    base_id: string | null; 
}

export default function NewParticipantPage() {
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);

    // 2. 修改 Token 获取
    const { data: session } = useSession();
    const token = session?.user?.rawToken;

    const API_URL = 'http://localhost:8000/api/v1/customers';

    const currentBaseId = null; 

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setCreatedCustomer(null);

        const payload: CreateCustomerPayload = {
            name: name || null,
            phone_number: phone,
            base_id: currentBaseId,
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(payload),
            });

            if (response.status === 409) {
                throw new Error("手机号已存在 (Phone number already exists)");
            }
            if (!response.ok) {
                throw new Error(`创建失败. Status: ${response.status}`);
            }

            const data: Customer = await response.json();
            setCreatedCustomer(data);
            alert("家长创建成功!");
            setName("");
            setPhone("");

        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">添加新会员</h1>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">第1步: 创建家长档案</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            家长手机号 (Phone Number) *
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            家长姓名 (Name)
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        disabled={isLoading}
                    >
                        {isLoading ? "正在创建..." : "创建家长档案"}
                    </button>
                </form>
                
                {error && <p className="text-red-500 mt-4">错误: {error}</p>}
            </div>

            {createdCustomer && (
                <div className="mt-8 bg-white p-6 rounded-lg shadow-md border-t-4 border-green-500">
                     <h3 className="text-lg font-semibold text-green-800">家长创建成功!</h3>
                     <p className="text-sm text-gray-600">ID: {createdCustomer.id}</p>
                     <p className="text-sm text-gray-600">手机: {createdCustomer.phone_number}</p>
                     
                     <hr className="my-4" />

                    <h2 className="text-xl font-semibold mb-4">第2步: 为 {createdCustomer.name || createdCustomer.phone_number} 添加学员</h2>
                    
                    <p className="text-gray-500">(学员表单将显示在这里...)</p>
                </div>
            )}
        </div>
    );
}