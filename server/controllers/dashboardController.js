import { getDashboardStats } from "../services/dataService.js";
import { sendApiError } from "../utils/apiErrors.js";

export const getDashboard = async (req, res) => {
  try {
    const stats = await getDashboardStats(req.user._id);
    return res.json({ success: true, data: stats });
  } catch (error) {
    return sendApiError(res, error, 500);
  }
};
