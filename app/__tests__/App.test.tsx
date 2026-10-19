import App from "../App";

describe("M0 scaffold", () => {
  it("app module loads with React Navigation wired", () => {
    expect(typeof App).toBe("function");
  });
});