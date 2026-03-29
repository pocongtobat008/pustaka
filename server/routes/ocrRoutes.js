import express from 'express';
import {
    getOCRStatus,
    getOCRQueue,
    getLaneLoad,
    retryOCRJob,
    requeueDocument,
    clearCompletedJobs
} from '../controllers/ocrController.js';

import { checkAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(checkAuth);

router.get('/status', getOCRStatus);
router.get('/queue', getOCRQueue);
router.get('/lanes', getLaneLoad);
router.post('/retry/:id', retryOCRJob);
router.post('/requeue/document/:docId', requeueDocument);
router.delete('/completed', clearCompletedJobs);

export default router;
