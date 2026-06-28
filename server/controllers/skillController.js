import { getCachedSkills } from '../services/skillCacheService.js';
import { success, asyncHandler } from '../utils/response.js';

export const getSkills = asyncHandler(async (req, res) => {
  const skills = getCachedSkills();
  success(res, { skills });
});
