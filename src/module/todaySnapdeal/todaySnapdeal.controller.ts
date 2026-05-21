import { TodaySnapdealRequest, TodaySnapdealResponseData } from "./todaySnapdeal.types";
import TodaySnapdealService from "./todaySnapdeal.service";

export default class TodaySnapdealController {
  async fetchSnapshot(
    body: TodaySnapdealRequest
  ): Promise<TodaySnapdealResponseData> {
    const service = new TodaySnapdealService();
    return service.getTodayFinancialSnapshot(body);
  }
}
