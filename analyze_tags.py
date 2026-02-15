
import json
import re

# Logic Definitions
TAG_RULES = {
    "time": {
        "morning": {
            "tags": ["#아침", "#해장", "#간단", "#국물", "#죽", "#샌드위치"],
            "keywords": ["죽", "수프", "샌드위치", "토스트", "해장", "콩나물국", "북엇국", "순두부", "누룽지", "오트밀", "시리얼", "요거트", "브런치", "계란", "스크램블", "프렌치토스트", "베이글", "팬케이크", "떡국"],
            "condition": lambda item: item.get("time_required", 99) <= 20 and item.get("category") == "cooking"
        },
        "lunch": {
            "tags": ["#점심", "#밥심", "#면요리", "#분식"],
            "keywords": ["볶음밥", "덮밥", "비빔밥", "라면", "국수", "우동", "파스타", "스파게티", "떡볶이", "김밥", "짜장", "짬뽕", "햄버거", "도시락", "샌드위치", "부대찌개", "김치찌개", "된장찌개"]
        },
        "dinner": {
            "tags": ["#저녁", "#바비큐", "#구이", "#전골", "#파티", "#메인요리"],
            "keywords": ["삼겹살", "목살", "스테이크", "바비큐", "구이", "전골", "찌개", "찜", "닭갈비", "불고기", "매운탕", "샤브샤브", "폭립", "등갈비", "수육", "백숙", "닭볶음탕"],
            "condition": lambda item: item.get("difficulty", 1) >= 2 or item.get("time_required", 0) >= 30
        },
        "night": {
            "tags": ["#야식", "#안주", "#가벼운", "#맥주", "#소주", "#와인"],
            "keywords": ["꼬치", "마른안주", "나쵸", "감바스", "콘치즈", "오뎅탕", "번데기", "먹태", "팝콘", "카나페", "치즈", "골뱅이", "소시지", "순대", "닭발", "껍데기", "곱창", "막창", "오징어", "노가리"]
        }
    },
    "weather": {
        "rain": {
            "tags": ["#비오는날", "#파전", "#국물", "#따뜻한"],
            "keywords": ["파전", "김치전", "빈대떡", "수제비", "칼국수", "우동", "어묵탕", "전골", "찌개", "짬뽕"]
        },
        "cold": {
            "tags": ["#추운날", "#따뜻한", "#매콤한", "#국물"],
            "keywords": ["탕", "찌개", "전골", "스튜", "핫초코", "매운", "얼큰", "국밥", "순두부", "만둣국"]
        },
        "hot": {
            "tags": ["#더운날", "#시원한", "#이열치열", "#보양식"],
            "keywords": ["냉면", "모밀", "비빔면", "화채", "빙수", "삼계탕", "백숙", "오이", "미역오이냉국", "물회"]
        }
    },
    "situation": {
        "kids": {
            "tags": ["#아이들", "#간식", "#달콤한"],
            "keywords": ["소시지", "마시멜로", "핫도그", "피자", "스파게티", "돈가스", "떡갈비", "카레", "짜장", "달콤", "주먹밥", "유부초밥", "감자튀김", "팝콘", "치킨"]
        },
        "solo": {
            "tags": ["#혼밥", "#간단"],
            "keywords": ["라면", "덮밥", "볶음밥", "컵밥", "간편"],
            "condition": lambda item: item.get("min_participants") == 1
        },
        "party": {
            "tags": ["#파티", "#다같이", "#푸짐한"],
            "keywords": ["바비큐", "전골", "백숙", "통구이", "해신탕", "밀푀유나베"],
            "condition": lambda item: "4인" in str(item.get("servings", "")) or item.get("max_participants", 0) >= 4
        }
    }
}

def analyze_item(item):
    tags = set()
    
    # Combined text for keyword search
    text = (item.get("title", "") + " " + item.get("description", "") + " " + item.get("tips", "")).lower()
    
    # Time Analysis
    for time_key, rule in TAG_RULES["time"].items():
        matched = False
        # Check Condition
        if "condition" in rule and rule["condition"](item):
            matched = True
        # Check Keywords
        if not matched and "keywords" in rule:
            for kw in rule["keywords"]:
                if kw in text:
                    matched = True
                    break
        
        if matched:
            # We don't add all tags, just the context tag usually, but for now let's add the primary tag
            tags.add(f"#{TAG_RULES['time'][time_key]['tags'][0][1:]}") # Add #아침, #점심...
           
            # Add specific tags if keywords match
            if "keywords" in rule:
                 for kw in rule["keywords"]:
                    if kw in text:
                        # Map keyword to tag if possible? 
                        # For simplicity, let's just add the category tags that make sense
                        pass

            # Hardcode mapping for now: add allowed tags based on logic
            # Actually, simpler approach: If morning match, add #아침. If "해장" in text, add #해장.
            for tag in rule["tags"]:
                keyword_part = tag[1:] # remove #
                if keyword_part in text or (keyword_part in ["아침", "점심", "저녁", "야식"] and matched):
                    tags.add(tag)

    # Weather Analysis
    for weather_key, rule in TAG_RULES["weather"].items():
        for kw in rule["keywords"]:
            if kw in text:
                tags.add(rule["tags"][0]) # Add #비오는날 etc
                for tag in rule["tags"]:
                    if tag[1:] in text:
                        tags.add(tag)
                break
                
    # Situation Analysis
    for sit_key, rule in TAG_RULES["situation"].items():
        matched = False
        if "condition" in rule and rule["condition"](item):
            matched = True
        if "keywords" in rule:
            for kw in rule["keywords"]:
                if kw in text:
                    matched = True
                    break
        
        if matched:
            tags.add(rule["tags"][0]) # Add #아이들 etc

    return list(tags)

def main():
    try:
        with open('추천 메뉴.txt', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        sql_statements = []
        sql_statements.append("TRUNCATE TABLE recommendation_pool;") # Clean start for seed
        
        json_mapping = []

        for item in data:
            new_tags = analyze_item(item)
            
            # Merge with existing tags if any (though input seems to have empty tags)
            existing_tags = item.get("tags", {})
            if isinstance(existing_tags, list):
                # Convert list to dict if needed, or just append to a list key
                # DB schema says tags is jsonb. Let's assume we store an array of strings under a key or just list?
                # Looking at seed_recommendations.sql, it inserts ARRAY['...'] or jsonb.
                # Migration says `tags` is JSONB.
                # Let's standardize: tags = {"season": [], "time": [], "situation": [], "flat": []}
                # OR just a flat list in JSON: ["#tag1", "#tag2"]
                # The prompt earlier mentioned "tags column was confirmed to be of type jsonb".
                # Let's use a flat array structure in JSONB for simplicity and queryability: ["#tag1", "#tag2"]
                pass
            
            # Form clean unique list
            final_tags = list(set(new_tags))
            
            # Escape single quotes for SQL
            title = item['title'].replace("'", "''")
            description = (item['description'] or "").replace("'", "''")
            category = item['category']
            image_url = f"'{item['image_url']}'" if item.get('image_url') else "NULL"
            
            # JSON dumps for complex types
            tags_json = json.dumps(final_tags, ensure_ascii=False)
            metadata_json = json.dumps(item.get('metadata', {}), ensure_ascii=False)
            ingredients_json = json.dumps(item.get('ingredients', []), ensure_ascii=False)
            
            # Construct INSERT statement
            sql = f"""
INSERT INTO "public"."recommendation_pool" 
("category", "title", "description", "image_url", "tags", "metadata", "difficulty", "time_required", "min_participants", "max_participants", "materials", "ingredients", "process_steps", "tips", "servings", "calories", "age_group", "location_type", "is_active")
VALUES
('{category}', '{title}', '{description}', {image_url}, '{tags_json}'::jsonb, '{metadata_json}'::jsonb, {item.get('difficulty', 1)}, {item.get('time_required', 0)}, {item.get('min_participants', 1)}, {item.get('max_participants', 10)}, '{json.dumps(item.get('materials', []), ensure_ascii=False)}'::jsonb, '{ingredients_json}'::jsonb, '{json.dumps(item.get('process_steps', []), ensure_ascii=False)}'::jsonb, '{ (item.get('tips') or "").replace("'", "''") }', '{item.get('servings', '')}', {item.get('calories', 0) or 'NULL'}, '{item.get('age_group') or ''}', '{item.get('location_type') or ''}', true);
            """
            sql_statements.append(sql.strip())
            
            # Add to mapping for remote update
            # item['id'] is available from the source data
            if 'id' in item:
                mapping_entry = {
                    "id": item['id'],
                    "tags": final_tags
                }
                json_mapping.append(mapping_entry)

        with open('supabase/seed_recommendations_v2.sql', 'w', encoding='utf-8') as f:
            f.write('\n'.join(sql_statements))
            
        with open('tags_mapping.json', 'w', encoding='utf-8') as f:
            json.dump(json_mapping, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully generated clean SQL and JSON mapping with {len(data)} items.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
