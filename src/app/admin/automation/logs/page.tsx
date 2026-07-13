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
  Maximize2,
  Share2,
  TrendingUp
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
  raw_data?: any;
}

const INITIAL_API_LIST: ApiStatus[] = [
  { name: 'MART_LARGE', label: '마트(대형마트)', status: 'PENDING', duration_ms: 0 },
  { name: 'MART_SSM', label: '마트(준대규모)', status: 'PENDING', duration_ms: 0 },
  { name: 'MART_SUPER', label: '마트(기타식품)', status: 'PENDING', duration_ms: 0 },
  { name: 'REST_LOCALDATA', label: '식당(모범음식점)', status: 'PENDING', duration_ms: 0 },
  { name: 'REST_BAEK', label: '식당(백년가게)', status: 'PENDING', duration_ms: 0 },
  { name: 'REST_SAFE', label: '식당(안심식당)', status: 'PENDING', duration_ms: 0 },
  { name: 'LX_RESTAURANT', label: '식당(LX공사맛집)', status: 'PENDING', duration_ms: 0 },
  { name: 'TOUR_SPOT', label: '관광명소(TourAPI)', status: 'PENDING', duration_ms: 0 },
  { name: 'FESTIVAL', label: '축제(TourAPI)', status: 'PENDING', duration_ms: 0 },
  { name: 'HOSPITAL', label: '병원(NMC)', status: 'PENDING', duration_ms: 0 },
  { name: 'GAS_OPINET', label: '주유소(오피넷)', status: 'PENDING', duration_ms: 0 },
  { name: 'WEATHER_SHORT', label: '날씨(단기)', status: 'PENDING', duration_ms: 0 },
  { name: 'WEATHER_MID', label: '날씨(중기)', status: 'PENDING', duration_ms: 0 },
  { name: 'KAKAO_LOCAL', label: '카카오로컬', status: 'PENDING', duration_ms: 0 },
  { name: 'KAKAO_MAP', label: '카카오맵', status: 'PENDING', duration_ms: 0 },
  { name: 'GOCAMPING', label: '고캠핑', status: 'PENDING', duration_ms: 0 },
  { name: 'SPOT_TMAP_REL', label: '명소 연관(Tmap)', status: 'PENDING', duration_ms: 0 },
  { name: 'SPOT_KT_CONCTR', label: '명소 집중률(KT)', status: 'PENDING', duration_ms: 0 },
  { name: 'KTO_POPULARITY', label: '명소(지자체 인기도)', status: 'PENDING', duration_ms: 0 },
  { name: 'SPOT_KTO_POP', label: '명소(KTO 공식 순위)', status: 'PENDING', duration_ms: 0 },
  { name: 'GEMINI', label: 'AI(제미나이)', status: 'PENDING', duration_ms: 0 }
];

export default function AutomationLogsPage() {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [localApiStatus, setLocalApiStatus] = useState<ApiStatus[]>(INITIAL_API_LIST);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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
          // Merge logic: Use INITIAL_API_LIST as base, update with DB results if match
          const mergedStatus = INITIAL_API_LIST.map(initial => {
            const dbMatch = latestHealthCheck.api_status.find((s: any) => s.name === initial.name);
            return dbMatch ? (dbMatch as ApiStatus) : initial;
          });
          setLocalApiStatus(mergedStatus);
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
    if (name.includes('TMAP')) return <Share2 className="w-5 h-5 text-indigo-500" />;
    if (name.includes('KT_CONCTR')) return <TrendingUp className="w-5 h-5 text-rose-500" />;
    if (name.includes('KTO_POPULARITY') || name.includes('SPOT_KTO_POP')) return <TrendingUp className="w-5 h-5 text-blue-500" />;
    if (name.includes('KAKAO')) return <Wifi className="w-5 h-5" />;
    return <Wifi className="w-5 h-5" />;
  };

  const renderLogDetails = (log: AutomationLog) => {
    try {
      if (log.job_name === 'MASTER_SYNC') {
        const statusList = log.api_status || [];
        
        // Grouping logic for 3 Rest, 3 Mart, 1 Spot
        const restaurantSources = statusList.filter(s => s.name.includes('REST'));
        const martSources = statusList.filter(s => s.name.includes('MART'));
        const spotSources = statusList.filter(s => s.name.includes('TOUR_SPOT'));
        const otherSources = statusList.filter(s => !s.name.includes('REST') && !s.name.includes('MART') && !s.name.includes('TOUR_SPOT'));

        const renderSourceGroup = (title: string, sources: any[], icon: React.ReactNode) => (
          <div className="space-y-4">
            <h5 className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center px-2">
              {icon} <span className="ml-2">{title}</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sources.map((s, i) => (
                <div key={i} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100/50 hover:border-brand-200 transition-colors">
                  <p className="text-[10px] font-black text-gray-400 truncate mb-1">{s.label || s.name}</p>
                  <div className="flex justify-between items-end">
                    <span className="text-xl font-black text-gray-900">{(s.fetched_count || 0).toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-lg">+{s.new_count || 0}</span>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50 text-[10px] text-gray-400 font-bold">
                    <span>대조: {(s.existing_count || 0).toLocaleString()}</span>
                    <span>갱신: {s.updated_count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

        return (
          <div className="p-10 bg-gray-50/50 rounded-[3rem] mt-2 mx-6 mb-8 border-4 border-dashed border-gray-100 shadow-inner">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-xl font-black text-gray-900 flex items-center">
                <Database className="w-6 h-6 mr-3 text-brand-600" /> 주간 배치 동기화 리포트 (MASTER_SYNC)
              </h4>
              <div className="px-4 py-2 bg-brand-600 text-white text-[11px] font-black rounded-2xl shadow-lg">
                총 적재: {log.processed_count.toLocaleString()}건
              </div>
            </div>
            
            <div className="space-y-12">
              {restaurantSources.length > 0 && renderSourceGroup('식당 API 그룹 (3개 이상)', restaurantSources, <UtensilsCrossed className="w-4 h-4" />)}
              {martSources.length > 0 && renderSourceGroup('마트 API 그룹 (LARGE/SSM/SUPER)', martSources, <ShoppingCart className="w-4 h-4" />)}
              {spotSources.length > 0 && renderSourceGroup('관광명소 API', spotSources, <MapPin className="w-4 h-4" />)}
              {otherSources.length > 0 && renderSourceGroup('기타 동기화 소스', otherSources, <Activity className="w-4 h-4" />)}
            </div>
          </div>
        );
      }

      if (log.job_name === 'SMART_PLAN_CACHING') {
        const apiStatus = log.api_status || [];
        const parsedMsg = (log.message && typeof log.message === 'string' && log.message.startsWith('{')) 
          ? JSON.parse(log.message) 
          : { text: log.message, quota_flow: [] };
        const quotaFlow = parsedMsg.quota_flow || [];
        
        return (
          <div className="p-10 bg-gray-50/50 rounded-[3rem] mt-2 mx-6 mb-8 border-4 border-dashed border-gray-100 shadow-inner">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-xl font-black text-gray-900 flex items-center">
                <Calendar className="w-6 h-6 mr-3 text-brand-600" /> D-3 스마트 플랜 캐싱 정밀 점검 리포트 (SOP v11)
              </h4>
              <div className="flex items-center space-x-3">
                <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100 text-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase">대상 예약</p>
                  <p className="text-sm font-black text-gray-900">{log.processed_count || 0}건</p>
                </div>
                <div className="bg-brand-600 px-5 py-2 rounded-2xl shadow-lg text-center text-white">
                  <p className="text-[9px] font-black text-brand-200 uppercase">작업 결과</p>
                  <p className="text-sm font-black">{log.status}</p>
                </div>
              </div>
            </div>

            <div className="space-y-12">
              {/* 🎯 2. D-3 캐싱 1부 (API별 지표 대조) */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center px-2">
                  <Activity className="w-4 h-4 mr-2" /> 1부: API별 지표 대조 (Dynamic Data)
                </h5>
                <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">카테고리</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">기존 데이터 수</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">API 수신 수</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right text-brand-600">신규 삽입(New)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right text-blue-600">변경 갱신(Upd)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">최종 총계</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {apiStatus.filter((s: any) => s.category !== 'SPOT').map((s: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              {s.category === 'HOSPITAL' && <Hospital className="w-3.5 h-3.5 mr-2 text-red-500" />}
                              {s.category === 'GAS_STATION' && <Activity className="w-3.5 h-3.5 mr-2 text-orange-500" />}
                              {s.category === 'FESTIVAL' && <Ticket className="w-3.5 h-3.5 mr-2 text-indigo-500" />}
                              <span className="text-[11px] font-black text-gray-900 uppercase">{s.category}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-bold text-gray-400">{(s.existing || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-xs font-black text-gray-700">{(s.received || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-block bg-brand-50 text-brand-700 text-[10px] font-black px-2 py-0.5 rounded-lg border border-brand-100">
                              +{s.new || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-block bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-lg border border-blue-100">
                               {s.updated || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-black text-gray-900">{(s.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 🔍 3. D-3 캐싱 2부 (Quota & Verification) */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center px-2">
                  <Maximize2 className="w-4 h-4 mr-2" /> 2부: 단계별 정제 및 검증 지표 (Quota & Verification)
                </h5>
                <div className="bg-[#224732] rounded-[3rem] p-8 shadow-2xl overflow-hidden overflow-x-auto border-4 border-[#2d5c41]">
                  <table className="w-full text-left border-collapse min-w-[700px] text-white">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-6 py-4 text-[10px] font-black text-brand-300 uppercase tracking-widest">카테고리</th>
                        <th className="px-6 py-4 text-[10px] font-black text-brand-300 uppercase tracking-widest text-right">
                          Step 1. 원천 데이터
                          <span className="text-[9px] font-normal text-white/50 block mt-0.5 normal-case">반경 25km DB 수집</span>
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black text-brand-300 uppercase tracking-widest text-right">
                          Step 2. 1차 정제
                          <span className="text-[9px] font-normal text-white/50 block mt-0.5 normal-case">행정구역 & 노이즈 필터</span>
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black text-brand-300 uppercase tracking-widest text-right">
                          Step 3. 지표 검증
                          <span className="text-[9px] font-normal text-white/50 block mt-0.5 normal-case">인증 맛집 및 스코어 가드</span>
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black text-brand-300 uppercase tracking-widest text-right font-black text-brand-400">
                          Step 4. 최종 캐시
                          <span className="text-[9px] font-normal text-brand-400/50 block mt-0.5 normal-case">사용자 취향 개인화 적재</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {quotaFlow.map((q: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-xs font-bold text-brand-100">{q.category}</td>
                          <td className="px-6 py-4 text-right text-xs font-black">{(q.raw_pool || q.raw_query || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-xs font-black">{(q.union_pool || q.top_quota || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center text-[10px] font-black text-green-400">
                              <CheckCircle2 className="w-3 h-3 mr-1.5" /> {(q.verified || 0).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-black text-brand-400 bg-white/5">{(q.personalized || q.final || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-6 flex justify-between items-center px-2">
                    <p className="text-[10px] font-bold text-brand-300 italic">
                      * 1차 선별 로직 통과 리스트는 spot_final_audit.md에서 상세 확인 가능합니다.
                    </p>
                    <p className="text-[9px] font-black text-brand-500 uppercase tracking-tighter">Precision Audit SOP v11.9.8 Compliant</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      if (log.job_name === 'DAILY_REGION_SYNC') {
        const apiStatus = log.api_status || [];
        
        return (
          <div className="p-10 bg-gray-50/50 rounded-[3rem] mt-2 mx-6 mb-8 border-4 border-dashed border-gray-100 shadow-inner">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-xl font-black text-gray-900 flex items-center">
                <RefreshCw className="w-6 h-6 mr-3 text-brand-600 animate-spin-slow" /> 17일 주기 지역 순환 동기화 리포트
              </h4>
              <div className="px-4 py-2 bg-indigo-600 text-white text-[11px] font-black rounded-2xl shadow-lg">
                수신 총계: {log.processed_count.toLocaleString()}건
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider">갱신 지역</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider">카테고리</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right">기존 데이터 수</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right">API 수신 수</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right text-brand-600">신규 삽입(New)</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right text-blue-600">변경 갱신(Upd)</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right font-black">최종 총계</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-left">비고 (Note)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {apiStatus.map((s: any, i: number) => {
                    const renderMetric = (val: any, styleType: 'plain' | 'brand' | 'blue', activeLabel: string = '영업', inactiveLabel: string = '폐업') => {
                      const isObj = val !== null && typeof val === 'object';
                      const a = isObj ? val.active || 0 : (val || 0);
                      const inact = isObj ? val.inactive || 0 : 0;
                      
                      const showPlus = styleType !== 'plain';
                      
                      if (styleType === 'brand') {
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <span className="inline-block bg-brand-50 text-brand-700 border border-brand-100 text-[10px] font-black px-2 py-0.5 rounded-lg">
                              {showPlus && a > 0 ? '+' : ''}{a.toLocaleString()} {isObj && activeLabel}
                            </span>
                            {isObj && (
                              <span className="inline-block bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                                {showPlus && inact > 0 ? '+' : ''}{inact.toLocaleString()} {inactiveLabel}
                              </span>
                            )}
                          </div>
                        );
                      }
                      
                      if (styleType === 'blue') {
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <span className="inline-block bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black px-2 py-0.5 rounded-lg">
                              {a.toLocaleString()} {isObj && activeLabel}
                            </span>
                            {isObj && (
                              <span className="inline-block bg-orange-50 text-orange-600 border border-orange-100 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                                +{inact.toLocaleString()} {inactiveLabel}
                              </span>
                            )}
                          </div>
                        );
                      }

                      // plain style
                      return (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="flex items-center text-xs font-bold text-gray-700">
                            {isObj && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>}
                            {a.toLocaleString()}
                          </span>
                          {isObj && (
                            <span className="flex items-center text-[10px] font-bold text-gray-400">
                              <span className="w-1 h-1 rounded-full bg-rose-400 mr-1.5"></span>
                              {inact.toLocaleString()}
                            </span>
                          )}
                        </div>
                      );
                    };

                    return (
                      <tr key={i} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{s.region}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            {s.label?.includes('RESTAURANT') && <UtensilsCrossed className="w-3.5 h-3.5 mr-2 text-orange-500" />}
                            {s.label?.includes('MART') && <ShoppingCart className="w-3.5 h-3.5 mr-2 text-green-500" />}
                            {s.label?.includes('HOSPITAL') && <Hospital className="w-3.5 h-3.5 mr-2 text-red-500" />}
                            {s.name === 'SPOT' && <MapPin className="w-3.5 h-3.5 mr-2 text-blue-500" />}
                            {s.name === 'SPOT_TMAP_REL' && <Share2 className="w-3.5 h-3.5 mr-2 text-indigo-500" />}
                            {s.name === 'SPOT_KT_CONCTR' && <TrendingUp className="w-3.5 h-3.5 mr-2 text-rose-500" />}
                            {s.name === 'SPOT_KTO_POP' && <Activity className="w-3.5 h-3.5 mr-2 text-indigo-500" />}
                            {s.name === 'ENRICHMENT' && <Database className="w-3.5 h-3.5 mr-2 text-brand-600" />}
                            <span className="text-[11px] font-bold text-gray-600">{s.label || s.name}</span>
                            {(s.name === 'SPOT' || s.label?.includes('HOSPITAL')) && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-50 text-green-700 border border-green-100">
                                상세 API 연동
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.existing_count, 'plain')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.fetched_count, 'plain')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.new_count, 'brand', '정상', '폐업')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.updated_count, 'blue', '갱신', '비활성')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm font-black text-gray-900">
                              {(typeof s.total_count === 'object' ? s.total_count?.active || 0 : (s.total_count || 0)).toLocaleString()}
                            </span>
                            {typeof s.total_count === 'object' && (
                              <span className="text-[10px] font-bold text-rose-500/80 line-through">
                                {(s.total_count?.inactive || 0).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-left text-xs font-bold text-gray-500 max-w-[250px] truncate" title={s.note || ''}>
                          {s.note || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex items-center justify-between px-2">
              <div className="flex items-center text-[10px] text-gray-400 font-bold">
                <AlertCircle className="w-3 h-3 mr-1.5" /> * 3진 아웃 방식: API에서 3회 연속(51일) 미확인 시 자동 비활성화 처리됩니다.
              </div>
              <p className="text-[10px] font-black text-gray-300 italic uppercase tracking-tighter">Powered by RAONAI Precision Audit Engine v3.0</p>
            </div>
          </div>
        );
      }

      if (log.job_name === 'WEEKLY_FESTIVAL_SYNC') {
        const apiStatus = log.api_status || [];
        
        return (
          <div className="p-10 bg-gray-50/50 rounded-[3rem] mt-2 mx-6 mb-8 border-4 border-dashed border-gray-100 shadow-inner">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-xl font-black text-gray-900 flex items-center">
                <Ticket className="w-6 h-6 mr-3 text-brand-600 animate-pulse" /> 주간 전국 축제 동기화 리포트
              </h4>
              <div className="px-4 py-2 bg-indigo-600 text-white text-[11px] font-black rounded-2xl shadow-lg">
                수신 총계: {log.processed_count.toLocaleString()}건
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider">대상 지역</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider">카테고리</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right">기존 데이터 수</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right">API 수신 수</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right text-brand-600">신규 삽입(New)</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right text-blue-600">변경 갱신(Upd)</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right font-black">최종 총계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {apiStatus.map((s: any, i: number) => {
                    const renderMetric = (val: any, styleType: 'plain' | 'brand' | 'blue', activeLabel: string = '영업') => {
                      const isObj = val !== null && typeof val === 'object';
                      const a = isObj ? val.active || 0 : (val || 0);
                      const showPlus = styleType !== 'plain';
                      
                      if (styleType === 'brand') {
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <span className="inline-block bg-brand-50 text-brand-700 border border-brand-100 text-[10px] font-black px-2 py-0.5 rounded-lg">
                              {showPlus && a > 0 ? '+' : ''}{a.toLocaleString()} {isObj && activeLabel}
                            </span>
                          </div>
                        );
                      }
                      
                      if (styleType === 'blue') {
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <span className="inline-block bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black px-2 py-0.5 rounded-lg">
                              {a.toLocaleString()} {isObj && activeLabel}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="flex items-center text-xs font-bold text-gray-700">
                            {a.toLocaleString()}
                          </span>
                        </div>
                      );
                    };

                    return (
                      <tr key={i} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-full">{s.region}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <Ticket className="w-3.5 h-3.5 mr-2 text-indigo-500" />
                            <span className="text-[11px] font-bold text-gray-600">{s.label || s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.existing_count, 'plain')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.fetched_count, 'plain')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.new_count, 'brand', '정상')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.updated_count, 'blue', '갱신')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm font-black text-gray-900">
                              {(typeof s.total_count === 'object' ? s.total_count?.active || 0 : (s.total_count || 0) || s.final_count || 0).toLocaleString()}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex items-center justify-between px-2">
              <div className="flex items-center text-[10px] text-gray-400 font-bold">
                <AlertCircle className="w-3 h-3 mr-1.5" /> * 주간 축제 정보는 중복 없이 마스터 데이터베이스에 안전하게 Upsert 병합됩니다.
              </div>
              <p className="text-[10px] font-black text-gray-300 italic uppercase tracking-tighter">Powered by RAONAI Festival Precision Sync Engine</p>
            </div>
          </div>
        );
      }

      if (log.job_name === 'DAILY_CRAWL_ENRICHMENT') {
        let stats: any = log.api_status;
        if (typeof stats === 'string') {
          try {
            stats = JSON.parse(stats);
          } catch (e) {
            stats = null;
          }
        }
        if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
          stats = { total: 0, updated: 0, skipped: 0, failed: 0, deactivated: 0, history: [] };
        }
        const statsObj = stats as any;
        const historyList = statsObj.history || [];

        return (
          <div className="p-10 bg-gray-50/50 rounded-[3rem] mt-2 mx-6 mb-8 border-4 border-dashed border-gray-100 shadow-inner animate-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-xl font-black text-gray-900 flex items-center">
                <RefreshCw className="w-6 h-6 mr-3 text-brand-600 animate-spin-slow" /> 일일 식당/카페/마트 크롤링 갱신 리포트 (DAILY_CRAWL_ENRICHMENT)
              </h4>
              <div className="px-4 py-2 bg-indigo-600 text-white text-[11px] font-black rounded-2xl shadow-lg">
                수집 대상: {statsObj.total}건
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                <p className="text-xs font-bold text-gray-400 mb-1">성공 (정보 업데이트)</p>
                <p className="text-2xl font-black text-brand-600">+{statsObj.updated || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                <p className="text-xs font-bold text-gray-400 mb-1">변동 없음 (스킵)</p>
                <p className="text-2xl font-black text-gray-500">{statsObj.skipped || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                <p className="text-xs font-bold text-gray-400 mb-1">실패 (임시 에러)</p>
                <p className="text-2xl font-black text-amber-500">+{statsObj.failed - (statsObj.deactivated || 0)}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                <p className="text-xs font-bold text-gray-400 mb-1">영구 비활성화 (3회 아웃)</p>
                <p className="text-2xl font-black text-red-600">+{statsObj.deactivated || 0}</p>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden overflow-x-auto max-h-[400px]">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">장소명</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">카테고리</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">처리 결과</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historyList.length > 0 ? (
                    historyList.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-gray-900">{item.name}</td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-gray-500 px-2 py-0.5 rounded-full bg-gray-100">
                            {item.category === 'MART' ? '마트' : '식당/카페'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.status === 'UPDATED' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-green-50 text-green-700 border border-green-100">
                              정보 업데이트
                            </span>
                          )}
                          {item.status === 'SKIPPED' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-100">
                              스킵 (변동없음)
                            </span>
                          )}
                          {item.status === 'FAILED' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                              실패 (1회 누적)
                            </span>
                          )}
                          {item.status === 'DEACTIVATED' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-red-50 text-red-700 border border-red-100 animate-pulse">
                              비활성화 (3회 아웃)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-gray-300 font-bold">세부 히스토리 없음</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex items-center justify-between px-2">
              <div className="flex items-center text-[10px] text-gray-400 font-bold">
                <AlertCircle className="w-3 h-3 mr-1.5" /> * Playwright 모바일 크롤링은 IP 차단 예방 및 변경 사항 여부에 따른 선별적 데이터 쓰기를 지원합니다.
              </div>
              <p className="text-[10px] font-black text-gray-300 italic uppercase tracking-tighter">Powered by RAONAI Playwright Anti-Scraping Daemon</p>
            </div>
          </div>
        );
      }
      
      if (log.job_name === 'DAILY_MASTER_ENRICHMENT') {
        const stats = log.api_status as any || { attempted: 0, success: 0, failed: 0, processed: [] };
        const successRate = stats.attempted > 0 ? Math.round((stats.success / stats.attempted) * 100) : 0;
        
        // 식당/카페 및 마트 파싱 분류 집계
        const restSuccess = stats.processed ? stats.processed.filter((p: string) => p.includes('(RESTAURANT)') || p.includes('(ROUTE_CAFE)')).length : 0;
        const martSuccess = stats.processed ? stats.processed.filter((p: string) => p.includes('(MART)')).length : 0;

        return (
          <div className="p-10 bg-gray-50/50 rounded-[3rem] mt-2 mx-6 mb-8 border-4 border-dashed border-gray-100 shadow-inner">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-xl font-black text-gray-900 flex items-center">
                <Database className="w-6 h-6 mr-3 text-brand-600 animate-pulse" /> 일일 마스터 상세 정보 분산 적재 리포트 (DAILY_MASTER_ENRICHMENT)
              </h4>
              <div className="px-4 py-2 bg-indigo-600 text-white text-[11px] font-black rounded-2xl shadow-lg">
                적재 성공: {stats.success}건
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100/50 text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase">총 시도</p>
                <p className="text-2xl font-black text-gray-900">{stats.attempted}건</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100/50 text-center">
                <p className="text-[10px] font-black text-orange-500 uppercase">식당/카페 성공 (목표 275)</p>
                <p className="text-2xl font-black text-orange-600">{restSuccess}건</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100/50 text-center">
                <p className="text-[10px] font-black text-green-500 uppercase">대형마트 성공 (목표 25)</p>
                <p className="text-2xl font-black text-green-600">{martSuccess}건</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100/50 text-center">
                <p className="text-[10px] font-black text-green-500 uppercase">총 성공</p>
                <p className="text-2xl font-black text-green-600">{stats.success}건</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100/50 text-center">
                <p className="text-[10px] font-black text-red-500 uppercase">실패</p>
                <p className="text-2xl font-black text-red-600">{stats.failed}건</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100/50 text-center">
                <p className="text-[10px] font-black text-brand-500 uppercase">성공률</p>
                <p className="text-2xl font-black text-brand-600">{successRate}%</p>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center px-2">
                <Activity className="w-4 h-4 mr-2" /> 상세 갱신 완료 대상 목록
              </h5>
              {stats.processed && stats.processed.length > 0 ? (
                <div className="flex flex-wrap gap-3 p-6 bg-white rounded-3xl border border-gray-100">
                  {stats.processed.map((name: string, i: number) => (
                    <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-50 text-brand-700 border border-brand-100">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-brand-600" />
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="p-10 bg-white rounded-3xl border border-gray-100 text-center text-gray-400 font-bold text-xs">
                  이번 배치에서 갱신 완료된 장소가 없습니다.
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between px-2">
              <div className="flex items-center text-[10px] text-gray-400 font-bold">
                <AlertCircle className="w-3 h-3 mr-1.5" /> * 매일 4,000건씩 순환 적재되며, Gemini 한 줄 설명과 함께 영업시간/주차 정보 등이 마스터 DB에 빌드됩니다.
              </div>
              <p className="text-[10px] font-black text-gray-300 italic uppercase tracking-tighter">Powered by RAONAI Master Place Enricher</p>
            </div>
          </div>
        );
      }
    } catch (e) {
      console.error(e);
      return <div className="mx-10 my-4 text-xs text-red-500 font-bold">상세 데이터를 파싱할 수 없습니다.</div>;
    }
    return null;
  };

  return (
    <div className="p-8 max-w-screen-2xl mx-auto space-y-8 bg-[#f8fafc] min-h-screen">
      {/* 1. 최상단 헤더 & 컨트롤 */}
      <div className="bg-[#224732] p-6 md:p-8 rounded-[2.5rem] text-white shadow-2xl shadow-brand-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="w-8 h-8 md:w-10 md:h-10 text-brand-400" />
            <h1 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">RAONAI Live Monitor</h1>
          </div>
          <p className="text-brand-100/70 text-xs md:text-sm font-bold flex items-center">
            <span className="w-2 h-2 md:w-2.4 md:h-2.5 bg-green-400 rounded-full mr-2 animate-pulse" />
            SSOT v9 기반 전계통 API 및 자동화 배치 실시간 점검 현황
          </p>
        </div>
        <div className="flex flex-wrap gap-3 relative z-10 w-full md:w-auto">
          <button 
            onClick={runApiHealthCheck}
            disabled={checkingHealth}
            className="flex-1 md:flex-initial px-4 md:px-8 py-3 md:py-4 bg-brand-500 text-white rounded-2xl text-sm md:text-base font-black hover:bg-brand-400 transition-all flex items-center justify-center shadow-xl disabled:opacity-50 active:scale-95 group"
          >
            {checkingHealth ? <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3 animate-spin" /> : <Wifi className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3 group-hover:animate-bounce" />}
            전계통 실시간 점검
          </button>
          <button 
            onClick={fetchLogs}
            className="px-4 md:px-8 py-3 md:py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-sm md:text-base font-black text-white hover:bg-white/20 transition-all flex items-center justify-center active:scale-95"
          >
            <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3" />
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

      {/* 3. 상단 Full-Width 독립 상세 패널 (DAILY_REGION_SYNC, SMART_PLAN_CACHING, DAILY_CRAWL_ENRICHMENT) */}
      {(() => {
        const selectedLog = logs.find(l => l.id === expandedLogId && (l.job_name === 'DAILY_REGION_SYNC' || l.job_name === 'SMART_PLAN_CACHING' || l.job_name === 'DAILY_CRAWL_ENRICHMENT' || l.job_name === 'WEEKLY_FESTIVAL_SYNC'));
        if (!selectedLog) return null;
        return (
          <section className="pt-4 animate-in slide-in-from-top-4 fade-in duration-500">
            {renderLogDetails(selectedLog)}
          </section>
        );
      })()}

      {/* 4. 하단 섹션: Timeline & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
        {/* 히스토리 테이블 */}
        <div className="lg:col-span-8 space-y-6">
          <h3 className="text-xl font-black text-gray-800 tracking-tight flex items-center px-1">
            <Clock className="w-6 h-6 mr-2 text-brand-600" /> 최근 자동화 작업 타임라인
          </h3>
          <div className="bg-white rounded-[3rem] border-4 border-white shadow-xl overflow-hidden overflow-x-auto scrollbar-thin">
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
                  <React.Fragment key={log.id}>
                    <tr 
                      className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${expandedLogId === log.id ? 'bg-brand-50/20' : ''}`}
                      onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                    >
                      <td className="px-10 py-6 whitespace-nowrap text-sm text-gray-400 font-bold">
                        {format(new Date(log.created_at), 'MM/dd HH:mm', { locale: ko })}
                      </td>
                      <td className="px-10 py-6 whitespace-nowrap font-black text-gray-800 text-sm">
                        <div className="flex items-center">
                          {log.job_name}
                          {(log.job_name === 'MASTER_SYNC' || log.job_name === 'SMART_PLAN_CACHING' || log.job_name === 'DAILY_REGION_SYNC' || log.job_name === 'DAILY_CRAWL_ENRICHMENT' || log.job_name === 'WEEKLY_FESTIVAL_SYNC') && (
                            <Maximize2 className="w-3 h-3 ml-2 text-brand-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-10 py-6 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="px-10 py-6 whitespace-nowrap text-[11px] text-gray-500 font-bold italic flex justify-between items-center">
                        <span>{(() => {
                            const m = log.message;
                            const text = (m && typeof m === 'string' && m.startsWith('{')) ? JSON.parse(m).text : m;
                            return text?.length > 50 ? text.substring(0, 50) + '...' : text;
                        })()}</span>
                        {expandedLogId === log.id ? <ChevronUp className="w-4 h-4 text-brand-600" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>
                    {expandedLogId === log.id && !['DAILY_REGION_SYNC', 'SMART_PLAN_CACHING', 'DAILY_CRAWL_ENRICHMENT', 'WEEKLY_FESTIVAL_SYNC'].includes(log.job_name) && (
                      <tr>
                        <td colSpan={4} className="bg-white">
                          {renderLogDetails(log)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
