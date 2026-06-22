import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema, 
  ErrorCode, 
  McpError 
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import express from 'express';
import cors from 'cors';
import { 
  validateApiKey, 
  logMcpUsage, 
  searchPlacesDb, 
  getPlaceDetailsDb, 
  getNearbyFacilitiesDb, 
  getTravelPlanTemplateDb 
} from './db.js';

// MCP 서버 인스턴스 생성
const server = new Server(
  {
    name: 'raon-i-smart-plan-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. Zod 매개변수 검증 스키마 정의
const SearchPlacesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_meters: z.number().min(100).max(50000).default(10000),
  category: z.string().optional(),
});

const GetPlaceDetailsSchema = z.object({
  place_id: z.string().uuid(),
});

const GetNearbyFacilitiesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  facility_type: z.enum(['HOSPITAL', 'GAS_STATION', 'MART']),
});

const GetTravelPlanTemplateSchema = z.object({
  reservation_id: z.string().uuid().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  duration_days: z.number().min(1).max(14).optional(),
  companions: z.array(z.string()).optional(),
});

// 2. 도구(Tools) 목록 제공 핸들러 등록
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_places',
        description: '라온아이의 신뢰 검증을 거친 주변 맛집, 카페, 관광명소 목록을 반경 기반 거리순으로 조회합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            lat: { type: 'number', description: '위도 (Latitude)' },
            lng: { type: 'number', description: '경도 (Longitude)' },
            radius_meters: { type: 'number', description: '반경 (기본값: 10000m, 최대: 50000m)' },
            category: { type: 'string', description: '필터링할 카테고리 (RESTAURANT, SPOT, ROUTE_CAFE, MART 등)' }
          },
          required: ['lat', 'lng']
        }
      },
      {
        name: 'get_place_details',
        description: '장소의 ID를 기반으로 세부 운영시간, 휴무일, 주차정보, 대표 메뉴 및 AI 사전빌드 요약설명을 조회합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            place_id: { type: 'string', description: '장소의 고유 UUID (smart_plan_facts.id)' }
          },
          required: ['place_id']
        }
      },
      {
        name: 'get_nearby_facilities',
        description: '지정 위치 주변 5~10km 내의 응급의료기관(NMC 병원), 주유소(오피넷 실시간 유가 반영), 대형마트 정보를 조회합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            lat: { type: 'number', description: '위도' },
            lng: { type: 'number', description: '경도' },
            facility_type: { type: 'string', enum: ['HOSPITAL', 'GAS_STATION', 'MART'], description: '편의시설 종류 (HOSPITAL: 응급병원, GAS_STATION: 주유소, MART: 마트)' }
          },
          required: ['lat', 'lng', 'facility_type']
        }
      },
      {
        name: 'get_travel_plan_template',
        description: '예약 건(1st Party) 또는 범용 실시간 조건(3rd Party)에 맞춰 정제 후보군 및 맞춤 시스템 프롬프트 가이드라인을 반환합니다. 외부 AI가 일정을 수립하는 컨텍스트로 사용합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            reservation_id: { type: 'string', description: '라온아이 예약 고유 ID (UUID) [선택]' },
            lat: { type: 'number', description: '예약 ID가 없을 때 중심 위도 [선택]' },
            lng: { type: 'number', description: '예약 ID가 없을 때 중심 경도 [선택]' },
            duration_days: { type: 'number', description: '여행 기간 (일수, 1~14) [선택]' },
            companions: { type: 'array', items: { type: 'string' }, description: '동반자 구성 태그 배열 (어르신, 어린이, 반려동물 등) [선택]' }
          }
        }
      }
    ]
  };
});

// 3. 도구 호출 핸들러 등록
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const startTime = Date.now();
  const toolName = request.params.name;
  let success = true;
  
  // SSE 또는 HTTP 환경에서 주입된 API 키가 있을 경우 룩업 (로컬 stdio 모드는 인증 생략 또는 시스템 키 사용)
  const meta: any = request.params._meta || {};
  const apiKeyId = meta.apiKeyId || 'SYSTEM_LOCAL';

  try {
    switch (toolName) {
      case 'search_places': {
        const args = SearchPlacesSchema.parse(request.params.arguments);
        const places = await searchPlacesDb(args.lat, args.lng, args.radius_meters, args.category);
        return {
          content: [{ type: 'text', text: JSON.stringify(places, null, 2) }]
        };
      }
      
      case 'get_place_details': {
        const args = GetPlaceDetailsSchema.parse(request.params.arguments);
        const details = await getPlaceDetailsDb(args.place_id);
        if (!details) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Place not found' }) }],
            isError: true
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(details, null, 2) }]
        };
      }
      
      case 'get_nearby_facilities': {
        const args = GetNearbyFacilitiesSchema.parse(request.params.arguments);
        const facilities = await getNearbyFacilitiesDb(args.lat, args.lng, args.facility_type);
        return {
          content: [{ type: 'text', text: JSON.stringify(facilities, null, 2) }]
        };
      }
      
      case 'get_travel_plan_template': {
        const args = GetTravelPlanTemplateSchema.parse(request.params.arguments);
        
        // 예약 ID 혹은 범용 실시간 위치 정보가 둘 중 하나라도 주어져야 함
        if (!args.reservation_id && (args.lat === undefined || args.lng === undefined)) {
          throw new McpError(ErrorCode.InvalidParams, "Either reservation_id or both lat and lng must be provided.");
        }

        const template = await getTravelPlanTemplateDb(
          args.reservation_id,
          args.lat,
          args.lng,
          args.duration_days,
          args.companions
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(template, null, 2) }]
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
  } catch (error: any) {
    success = false;
    if (error instanceof z.ZodError) {
      return {
        content: [{ type: 'text', text: `Invalid parameters: ${JSON.stringify(error.flatten().fieldErrors)}` }],
        isError: true
      };
    }
    return {
      content: [{ type: 'text', text: `Error: ${error.message || error}` }],
      isError: true
    };
  } finally {
    const elapsed = Date.now() - startTime;
    if (apiKeyId !== 'SYSTEM_LOCAL') {
      logMcpUsage(apiKeyId, toolName, success, elapsed).catch();
    }
  }
});

// 4. 전송 프로토콜 바인딩 & 실행 인터페이스 분기
const runStdio = process.argv.includes('--stdio');

if (runStdio) {
  // Stdio 모드 실행 (로컬 개발 및 Claude Desktop 연동용)
  console.error('[MCP] Starting RAON.I MCP Server in Stdio mode...');
  const transport = new StdioServerTransport();
  server.connect(transport).catch(console.error);
} else {
  // SSE 모드 실행 (Express 웹서버 연동용)
  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json());

  // API Key 인증 미들웨어
  const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // 쿼리 파라미터 또는 Authorization 헤더 추출
    let apiKey = req.query.apiKey as string;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API Key. Provide it in query param "apiKey" or Bearer header.' });
    }

    const { isValid, tier, keyId } = await validateApiKey(apiKey);
    if (!isValid || !keyId) {
      return res.status(401).json({ error: 'Invalid or deactivated API Key.' });
    }

    // 요청 메타데이터에 주입
    req.body.apiKeyId = keyId;
    req.body.apiTier = tier;
    next();
  };

  let sseTransport: SSEServerTransport | null = null;

  // 1) SSE 연결 개방 엔드포인트
  app.get('/sse', authMiddleware, async (req, res) => {
    // console.log(`[SSE] New SSE client connection established. Tier: ${req.body.apiTier}`);
    
    // SSE 수송 채널 기동
    sseTransport = new SSEServerTransport('/messages', res);
    
    // server.connect는 백그라운드 연동 처리
    await server.connect(sseTransport);
  });

  // 2) 클라이언트 메시지 수신 엔드포인트
  app.post('/messages', authMiddleware, async (req, res) => {
    if (!sseTransport) {
      return res.status(400).json({ error: 'SSE connection not active' });
    }

    // API Key ID 메타데이터 주입
    if (req.body && typeof req.body === 'object') {
      req.body._meta = { apiKeyId: req.body.apiKeyId };
    }

    await sseTransport.handlePostMessage(req, res);
  });

  app.listen(PORT, () => {
    console.log(`[MCP] RAON.I MCP Server listening on http://localhost:${PORT}`);
    console.log(`[MCP] SSE Endpoint: http://localhost:${PORT}/sse`);
    console.log(`[MCP] Messages Endpoint: http://localhost:${PORT}/messages`);
  });
}
