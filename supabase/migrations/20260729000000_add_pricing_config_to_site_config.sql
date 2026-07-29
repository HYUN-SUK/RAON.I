-- Add pricing_config JSONB column to site_config table for dynamic pricing & peak season management
ALTER TABLE site_config 
ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT '{
  "weekday": 40000,
  "weekend": 70000,
  "peakWeekday": 50000,
  "peakWeekend": 70000,
  "extraFamily": 35000,
  "visitor": 10000,
  "longStayDiscount": 10000,
  "seasons": [
    { "name": "Summer Peak", "startMonth": 6, "startDay": 1, "endMonth": 9, "endDay": 30 }
  ]
}'::jsonb;

COMMENT ON COLUMN site_config.pricing_config IS 'JSON object storing base rates, extra option costs, and peak season date ranges';
