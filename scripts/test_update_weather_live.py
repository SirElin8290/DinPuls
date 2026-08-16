#!/usr/bin/env python3
import unittest

import update_weather_live


class WeatherLiveTests(unittest.TestCase):
    def test_parse_nowcast_keeps_current_and_timeline(self):
        payload = {"properties": {"meta": {"updated_at": "2026-08-16T06:00:00Z", "radar_coverage": "ok"}, "timeseries": [
            {"time": "2026-08-16T06:00:00Z", "data": {
                "instant": {"details": {"air_temperature": 17.2, "wind_speed": 4.1, "relative_humidity": 88, "precipitation_rate": 6.5}},
                "next_1_hours": {"details": {"precipitation_amount": 8.2}, "summary": {"symbol_code": "heavyrainandthunder"}},
            }}
        ]}}
        result = update_weather_live.parse_nowcast(payload)
        self.assertEqual(result["radarCoverage"], "ok")
        self.assertEqual(result["current"]["precipitationRate"], 6.5)
        self.assertEqual(result["current"]["symbolCode"], "heavyrainandthunder")

    def test_lightning_is_only_checked_during_active_weather(self):
        dry = {"timeline": [{"symbolCode": "partlycloudy_day", "precipitationRate": 0, "precipitationAmount": 0}]}
        wet = {"timeline": [{"symbolCode": "rainshowers_day", "precipitationRate": 0.3, "precipitationAmount": 0.4}]}
        self.assertFalse(update_weather_live.should_check_lightning(dry))
        self.assertTrue(update_weather_live.should_check_lightning(wet))

    def test_parse_lightning_reports_distance_and_ground_strikes(self):
        payload = {"response": [
            {"relativeTo": {"distanceKM": 2.37}, "ob": {"pulse": {"type": "cg"}}},
            {"relativeTo": {"distanceKM": 8.1}, "ob": {"pulse": {"type": "ic"}}},
        ]}
        result = update_weather_live.parse_lightning(payload, "2026-08-16T06:00:00Z")
        self.assertEqual(result["count"], 2)
        self.assertEqual(result["groundStrikes"], 1)
        self.assertEqual(result["nearestKm"], 2.4)


if __name__ == "__main__":
    unittest.main()
