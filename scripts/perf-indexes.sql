-- Performance indexes for 10M+ dataset
CREATE INDEX IF NOT EXISTS idx_da_driver_assigned ON "DeliveryAssignment"("driverId", "assignedAt");
CREATE INDEX IF NOT EXISTS idx_da_shipment ON "DeliveryAssignment"("shipmentId");
CREATE INDEX IF NOT EXISTS idx_da_vehicle ON "DeliveryAssignment"("vehicleId");
CREATE INDEX IF NOT EXISTS idx_gps_driver_created ON "GpsLog"("driverId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_gps_created ON "GpsLog"("createdAt");
CREATE INDEX IF NOT EXISTS idx_gps_vehicle ON "GpsLog"("vehicleId");
CREATE INDEX IF NOT EXISTS idx_ship_sender ON "Shipment"("senderId");
CREATE INDEX IF NOT EXISTS idx_ship_receiver ON "Shipment"("receiverId");
CREATE INDEX IF NOT EXISTS idx_ship_status ON "Shipment"("status");
CREATE INDEX IF NOT EXISTS idx_ship_created ON "Shipment"("createdAt");
