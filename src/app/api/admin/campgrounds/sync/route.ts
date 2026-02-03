/**
 * 캠핑장 데이터 동기화 API
 *
 * 관리자 전용: 고캠핑 API에서 데이터를 가져와 DB에 동기화
 *
 * POST /api/admin/campgrounds/sync
 * - 전체 동기화 또는 키워드 검색 동기화
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchCampgrounds, searchCampgrounds, GoCampingItem } from '@/lib/gocamping-api';
import { transformGoCampingItem, CampgroundInsertData } from '@/lib/auto-tagging';

// Service Role Client (RLS 우회)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SyncRequest {
    mode: 'full' | 'search' | 'sample';
    keyword?: string;
    pageNo?: number;
    numOfRows?: number;
}

interface SyncResult {
    success: boolean;
    inserted: number;
    updated: number;
    failed: number;
    total: number;
    errors: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        // 관리자 인증 확인 (간단한 Secret 체크)
        const authHeader = request.headers.get('Authorization');
        const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

        // 관리자 이메일 체크 (쿠키 기반)
        const adminEmails = ['admin@raon.ai'];
        const isAdminRequest = authHeader === expectedSecret;

        // TODO: 실제 환경에서는 세션 기반 관리자 인증으로 변경
        // 개발 단계에서는 CRON_SECRET 또는 로컬 호출 허용
        if (!isAdminRequest && process.env.NODE_ENV === 'production') {
            return NextResponse.json(
                { error: '관리자 권한이 필요합니다.' },
                { status: 401 }
            );
        }

        const body: SyncRequest = await request.json();
        const { mode = 'sample', keyword, pageNo = 1, numOfRows = 100 } = body;

        let items: GoCampingItem[] = [];

        // 모드별 데이터 조회
        switch (mode) {
            case 'full':
                // 전체 동기화 (대량 데이터 - 주의)
                items = await fetchCampgrounds({ pageNo, numOfRows: 500 });
                break;

            case 'search':
                if (!keyword) {
                    return NextResponse.json(
                        { error: '검색어(keyword)가 필요합니다.' },
                        { status: 400 }
                    );
                }
                items = await searchCampgrounds(keyword, { pageNo, numOfRows });
                break;

            case 'sample':
            default:
                // 샘플 데이터 (테스트용 100개)
                items = await fetchCampgrounds({ pageNo: 1, numOfRows: 100 });
                break;
        }

        // 데이터 변환 및 DB 삽입
        const result = await syncCampgroundsToDB(items);

        return NextResponse.json({
            mode,
            ...result,
        });
    } catch (error) {
        console.error('[Campground Sync] 오류:', error);
        return NextResponse.json(
            {
                error: '동기화 중 오류가 발생했습니다.',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

/**
 * 변환된 캠핑장 데이터를 DB에 동기화
 */
async function syncCampgroundsToDB(items: GoCampingItem[]): Promise<SyncResult> {
    const result: SyncResult = {
        success: true,
        inserted: 0,
        updated: 0,
        failed: 0,
        total: items.length,
        errors: [],
    };

    for (const item of items) {
        try {
            const data = transformGoCampingItem(item);

            // 기존 데이터 확인
            const { data: existing } = await supabaseAdmin
                .from('campgrounds')
                .select('id')
                .eq('gocamping_id', data.gocamping_id)
                .single();

            // Upsert 수행
            const { error } = await supabaseAdmin.from('campgrounds').upsert(
                {
                    ...data,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'gocamping_id',
                }
            );

            if (error) {
                result.failed++;
                result.errors.push(`[${data.name}] ${error.message}`);
            } else {
                if (existing) {
                    result.updated++;
                } else {
                    result.inserted++;
                }
            }
        } catch (err) {
            result.failed++;
            result.errors.push(
                `[${item.facltNm}] ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    result.success = result.failed === 0;
    return result;
}

/**
 * GET: 동기화 상태 확인
 */
export async function GET(): Promise<NextResponse> {
    try {
        // 현재 DB 상태 조회
        const { count, error } = await supabaseAdmin
            .from('campgrounds')
            .select('*', { count: 'exact', head: true });

        if (error) {
            throw error;
        }

        // 마지막 업데이트 시간
        const { data: latest } = await supabaseAdmin
            .from('campgrounds')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        return NextResponse.json({
            totalCampgrounds: count || 0,
            lastUpdated: latest?.updated_at || null,
            apiEndpoint: '/api/admin/campgrounds/sync',
            supportedModes: ['full', 'search', 'sample'],
        });
    } catch (error) {
        console.error('[Campground Sync] 상태 조회 오류:', error);
        return NextResponse.json(
            { error: '상태 조회 실패' },
            { status: 500 }
        );
    }
}
