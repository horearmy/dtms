const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

// All replacements for Prisma include/where/select clauses and property access
const replacements = [
  // _count select patterns
  [/\b_count:\s*\{\s*select:\s*\{\s*users:/g, '_count: { select: { User:'],
  [/\b_count:\s*\{\s*select:\s*\{\s*drivers:/g, '_count: { select: { Driver:'],
  [/\b_count:\s*\{\s*select:\s*\{\s*shipments:/g, '_count: { select: { Shipment:'],
  [/\b_count:\s*\{\s*select:\s*\{\s*assignments:/g, '_count: { select: { DeliveryAssignment:'],
  [/\b_count:\s*\{\s*select:\s*\{\s*warehouses:/g, '_count: { select: { Warehouse:'],
  [/\b_count:\s*\{\s*select:\s*\{\s*hubs:/g, '_count: { select: { Hub:'],

  // Shipment include patterns
  [/\bsender:\s*(true|{)/g, 'Customer_Shipment_senderIdToCustomer: $1'],
  [/\breceiver:\s*(true|{)/g, 'Customer_Shipment_receiverIdToCustomer: $1'],
  [/\bassignments:\s*\{/g, 'DeliveryAssignment: {'],
  [/\binclude:\s*\{\s*driver:\s*true/g, 'include: { Driver: true'],
  [/\binclude:\s*\{\s*vehicle:\s*true/g, 'include: { Vehicle: true'],
  [/\binclude:\s*\{\s*driver:\s*true,\s*vehicle:\s*true/g, 'include: { Driver: true, Vehicle: true'],
  [/\binclude:\s*\{\s*vehicle:\s*true,\s*driver:\s*true/g, 'include: { Vehicle: true, Driver: true'],

  // GeofenceEvent patterns
  [/\bgeofence:\s*(true|{)/g, 'Geofence: $1'],
  [/include:\s*\{\s*driver:\s*true\s*\}/g, 'include: { Driver: true }'],
  [/\binclude:\s*\{\s*geofence:\s*true,\s*driver:\s*true/g, 'include: { Geofence: true, Driver: true'],

  // AuditLog
  [/include:\s*\{\s*user:\s*\{/g, 'include: { User: {'],

  // DailyReport
  [/include:\s*\{\s*driver:\s*\{/g, 'include: { Driver: {'],

  // Driver
  [/include:\s*\{\s*user:\s*\{/g, 'include: { User: {'],

  // Geofence
  [/events:\s*\{/g, 'GeofenceEvent: {'],

  // Where clause nested relations
  [/\bwhere:\s*\{\s*shipment:\s*\{/g, 'where: { Shipment: {'],

  // select clause patterns
  [/select:\s*\{\s*driver:\s*\{/g, 'select: { Driver: {'],
  [/select:\s*\{\s*vehicle:\s*\{/g, 'select: { Vehicle: {'],
  [/select:\s*\{\s*shipment:\s*\{/g, 'select: { Shipment: {'],

  // JSX/TS property access
  [/\.sender\.name/g, '.Customer_Shipment_senderIdToCustomer.name'],
  [/\.receiver\.name/g, '.Customer_Shipment_receiverIdToCustomer.name'],
  [/\.receiver\.address/g, '.Customer_Shipment_receiverIdToCustomer.address'],
  [/\.receiver\.city/g, '.Customer_Shipment_receiverIdToCustomer.city'],
  [/\.receiver\.phone/g, '.Customer_Shipment_receiverIdToCustomer.phone'],
  [/\.assignments\[(\d+)\]\?\.driver\.name/g, '.DeliveryAssignment[$1]?.Driver.name'],
  [/\.assignments\[(\d+)\]\?\.vehicle\??\./g, '.DeliveryAssignment[$1]?.Vehicle?.'],
  [/\.assignments\[0\]\?\.driver\.name/g, '.DeliveryAssignment[0]?.Driver.name'],
  [/\.geofence\.name/g, '.Geofence.name'],
  [/\.geofence\.id/g, '.Geofence.id'],
  [/\.driver\.name/g, '.Driver.name'],
  [/_count\.users/g, '_count.User'],
  [/_count\.drivers/g, '_count.Driver'],
  [/_count\.shipments/g, '_count.Shipment'],
  [/_count\.assignments/g, '_count.DeliveryAssignment'],
  [/_count\.warehouses/g, '_count.Warehouse'],
  [/_count\.hubs/g, '_count.Hub'],
  [/\.organization\?\.name/g, '.Organization?.name'],
  [/\.region\?\.name/g, '.Region?.name'],

  // Shipment property access from DeliveryAssignment
  [/activeAssignment\?\.shipment\b/g, 'activeAssignment?.Shipment'],
  [/activeAssignment\.shipment\./g, 'activeAssignment.Shipment.'],
  [/latestAssignment\?\.vehicle\b/g, 'latestAssignment?.Vehicle'],
  [/latestAssignment\.vehicle\./g, 'latestAssignment.Vehicle.'],
  [/\.vehicle\?\.vehicleNumber/g, '.Vehicle?.vehicleNumber'],

  // pods → ProofOfDelivery
  [/\.pods\[0\]/g, '.ProofOfDelivery'],
  [/pods:\s*true/g, 'ProofOfDelivery: true'],

  // events → TrackingEvent (on Shipment) or ShipmentEvent
  [/shipment\.events\[0\]/g, 'shipment.ShipmentEvent[0]'],
  [/\.events\[0\]/g, '.TrackingEvent[0]'],

  // driver.user
  [/driver\.user\?/g, 'driver.User?'],
  [/\.user\?\.username/g, '.User?.username'],

  // t.shipment
  [/t\.shipment\.trackingNumber/g, 't.Shipment.trackingNumber'],

  // gpsLogs → GpsLog
  [/gpsLogs:\s*\{/g, 'GpsLog: {'],

  // Notification where
  [/\bshipment:\s*\{\s*tenantId/g, 'Shipment: { tenantId'],

  // Branch include
  [/organization:\s*\{/g, 'Organization: {'],
  [/region:\s*\{/g, 'Region: {'],
];

let totalFixed = 0;

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      for (const [pattern, replacement] of replacements) {
        content = content.replace(pattern, replacement);
      }
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`FIXED: ${path.relative(path.join(__dirname, '..'), fullPath)}`);
        totalFixed++;
      }
    }
  }
}

walkDir(srcDir);
console.log(`\nTotal files fixed: ${totalFixed}`);
