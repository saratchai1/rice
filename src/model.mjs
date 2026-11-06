export const PROJECT_COUNT = 300;
export const PLANT_FOOTPRINT = { lengthM: 15, widthM: 10 };
export const ASSETS = [
  { id: 1, code: 'RCV-01', short: 'Receiving hopper', thai: 'ชุดกระบะรับข้าว', cost: 150000, color: '#e9b86a', sensor: 'ระดับข้าว / อัตราป้อน', icon: 'inbox' },
  { id: 2, code: 'CLN-02', short: 'Pre-cleaner', thai: 'เครื่องร่อนทำความสะอาด + ต้นกระพ้อ', cost: 700000, color: '#5bd6bf', sensor: 'กระแสมอเตอร์ / การสั่น', icon: 'filter' },
  { id: 3, code: 'DRY-03', short: 'Biomass dryer', thai: 'เครื่องอบเมล็ดพันธุ์ + เตาชีวมวล', cost: 4250000, color: '#ffae66', sensor: 'อุณหภูมิ / ความชื้น / พลังงาน', icon: 'thermometer' },
  { id: 4, code: 'SIL-04', short: '3 × 20 t silos', thai: 'ไซโล 20 ตัน × 3 / ชุดลำเลียง', cost: 2700000, color: '#74d9d4', sensor: 'ระดับ / อุณหภูมิเมล็ด / CO₂', icon: 'database' },
  { id: 5, code: 'SRT-05', short: 'Seed grader', thai: 'เครื่องคัดเมล็ดพันธุ์ 1 ตัน/ชั่วโมง', cost: 850000, color: '#b0dc7e', sensor: 'อัตราคัด / การสั่น / มอเตอร์', icon: 'scan' },
  { id: 6, code: 'MDB-06', short: 'Control cabinet', thai: 'ตู้ควบคุมเครื่องจักร MDB', cost: 350000, color: '#90a6ff', sensor: 'ไฟฟ้า / กระแส / Power quality', icon: 'zap' },
  { id: 7, code: 'PKG-07', short: 'Bagging station', thai: 'เครื่องแพ็กกระสอบ 5–50 กก.', cost: 700000, color: '#c7a7ff', sensor: 'น้ำหนัก / จำนวนกระสอบ / Jam', icon: 'package' },
  { id: 8, code: 'PV-08', short: 'Solar + inverter', thai: 'ระบบโซลาร์ + Inverter + Dongle', cost: 2100000, color: '#ffd16e', sensor: 'ผลิตไฟ / Inverter / Self-consumption', icon: 'sun' },
];
export const CAPEX_PER_SITE = ASSETS.reduce((sum, item) => sum + item.cost, 0);
export const NATIONAL_NOMINAL_CAPEX = CAPEX_PER_SITE * PROJECT_COUNT;

export const REGIONS = [
  { id: 'north', name: 'ภาคเหนือ', en: 'NORTH', color: '#55dbcb', x: 217, y: 104,
    provinces: 'เชียงใหม่,เชียงราย,ลำพูน,ลำปาง,แม่ฮ่องสอน,น่าน,พะเยา,แพร่,อุตรดิตถ์' },
  { id: 'northeast', name: 'ภาคตะวันออกเฉียงเหนือ', en: 'NORTHEAST', color: '#92b2ff', x: 340, y: 144,
    provinces: 'กาฬสินธุ์,ขอนแก่น,ชัยภูมิ,นครพนม,นครราชสีมา,บึงกาฬ,บุรีรัมย์,มหาสารคาม,มุกดาหาร,ยโสธร,ร้อยเอ็ด,เลย,ศรีสะเกษ,สกลนคร,สุรินทร์,หนองคาย,หนองบัวลำภู,อำนาจเจริญ,อุดรธานี,อุบลราชธานี' },
  { id: 'central', name: 'ภาคกลาง', en: 'CENTRAL', color: '#e9c780', x: 263, y: 242,
    provinces: 'กรุงเทพมหานคร,กำแพงเพชร,ชัยนาท,นครนายก,นครปฐม,นครสวรรค์,นนทบุรี,ปทุมธานี,พระนครศรีอยุธยา,พิจิตร,พิษณุโลก,เพชรบูรณ์,ลพบุรี,สมุทรปราการ,สมุทรสงคราม,สมุทรสาคร,สระบุรี,สิงห์บุรี,สุโขทัย,สุพรรณบุรี,อ่างทอง,อุทัยธานี' },
  { id: 'east', name: 'ภาคตะวันออก', en: 'EAST', color: '#d6a5ff', x: 345, y: 303,
    provinces: 'จันทบุรี,ฉะเชิงเทรา,ชลบุรี,ตราด,ปราจีนบุรี,ระยอง,สระแก้ว' },
  { id: 'west', name: 'ภาคตะวันตก', en: 'WEST', color: '#84baef', x: 183, y: 277,
    provinces: 'กาญจนบุรี,ตาก,ประจวบคีรีขันธ์,เพชรบุรี,ราชบุรี' },
  { id: 'south', name: 'ภาคใต้', en: 'SOUTH', color: '#ed9a92', x: 210, y: 415,
    provinces: 'กระบี่,ชุมพร,ตรัง,นครศรีธรรมราช,นราธิวาส,ปัตตานี,พังงา,พัทลุง,ภูเก็ต,ยะลา,ระนอง,สงขลา,สตูล,สุราษฎร์ธานี' },
];

export const PROVINCES = REGIONS.flatMap(region => region.provinces.split(',').map(name => ({ name, region: region.id })));

// Explicitly synthetic project registry. Replace with the approved 300-site master list.
export function generateDemoSites(count = PROJECT_COUNT) {
  const locations = PROVINCES.map(p => ({ ...p, seen: 0 }));
  const sites = [];
  for (let i = 0; i < count; i++) {
    const p = locations[i % locations.length];
    p.seen++;
    const n = i + 1;
    const status = n % 67 === 0 ? 'offline' : n % 41 === 0 ? 'critical' : (n % 13 === 0 || n % 17 === 0) ? 'warning' : 'healthy';
    sites.push({
      id: `RICE-${String(n).padStart(3, '0')}`,
      province: p.name,
      region: p.region,
      name: `ศูนย์เมล็ดพันธุ์ข้าว ${p.name} · ${String(p.seen).padStart(2, '0')}`,
      status,
      health: status === 'healthy' ? 82 + (n % 17) : status === 'warning' ? 60 + (n % 16) : status === 'critical' ? 25 + (n % 30) : null,
      assets: ASSETS.length,
      demo: true,
    });
  }
  return sites;
}

export const DEMO_SITES = generateDemoSites();

export function getFleetStats(sites = DEMO_SITES) {
  const counts = { healthy: 0, warning: 0, critical: 0, offline: 0 };
  for (const site of sites) counts[site.status] = (counts[site.status] || 0) + 1;
  return { sites: sites.length, assets: sites.length * ASSETS.length, ...counts };
}

const inRange = (value, low, high) => Math.min(high, Math.max(low, Number.isFinite(+value) ? +value : low));

// Wet-basis mass balance. Thermal values are explicitly illustrative assumptions, not equipment specs.
export function calculateDrying(input = {}) {
  const inletMoisture = inRange(input.inletMoisture ?? 24, 5, 45);
  const outletMoisture = inRange(input.outletMoisture ?? 14, 5, inletMoisture);
  const feedTph = inRange(input.feedTph ?? 2.8, 0, 10);
  const solarKwp = inRange(input.solarKwp ?? 60, 0, 200);
  const solarFactor = inRange(input.solarFactor ?? 0.72, 0, 1);
  const drySolidsTph = feedTph * (1 - inletMoisture / 100);
  const outputTph = drySolidsTph / (1 - outletMoisture / 100);
  const evaporatedKgH = Math.max(0, (feedTph - outputTph) * 1000);
  const assumedSpecificEnergyMjKg = 2.8;
  const assumedBiomassLhvMjKg = 14;
  const assumedThermalEfficiency = 0.55;
  const heatKw = evaporatedKgH * assumedSpecificEnergyMjKg / 3.6;
  const biomassKgH = evaporatedKgH * assumedSpecificEnergyMjKg / (assumedBiomassLhvMjKg * assumedThermalEfficiency);
  const electricalDemandKw = feedTph > 0 ? 9 + 4.5 * feedTph : 2;
  const solarKw = solarKwp * solarFactor * 0.82;
  const solarUsedKw = Math.min(electricalDemandKw, solarKw);
  const gridKw = Math.max(0, electricalDemandKw - solarUsedKw);
  return { inletMoisture, outletMoisture, feedTph, outputTph, evaporatedKgH, heatKw, biomassKgH,
    electricalDemandKw, solarKwp, solarKw, solarUsedKw, gridKw,
    warnings: [
      ...(inletMoisture <= outletMoisture ? ['ความชื้นเป้าหมายไม่ต่ำกว่าขาเข้า จึงไม่มีการระเหยน้ำ'] : []),
      ...(feedTph > 1 ? ['อัตราป้อนเป็นสมมติฐานเพื่อจำลอง: เครื่องคัดเมล็ดพันธุ์ในข้อมูลตั้งต้นระบุ 1 ตัน/ชั่วโมง'] : []),
    ],
  };
}

export const DEMO_TEAMS = REGIONS.map((region, i) => ({ id: `TEAM-${i + 1}`, region: region.id, name: `Ditto · ${region.name} (DEMO)`, capacity: 2 + (i % 3) }));
export const WORKFLOW = ['new', 'assigned', 'in_progress', 'done'];
export const WORKFLOW_LABELS = { new: 'รับแจ้ง', assigned: 'มอบหมาย', in_progress: 'กำลังซ่อม', done: 'ปิดงาน' };

export function makeWorkOrder({ siteId, assetId, priority = 'medium', description = '', id, createdAt }, sites = DEMO_SITES) {
  const site = sites.find(item => item.id === siteId);
  if (!site) throw new Error('Unknown site');
  const asset = ASSETS.find(item => item.id === Number(assetId));
  if (!asset) throw new Error('Unknown asset');
  if (!['high', 'medium', 'low'].includes(priority)) throw new Error('Invalid priority');
  return { id: id || `WO-${Date.now()}`, siteId, assetId: asset.id, priority, description: String(description).slice(0, 800),
    status: 'new', region: site.region, teamId: null, createdAt: createdAt || new Date().toISOString(), updatedAt: createdAt || new Date().toISOString(), demo: true };
}

export function advanceWorkOrder(order, teamId = null) {
  const index = WORKFLOW.indexOf(order.status);
  if (index < 0) throw new Error('Invalid workflow status');
  if (index === WORKFLOW.length - 1) return { ...order };
  const status = WORKFLOW[index + 1];
  const nextTeam = teamId || order.teamId;
  if (status === 'assigned' && !DEMO_TEAMS.some(team => team.id === nextTeam && team.region === order.region)) {
    throw new Error('Assign a demo team from the same region');
  }
  return { ...order, status, teamId: nextTeam, updatedAt: new Date().toISOString() };
}

export function seedWorkOrders(sites = DEMO_SITES) {
  const targets = sites.filter(site => site.status === 'critical' || site.status === 'warning').slice(0, 13);
  return targets.map((site, i) => {
    const order = makeWorkOrder({ siteId: site.id, assetId: [3, 2, 4, 6, 5][i % 5],
      priority: site.status === 'critical' ? 'high' : 'medium',
      description: ['ตรวจสอบอุณหภูมิทางออกเครื่องอบผิดช่วง', 'Vibration สูงกว่าค่าเตือน', 'ตรวจเซนเซอร์ระดับไซโล', 'ตรวจคุณภาพไฟฟ้า', 'ตรวจเครื่องคัดเมล็ดพันธุ์'][i % 5],
      id: `WO-DEMO-${String(i + 1).padStart(3, '0')}`, createdAt: new Date(Date.now() - i * 33e5).toISOString() }, sites);
    if (i % 4 === 1) return { ...order, status: 'assigned', teamId: DEMO_TEAMS.find(t => t.region === site.region)?.id };
    if (i % 4 === 2) return { ...order, status: 'in_progress', teamId: DEMO_TEAMS.find(t => t.region === site.region)?.id };
    return order;
  });
}
