import { FastlyConnector } from "../../../src/services/cdn";
import c from "config";
import { ConsoleLogger } from "../../../src/services/logger";
export const UpsertEdgeDictionaryItem = async (event: any = {}): Promise<any> => {
    const pair = {
        key: event.detail.fullDocument.name,
        value: event.detail.fullDocument.url
    }
    await new FastlyConnector(new ConsoleLogger).upsertEdgeDictionaryItem(pair, c.get('fastlyDochubMap'), c.get('cdn_creds')['dochub']);
}