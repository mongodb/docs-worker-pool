import { FastlyConnector } from "../../../src/services/cdn";
import c from "config";
export const UpsertEdgeDictionaryItem = async (event: any = {}): Promise<any> => {
    console.log("EVENT: \n" + JSON.stringify(event));
    const pair = {
        key: event.detail.fullDocument.name,
        value: event.detail.fullDocument.url
    }
    let resp = await FastlyConnector.upsertEdgeDictionaryItem(pair, c.get('fastlyDochubMap'), c.get('cdn_creds')['dochub']);
    console.log(resp);
    return resp;
}