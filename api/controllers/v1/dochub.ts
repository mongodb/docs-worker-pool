import { FastlyConnector } from "../../../src/services/cdn";
import c from "config";
import { ConsoleLogger } from "../../../src/services/logger";
import { CDNCreds } from "../../../src/entities/creds";
export const UpsertEdgeDictionaryItem = async (event: any = {}): Promise<any> => {
    const pair = {
        key: event.detail.fullDocument.name,
        value: event.detail.fullDocument.url
    }
    await new FastlyConnector(new ConsoleLogger).upsertEdgeDictionaryItem(pair, c.get('fastlyDochubMap'),
    new CDNCreds(c.get('cdn_creds')['dochub']['id'], c.get('cdn_creds')['dochub']['token']));
}