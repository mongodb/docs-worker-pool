export const UpsertEdgeDictionaryItem = async (event: any = {}): Promise<any> => {
    console.log("EVENT: \n" + JSON.stringify(event));
    const response = JSON.stringify(event, null, 2);
    return response;
}