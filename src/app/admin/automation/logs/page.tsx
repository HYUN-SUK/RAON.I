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
  { name: 'MART_LARGE', label: '留덊듃(??뺣쭏??', status: 'PENDING', duration_ms: 0 },
  { name: 'MART_SSM', label: '留덊듃(以?洹쒕え)', status: 'PENDING', duration_ms: 0 },
  { name: 'MART_SUPER', label: '留덊듃(湲고??앺뭹)', status: 'PENDING', duration_ms: 0 },
  { name: 'REST_LOCALDATA', label: '?앸떦(紐⑤쾾?뚯떇??', status: 'PENDING', duration_ms: 0 },
  { name: 'REST_BAEK', label: '?앸떦(諛깅뀈媛寃?', status: 'PENDING', duration_ms: 0 },
  { name: 'REST_SAFE', label: '?앸떦(?덉떖?앸떦)', status: 'PENDING', duration_ms: 0 },
  { name: 'LX_RESTAURANT', label: '?앸떦(LX怨듭궗留쏆쭛)', status: 'PENDING', duration_ms: 0 },
  { name: 'TOUR_SPOT', label: '愿愿묐챸??TourAPI)', status: 'PENDING', duration_ms: 0 },
  { name: 'FESTIVAL', label: '異뺤젣(TourAPI)', status: 'PENDING', duration_ms: 0 },
  { name: 'HOSPITAL', label: '蹂묒썝(NMC)', status: 'PENDING', duration_ms: 0 },
  { name: 'GAS_OPINET', label: '二쇱쑀???ㅽ뵾??', status: 'PENDING', duration_ms: 0 },
  { name: 'WEATHER_SHORT', label: '?좎뵪(?④린)', status: 'PENDING', duration_ms: 0 },
  { name: 'WEATHER_MID', label: '?좎뵪(以묎린)', status: 'PENDING', duration_ms: 0 },
  { name: 'KAKAO_LOCAL', label: '移댁뭅?ㅻ줈而?, status: 'PENDING', duration_ms: 0 },
  { name: 'KAKAO_MAP', label: '移댁뭅?ㅻ㏊', status: 'PENDING', duration_ms: 0 },
  { name: 'GOCAMPING', label: '怨좎틺??, status: 'PENDING', duration_ms: 0 },
  { name: 'SPOT_TMAP_REL', label: '紐낆냼 ?곌?(Tmap)', status: 'PENDING', duration_ms: 0 },
  { name: 'SPOT_KT_CONCTR', label: '紐낆냼 吏묒쨷瑜?KT)', status: 'PENDING', duration_ms: 0 },
  { name: 'KTO_POPULARITY', label: '紐낆냼(吏?먯껜 ?멸린??', status: 'PENDING', duration_ms: 0 },
  { name: 'SPOT_KTO_POP', label: '紐낆냼(KTO 怨듭떇 ?쒖쐞)', status: 'PENDING', duration_ms: 0 },
  { name: 'GEMINI', label: 'AI(?쒕??섏씠)', status: 'PENDING', duration_ms: 0 }
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
        alert(result.error || 'API ?먭? 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
      }
    } catch (e) {
      console.error(e);
      alert('API ?먭? ?붿껌???ㅽ뙣?덉뒿?덈떎.');
    } finally {
      setCheckingHealth(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">?깃났</span>;
      case 'FAILURE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">?ㅽ뙣</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800">?湲?/span>;
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
                    <span>?議? {(s.existing_count || 0).toLocaleString()}</span>
                    <span>媛깆떊: {s.updated_count || 0}</span>
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
                <Database className="w-6 h-6 mr-3 text-brand-600" /> 二쇨컙 諛곗튂 ?숆린??由ы룷??(MASTER_SYNC)
              </h4>
              <div className="px-4 py-2 bg-brand-600 text-white text-[11px] font-black rounded-2xl shadow-lg">
                珥??곸옱: {log.processed_count.toLocaleString()}嫄?
              </div>
            </div>
            
            <div className="space-y-12">
              {restaurantSources.length > 0 && renderSourceGroup('?앸떦 API 洹몃９ (3媛??댁긽)', restaurantSources, <UtensilsCrossed className="w-4 h-4" />)}
              {martSources.length > 0 && renderSourceGroup('留덊듃 API 洹몃９ (LARGE/SSM/SUPER)', martSources, <ShoppingCart className="w-4 h-4" />)}
              {spotSources.length > 0 && renderSourceGroup('愿愿묐챸??API', spotSources, <MapPin className="w-4 h-4" />)}
              {otherSources.length > 0 && renderSourceGroup('湲고? ?숆린???뚯뒪', otherSources, <Activity className="w-4 h-4" />)}
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
                <Calendar className="w-6 h-6 mr-3 text-brand-600" /> D-3 ?ㅻ쭏???뚮옖 罹먯떛 ?뺣? ?먭? 由ы룷??(SOP v11)
              </h4>
              <div className="flex items-center space-x-3">
                <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100 text-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase">????덉빟</p>
                  <p className="text-sm font-black text-gray-900">{log.processed_count || 0}嫄?/p>
                </div>
                <div className="bg-brand-600 px-5 py-2 rounded-2xl shadow-lg text-center text-white">
                  <p className="text-[9px] font-black text-brand-200 uppercase">?묒뾽 寃곌낵</p>
                  <p className="text-sm font-black">{log.status}</p>
                </div>
              </div>
            </div>

            <div className="space-y-12">
              {/* ?렞 2. D-3 罹먯떛 1遺 (API蹂?吏???議? */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center px-2">
                  <Activity className="w-4 h-4 mr-2" /> 1遺: API蹂?吏???議?(Dynamic Data)
                </h5>
                <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">移댄뀒怨좊━</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">湲곗〈 ?곗씠????/th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">API ?섏떊 ??/th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right text-brand-600">?좉퇋 ?쎌엯(New)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right text-blue-600">蹂寃?媛깆떊(Upd)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">理쒖쥌 珥앷퀎</th>
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

              {/* ?뵇 3. D-3 罹먯떛 2遺 (Quota & Verification) */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center px-2">
                  <Maximize2 className="w-4 h-4 mr-2" /> 2遺: ?④퀎蹂??뺤젣 諛?寃利?吏??(Quota & Verification)
                </h5>
                <div className="bg-[#224732] rounded-[3rem] p-8 shadow-2xl overflow-hidden overflow-x-auto border-4 border-[#2d5c41]">
                  <table className="w-full text-left border-collapse min-w-[700px] text-white">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-6 py-4 text-[10px] font-black text-brand-300 uppercase tracking-widest">移댄뀒怨좊━</th>
                        <th className="px-6 py-4 text-[10px] font-black text-brand-300 uppercase tracking-widest text-right">1踰?荑쇳꽣 (Raw)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-brand-300 uppercase tracking-widest text-right">2踰?荑쇳꽣 (Top Cap)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-brand-300 uppercase tracking-widest text-right">移댁뭅???뺣?寃利?/th>
                        <th className="px-6 py-4 text-[10px] font-black text-brand-300 uppercase tracking-widest text-right font-black text-brand-400">理쒖쥌 ?곸옱</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {quotaFlow.map((q: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-xs font-bold text-brand-100">{q.category}</td>
                          <td className="px-6 py-4 text-right text-xs font-black">{(q.raw_query || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-xs font-black">{(q.top_quota || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center text-[10px] font-black text-green-400">
                              <CheckCircle2 className="w-3 h-3 mr-1.5" /> {(q.verified || 0).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-black text-brand-400 bg-white/5">{(q.final || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-6 flex justify-between items-center px-2">
                    <p className="text-[10px] font-bold text-brand-300 italic">
                      * 1李??좊퀎 濡쒖쭅 ?듦낵 由ъ뒪?몃뒗 spot_final_audit.md?먯꽌 ?곸꽭 ?뺤씤 媛?ν빀?덈떎.
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
                <RefreshCw className="w-6 h-6 mr-3 text-brand-600 animate-spin-slow" /> 17??二쇨린 吏???쒗솚 ?숆린??由ы룷??
              </h4>
              <div className="px-4 py-2 bg-indigo-600 text-white text-[11px] font-black rounded-2xl shadow-lg">
                ?섏떊 珥앷퀎: {log.processed_count.toLocaleString()}嫄?
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider">媛깆떊 吏??/th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider">移댄뀒怨좊━</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right">湲곗〈 ?곗씠????/th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right">API ?섏떊 ??/th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right text-brand-600">?좉퇋 ?쎌엯(New)</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right text-blue-600">蹂寃?媛깆떊(Upd)</th>
                    <th className="px-4 py-3 text-[10px] whitespace-nowrap font-black text-gray-400 uppercase tracking-wider text-right font-black">理쒖쥌 珥앷퀎</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {apiStatus.map((s: any, i: number) => {
                    const renderMetric = (val: any, styleType: 'plain' | 'brand' | 'blue', activeLabel: string = '?곸뾽', inactiveLabel: string = '?먯뾽') => {
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
                            {s.name === 'SPOT' && <MapPin className="w-3.5 h-3.5 mr-2 text-blue-500" />}
                            {s.name === 'SPOT_TMAP_REL' && <Share2 className="w-3.5 h-3.5 mr-2 text-indigo-500" />}
                            {s.name === 'SPOT_KT_CONCTR' && <TrendingUp className="w-3.5 h-3.5 mr-2 text-rose-500" />}
                            {s.name === 'SPOT_KTO_POP' && <TrendingUp className="w-3.5 h-3.5 mr-2 text-blue-500" />}
                            <span className="text-[11px] font-bold text-gray-600">{s.label || s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.existing_count, 'plain')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.fetched_count, 'plain')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.new_count, 'brand', '?뺤긽', '?먯뾽')}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{renderMetric(s.updated_count, 'blue', '媛깆떊', '鍮꾪솢??)}</td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex items-center justify-between px-2">
              <div className="flex items-center text-[10px] text-gray-400 font-bold">
                <AlertCircle className="w-3 h-3 mr-1.5" /> * 3吏??꾩썐 諛⑹떇: API?먯꽌 3???곗냽(51?? 誘명솗?????먮룞 鍮꾪솢?깊솕 泥섎━?⑸땲??
              </div>
              <p className="text-[10px] font-black text-gray-300 italic uppercase tracking-tighter">Powered by RAONAI Precision Audit Engine v3.0</p>
            </div>
          </div>
        );
      }
    } catch (e) {
      console.error(e);
      return <div className="mx-10 my-4 text-xs text-red-500 font-bold">?곸꽭 ?곗씠?곕? ?뚯떛?????놁뒿?덈떎.</div>;
    }
    return null;
  };

  return (
    <div className="p-8 max-w-screen-2xl mx-auto space-y-8 bg-[#f8fafc] min-h-screen">
      {/* 1. 理쒖긽???ㅻ뜑 & 而⑦듃濡?*/}
      <div className="bg-[#224732] p-8 rounded-[2.5rem] text-white shadow-2xl shadow-brand-100 flex justify-between items-center relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="w-10 h-10 text-brand-400" />
            <h1 className="text-4xl font-black tracking-tighter uppercase">RAONAI Live Monitor</h1>
          </div>
          <p className="text-brand-100/70 font-bold flex items-center">
            <span className="w-2.4 h-2.5 bg-green-400 rounded-full mr-2 animate-pulse" />
            SSOT v9 湲곕컲 ?꾧퀎??API 諛??먮룞??諛곗튂 ?ㅼ떆媛??먭? ?꾪솴
          </p>
        </div>
        <div className="flex gap-4 relative z-10">
          <button 
            onClick={runApiHealthCheck}
            disabled={checkingHealth}
            className="px-8 py-4 bg-brand-500 text-white rounded-2xl text-base font-black hover:bg-brand-400 transition-all flex items-center shadow-xl disabled:opacity-50 active:scale-95 group"
          >
            {checkingHealth ? <RefreshCw className="w-5 h-5 mr-3 animate-spin" /> : <Wifi className="w-5 h-5 mr-3 group-hover:animate-bounce" />}
            ?꾧퀎???ㅼ떆媛??먭? ?ㅽ뻾
          </button>
          <button 
            onClick={fetchLogs}
            className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-base font-black text-white hover:bg-white/20 transition-all flex items-center active:scale-95"
          >
            <RefreshCw className="w-5 h-5 mr-3" />
            ?덈줈怨좎묠
          </button>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
      </div>

      {/* 2. ?듭떖 ?뱀뀡: ?ㅼ떆媛?API ?뚰넻 蹂대뱶 (?좎? ?붿껌 理쒖슦??諛섏쁺?섏뿬 ?곷떒 諛곗튂) */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <Server className="w-7 h-7 mr-3 text-brand-600" /> ?ㅼ떆媛?API ?뚰넻 ?곸꽭 蹂대뱶
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

      {/* 3. ?곷떒 Full-Width ?낅┰ ?곸꽭 ?⑤꼸 (DAILY_REGION_SYNC, SMART_PLAN_CACHING) */}
      {(() => {
        const selectedLog = logs.find(l => l.id === expandedLogId && (l.job_name === 'DAILY_REGION_SYNC' || l.job_name === 'SMART_PLAN_CACHING'));
        if (!selectedLog) return null;
        return (
          <section className="pt-4 animate-in slide-in-from-top-4 fade-in duration-500">
            {renderLogDetails(selectedLog)}
          </section>
        );
      })()}

      {/* 4. ?섎떒 ?뱀뀡: Timeline & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
        {/* ?덉뒪?좊━ ?뚯씠釉?*/}
        <div className="lg:col-span-8 space-y-6">
          <h3 className="text-xl font-black text-gray-800 tracking-tight flex items-center px-1">
            <Clock className="w-6 h-6 mr-2 text-brand-600" /> 理쒓렐 ?먮룞???묒뾽 ??꾨씪??
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
                          {(log.job_name === 'MASTER_SYNC' || log.job_name === 'SMART_PLAN_CACHING') && (
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
                    {expandedLogId === log.id && !['DAILY_REGION_SYNC', 'SMART_PLAN_CACHING'].includes(log.job_name) && (
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
                      <p className="text-gray-300 font-bold">吏묎퀎 ?곗씠???놁쓬</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 由щ쭏?몃뜑 ?붿쭊 ?곹깭 */}
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-xl font-black text-gray-800 tracking-tight flex items-center px-1">
            <Bell className="w-6 h-6 mr-2 text-brand-600" /> ?몄떆 ?쒕퉬???곹깭
          </h3>
          <div className="bg-white p-8 rounded-[3rem] border-4 border-white shadow-xl space-y-6">
            {[
              { label: 'D-4 ?λ퉬 泥댄겕', time: '08:15', status: 'READY', color: 'bg-green-500' },
              { label: 'D-1 硫붾돱 異붿쿇', time: '08:15', status: 'READY', color: 'bg-green-500' },
              { label: 'D-Day ?낆떎 ?덈궡', time: '08:30', status: 'ACTIVE', color: 'bg-blue-500 animate-pulse' }
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
