
import os
import re

tier1_path = r"c:\Users\USER\Desktop\RAON.I\korea_tourism_100_official.md"
tier2_path = r"c:\Users\USER\Desktop\RAON.I\regional_8_sceneries_pure_list.md"
master_path = r"c:\Users\USER\Desktop\RAON.I\korea_prestige_landmark_master_v1.md"

def parse_tier1(path):
    with open(path, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    # Extract items starting with '-'
    items = re.findall(r'- (.*?)\n', content)
    # Handle cases like "5대 고궁 (경복궁, ...)"
    refined_items = []
    for item in items:
        if '(' in item and ')' in item:
            # Extract nested items if list is in parenthesis
            nested = re.findall(r'\((.*?)\)', item)
            if nested:
                for sub in nested[0].split(','):
                    refined_items.append(sub.strip())
        refined_items.append(item.split('(')[0].strip())
    return set(refined_items)

def parse_tier2_by_district(path):
    with open(path, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    sections = re.split(r'## ', content)[1:]
    districts_data = {}
    
    for section in sections:
        lines = section.split('\n')
        region_name = lines[0].split('(')[0].strip()
        districts_data[region_name] = {}
        
        current_district = "General"
        for line in lines[1:]:
            if line.startswith('### '):
                current_district = line.replace('### ', '').strip()
                districts_data[region_name][current_district] = []
            elif line.startswith('- '):
                items = line.replace('- ', '').split(',')
                districts_data[region_name][current_district].extend([i.strip() for i in items])
                
    return districts_data

# 1. Load Data
tier1_set = parse_tier1(tier1_path)
districts_data = parse_tier2_by_district(tier2_path)

# 2. Build Master Content
master_content = """# [Master] 대한민국 프레스티지 랜드마크 마스터 리스트 (v1.0)

> [!IMPORTANT]
> 본 리스트는 RAONAI 인기도 산출 엔진의 핵심 SSOT로, 권위 등급(Authority Tier)에 따라 가중치 점수를 부여합니다.
> - **Tier 1 (+100점)**: 한국관광공사 선정 '한국관광 100선' (국가대표 명소)
> - **Tier 2 (+50점)**: 전국 250개 시군구별 '지역 8경/10경' (지역대표 명소)

## 🗺️ 권역별 프레스티지 랜드마크 통합 리스트

"""

for region, districts in districts_data.items():
    master_content += f"## {region}\n"
    for district, items in districts.items():
        if district != "General":
            master_content += f"### {district}\n"
        
        # Identify Tier 1 items in this district (Simple matching)
        t1_in_this = []
        t2_in_this = []
        
        for item in items:
            is_t1 = False
            for t1_item in tier1_set:
                if t1_item in item or item in t1_item:
                    is_t1 = True
                    t1_in_this.append(item)
                    break
            if not is_t1:
                t2_in_this.append(item)
        
        if t1_in_this:
            master_content += f"- **[Tier 1]**: {', '.join(sorted(list(set(t1_in_this))))}\n"
        if t2_in_this:
            master_content += f"- **[Tier 2]**: {', '.join(sorted(list(set(t2_in_this))))}\n"
        master_content += "\n"

# 3. Write Master File
with open(master_path, 'w', encoding='utf-8-sig') as f:
    f.write(master_content)

print(f"Master list successfully created at {master_path}")
