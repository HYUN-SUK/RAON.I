import { 
  searchPlacesDb, 
  getPlaceDetailsDb, 
  getNearbyFacilitiesDb, 
  getTravelPlanTemplateDb,
  supabase
} from './db.js';

async function runLocalMcpTests() {
  console.log("🚀 Starting RAON.I MCP Local Integration Tests...");

  try {
    // 1. searchPlacesDb 테스트 (춘천 근처 15km 반경 명소/식당 검색)
    console.log("\n[Test 1] Testing searchPlacesDb (15km radius around Chuncheon)...");
    const places = await searchPlacesDb(37.8813, 127.7298, 15000);
    console.log(`  -> Successfully retrieved ${places.length} places.`);
    if (places.length > 0) {
      console.log(`  -> Sample: ${places[0].name} (${places[0].category}) - ${places[0].address}`);
    }

    // 2. getPlaceDetailsDb 테스트 (DB에서 임의의 장소 1개를 뽑아 상세 enrichment 및 Gemini 요약 빌드 테스트)
    console.log("\n[Test 2] Testing getPlaceDetailsDb (Lazy Loading & Gemini Description Build)...");
    const { data: sampleFacts } = await supabase
      .from('smart_plan_facts')
      .select('id, name, category, description, raw_data')
      .limit(1);

    if (sampleFacts && sampleFacts.length > 0) {
      const targetFact = sampleFacts[0];
      console.log(`  -> Selected Target: ${targetFact.name} (${targetFact.category})`);
      console.log(`  -> Old Description: ${targetFact.description}`);
      
      const enrichedDetails = await getPlaceDetailsDb(targetFact.id);
      if (enrichedDetails) {
        console.log(`  -> Enriched Result: ${enrichedDetails.name}`);
        console.log(`  -> New Description (Gemini Build): ${enrichedDetails.description}`);
        console.log(`  -> Has Enriched Meta?`, enrichedDetails.raw_data?.enriched === true);
      }
    } else {
      console.log("  -> Warning: No master places found in smart_plan_facts to test details.");
    }

    // 3. getNearbyFacilitiesDb 테스트 (NMC 병원, 대형 마트)
    console.log("\n[Test 3] Testing getNearbyFacilitiesDb (Hospital & Mart)...");
    const hospitals = await getNearbyFacilitiesDb(37.8813, 127.7298, 'HOSPITAL');
    console.log(`  -> Found ${hospitals.length} hospitals nearby.`);
    if (hospitals.length > 0) {
      console.log(`  -> Sample Hospital: ${hospitals[0].name} - ${hospitals[0].address}`);
    }

    // 4. getNearbyFacilitiesDb 테스트 (OPINET 주유소 2단계 온디맨드 캐싱)
    console.log("\n[Test 4] Testing getNearbyFacilitiesDb (OPINET Gas Station 2-Tier Caching)...");
    const gasStations = await getNearbyFacilitiesDb(37.8813, 127.7298, 'GAS_STATION');
    console.log(`  -> Retrieved ${gasStations.length} gas stations via OPINET/DB.`);
    if (gasStations.length > 0) {
      console.log(`  -> Sample Gas Station: ${gasStations[0].name} - ${gasStations[0].address} (${gasStations[0].description})`);
    }

    // 5. getTravelPlanTemplateDb 테스트 (예약 ID가 없는 범용 3rd Party 요청 조립 테스트)
    console.log("\n[Test 5] Testing getTravelPlanTemplateDb (General 3rd Party Request)...");
    const template = await getTravelPlanTemplateDb(
      undefined, 
      37.8813, 
      127.7298, 
      3, 
      ["성인 2", "초등학생 1", "반려동물 동반"]
    );
    console.log("  -> Template metadata:", JSON.stringify(template.metadata));
    console.log(`  -> Template Place Candidates count: ${template.place_candidates.length}`);
    console.log("  -> Prompt Guide Sample length:", template.system_prompt_guide.length);

    console.log("\n🎉 All local integration tests completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Test execution failed with error:", error.message || error);
  }
}

runLocalMcpTests();
