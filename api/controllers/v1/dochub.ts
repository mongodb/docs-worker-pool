import { FastlyConnector } from "../../../src/services/cdn";
import { ConsoleLogger } from "../../../src/services/logger";
import { CDNCreds } from "../../../src/entities/creds";
export const UpsertEdgeDictionaryItem = async (event: any = {}): Promise<any> => {
    const pair = {
        key: event.detail.fullDocument.name,
        value: event.detail.fullDocument.url
    }
    const creds = new CDNCreds(process.env.FASTLY_DOCHUB_SERVICE_ID, process.env.FASTLY_DOCHUB_TOKEN)
    await new FastlyConnector(new ConsoleLogger()).upsertEdgeDictionaryItem(pair,process.env.FASTLY_DOCHUB_MAP, creds);
}

