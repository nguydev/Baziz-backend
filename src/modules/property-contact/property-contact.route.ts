/**
 * Property Contact Routes
 * Mounted at /api/v1/properties/:propertyId/contacts
 */

import { Router } from 'express';
import * as propertyContactController from './property-contact.controller';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router({ mergeParams: true });

router.post('/', apiLimiter, propertyContactController.createPropertyContact);
router.get('/', propertyContactController.listPropertyContacts);
router.get('/:contactId', propertyContactController.getPropertyContactById);
router.patch('/:contactId', apiLimiter, propertyContactController.updatePropertyContact);
router.delete('/:contactId', propertyContactController.deletePropertyContact);

export default router;
