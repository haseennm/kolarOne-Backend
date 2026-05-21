import { AppError } from "../../utils/AppError";
import { RecentActivityRequest, RecentActivityItem } from "./recent-activity.types";
import RecentActivityService from "./recent-activity.service";

export default class RecentActivityController {
  async fetchRecentActivity(
    data: RecentActivityRequest
  ): Promise<RecentActivityItem[]> {
    if (!data || typeof data !== "object") {
      throw new AppError("Request body is required", 400);
    }

    const { entity_id, entity_type } = data;

    if (typeof entity_id !== "number" || Number.isNaN(entity_id)) {
      throw new AppError("entity_id must be a valid number", 400);
    }

    if (!entity_type || !["C", "B", "F"].includes(entity_type)) {
      throw new AppError("entity_type must be one of C, B, or F", 400);
    }

    const service = new RecentActivityService();
    return service.fetchRecentActivity(data);
  }
}
