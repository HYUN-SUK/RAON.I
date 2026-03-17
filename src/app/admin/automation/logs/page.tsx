'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Database, 
  Calendar,
  AlertCircle,
  Server,
  Bell,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Wifi,
  WifiOff,
  MapPin,
  CloudSun,
  Bot,
  ShoppingCart,
  UtensilsCrossed,
  Hospital,
  Ticket,
  Maximize2
} from 'lucide-react';

interface ApiStatus {
  name: string;
  label: string;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  duration_ms: number;
  error?: string;
  checked_at?: string;
}

interface AutomationLog {
  id: string;
  job_name: string;
  status: 'SUCCESS' | 'FAILURE' | 'RUNNING' | 'PARTIAL_FAILURE';
  processed_count: number;
  message: string;
  duration_ms: number;
  target_date: string | null;
  created_at: string;
  api_status?: ApiStatus[];
}

const INITIAL_API_LIST: ApiStatus[] = [
  { name: 'MART_LOCALDATA', label: '마트(LocalData)', status: 'PENDING', duration_ms: 0 },
  { name: 'REST_LOCALDATA', label: '식당(모범음식점)', status: 'PENDING', duration_ms: 0 },
  { name: 'REST_BAEK', label: '식당(백년가게)', status: 'PENDING', duration_ms: 0 },
  { name: 'REST_SAFE', label: '식당(안심식당)', status: 'PENDING', duration_ms: 0 },
  { name: 'TOUR_SPOT', label: '관광명소(TourAPI)', status: 'PENDING', duration_ms: 0 },
  { name: 'FESTIVAL', label: '축제(TourAPI)', status: 'PENDING', duration_ms: 0 },
  { name: 'HOSPITAL', label: '병원(NMC)', status: 'PENDING', duration_ms: 0 },
  { name: 'GAS_OPINET', label: '주유소(오피넷)', status: 'PENDING', duration_ms: 0 },
  { name: 'WEATHER_SHORT', label: '날씨(단기)', status: 'PENDING', duration_ms: 0 },
  { name: 'WEATHER_MID', label: '날씨(중기)', status: 'PENDING', duration_ms: 0 },
  { name: 'KAKAO_LOCAL', label: '카카오로컬', status: 'PENDING', duration_ms: 0 },
  { name: 'KAKAO_MAP', label: '카카오맵', status: 'PENDING', duration_ms: 0 },
  { name: 'GOCAMPING', label: '고캠핑', status: 'PENDING', duration_ms: 0 },
  { name: 'GEMINI', label: 'AI(제미나이)', status: 'PENDING', duration_ms: 0 }
];

export default function AutomationLogsPage() {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [localApiStatus, setLocalApiStatus] = useState<ApiStatus[]>(INITIAL_API_LIST);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setLogs(data);
        const latestHealthCheck = data.find(l => l.job_name === 'API_HEALTH_CHECK');
        if (latestHealthCheck?.api_status) {
          setLocalApiStatus(latestHealthCheck.api_status);
        }
      }
    } catch (e) {
      console.error('Fetch logs error:', e);
    }
    setLoading(false);
  };

  const runApiHealthCheck = async () => {
    setCheckingHealth(true);
    setLocalApiStatus(prev => prev.map(api => ({ ...api, status: 'PENDING' })));

    try {
      const res = await fetch('/api/admin/automation/check-health', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await res.json();
      
      if (res.ok && result.data) {
        setLocalApiStatus(result.data);
        await fetchLogs();
      } else {
        alert(result.error || 'API 점검 중 오류가 발생했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('API 점검 요청에 실패했습니다.');
    } finally {
      setCheckingHealth(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">성공</span>;
      case 'FAILURE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">실패</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800">대기</span>;
    }
  };

  const getApiIcon = (name: string) => {
    if (name.includes('MART')) return <ShoppingCart className="w-5 h-5" />;
    if (name.includes('REST')) return <UtensilsCrossed className="w-5 h-5" />;
    if (name.includes('TOUR') || name.includes('CAMPING')) return <MapPin className="w-5 h-5" />;
    if (name.includes('WEATHER')) return <CloudSun className="w-5 h-5" />;
    if (name.includes('GEMINI')) return <Bot className="w-5 h-5" />;
    if (name.includes('HOSPITAL')) return <Hospital className="w-5 h-5" />;
    if (name.includes('FESTIVAL')) return <Ticket className="w-5 h-5" />;
    if (name.includes('KAKAO')) return <Wifi className="w-5 h-5" />;
    return <Wifi className="w-5 h-5" />;
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 bg-[#f8fafc] min-h-screen">
      {/* 1. 최상단 헤더 & 컨트롤 */}
      <div className="bg-[#224732] p-8 rounded-[2.5rem] text-white shadow-2xl shadow-brand-100 flex justify-between items-center relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="w-10 h-10 text-brand-400" />
            <h1 className="text-4xl font-black tracking-tighter uppercase">RAONAI Live Monitor</h1>
          </div>
          <p className="text-brand-100/70 font-bold flex items-center">
            <span className="w-2.4 h-2.5 bg-green-400 rounded-full mr-2 animate-pulse" />
            SSOT v9 기반 전계통 API 및 자동화 배치 실시간 점검 현황
          </p>
        </div>
        <div className="flex gap-4 relative z-10">
          <button 
            onClick={runApiHealthCheck}
            disabled={checkingHealth}
            className="px-8 py-4 bg-brand-500 text-white rounded-2xl text-base font-black hover:bg-brand-400 transition-all flex items-center shadow-xl disabled:opacity-50 active:scale-95 group"
          >
            {checkingHealth ? <RefreshCw className="w-5 h-5 mr-3 animate-spin" /> : <Wifi className="w-5 h-5 mr-3 group-hover:animate-bounce" />}
            전계통 실시간 점검 실행
          </button>
          <button 
            onClick={fetchLogs}
            className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-base font-black text-white hover:bg-white/20 transition-all flex items-center active:scale-95"
          >
            <RefreshCw className="w-5 h-5 mr-3" />
            새로고침
          </button>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
      </div>

      {/* 2. 핵심 섹션: 실시간 API 소통 보드 (유저 요청 최우선 반영하여 상단 배치) */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <Server className="w-7 h-7 mr-3 text-brand-600" /> 실시간 API 소통 상세 보드
            <span className="ml-4 px-3 py-1 bg-gray-200 text-gray-500 text-xs font-black rounded-full uppercase tracking-widest">
              Live Metrics
            </span>
          </h2>
          <div className="flex items-center space-x-6 text-xs font-bold text-gray-400">
            <div className="flex items-center"><div className="w-3 h-3 bg-green-500 rounded-full mr-2" /> ONLINE</div>
            <div className="flex items-center"><div className="w-3 h-3 bg-red-500 rounded-full mr-2" /> ERROR</div>
            <div className="flex items-center"><div className="w-3 h-3 bg-gray-300 rounded-full mr-2" /> PENDING</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {localApiStatus.map((api, idx) => (
            <div key={idx} className={`relative p-6 rounded-[2.5rem] border-4 transition-all group ${
              api.status === 'SUCCESS' 
              ? 'bg-white border-brand-50 shadow-lg shadow-brand-50/20' 
              : api.status === 'PENDING'
              ? 'bg-gray-50 border-gray-100/50 grayscale'
              : 'bg-red-50 border-red-100 shadow-lg shadow-red-50/20'
            }`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-3xl ${
                  api.status === 'SUCCESS' ? 'bg-brand-50 text-brand-700' : 
                  api.status === 'PENDING' ? 'bg-white text-gray-400' :
                  'bg-red-200 text-red-700'
                }`}>
                  {getApiIcon(api.name)}
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  api.status === 'SUCCESS' ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]' : 
                  api.status === 'PENDING' ? 'bg-gray-300' :
                  'bg-red-500 animate-ping'
                }`} />
              </div>
              
              <div className="space-y-1">
                <p className="text-base font-black text-gray-900 leading-tight">{api.label}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{api.name}</p>
              </div>

              <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between items-center">
                {api.status === 'SUCCESS' ? (
                  <span className="text-sm font-black text-brand-600">{api.duration_ms}ms</span>
                ) : api.status === 'PENDING' ? (
                  <span className="text-[10px] font-bold text-gray-300 italic uppercase">Waiting...</span>
                ) : (
                  <span className="text-[10px] font-black text-red-600 underline decoration-2 underline-offset-2">ERROR DETAILS</span>
                )}
                {api.status === 'FAILURE' && api.error && (
                   <div className="absolute inset-x-0 bottom-0 p-3 bg-red-600 text-white text-[9px] font-bold rounded-b-[2.5rem] translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-20">
                     {api.error}
                   </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. 하단 섹션: Timeline & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
        {/* 히스토리 테이블 */}
        <div className="lg:col-span-8 space-y-6">
          <h3 className="text-xl font-black text-gray-800 tracking-tight flex items-center px-1">
            <Clock className="w-6 h-6 mr-2 text-brand-600" /> 최근 자동화 작업 타임라인
          </h3>
          <div className="bg-white rounded-[3rem] border-4 border-white shadow-xl overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-10 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Timestamp</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">process</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Result</th>
                  <th className="px-10 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.length > 0 ? logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-10 py-6 whitespace-nowrap text-sm text-gray-400 font-bold">
                      {format(new Date(log.created_at), 'MM/dd HH:mm', { locale: ko })}
                    </td>
                    <td className="px-10 py-6 whitespace-nowrap font-black text-gray-800 text-sm">
                      {log.job_name}
                    </td>
                    <td className="px-10 py-6 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-10 py-6 whitespace-nowrap text-[11px] text-gray-500 font-bold italic">
                      {log.message}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-10 py-24 text-center">
                      <p className="text-gray-300 font-bold">집계 데이터 없음</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 리마인더 엔진 상태 */}
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-xl font-black text-gray-800 tracking-tight flex items-center px-1">
            <Bell className="w-6 h-6 mr-2 text-brand-600" /> 푸시 서비스 상태
          </h3>
          <div className="bg-white p-8 rounded-[3rem] border-4 border-white shadow-xl space-y-6">
            {[
              { label: 'D-4 장비 체크', time: '08:15', status: 'READY', color: 'bg-green-500' },
              { label: 'D-1 메뉴 추천', time: '08:15', status: 'READY', color: 'bg-green-500' },
              { label: 'D-Day 입실 안내', time: '08:30', status: 'ACTIVE', color: 'bg-blue-500 animate-pulse' }
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center p-5 rounded-[1.5rem] bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${item.color} shadow-sm`} />
                  <div>
                    <p className="text-base font-black text-gray-900">{item.label}</p>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{item.time} KST</p>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black ${
                  item.status === 'READY' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
