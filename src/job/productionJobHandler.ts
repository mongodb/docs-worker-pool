import { JobHandler } from "./jobHandler";

export class ProductionJobHandler extends JobHandler {
    throwIfJobInvalid(): void {
        throw new Error("Method not implemented.");
    }
    async prepCommands(): Promise<string[]> {
        throw new Error("Method not implemented.");
    }
    async build(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    async publish(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}