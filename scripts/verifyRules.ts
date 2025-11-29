import { checkReservationRules } from '../src/utils/reservationRules';

console.log("🔍 Verifying Reservation Rules...");

const today = new Date('2025-11-29T00:00:00'); // Fixed 'Now' for testing
console.log(`📅 Today (Simulated): ${today.toISOString()}`);

// Test Case 1: Strict Weekend Rule (Blocked)
// Target: Dec 12 (Fri) - Dec 13 (Sat) 2025
// Distance: Far future (definitely > 7 days)
const dateFri = new Date('2025-12-12T00:00:00');
const dateSat = new Date('2025-12-13T00:00:00');

const result1 = checkReservationRules(dateFri, dateSat, today);
console.log(`\nTest 1: Fri(12/12) - Sat(12/13) [> D-7]`);
console.log(`Expected: Blocked (isFridayOneNight=true, isWithinDN=false)`);
console.log(`Actual:   Blocked=${result1.isBlocked}, Fri1Night=${result1.isFridayOneNight}, DN=${result1.isWithinDN}`);

if (result1.isBlocked && result1.isFridayOneNight && !result1.isWithinDN) {
    console.log("✅ PASS");
} else {
    console.error("❌ FAIL");
    process.exit(1);
}

// Test Case 2: D-N Exception (Allowed)
// Target: Dec 5 (Fri) - Dec 6 (Sat) 2025
// Wait, today is Nov 29. Dec 5 is D+6. So it should be within D-7.
const dateFriNear = new Date('2025-12-05T00:00:00');
const dateSatNear = new Date('2025-12-06T00:00:00');

const result2 = checkReservationRules(dateFriNear, dateSatNear, today);
console.log(`\nTest 2: Fri(12/05) - Sat(12/06) [<= D-7]`);
console.log(`Expected: Allowed (isBlocked=false, isWithinDN=true)`);
console.log(`Actual:   Blocked=${result2.isBlocked}, Fri1Night=${result2.isFridayOneNight}, DN=${result2.isWithinDN}`);

if (!result2.isBlocked && result2.isFridayOneNight && result2.isWithinDN) {
    console.log("✅ PASS");
} else {
    console.error("❌ FAIL");
    process.exit(1);
}

// Test Case 3: 2 Nights (Allowed)
// Target: Dec 12 (Fri) - Dec 14 (Sun)
const dateSun = new Date('2025-12-14T00:00:00');
const result3 = checkReservationRules(dateFri, dateSun, today);
console.log(`\nTest 3: Fri(12/12) - Sun(12/14) [2 Nights]`);
console.log(`Expected: Allowed (isBlocked=false)`);
console.log(`Actual:   Blocked=${result3.isBlocked}`);

if (!result3.isBlocked && !result3.isFridayOneNight) {
    console.log("✅ PASS");
} else {
    console.error("❌ FAIL");
    process.exit(1);
}

console.log("\n🎉 All Reservation Rules Verified!");
