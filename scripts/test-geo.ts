// Quick sanity test of the geo service (run with npx tsx)
import {
  haversineKm,
  zoneFromAddress,
  nearestZone,
  inServiceArea,
  geofenceStatus,
  orderDistanceKm,
} from '../../Kozy-Dryclean/src/lib/geo'

function approx(a: number, b: number, tol = 0.5) {
  return Math.abs(a - b) <= tol
}

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ FAIL: ${name} ${extra}`) }
}

console.log('--- haversine ---')
// Lekki Phase 1 -> VI ≈ 6.5 km
check('Lekki->VI ~6.5km', approx(haversineKm(6.4392, 3.4712, 6.4281, 3.4219), 6.5, 1.5))
check('same point = 0', haversineKm(6.5, 3.4, 6.5, 3.4) === 0)
// Lagos -> London ~5000+ km (sanity for scale)
check('Lagos->London > 4500km', haversineKm(6.5, 3.4, 51.5, -0.12) > 4500)

console.log('--- zoneFromAddress ---')
check('"12 Admiralty Way, Lekki Phase 1" -> Lekki', zoneFromAddress('12 Admiralty Way, Lekki Phase 1, Lagos')?.name === 'Lekki')
check('"3 Ozumba Mbadiwe, Victoria Island" -> VI', zoneFromAddress('3 Ozumba Mbadiwe Ave, Victoria Island')?.name === 'Victoria Island')
check('"5 Banana Island Road" -> Ikoyi (longest keyword wins)', zoneFromAddress('5 Banana Island Road, Ikoyi')?.name === 'Ikoyi')
check('"22 Allen Avenue, Ikeja" -> Ikeja', zoneFromAddress('22 Allen Avenue, Ikeja')?.name === 'Ikeja')
check('"1 Ojota" -> Maryland', zoneFromAddress('1 Ojota, Kosofe')?.name === 'Maryland')
check('"14 Sangotedo, Ajah" -> Ajah', zoneFromAddress('14 Sangotedo, Ajah')?.name === 'Ajah')
check('"7 Bode Thomas, Surulere" -> Surulere', zoneFromAddress('7 Bode Thomas St, Surulere')?.name === 'Surulere')
check('no match -> null', zoneFromAddress('Nowhere Street, Uyo') === null)
check('empty -> null', zoneFromAddress('') === null)
check('"Oviedo" does NOT match "vi" keyword (word boundary)', zoneFromAddress('Oviedo Street') === null)
check('"Lagos VI island" matches VI', zoneFromAddress('Lagos VI island')?.name === 'Victoria Island')

console.log('--- geofence status ---')
// Rider standing in Lekki Phase 1
const lekki = geofenceStatus(6.4392, 3.4712)
check('rider in Lekki -> inServiceArea', lekki.inServiceArea === true, JSON.stringify(lekki))
check('rider in Lekki -> zone Lekki', lekki.zone === 'Lekki')
// Rider in Ikorodu (far north-east, ~25km+ from nearest zone)
const ikorodu = geofenceStatus(6.6194, 3.5105)
check('rider in Ikorodu -> outside', ikorodu.inServiceArea === false, JSON.stringify(ikorodu))
// Rider in Abuja (way out)
const abuja = geofenceStatus(9.0579, 7.4951)
check('rider in Abuja -> outside', abuja.inServiceArea === false, `dist=${abuja.distanceKm}`)
check('rider in Abuja -> very far', abuja.distanceKm > 400)

console.log('--- order distance / visibility ---')
// Driver in VI, order in Lekki -> ~6.5km -> visible within 12km
const d1 = orderDistanceKm(6.4281, 3.4219, '12 Admiralty Way, Lekki Phase 1')
check('VI rider -> Lekki order ~6.5km', d1 !== null && approx(d1.distanceKm, 6.5, 1.5), JSON.stringify(d1))
// Driver in Ikeja, order in Lekki -> ~22km -> hidden (beyond 12km) and blocked (>15km)
const d2 = orderDistanceKm(6.6018, 3.3515, '12 Admiralty Way, Lekki Phase 1')
check('Ikeja rider -> Lekki order ~22km (hidden + blocked)', d2 !== null && d2.distanceKm > 15, JSON.stringify(d2))
// Unknown address -> null (always visible / never blocked)
check('unknown address -> null', orderDistanceKm(6.5, 3.4, 'Mystery Road') === null)

console.log('--- nearestZone ---')
check('nearest to Ikeja coords is Ikeja', nearestZone(6.6018, 3.3515).zone.name === 'Ikeja')
check('nearest to VI coords is VI', nearestZone(6.4281, 3.4219).zone.name === 'Victoria Island')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
