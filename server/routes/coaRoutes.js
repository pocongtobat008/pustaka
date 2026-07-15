import express from 'express';
import {
    getCoaHierarchy,
    searchCoa,
    createCoa,
    updateCoa,
    deleteCoa,
    deleteAllCoa,
    importCoaExcel,
    importCoaBatch,
    getCoaStats,
    downloadCoaTemplate
} from '../controllers/coaController.js';
import { upload } from '../config/upload.js';
import { checkAuth } from '../middleware/auth.js';

const router = express.Router();

if (process.env.NODE_ENV !== 'test') {
    router.use(checkAuth);
}

router.get('/', getCoaHierarchy);
router.get('/search', searchCoa);
router.get('/stats', getCoaStats);
router.get('/template', downloadCoaTemplate);
router.post('/', createCoa);
router.put('/:level/:id', updateCoa);
router.delete('/all', deleteAllCoa);
router.post('/import-batch', importCoaBatch);
router.delete('/:level/:id', deleteCoa);
router.post('/import', upload.single('file'), importCoaExcel);

export default router;
