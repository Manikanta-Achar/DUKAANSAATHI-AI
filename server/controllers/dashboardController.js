import { getDashboardStats } from "../services/dataService.js";

export const getDashboard = async (_req, res) => {
  try {
    const stats = await getDashboardStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error in getDashboard:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};
