/** ******************************************************************
 *                  Monitor test                       *
 ******************************************************************* */

const Monitor = require("../../utils/monitor").Monitor;

describe("Monitor Test Class", () => {
  beforeAll(() => {});

  afterAll(() => {});

  beforeEach(() => {});

  afterEach(() => {});

  it("Monitor Class Test", async () => {
    let monitor = new Monitor({ component: "test" });
    monitor.setXlarge(true);
    monitor.setEnvType("pool");
    expect(monitor).toHaveProperty("config.isXlarge", true);
    expect(monitor).toHaveProperty("config.envType", "pool");
  });
});
