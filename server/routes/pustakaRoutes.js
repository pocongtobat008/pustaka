import express from 'express';
import {
    getGuides,
    getCategories,
    createGuide,
    updatePustakaGuide,
    deletePustakaGuide,
    getGuideSlides,
    createPustakaSlide,
    deleteSlidesByGuideId
} from '../controllers/pustakaController.js';

import { checkAuth } from '../middleware/auth.js';

const router = express.Router();

// In tests we mount routes directly without auth; keep auth enabled outside test
if (process.env.NODE_ENV !== 'test') {
    router.use(checkAuth);
}

router.get('/guides', getGuides);
router.get('/categories', getCategories);
router.post('/guides', createGuide);
router.put('/guides/:id', updatePustakaGuide);
router.delete('/guides/:id', deletePustakaGuide);

// Slides
router.get('/guides/:id/slides', getGuideSlides);
router.post('/slides', createPustakaSlide);
router.delete('/slides/by-guide/:guideId', deleteSlidesByGuideId);

export default router;
