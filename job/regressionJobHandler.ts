import { ProductionJobHandler } from "./productionJobHandler";

export class RegressionJobHandler extends ProductionJobHandler {
    publish():  Promise<void> {
        throw new Error("Method not implemented.");
    }
}