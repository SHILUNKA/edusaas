/*
 * 基地-学员与会员 (V4 - 批量学生录入)
 * 路径: src/app/(app)/campus/memberships/page.tsx
 *
 * 修复: 功能 B (学生录入) 
 * 现已支持 "+" 按钮 动态添加多名学生。
 */
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// --- 1. 定义我们需要的数据类型 ---

interface Customer { //
  id: string;
  name: string | null;
  phone_number: string;
}
interface Participant { //
  id: string;
  customer_id: string;
  name: string;
}
interface MembershipTier { //
  id: string;
  name_key: string;
  price_in_cents: number;
}
interface CustomerMembership { //
  id: string;
  customer_id: string;
  tier_id: string;
}
// (★ 新增) V4: 用于动态学生表单的状态类型
interface NewParticipantRow {
  name: string;
  dob: string; // (YYYY-MM-DD)
}


// (API 辅助函数 - 保持不变)
async function apiGet(endpoint: string, token: string) {
  const apiUrlBase = "http://localhost:8000"; //
  const res = await fetch(`${apiUrlBase}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`API GET 请求失败 (${res.status}): ${endpoint}`);
  return res.json();
}
async function apiPost(endpoint: string, token: string, payload: any) {
  const apiUrlBase = "http://localhost:8000"; //
  const res = await fetch(`${apiUrlBase}${endpoint}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: '未知错误' }));
    throw new Error(`API POST 请求失败 (${res.status}): ${errorData.detail || '未知错误'}`);
  }
  return res.json();
}


// --- 2. 页面组件 ---
export default function CampusMembershipsPage() {
  const { data: session } = useSession();
  const token = session?.user?.rawToken; //

  // --- 状态管理 (★ 已更新) ---
  // A. 页面加载数据
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // B. “新会员”表单 (家长)
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>('');
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [customerSubmitMessage, setCustomerSubmitMessage] = useState<string | null>(null);

  // (★ 关键修复) C. “新学生”表单 (学员)
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  // (★ 关键) V4: 现在是一个数组, 包含多行学生
  const [newParticipants, setNewParticipants] = useState<NewParticipantRow[]>([
    { name: '', dob: '' } // 总是从 1 行空行开始
  ]);
  const [isSubmittingParticipant, setIsSubmittingParticipant] = useState(false);
  const [participantSubmitMessage, setParticipantSubmitMessage] = useState<string | null>(null);

  // D. “开卡”表单
  const [selectedCardCustomerId, setSelectedCardCustomerId] = useState<string>('');
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);
  const [cardSubmitMessage, setCardSubmitMessage] = useState<string | null>(null);


  // --- 3. 数据获取 (Effect) (★ 已更新) ---
  const fetchCustomers = async (selectNewestCustomer = false) => {
    if (!token) return;
    try {
      const customersData: Customer[] = await apiGet('/api/v1/customers', token); //
      setCustomers(customersData);
      
      if (customersData.length > 0) {
        if (selectNewestCustomer) {
          const newCustomerId = customersData[0].id;
          setSelectedParentId(newCustomerId);
          setSelectedCardCustomerId(newCustomerId);
        } else {
          // (★ 关键) 确保在刷新时不会重置用户已选择的家长
          if (!selectedParentId) setSelectedParentId(customersData[0].id);
          if (!selectedCardCustomerId) setSelectedCardCustomerId(customersData[0].id);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const fetchTiers = async () => { /* (保持不变) */ 
    if (!token) return;
    try {
      const tiersData: MembershipTier[] = await apiGet('/api/v1/membership-tiers', token); //
      setTiers(tiersData);
      if (tiersData.length > 0 && !selectedTierId) {
        setSelectedTierId(tiersData[0].id);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  
  useEffect(() => {
    if (!token) return;
    const loadPageData = async () => {
      setIsLoading(true);
      setError(null);
      await Promise.all([fetchCustomers(), fetchTiers()]);
      setIsLoading(false);
    };
    loadPageData();
  }, [token]);

  // --- 4. 表单提交 ---

  // A. 提交新会员 (家长) (保持不变)
  const handleCreateCustomer = async (e: React.FormEvent) => { /* (保持不变) */ 
    e.preventDefault();
    if (!token) return;
    setIsSubmittingCustomer(true);
    setCustomerSubmitMessage(null);
    try {
      const payload = { name: newCustomerName || null, phone_number: newCustomerPhone };
      const newCustomer: Customer = await apiPost('/api/v1/customers', token, payload); //
      setCustomerSubmitMessage(`会员 ${newCustomer.name} (${newCustomer.phone_number}) 创建成功!`);
      setNewCustomerName('');
      setNewCustomerPhone('');
      await fetchCustomers(true);
    } catch (e) {
      setCustomerSubmitMessage((e as Error).message);
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  // (★ 关键) B. 提交 *所有* 新学生 (学员)
  const handleCreateParticipants = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedParentId) {
        setParticipantSubmitMessage("错误: 必须选择一个关联的家长");
        return;
    }

    // (★ 关键) V4: 过滤掉空行
    const participantsToCreate = newParticipants.filter(
      p => p.name.trim() !== ''
    );

    if (participantsToCreate.length === 0) {
        setParticipantSubmitMessage("错误: 请至少填写一名学生的信息");
        return;
    }

    setIsSubmittingParticipant(true);
    setParticipantSubmitMessage(null);

    try {
        // (★ 关键) V4: 准备 *所有* payload
        const payloads = participantsToCreate.map(p => ({
            customer_id: selectedParentId,
            name: p.name,
            date_of_birth: p.dob || null, //
        }));

        // (★ 关键) V4: 并行发送所有 API 请求
        const results = await Promise.all(
          payloads.map(payload => 
            apiPost('/api/v1/participants', token, payload) //
          )
        );
        
        setParticipantSubmitMessage(`成功创建 ${results.length} 名新学员!`);
        // (清空表单)
        setNewParticipants([{ name: '', dob: '' }]); 
        // (可选: 刷新学员列表, V2)

    } catch (e) {
        setParticipantSubmitMessage((e as Error).message);
    } finally {
        setIsSubmittingParticipant(false);
    }
  };

  // C. 提交开卡 (逻辑不变)
  const handleAssignMembership = async (e: React.FormEvent) => { /* (保持不变) */ 
    e.preventDefault();
    if (!token || !selectedCardCustomerId || !selectedTierId) {
      setCardSubmitMessage("错误: 客户或卡种未选择");
      return;
    }
    setIsSubmittingCard(true);
    setCardSubmitMessage(null);
    try {
      const payload = { customer_id: selectedCardCustomerId, tier_id: selectedTierId, participant_id: null };
      const newMembership: CustomerMembership = await apiPost('/api/v1/customer-memberships', token, payload); //
      setCardSubmitMessage(`开卡成功! ID: ${newMembership.id}`);
    } catch (e) {
      setCardSubmitMessage((e as Error).message);
    } finally {
      setIsSubmittingCard(false);
    }
  };

  // (★ 新增) V4: 处理学生表单行变化的辅助函数
  const handleParticipantChange = (index: number, field: 'name' | 'dob', value: string) => {
    const updatedParticipants = [...newParticipants];
    updatedParticipants[index][field] = value;
    setNewParticipants(updatedParticipants);
  };
  
  // (★ 新增) V4: 处理 "+" 按钮点击
  const handleAddParticipantRow = () => {
    setNewParticipants([...newParticipants, { name: '', dob: '' }]);
  };


  // --- 5. 页面渲染 (★ 已更新) ---
  if (isLoading) {
    return <div>正在加载客户与卡种列表...</div>;
  }
  if (error) {
    return <div className="text-red-500">加载失败: {error}</div>;
  }

  const customerOptions = customers.length === 0 
    ? <option>请先创建新会员</option>
    : customers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.phone_number})
        </option>
      ));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold">学员与会员管理</h1>
      
      {/* --- 模块一: 新会员 (家长) 录入 (保持不变) --- */}
      <section className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">A. 新会员 (家长) 录入</h2>
        <form onSubmit={handleCreateCustomer} className="flex items-end gap-4">
          <div className="flex-1">
            <label htmlFor="customerName" className="block text-sm font-medium text-gray-700">家长姓名</label>
            <input id="customerName" type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" placeholder="例如: 张三"/>
          </div>
          <div className="flex-1">
            <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700">手机号 (必填)</label>
            <input id="customerPhone" type="tel" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" placeholder="用于登录和识别" required/>
          </div>
          <button type="submit" disabled={isSubmittingCustomer} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400">
            {isSubmittingCustomer ? '创建中...' : '创建新会员'}
          </button>
        </form>
        {customerSubmitMessage && <p className={`mt-4 text-sm ${customerSubmitMessage.includes('失败') ? 'text-red-500' : 'text-green-500'}`}>{customerSubmitMessage}</p>}
      </section>

      {/* --- (★ 关键) 模块二: 新学生 (学员) 录入 (V4) --- */}
      <section className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">B. 新学生 (学员) 录入</h2>
        <form onSubmit={handleCreateParticipants} className="space-y-4">
          {/* 步骤 1: 关联家长 */}
          <div>
            <label htmlFor="parentSelect" className="block text-sm font-medium text-gray-700">
              关联家长 (必选)
            </label>
            <select
              id="parentSelect"
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
              disabled={customers.length === 0}
            >
              {customerOptions}
            </select>
          </div>

          {/* 步骤 2: 动态学生列表 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              学生信息
            </label>
            {newParticipants.map((participant, index) => (
              <div key={index} className="flex gap-4">
                <input
                  type="text"
                  value={participant.name}
                  onChange={(e) => handleParticipantChange(index, 'name', e.target.value)}
                  className="block w-1/2 p-2 border border-gray-300 rounded-md"
                  placeholder={`学生 ${index + 1} 姓名 (必填)`}
                />
                <input
                  type="date"
                  value={participant.dob}
                  onChange={(e) => handleParticipantChange(index, 'dob', e.target.value)}
                  className="block w-1/2 p-2 border border-gray-300 rounded-md text-gray-500"
                />
                {/* (V4.1: 可以在这里加一个 'X' 按钮来删除行) */}
              </div>
            ))}
          </div>
          
          {/* 步骤 3: 操作按钮 */}
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={handleAddParticipantRow}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              + 添加另一名学生
            </button>
            <button
              type="submit"
              disabled={isSubmittingParticipant || customers.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {isSubmittingParticipant ? '创建中...' : '创建 (全部) 新学生'}
            </button>
          </div>
        </form>
        {participantSubmitMessage && <p className={`mt-4 text-sm ${participantSubmitMessage.includes('失败') ? 'text-red-500' : 'text-green-500'}`}>{participantSubmitMessage}</p>}
      </section>

      {/* --- 模块三: 快速开卡 (保持不变) --- */}
      <section className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">C. 快速开卡 (给家长)</h2>
        <form onSubmit={handleAssignMembership} className="flex items-end gap-4">
          <div className="flex-1">
            <label htmlFor="customer" className="block text-sm font-medium text-gray-700">选择客户</label>
            <select id="customer" value={selectedCardCustomerId} onChange={(e) => setSelectedCardCustomerId(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" disabled={customers.length === 0}>
              {customerOptions}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="tier" className="block text-sm font-medium text-gray-700">选择会员卡</label>
            <select id="tier" value={selectedTierId} onChange={(e) => setSelectedTierId(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md">
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>{t.name_key} ({(t.price_in_cents / 100).toFixed(2)} 元)</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={isSubmittingCard || customers.length === 0} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
            {isSubmittingCard ? '处理中...' : '确认开卡'}
          </button>
        </form>
        {cardSubmitMessage && <p className={`mt-4 text-sm ${cardSubmitMessage.includes('失败') ? 'text-red-500' : 'text-green-500'}`}>{cardSubmitMessage}</p>}
      </section>
    </div>
  );
}