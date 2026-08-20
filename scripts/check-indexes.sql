SELECT indexname FROM pg_indexes WHERE tablename = 'Shipment' AND schemaname = 'public';
SELECT indexname FROM pg_indexes WHERE tablename = 'DeliveryAssignment' AND schemaname = 'public';
SELECT indexname FROM pg_indexes WHERE tablename = 'GpsLog' AND schemaname = 'public';
