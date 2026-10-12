import { Router } from 'express';
import authRoutes from '../modules/auth/auth.route';
import userRoutes from '../modules/user/user.route';
import tenantRoutes from '../modules/tenant/tenant.route';
import propertyRoutes from '../modules/property/property.route';
import taskRoutes from '../modules/task/task.route';
import contactRoutes from '../modules/contact/contact.route';
import maintenanceRequestRoutes from '../modules/maintenance-request/maintenance-request.route';
import monthlyBillRoutes from '../modules/monthly-bill/monthly-bill.route';
import complaintRoutes from '../modules/complaint/complaint.route';
import propertyDocumentRoutes from '../modules/property-document/property-document.route';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tenants', tenantRoutes);
router.use('/properties', propertyRoutes);
router.use('/tasks', taskRoutes);
router.use('/contacts', contactRoutes);
router.use('/maintenance-requests', maintenanceRequestRoutes);
router.use('/monthly-bills', monthlyBillRoutes);
router.use('/complaints', complaintRoutes);
router.use('/properties/:propertyId/documents', propertyDocumentRoutes);

export default router;
